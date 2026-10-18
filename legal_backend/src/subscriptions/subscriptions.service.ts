import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AIBudgetPolicyService } from '@/cost-monitoring/ai-budget-policy.service';
import { getCountryConfig } from '@/config/countries';
import {
  comparePlanChange,
  mapBillingPlanToPlanId,
  mapPlanIdToBillingPlan,
  normalizeBillingPlan,
} from '@/config/billing-plans';
import {
  getStripePriceId,
  shouldUseStripeSubscriptionCheckout,
} from '@/config/stripe-prices.config';
import { USER_TYPES } from '@/auth/constants';
import { CurrencyFxService } from '@/config/currency-fx.service';
import { FX_MARKUP_PERCENT, getCountryPricingTier } from '@/config/currency-fx.util';
import {
  COUNTRY_PRICING_SEEDS,
  PRICING_PLANS,
  DEVELOPING_USD_BASE_PLANS,
  findDevelopingUsdBasePlan,
  filterPublicPricingPlans,
  getPricingForCountry,
  isNativeInrPricingCountry,
  isRetiredPricingPlan,
} from '@/config/pricing.config';
import { computePlanCreditsFromPrice, computePlanCreditsForTier } from '@/ai-credits/credit-pricing.util';
import { PrismaService } from '@/prisma/prisma.service';
import { StripeService, toStripeMinorUnits } from '@/payments/stripe.service';
import { ReferralsService } from '@/referrals/referrals.service';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { resolveAppUrl } from '@/common/app-url';
import {
  IntroOfferStatusDto,
  PAID_SUBSCRIPTION_STATUSES,
  applyIntroOfferDiscount,
  computeIntroOfferExpiry,
  computeIntroOfferTimeRemaining,
  getIntroOfferDays,
  getIntroOfferDiscountPercent,
  resolveIntroOfferCouponId,
} from './intro-offer.util';

type PricingPlan = {
  countryCode: string;
  userType: string;
  planId: string;
  currency: string;
  amount: Prisma.Decimal;
  aiCredits: number;
  features: Record<string, boolean | number | string>;
};

export type CurrentBillingDto = {
  userType: 'LAW_FIRM' | 'CONSUMER';
  billingPlan: string | null;
  planTier: string;
  planId: string;
  subscriptionStatus: string | null;
  countryCode: string;
  hasStripeSubscription: boolean;
  canManageInPortal: boolean;
  stripeCustomerId: string | null;
  providerSubscriptionId: string | null;
};

export type ConfirmCheckoutResultDto = {
  activated: boolean;
  alreadyActive: boolean;
  planId: string;
  planLabel: string;
  aiCredits: number;
  /** Credits added to the wallet on this confirmation (0 if already active). */
  creditsGranted: number;
  amount: number;
  currency: string;
  currentPeriodEnd: string | null;
  billing: CurrentBillingDto;
};

const PLAN_DISPLAY_LABELS: Record<string, string> = {
  consumer_free: 'Free',
  consumer_plus: 'Plus',
  lawyer_solo: 'Solo',
  firm_starter: 'Starter',
  firm_professional: 'Professional',
  firm_pro_plus: 'Pro Plus',
  firm_enterprise: 'Enterprise',
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly referralsService: ReferralsService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly budgetPolicy: AIBudgetPolicyService,
    private readonly currencyFx: CurrencyFxService,
  ) {}

  async listPlans(userType?: string) {
    const dbPlans = await this.prisma.countryPricing.findMany({
      where: {
        isActive: true,
        userType: userType?.toUpperCase(),
      },
      orderBy: [{ countryCode: 'asc' }, { amount: 'asc' }],
    });

    if (dbPlans.length > 0) {
      return filterPublicPricingPlans(dbPlans);
    }

    return filterPublicPricingPlans(
      COUNTRY_PRICING_SEEDS.filter((plan) =>
        userType ? plan.userType === userType.toUpperCase() : true,
      ),
    );
  }

  async listPricingByCountry(countryCode?: string) {
    const normalized = (countryCode ?? 'US').toUpperCase();
    const country = getCountryConfig(normalized);
    const basePlans = this.loadCanonicalDevelopingPlans();
    const plans = await Promise.all(
      basePlans.map((plan) => this.localizePlanForCountry(plan, normalized)),
    );
    const fxMeta =
      country.currency === 'USD'
        ? { rate: 1, source: 'fallback' as const }
        : await this.currencyFx.getRateMetadata(country.currency);

    return {
      countryCode: normalized,
      currency: country.currency,
      pricingCurrency: 'USD',
      fxMarkupPercent: FX_MARKUP_PERCENT,
      fxRate: fxMeta.rate,
      fxSource: fxMeta.source,
      plans: filterPublicPricingPlans(
        plans.map((plan) => ({
          ...plan,
          amount: Number(plan.amount),
          features: plan.features,
          checkoutEligible:
            !plan.features.contactSales && !isRetiredPricingPlan(plan.planId),
        })),
      ),
    };
  }

  async getCurrentBilling(userId: string, tenantId?: string): Promise<CurrentBillingDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { consumerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const activeSub = await this.prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });

      return this.buildCurrentBillingDto({
        userType: 'LAW_FIRM',
        billingPlan: tenant.billingPlan,
        planId:
          activeSub?.planId ?? mapBillingPlanToPlanId(tenant.billingPlan, 'LAW_FIRM'),
        subscriptionStatus: activeSub?.status ?? null,
        countryCode: tenant.primaryCountry,
        stripeCustomerId: tenant.stripeCustomerId,
        providerSubscriptionId: activeSub?.providerSubscriptionId ?? null,
        paymentProvider: activeSub?.paymentProvider ?? null,
      });
    }

    if (user.userType === USER_TYPES.LAWYER) {
      const membership = await this.prisma.tenantUser.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      });

      if (membership?.tenant) {
        return this.getCurrentBilling(userId, membership.tenantId);
      }
    }

    const profile = user.consumerProfile;
    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });

    const subscriptionStatus = profile?.subscriptionStatus ?? 'FREE';
    const planId =
      activeSub?.planId ??
      mapBillingPlanToPlanId(subscriptionStatus, 'CONSUMER');

    return this.buildCurrentBillingDto({
      userType: 'CONSUMER',
      billingPlan: subscriptionStatus,
      planId,
      subscriptionStatus: activeSub?.status ?? subscriptionStatus,
      countryCode: profile?.countryCode ?? user.countryCode ?? 'US',
      stripeCustomerId: profile?.stripeCustomerId ?? null,
      providerSubscriptionId: activeSub?.providerSubscriptionId ?? null,
      paymentProvider: activeSub?.paymentProvider ?? null,
    });
  }

  /**
   * Confirms a Stripe Checkout session after redirect — activates the subscription
   * when the webhook has not yet fired (common in dev / delayed webhook delivery).
   */
  async confirmCheckoutSession(
    userId: string,
    tenantId: string | undefined,
    sessionId: string,
  ): Promise<ConfirmCheckoutResultDto> {
    const trimmed = sessionId?.trim();
    if (!trimmed?.startsWith('cs_')) {
      throw new BadRequestException('Invalid checkout session id');
    }

    const session = await this.stripeService.retrieveCheckoutSession(trimmed);
    const isPaid =
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required' ||
      session.status === 'complete';

    if (!isPaid) {
      throw new BadRequestException('Checkout session is not paid yet');
    }

    const meta = session.metadata ?? {};
    let internalId: string | undefined = meta['subscriptionId'];

    let subscription = internalId
      ? await this.prisma.subscription.findUnique({ where: { id: internalId } })
      : null;

    if (!subscription) {
      subscription = await this.prisma.subscription.findFirst({
        where: { providerSubscriptionId: trimmed },
        orderBy: { updatedAt: 'desc' },
      });
      internalId = subscription?.id;
    }

    if (!subscription || !internalId) {
      throw new NotFoundException('Subscription not found for this checkout');
    }

    if (tenantId) {
      if (subscription.tenantId !== tenantId) {
        throw new ForbiddenException('Checkout session does not belong to this workspace');
      }
    } else if (subscription.tenantId) {
      const membership = await this.prisma.tenantUser.findFirst({
        where: { tenantId: subscription.tenantId, userId },
        select: { id: true },
      });
      if (!membership) {
        throw new ForbiddenException('Checkout session does not belong to this user');
      }
    } else if (subscription.userId !== userId) {
      throw new ForbiddenException('Checkout session does not belong to this user');
    }

    const stripeSubId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    let periodEnd: Date | undefined;
    if (stripeSubId) {
      try {
        const stripeSub = await this.stripeService.retrieveSubscription(stripeSubId);
        if (stripeSub.current_period_end) {
          periodEnd = new Date(stripeSub.current_period_end * 1000);
        }
      } catch (err) {
        this.logger.warn(
          `confirmCheckout: could not load Stripe subscription ${stripeSubId}: ${err}`,
        );
      }
    }

    const alreadyActive = subscription.status === 'ACTIVE';
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    await this.activateSubscription(internalId, {
      providerSubscriptionId: stripeSubId ?? trimmed,
      providerCustomerId: customerId,
      currentPeriodEnd: periodEnd,
    });

    if (stripeSubId) {
      try {
        const stripeSub = await this.stripeService.retrieveSubscription(stripeSubId);
        await this.syncFromStripeSubscriptionEvent(stripeSub);
      } catch (err) {
        this.logger.warn(`confirmCheckout: syncFromStripe failed: ${err}`);
      }
    }

    const plan = await this.resolvePlan({
      planId: subscription.planId,
      countryCode: subscription.countryCode,
      userType: subscription.userType,
    });

    const billing = await this.getCurrentBilling(userId, tenantId);

    return {
      activated: true,
      alreadyActive,
      planId: subscription.planId,
      planLabel: PLAN_DISPLAY_LABELS[subscription.planId] ?? subscription.planId,
      aiCredits: plan.aiCredits,
      creditsGranted: alreadyActive ? 0 : plan.aiCredits,
      amount: Number(plan.amount),
      currency: plan.currency,
      currentPeriodEnd: periodEnd?.toISOString() ?? null,
      billing,
    };
  }

  async getIntroOfferStatus(
    userId: string,
    tenantId?: string,
  ): Promise<IntroOfferStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstLoginAt: true, userType: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userType: 'CONSUMER' | 'LAW_FIRM' =
      tenantId || user.userType === USER_TYPES.LAWYER ? 'LAW_FIRM' : 'CONSUMER';
    const discountPercent = getIntroOfferDiscountPercent(this.configService);
    const offerDays = getIntroOfferDays(this.configService);

    if (!user.firstLoginAt) {
      return {
        eligible: false,
        discountPercent,
        firstLoginAt: null,
        expiresAt: null,
        daysRemaining: 0,
        hoursRemaining: 0,
        reason: 'not_started',
        userType,
      };
    }

    const expiresAt = computeIntroOfferExpiry(user.firstLoginAt, offerDays);
    const { daysRemaining, hoursRemaining } = computeIntroOfferTimeRemaining(
      expiresAt,
    );

    if (new Date() >= expiresAt) {
      return {
        eligible: false,
        discountPercent,
        firstLoginAt: user.firstLoginAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        daysRemaining: 0,
        hoursRemaining: 0,
        reason: 'expired',
        userType,
      };
    }

    const subscribed = await this.hasPaidSubscriptionHistory(userId, tenantId);
    if (subscribed) {
      return {
        eligible: false,
        discountPercent,
        firstLoginAt: user.firstLoginAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        daysRemaining,
        hoursRemaining,
        reason: 'subscribed',
        userType,
      };
    }

    return {
      eligible: true,
      discountPercent,
      firstLoginAt: user.firstLoginAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      hoursRemaining,
      userType,
    };
  }

  private async hasPaidSubscriptionHistory(
    userId: string,
    tenantId?: string,
    excludeSubscriptionId?: string,
  ): Promise<boolean> {
    const paidSubFilter = {
      ...(tenantId ? { tenantId } : { userId }),
      providerSubscriptionId: { startsWith: 'sub_' },
      ...(excludeSubscriptionId ? { id: { not: excludeSubscriptionId } } : {}),
    };

    const activeSub = await this.prisma.subscription.findFirst({
      where: {
        ...paidSubFilter,
        status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] },
      },
    });
    if (activeSub) return true;

    const priorPaidSubs = await this.prisma.subscription.count({
      where: {
        ...paidSubFilter,
        status: { in: [...PAID_SUBSCRIPTION_STATUSES] },
      },
    });
    return priorPaidSubs > 0;
  }

  private async resolveIntroOfferForCheckout(
    userId: string,
    tenantId: string | undefined,
    excludeSubscriptionId: string,
  ): Promise<{ eligible: boolean; discountPercent: number }> {
    const status = await this.getIntroOfferStatus(userId, tenantId);
    if (!status.eligible) {
      return { eligible: false, discountPercent: 0 };
    }

    const stillFirstPurchase = !(await this.hasPaidSubscriptionHistory(
      userId,
      tenantId,
      excludeSubscriptionId,
    ));
    if (!stillFirstPurchase) {
      return { eligible: false, discountPercent: 0 };
    }

    return {
      eligible: true,
      discountPercent: status.discountPercent,
    };
  }

  private computeDiscountedPlanAmount(
    planAmount: number,
    introOffer: { eligible: boolean; discountPercent: number },
  ): number {
    if (!introOffer.eligible) return planAmount;
    return applyIntroOfferDiscount(planAmount, introOffer.discountPercent);
  }

  async createBillingPortal(userId: string, tenantId?: string) {
    const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const activeSub = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          paymentProvider: 'stripe',
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Prefer tenant-level customer ID; fall back to the subscription record's providerCustomerId.
      const customerId = tenant.stripeCustomerId ?? activeSub?.providerCustomerId ?? null;

      if (!customerId) {
        throw new BadRequestException(
          'No Stripe customer on file. Subscribe to a plan first.',
        );
      }

      if (!activeSub?.providerSubscriptionId?.startsWith('sub_')) {
        throw new BadRequestException(
          'No active Stripe subscription. Use checkout to subscribe first.',
        );
      }

      // If the tenant record was missing the customer ID, backfill it now.
      if (!tenant.stripeCustomerId && customerId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await this.stripeService.createBillingPortalSession({
        customerId,
        returnUrl: `${appUrl}/app/settings/plan-usage`,
      });

      return { url: session.url };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { consumerProfile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activeSub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        paymentProvider: 'stripe',
      },
      orderBy: { updatedAt: 'desc' },
    });

    const customerId =
      user.consumerProfile?.stripeCustomerId ?? activeSub?.providerCustomerId ?? null;

    if (!customerId) {
      throw new BadRequestException(
        'No Stripe customer on file. Subscribe to a plan first.',
      );
    }

    if (!activeSub?.providerSubscriptionId?.startsWith('sub_')) {
      throw new BadRequestException(
        'No active Stripe subscription. Use checkout to subscribe first.',
      );
    }

    if (!user.consumerProfile?.stripeCustomerId && customerId && user.consumerProfile) {
      await this.prisma.consumerProfile.update({
        where: { userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripeService.createBillingPortalSession({
      customerId,
      returnUrl: `${appUrl}/consumer/subscription`,
    });

    return { url: session.url };
  }

  async createCheckout(
    userId: string,
    dto: CheckoutSubscriptionDto,
    tenantId?: string,
  ) {
    const plan = await this.resolvePlan(dto);
    const countryCode = dto.countryCode.toUpperCase();
    const userType = (dto.userType ?? (tenantId ? 'LAW_FIRM' : 'CONSUMER')).toUpperCase();
    const useStripe = shouldUseStripeSubscriptionCheckout(
      this.configService,
      plan.planId,
      countryCode,
    );
    if (!useStripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY and run setup-stripe-billing.ts to configure price IDs.',
      );
    }
    const provider = 'stripe';
    const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));
    const defaultReturnPath = tenantId ? '/app/dashboard' : '/consumer/dashboard';
    const returnPath = dto.returnPath?.trim() || defaultReturnPath;
    const redirectSuffix = `&redirect=${encodeURIComponent(returnPath)}`;
    const checkoutSuccessUrl = `${appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}${redirectSuffix}`;
    const checkoutCancelUrlBase = tenantId ? `${appUrl}/pricing` : `${appUrl}/consumer/subscription`;

    let tenantBillingPlan: string | null = null;
    let stripeCustomerId: string | null = null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { consumerProfile: true },
    });

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      tenantBillingPlan = tenant.billingPlan;
      stripeCustomerId = tenant.stripeCustomerId;

      // Only block checkout when the tenant already has a paid Stripe subscription.
      // Tenants without any ACTIVE sub (e.g. defaults with billingPlan='STARTER')
      // must be allowed to purchase any plan including Starter.
      const activeStripeSub = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          paymentProvider: 'stripe',
          providerSubscriptionId: { startsWith: 'sub_' },
        },
      });
      if (activeStripeSub) {
        const change = comparePlanChange(tenant.billingPlan, plan.planId);
        if (change === 'same') {
          throw new BadRequestException('You are already on this plan. Use Manage in Stripe to update billing.');
        }
        throw new BadRequestException(
          'You already have an active subscription. Use Manage in Stripe to upgrade or downgrade.',
        );
      }
    } else if (userType === 'CONSUMER') {
      const activeStripeSub = await this.prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          paymentProvider: 'stripe',
          providerSubscriptionId: { startsWith: 'sub_' },
        },
      });
      if (activeStripeSub) {
        if (activeStripeSub.planId === plan.planId) {
          throw new BadRequestException(
            'You are already on this plan. Use Manage plan to update billing.',
          );
        }
        throw new BadRequestException(
          'You already have an active subscription. Use Manage plan to upgrade, downgrade, or cancel.',
        );
      }
      stripeCustomerId = user?.consumerProfile?.stripeCustomerId ?? null;
    }

    const planChange = tenantId
      ? comparePlanChange(tenantBillingPlan, plan.planId)
      : 'new';

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: tenantId ? undefined : userId,
        tenantId,
        userType,
        countryCode,
        currency: plan.currency,
        planId: plan.planId,
        status: 'CHECKOUT_PENDING',
        paymentProvider: provider,
        providerCustomerId: stripeCustomerId ?? undefined,
      },
    });

    const metadata: Record<string, string> = {
      subscriptionId: subscription.id,
      planId: plan.planId,
      userType,
      countryCode,
      planChange,
      userId: tenantId ? '' : userId,
      tenantId: tenantId ?? '',
    };

    // Referral attribution (referrer rewards) — discount is unified intro offer
    let referralId: string | undefined;
    const referralCheck = await this.referralsService.validateReferralForCheckout({
      refereeUserId: userId,
      deviceFingerprint: dto.deviceFingerprint,
    });
    if (referralCheck.eligible && referralCheck.referralId) {
      referralId = referralCheck.referralId;
      metadata.referralId = referralId;
      metadata.referralDiscount = 'true';
    }

    const introOffer = await this.resolveIntroOfferForCheckout(
      userId,
      tenantId,
      subscription.id,
    );
    if (introOffer.eligible) {
      metadata.introOfferDiscount = 'true';
    }

    this.logger.log(
      `createCheckout planId=${plan.planId} countryCode=${countryCode} userType=${userType} tenantId=${tenantId ?? 'none'} provider=${provider} introOffer=${introOffer.eligible}`,
    );

    const originalAmount = Number(plan.amount);
    const discountedAmount = this.computeDiscountedPlanAmount(originalAmount, introOffer);
    const isAnnual = dto.billingCycle === 'annual';

    // Annual billing: always use dynamic checkout with a yearly price (20% off monthly rate).
    if (isAnnual) {
      const annualAmount = Math.round(originalAmount * 12 * 0.8 * 100) / 100;
      const customer = await this.stripeService.createOrRetrieveCustomer({
        email: user?.email,
        existingCustomerId: stripeCustomerId ?? undefined,
        metadata: tenantId ? { tenantId } : { userId },
      });

      if (tenantId && customer.id !== stripeCustomerId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customer.id },
        });
      }

      const annualMetadata = { ...metadata, billingCycle: 'annual', monthlyEquivalent: String(Math.round(originalAmount * 0.8)) };
      const annualMinorUnits = toStripeMinorUnits(annualAmount, plan.currency);
      const annualSession = await this.stripeService.createDynamicCheckoutSession({
        customerId: customer.id,
        amountMinorUnits: annualMinorUnits,
        currency: plan.currency,
        productName: `${plan.planId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} (Annual)`,
        productDescription: `${plan.aiCredits ?? ''} AI credits / month · billed annually`.trim(),
        mode: 'subscription',
        recurringInterval: 'year',
        successUrl: checkoutSuccessUrl,
        cancelUrl: checkoutCancelUrlBase,
        metadata: annualMetadata,
      });

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          providerSubscriptionId: annualSession.id,
          providerCustomerId: customer.id,
        },
      });

      if (referralId) {
        await this.referralsService.markReferralSubscribed(referralId);
      }

      return {
        checkoutSessionId: annualSession.id,
        provider: 'stripe',
        status: 'CHECKOUT_PENDING',
        subscriptionId: subscription.id,
        planId: plan.planId,
        amount: annualAmount,
        originalAmount: originalAmount * 12,
        currency: plan.currency,
        checkoutUrl: annualSession.url,
        introOfferDiscount: false,
      };
    }

    const stripePriceId = getStripePriceId(plan.planId, this.configService, countryCode);
    if (!stripePriceId) {
      // No pre-created Stripe Price ID — use dynamic price_data checkout.
      const customer = await this.stripeService.createOrRetrieveCustomer({
        email: user?.email,
        existingCustomerId: stripeCustomerId ?? undefined,
        metadata: tenantId ? { tenantId } : { userId },
      });

      // Resolve intro-offer coupon (duration=once) for this path too.
      let noPriceIdCouponId: string | undefined;
      if (introOffer.eligible) {
        const rawCouponId = resolveIntroOfferCouponId(this.configService);
        if (rawCouponId) {
          const valid = await this.stripeService.validateCoupon(
            rawCouponId,
            getIntroOfferDiscountPercent(this.configService),
          );
          if (valid) {
            noPriceIdCouponId = rawCouponId;
          } else {
            this.logger.warn(
              `Intro offer coupon "${rawCouponId}" failed validation (no-price-id path) — intro offer skipped`,
            );
          }
        }
      }

      // Always use full price; coupon handles the first-month discount.
      const amountMinorUnits = toStripeMinorUnits(originalAmount, plan.currency);
      const session = await this.stripeService.createDynamicCheckoutSession({
        customerId: customer.id,
        amountMinorUnits,
        currency: plan.currency,
        productName: plan.planId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        productDescription: `${plan.aiCredits ?? ''} AI credits / month`.trim(),
        mode: 'subscription',
        recurringInterval: 'month',
        successUrl: checkoutSuccessUrl,
        cancelUrl: checkoutCancelUrlBase,
        metadata,
        couponId: noPriceIdCouponId,
      });

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          providerSubscriptionId: session.id,
          providerCustomerId: customer.id,
        },
      });

      if (referralId) {
        await this.referralsService.markReferralSubscribed(referralId);
      }

      return {
        checkoutSessionId: session.id,
        provider: 'stripe',
        status: 'CHECKOUT_PENDING',
        subscriptionId: subscription.id,
        planId: plan.planId,
        amount: noPriceIdCouponId ? discountedAmount : originalAmount,
        originalAmount,
        currency: plan.currency,
        checkoutUrl: session.url,
        introOfferDiscount: Boolean(noPriceIdCouponId),
      };
    }

    const customer = await this.stripeService.createOrRetrieveCustomer({
      email: user?.email,
      existingCustomerId: stripeCustomerId,
      metadata: tenantId ? { tenantId } : { userId },
    });

    if (tenantId && customer.id !== stripeCustomerId) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Resolve intro-offer coupon for Stripe Price ID checkout
    let stripeCouponId: string | undefined;
    if (introOffer.eligible) {
      const rawCouponId = resolveIntroOfferCouponId(this.configService);
      if (rawCouponId) {
        const valid = await this.stripeService.validateCoupon(
          rawCouponId,
          getIntroOfferDiscountPercent(this.configService),
        );
        if (valid) {
          stripeCouponId = rawCouponId;
        } else {
          this.logger.warn(
            `Intro offer coupon "${rawCouponId}" is invalid or missing in Stripe — skipping coupon`,
          );
        }
      }
    }

    // Intro offer is eligible but no valid coupon is configured — proceed at full price.
    // Do NOT bake the discount into the recurring unit_amount (that would apply it forever).
    if (introOffer.eligible && !stripeCouponId) {
      this.logger.warn(
        `Intro offer eligible for ${userId ?? tenantId} but no valid coupon configured — charging full price`,
      );
      const fullAmountMinorUnits = toStripeMinorUnits(originalAmount, plan.currency);
      const fallbackSession = await this.stripeService.createDynamicCheckoutSession({
        customerId: customer.id,
        amountMinorUnits: fullAmountMinorUnits,
        currency: plan.currency,
        productName: plan.planId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        productDescription: `${plan.aiCredits ?? ''} AI credits / month`.trim(),
        mode: 'subscription',
        recurringInterval: 'month',
        successUrl: checkoutSuccessUrl,
        cancelUrl: checkoutCancelUrlBase,
        metadata,
      });
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          providerSubscriptionId: fallbackSession.id,
          providerCustomerId: customer.id,
        },
      });
      if (referralId) {
        await this.referralsService.markReferralSubscribed(referralId);
      }
      return {
        checkoutSessionId: fallbackSession.id,
        provider: 'stripe',
        status: 'CHECKOUT_PENDING',
        subscriptionId: subscription.id,
        planId: plan.planId,
        amount: originalAmount,
        originalAmount,
        currency: plan.currency,
        checkoutUrl: fallbackSession.url,
        introOfferDiscount: false,
      };
    }

    let session: { id: string; url?: string };
    try {
      session = await this.stripeService.createSubscriptionCheckoutSession({
        customerId: customer.id,
        priceId: stripePriceId,
        successUrl: checkoutSuccessUrl,
        cancelUrl: checkoutCancelUrlBase,
        metadata,
        couponId: stripeCouponId,
        currency: plan.currency,
      });
    } catch (err: unknown) {
      // If the price ID is rejected by Stripe (deleted/wrong currency), fall back to dynamic checkout
      const isStripeRejection =
        err instanceof BadRequestException || err instanceof ServiceUnavailableException;
      if (isStripeRejection) {
        this.logger.warn(
          `Stripe priceId ${stripePriceId} rejected (${String(err)}); falling back to dynamic checkout`,
        );
        const fallbackSession = await this.stripeService.createDynamicCheckoutSession({
          customerId: customer.id,
          amountMinorUnits: toStripeMinorUnits(originalAmount, plan.currency),
          currency: plan.currency,
          productName: plan.planId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          productDescription: `${plan.aiCredits ?? ''} AI credits / month`.trim(),
          mode: 'subscription',
          recurringInterval: 'month',
          successUrl: checkoutSuccessUrl,
          cancelUrl: checkoutCancelUrlBase,
          metadata,
          couponId: stripeCouponId,
        });
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            providerSubscriptionId: fallbackSession.id,
            providerCustomerId: customer.id,
          },
        });
        if (referralId) {
          await this.referralsService.markReferralSubscribed(referralId);
        }
        return {
          checkoutSessionId: fallbackSession.id,
          provider: 'stripe',
          status: 'CHECKOUT_PENDING',
          subscriptionId: subscription.id,
          planId: plan.planId,
          amount: introOffer.eligible && stripeCouponId ? discountedAmount : originalAmount,
          originalAmount,
          currency: plan.currency,
          checkoutUrl: fallbackSession.url,
          introOfferDiscount: introOffer.eligible && Boolean(stripeCouponId),
        };
      }
      throw err;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        providerSubscriptionId: session.id,
        providerCustomerId: customer.id,
      },
    });

    if (referralId) {
      await this.referralsService.markReferralSubscribed(referralId);
    }

    return {
      checkoutSessionId: session.id,
      provider: 'stripe',
      status: 'CHECKOUT_PENDING',
      subscriptionId: subscription.id,
      planId: plan.planId,
      amount: introOffer.eligible ? discountedAmount : originalAmount,
      originalAmount,
      currency: plan.currency,
      checkoutUrl: session.url,
      introOfferDiscount: introOffer.eligible,
    };
  }

  /** @deprecated Use createCheckout */
  async createCheckoutStub(
    userId: string,
    dto: CheckoutSubscriptionDto,
    tenantId?: string,
  ) {
    return this.createCheckout(userId, dto, tenantId);
  }

  async handleStripeSubscriptionWebhook(rawBody: string, signature?: string) {
    if (!signature || !this.stripeService.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    const event = JSON.parse(rawBody) as StripeSubscriptionEvent;
    const type = event.type;

    if (type === 'checkout.session.completed') {
      const session = event.data?.object;
      const meta = session?.metadata ?? {};

      // Plan boost fulfilment
      if (meta['type'] === 'plan_boost') {
        const userId = meta['userId'];
        const tenantId = meta['tenantId'] || undefined;
        const planCredits = Number(meta['planCredits'] ?? 0);
        const cycleEndAt = meta['cycleEndAt'] ? new Date(meta['cycleEndAt']) : null;
        if (userId && planCredits > 0) {
          await this.creditLedger.credit({
            userId,
            tenantId: tenantId ?? undefined,
            credits: planCredits,
            taskType: 'plan_boost',
            metadata: {
              source: 'plan_boost',
              planId: meta['planId'] ?? '',
              expiresAt: cycleEndAt?.toISOString() ?? null,
              stripeSessionId: session?.id,
            } as Prisma.InputJsonValue,
          });
        }
      }

      const internalId = meta['subscriptionId'];
      const stripeSubId =
        typeof session?.subscription === 'string' ? session.subscription : undefined;
      if (internalId) {
        await this.activateSubscription(internalId, {
          providerSubscriptionId: stripeSubId ?? session?.id,
          providerCustomerId:
            typeof session?.customer === 'string' ? session.customer : undefined,
        });
      }
    }

    if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
      const sub = event.data?.object;
      if (sub?.id) {
        await this.syncFromStripeSubscriptionEvent(sub);
      }
    }

    if (type === 'customer.subscription.deleted') {
      const sub = event.data?.object;
      if (sub?.id) {
        await this.cancelFromStripeSubscription(sub.id, sub.customer);
      }
    }

    if (type === 'invoice.paid') {
      const invoice = event.data?.object as any;
      // Only grant credits on period renewal, not initial subscription payment
      if (invoice?.billing_reason === 'subscription_cycle' && invoice?.subscription) {
        await this.handlePeriodRenewal(invoice.subscription, invoice.customer);
      }

      // Platform revenue ledger — record every paid Stripe invoice
      if (invoice?.id && invoice?.amount_paid > 0) {
        void this.upsertSubscriptionRevenue(invoice);
      }
    }

    return {
      received: true,
      provider: 'stripe',
      eventType: type,
      processedAt: new Date().toISOString(),
    };
  }

  async activateSubscription(
    subscriptionId: string,
    providerMeta?: {
      providerSubscriptionId?: string;
      providerCustomerId?: string;
      currentPeriodEnd?: Date;
    },
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === 'ACTIVE') {
      await this.applyPlanToSubscription(subscription.id, subscription.planId, providerMeta);
      // Still sync the Stripe customer ID in case it wasn't saved the first time.
      await this.syncStripeCustomerToTenant(subscription, providerMeta);
      return subscription;
    }

    const plan = await this.resolvePlan({
      planId: subscription.planId,
      countryCode: subscription.countryCode,
      userType: subscription.userType,
    });

    const periodStart = new Date();
    const periodEnd =
      providerMeta?.currentPeriodEnd ??
      new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Use a transaction with an optimistic status-lock to prevent double credit grants.
    // If another process already flipped the status to ACTIVE between our read and
    // this write, Prisma will return `null` (update where clause won't match) and
    // we skip granting credits.
    const activated = await this.prisma.subscription.updateMany({
      where: { id: subscriptionId, status: { not: 'ACTIVE' } },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        providerSubscriptionId:
          providerMeta?.providerSubscriptionId ?? subscription.providerSubscriptionId,
        providerCustomerId:
          providerMeta?.providerCustomerId ?? subscription.providerCustomerId,
      },
    });

    // Another process already activated — return without granting credits again.
    if (activated.count === 0) {
      this.logger.warn(
        `activateSubscription: subscription ${subscriptionId} already ACTIVE — skipping credit grant`,
      );
      return this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    }

    const mrrUsd = this.estimateMrrUsd(Number(plan.amount), plan.currency);
    const creditsToGrant = this.computeActivationCredits(plan, mrrUsd);

    if (subscription.userId && subscription.userType === 'CONSUMER') {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: subscription.userId },
        data: {
          subscriptionStatus: 'ACTIVE',
        },
      });

      await this.creditLedger.credit({
        userId: subscription.userId,
        taskType: 'subscription_activation',
        credits: creditsToGrant,
        metadata: { subscriptionId, planId: plan.planId },
      });

      await this.budgetPolicy.upsertPolicy({
        userId: subscription.userId,
        mrrUsd,
      });
    }

    if (subscription.tenantId) {
      const billingPlan = mapPlanIdToBillingPlan(plan.planId);
      await this.prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          billingPlan,
        },
      });

      await this.creditLedger.credit({
        tenantId: subscription.tenantId,
        taskType: 'subscription_activation',
        credits: creditsToGrant,
        metadata: { subscriptionId, planId: plan.planId },
      });

      await this.budgetPolicy.upsertPolicy({
        tenantId: subscription.tenantId,
        mrrUsd,
      });
    }

    // Sync the Stripe customer ID so auto top-up can reuse the same customer.
    await this.syncStripeCustomerToTenant(subscription, providerMeta).catch((err) =>
      this.logger.warn(`syncStripeCustomer failed: ${err}`),
    );

    // Referral reward fulfillment — idempotent, fires for both consumers and law firms
    if (subscription.userId && subscription.userType === 'CONSUMER') {
      await this.referralsService
        .onConsumerSubscriptionActivated({
          subscriptionId,
          userId: subscription.userId,
        })
        .catch(() => undefined);
    }

    if (subscription.tenantId && subscription.userType !== 'CONSUMER') {
      // Resolve the founding member (earliest active tenant user) — most likely the person
      // who signed up via a referral link and created the firm workspace.
      const foundingMember = await this.prisma.tenantUser.findFirst({
        where: { tenantId: subscription.tenantId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      });
      if (foundingMember?.userId) {
        await this.referralsService
          .onConsumerSubscriptionActivated({
            subscriptionId,
            userId: foundingMember.userId,
            tenantId: subscription.tenantId,
          })
          .catch(() => undefined);
      }
    }

    return this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  }

  /**
   * Sync the Stripe customer ID from the subscription's providerCustomerId to the
   * tenant/consumer profile so auto top-up uses the same Stripe customer as the
   * active subscription (avoids orphaned customers and broken auto top-up).
   */
  private async syncStripeCustomerToTenant(
    subscription: { id: string; userId: string | null; tenantId: string | null; userType: string },
    providerMeta?: { providerCustomerId?: string },
  ): Promise<void> {
    const customerId =
      providerMeta?.providerCustomerId ??
      (await this.prisma.subscription.findUnique({ where: { id: subscription.id } }))?.providerCustomerId;
    if (!customerId) return;

    if (subscription.tenantId) {
      await this.prisma.tenant.updateMany({
        where: { id: subscription.tenantId, stripeCustomerId: null },
        data: { stripeCustomerId: customerId },
      });
    } else if (subscription.userId && subscription.userType === 'CONSUMER') {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: subscription.userId, stripeCustomerId: null },
        data: { stripeCustomerId: customerId },
      });
    }
  }

  getPlanCatalog() {
    return {
      plans: Object.values(PRICING_PLANS),
      supportedCountries: ['IN', 'US', 'KE', 'GB'],
    };
  }

  private async resolvePlan(dto: CheckoutSubscriptionDto): Promise<PricingPlan> {
    const countryCode = dto.countryCode.toUpperCase();
    const userType = (dto.userType ?? 'CONSUMER').toUpperCase();

    const basePlan = this.findCanonicalDevelopingPlan(userType, dto.planId);
    if (!basePlan) {
      throw new NotFoundException('Pricing plan not found');
    }

    if (isRetiredPricingPlan(basePlan.planId)) {
      throw new BadRequestException(
        'This plan is no longer available for new subscriptions. Please choose Starter or higher.',
      );
    }

    if (basePlan.features.contactSales) {
      throw new BadRequestException(
        'Enterprise plans require a sales conversation. Contact us for pricing.',
      );
    }

    return this.localizePlanForCountry(basePlan, countryCode);
  }

  /**
   * Developing-tier USD list prices ($25/$100/$500) — localized via FX for non-India markets.
   */
  private loadCanonicalDevelopingPlans(): PricingPlan[] {
    return DEVELOPING_USD_BASE_PLANS.map((seed) => this.mapSeedPlan(seed));
  }

  private findCanonicalDevelopingPlan(
    userType: string,
    planId: string,
  ): PricingPlan | null {
    const seed = findDevelopingUsdBasePlan(userType, planId);
    return seed ? this.mapSeedPlan(seed) : null;
  }

  private async localizePlanForCountry(
    basePlan: PricingPlan,
    countryCode: string,
  ): Promise<PricingPlan> {
    const normalized = countryCode.toUpperCase();

    if (isNativeInrPricingCountry(normalized)) {
      const native = getPricingForCountry(normalized, basePlan.userType, basePlan.planId);
      if (native) {
        return this.mapSeedPlan(native);
      }
    }

    const country = getCountryConfig(normalized);
    const usdAmount = Number(basePlan.amount);
    const tier = getCountryPricingTier(normalized);
    const amount = await this.currencyFx.convertUsdAmount(usdAmount, country.currency, normalized);
    const localizedUsdEquivalent = usdAmount * tier;
    const tierBudgetPercent = tier >= 2 ? 50 : 60;
    const aiCredits =
      localizedUsdEquivalent > 0
        ? computePlanCreditsForTier(localizedUsdEquivalent, tierBudgetPercent)
        : basePlan.aiCredits;

    return {
      ...basePlan,
      countryCode: normalized,
      currency: country.currency,
      amount: new Prisma.Decimal(amount),
      aiCredits,
    };
  }

  private mapDbPlan(plan: {
    countryCode: string;
    userType: string;
    planId: string;
    currency: string;
    amount: Prisma.Decimal;
    aiCredits: number;
    features: Prisma.JsonValue;
  }): PricingPlan {
    return {
      countryCode: plan.countryCode,
      userType: plan.userType,
      planId: plan.planId,
      currency: plan.currency,
      amount: plan.amount,
      aiCredits: plan.aiCredits,
      features: plan.features as Record<string, boolean | number | string>,
    };
  }

  private mapSeedPlan(seed: (typeof COUNTRY_PRICING_SEEDS)[number]): PricingPlan {
    return {
      countryCode: seed.countryCode,
      userType: seed.userType,
      planId: seed.planId,
      currency: seed.currency,
      amount: seed.amount,
      aiCredits: seed.aiCredits,
      features: seed.features,
    };
  }

  private buildCurrentBillingDto(input: {
    userType: 'LAW_FIRM' | 'CONSUMER';
    billingPlan: string | null;
    planId: string;
    subscriptionStatus: string | null;
    countryCode: string;
    stripeCustomerId: string | null;
    providerSubscriptionId: string | null;
    paymentProvider: string | null;
  }): CurrentBillingDto {
    const isActiveSubscription = input.subscriptionStatus === 'ACTIVE';

    const hasStripeSubscription =
      input.paymentProvider === 'stripe' &&
      isActiveSubscription &&
      Boolean(
        input.providerSubscriptionId?.startsWith('sub_') || input.stripeCustomerId,
      );

    const planTier =
      input.userType === 'CONSUMER'
        ? input.billingPlan === 'ACTIVE' || isActiveSubscription
          ? 'PLUS'
          : 'FREE'
        : isActiveSubscription && input.billingPlan
          ? normalizeBillingPlan(input.billingPlan)
          : 'FREE';

    const resolvedPlanId =
      input.userType === 'CONSUMER'
        ? isActiveSubscription && input.planId
          ? input.planId
          : mapBillingPlanToPlanId(input.billingPlan, 'CONSUMER')
        : isActiveSubscription && input.planId
          ? input.planId
          : null;

    const canManageInPortal =
      isActiveSubscription &&
      input.paymentProvider === 'stripe' &&
      Boolean(input.stripeCustomerId);

    return {
      userType: input.userType,
      billingPlan: input.billingPlan,
      planTier,
      planId: resolvedPlanId ?? '',
      subscriptionStatus: input.subscriptionStatus,
      countryCode: input.countryCode,
      hasStripeSubscription,
      canManageInPortal,
      stripeCustomerId: input.stripeCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
    };
  }

  private async syncFromStripeSubscriptionEvent(stripeSub: {
    id?: string;
    status?: string;
    customer?: string;
    metadata?: Record<string, string>;
    items?: {
      data?: Array<{
        price?: { id?: string; metadata?: Record<string, string> };
      }>;
    };
    current_period_end?: number;
  }) {
    if (!stripeSub.id) {
      return;
    }

    const planId =
      this.stripeService.extractPlanIdFromStripeSubscription(stripeSub) ??
      stripeSub.metadata?.planId;

    let internal = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: stripeSub.id },
    });

    if (!internal && stripeSub.metadata?.subscriptionId) {
      internal = await this.prisma.subscription.findUnique({
        where: { id: stripeSub.metadata.subscriptionId },
      });
    }

    if (!internal && typeof stripeSub.customer === 'string') {
      const tenant = await this.prisma.tenant.findFirst({
        where: { stripeCustomerId: stripeSub.customer },
      });
      if (tenant) {
        internal = await this.prisma.subscription.findFirst({
          where: { tenantId: tenant.id, paymentProvider: 'stripe' },
          orderBy: { updatedAt: 'desc' },
        });
      }
    }

    if (!internal) {
      return;
    }

    const resolvedPlanId = planId ?? internal.planId;
    const periodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : undefined;

    if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
      const providerMeta = {
        providerSubscriptionId: stripeSub.id,
        providerCustomerId:
          typeof stripeSub.customer === 'string' ? stripeSub.customer : undefined,
        currentPeriodEnd: periodEnd,
      };

      if (internal.status !== 'ACTIVE') {
        await this.activateSubscription(internal.id, providerMeta);
      }

      if (resolvedPlanId && resolvedPlanId !== internal.planId) {
        this.logger.warn(
          `Stripe subscription ${stripeSub.id} plan ${resolvedPlanId} differs from DB ${internal.planId} — syncing`,
        );
      }

      await this.applyPlanToSubscription(internal.id, resolvedPlanId, providerMeta);
    }
  }

  private async handlePeriodRenewal(
    stripeSubscriptionId: string,
    stripeCustomerId?: string,
  ) {
    const internal = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: stripeSubscriptionId },
    });

    if (!internal) {
      // Try matching via tenant's stripeCustomerId
      if (stripeCustomerId) {
        const tenant = await this.prisma.tenant.findFirst({
          where: { stripeCustomerId: typeof stripeCustomerId === 'string' ? stripeCustomerId : undefined },
        });
        if (tenant) {
          const sub = await this.prisma.subscription.findFirst({
            where: { tenantId: tenant.id, status: 'ACTIVE', paymentProvider: 'stripe' },
            orderBy: { updatedAt: 'desc' },
          });
          if (sub) {
            await this.grantPeriodCredits(sub.id, sub.planId, sub.countryCode, sub.userId ?? undefined, sub.tenantId ?? undefined);
          }
        }
      }
      return;
    }

    await this.grantPeriodCredits(
      internal.id,
      internal.planId,
      internal.countryCode,
      internal.userId ?? undefined,
      internal.tenantId ?? undefined,
    );
  }

  private async grantPeriodCredits(
    subscriptionId: string,
    planId: string,
    countryCode: string,
    userId?: string,
    tenantId?: string,
  ) {
    // DB-first: use the country-specific row from CountryPricing so that
    // localized prices (e.g. Kenya vs US) grant the correct credit amount.
    // Fall back to the in-memory developing-tier seed when no DB row exists.
    const dbRow = await this.prisma.countryPricing.findFirst({
      where: { planId, countryCode, isActive: true },
    });

    let creditsToGrant: number;
    if (dbRow && dbRow.aiCredits > 0) {
      creditsToGrant = dbRow.aiCredits;
    } else {
      const basePlan = this.findCanonicalDevelopingPlan(
        tenantId ? 'LAW_FIRM' : 'CONSUMER',
        planId,
      );
      if (!basePlan) return;
      const localized = await this.localizePlanForCountry(basePlan, countryCode);
      creditsToGrant = localized.aiCredits;
    }

    if (creditsToGrant <= 0) return;

    if (userId) {
      await this.creditLedger.credit({
        userId,
        taskType: 'subscription_renewal',
        credits: creditsToGrant,
        metadata: { subscriptionId, planId, countryCode },
      });
    }

    if (tenantId) {
      await this.creditLedger.credit({
        tenantId,
        taskType: 'subscription_renewal',
        credits: creditsToGrant,
        metadata: { subscriptionId, planId, countryCode },
      });
    }
  }

  /**
   * Compute credits to grant on subscription activation or renewal.
   * For paid plans, derive from the USD plan price × subscription margin.
   * For free plans (amount = 0), fall back to the seed aiCredits value.
   */
  private computeActivationCredits(
    plan: PricingPlan,
    mrrUsd: number,
  ): number {
    if (plan.aiCredits > 0 && plan.amount.gt(0)) {
      return plan.aiCredits;
    }

    const marginPercent = this.configService.get<number>(
      'AI_SUBSCRIPTION_MARGIN_PERCENT',
      40,
    );
    const creditUsdValue = this.configService.get<number>(
      'AI_CREDIT_USD_VALUE',
      0.01,
    );

    if (mrrUsd > 0) {
      return computePlanCreditsFromPrice(mrrUsd, marginPercent, creditUsdValue);
    }
    return plan.aiCredits;
  }

  private async cancelFromStripeSubscription(
    stripeSubscriptionId: string,
    stripeCustomerId?: string,
  ) {
    const internal = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: stripeSubscriptionId },
    });

    if (!internal) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: internal.id },
      data: { status: 'CANCELED' },
    });

    if (internal.tenantId) {
      await this.prisma.tenant.update({
        where: { id: internal.tenantId },
        data: { billingPlan: 'TRIAL_PENDING_PAYMENT' },
      });
    }

    if (internal.userId) {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: internal.userId },
        data: { subscriptionStatus: 'FREE' },
      });
    }

    if (stripeCustomerId && internal.tenantId) {
      await this.prisma.tenant.update({
        where: { id: internal.tenantId },
        data: { stripeCustomerId: stripeCustomerId },
      });
    }
  }

  private async applyPlanToSubscription(
    internalSubscriptionId: string,
    planId: string,
    providerMeta?: {
      providerSubscriptionId?: string;
      providerCustomerId?: string;
      currentPeriodEnd?: Date;
    },
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: internalSubscriptionId },
    });
    if (!subscription || subscription.planId === planId) {
      if (subscription && providerMeta) {
        await this.prisma.subscription.update({
          where: { id: internalSubscriptionId },
          data: {
            providerSubscriptionId:
              providerMeta.providerSubscriptionId ?? subscription.providerSubscriptionId,
            providerCustomerId:
              providerMeta.providerCustomerId ?? subscription.providerCustomerId,
            currentPeriodEnd: providerMeta.currentPeriodEnd ?? subscription.currentPeriodEnd,
          },
        });
      }
      return;
    }

    const plan = await this.resolvePlan({
      planId,
      countryCode: subscription.countryCode,
      userType: subscription.userType,
    });

    await this.prisma.subscription.update({
      where: { id: internalSubscriptionId },
      data: {
        planId,
        providerSubscriptionId:
          providerMeta?.providerSubscriptionId ?? subscription.providerSubscriptionId,
        providerCustomerId:
          providerMeta?.providerCustomerId ?? subscription.providerCustomerId,
        currentPeriodEnd: providerMeta?.currentPeriodEnd ?? subscription.currentPeriodEnd,
      },
    });

    if (subscription.tenantId) {
      const billingPlan = mapPlanIdToBillingPlan(planId);
      await this.prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: { billingPlan },
      });
    }

    if (subscription.userId && subscription.userType === 'CONSUMER') {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: subscription.userId },
        data: { subscriptionStatus: 'ACTIVE' },
      });
    }
  }

  private estimateMrrUsd(amount: number, currency: string): number {
    const rates: Record<string, number> = {
      USD: 1,
      GBP: 1.27,
      INR: 0.012,
      KES: 0.0077,
    };
    const rate = rates[currency.toUpperCase()] ?? 1;
    return Number((amount * rate).toFixed(2));
  }

  private async upsertSubscriptionRevenue(invoice: {
    id: string;
    amount_paid?: number;
    tax?: number;
    currency?: string;
    customer?: string;
    subscription?: string;
  }) {
    try {
      const gross = (invoice.amount_paid ?? 0) / 100;
      const tax = (invoice.tax ?? 0) / 100;
      await this.prisma.platformRevenueEntry.upsert({
        where: { providerRef: `stripe_invoice:${invoice.id}` },
        create: {
          source: 'subscription',
          grossAmount: new Prisma.Decimal(gross),
          taxAmount: new Prisma.Decimal(tax),
          feeAmount: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(gross - tax),
          currency: (invoice.currency ?? 'usd').toUpperCase(),
          paymentProvider: 'stripe',
          providerRef: `stripe_invoice:${invoice.id}`,
          description: `Stripe subscription invoice ${invoice.id}`,
          occurredAt: new Date(),
          metadata: {
            stripeInvoiceId: invoice.id,
            stripeCustomerId: invoice.customer,
            stripeSubscriptionId: invoice.subscription,
          } as Prisma.InputJsonValue,
        },
        update: {},
      });
    } catch (err) {
      this.logger.warn(`[PlatformAccounting] invoice revenue upsert failed: ${(err as Error).message}`);
    }
  }

}

type StripeSubscriptionEvent = {
  type?: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      customer?: string;
      subscription?: string;
      metadata?: Record<string, string>;
      current_period_end?: number;
      payment_status?: string;
      items?: {
        data?: Array<{
          price?: { id?: string; metadata?: Record<string, string> };
        }>;
      };
    };
  };
};

