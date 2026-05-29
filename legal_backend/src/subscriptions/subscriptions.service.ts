import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AIBudgetPolicyService } from '@/cost-monitoring/ai-budget-policy.service';
import { getCountryConfig } from '@/config/countries';
import { mapPlanIdToBillingPlan } from '@/config/billing-plans';
import { COUNTRY_PRICING_SEEDS, PRICING_PLANS } from '@/config/pricing.config';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from '@/payments/razorpay.service';
import { StripeService } from '@/payments/stripe.service';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';

type PricingPlan = {
  countryCode: string;
  userType: string;
  planId: string;
  currency: string;
  amount: Prisma.Decimal;
  aiCredits: number;
  features: Record<string, boolean | number | string>;
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly razorpayService: RazorpayService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly budgetPolicy: AIBudgetPolicyService,
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
      return dbPlans;
    }

    return COUNTRY_PRICING_SEEDS.filter((plan) =>
      userType ? plan.userType === userType.toUpperCase() : true,
    );
  }

  async listPricingByCountry(countryCode?: string) {
    const normalized = (countryCode ?? 'US').toUpperCase();
    getCountryConfig(normalized);

    const dbPlans = await this.prisma.countryPricing.findMany({
      where: { countryCode: normalized, isActive: true },
      orderBy: { amount: 'asc' },
    });

    if (dbPlans.length > 0) {
      return {
        countryCode: normalized,
        plans: dbPlans,
      };
    }

    return {
      countryCode: normalized,
      plans: COUNTRY_PRICING_SEEDS.filter((plan) => plan.countryCode === normalized),
    };
  }

  async createCheckout(
    userId: string,
    dto: CheckoutSubscriptionDto,
    tenantId?: string,
  ) {
    const plan = await this.resolvePlan(dto);
    const countryCode = dto.countryCode.toUpperCase();
    const userType = (dto.userType ?? (tenantId ? 'LAW_FIRM' : 'CONSUMER')).toUpperCase();
    const provider = getCountryConfig(countryCode).defaultPaymentProvider;
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

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
        providerCustomerId: `cust_${userId.slice(0, 8)}`,
      },
    });

    const metadata = {
      subscriptionId: subscription.id,
      planId: plan.planId,
      userType,
      countryCode,
      userId: tenantId ? '' : userId,
      tenantId: tenantId ?? '',
    };

    if (provider === 'razorpay') {
      const intent = await this.razorpayService.createPaymentIntent({
        amount: Number(plan.amount),
        currency: plan.currency,
        countryCode,
        purpose: 'subscription',
        metadata,
      });

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { providerSubscriptionId: intent.providerPaymentId },
      });

      return {
        checkoutSessionId: intent.providerPaymentId,
        provider,
        status: 'CHECKOUT_PENDING',
        subscriptionId: subscription.id,
        planId: plan.planId,
        amount: Number(plan.amount),
        currency: plan.currency,
        checkoutUrl: intent.checkoutUrl,
      };
    }

    const session = await this.createStripeCheckoutSession({
      amount: Number(plan.amount),
      currency: plan.currency,
      successUrl: `${appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/subscription/cancel`,
      metadata,
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { providerSubscriptionId: session.id },
    });

    return {
      checkoutSessionId: session.id,
      provider: 'stripe',
      status: 'CHECKOUT_PENDING',
      subscriptionId: subscription.id,
      planId: plan.planId,
      amount: Number(plan.amount),
      currency: plan.currency,
      checkoutUrl: session.url,
      clientSecret: session.clientSecret,
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
      const subscriptionId = session?.metadata?.subscriptionId;
      if (subscriptionId) {
        await this.activateSubscription(subscriptionId, {
          providerSubscriptionId: session.subscription ?? session.id,
          providerCustomerId: session.customer,
        });
      }
    }

    if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
      const sub = event.data?.object;
      const subscriptionId = sub?.metadata?.subscriptionId;
      if (subscriptionId && sub?.status === 'active') {
        await this.activateSubscription(subscriptionId, {
          providerSubscriptionId: sub.id,
          providerCustomerId: sub.customer,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : undefined,
        });
      }
    }

    return {
      received: true,
      provider: 'stripe',
      eventType: type,
      processedAt: new Date().toISOString(),
    };
  }

  async handleRazorpaySubscriptionWebhook(rawBody: string, signature?: string) {
    if (!signature || !this.razorpayService.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }

    const event = JSON.parse(rawBody) as RazorpaySubscriptionEvent;
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const notes =
        event.payload?.payment?.entity?.notes ??
        event.payload?.order?.entity?.notes;
      const subscriptionId = notes?.subscriptionId;
      if (subscriptionId) {
        await this.activateSubscription(subscriptionId, {
          providerSubscriptionId:
            event.payload?.payment?.entity?.order_id ??
            event.payload?.order?.entity?.id,
        });
      }
    }

    return {
      received: true,
      provider: 'razorpay',
      eventType: event.event,
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

    const activated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
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

    const mrrUsd = this.estimateMrrUsd(Number(plan.amount), plan.currency);

    if (subscription.userId && subscription.userType === 'CONSUMER') {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: subscription.userId },
        data: {
          subscriptionStatus: 'ACTIVE',
          aiCreditsRemaining: { increment: plan.aiCredits },
        },
      });

      await this.creditLedger.credit({
        userId: subscription.userId,
        taskType: 'subscription_activation',
        credits: plan.aiCredits,
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
          aiCreditsRemaining: { increment: plan.aiCredits },
        },
      });

      await this.creditLedger.credit({
        tenantId: subscription.tenantId,
        taskType: 'subscription_activation',
        credits: plan.aiCredits,
        metadata: { subscriptionId, planId: plan.planId },
      });

      await this.budgetPolicy.upsertPolicy({
        tenantId: subscription.tenantId,
        mrrUsd,
      });
    }

    return activated;
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

    const dbPlan = await this.prisma.countryPricing.findUnique({
      where: {
        countryCode_userType_planId: {
          countryCode,
          userType,
          planId: dto.planId,
        },
      },
    });

    if (dbPlan) {
      return {
        countryCode: dbPlan.countryCode,
        userType: dbPlan.userType,
        planId: dbPlan.planId,
        currency: dbPlan.currency,
        amount: dbPlan.amount,
        aiCredits: dbPlan.aiCredits,
        features: dbPlan.features as Record<string, boolean | number | string>,
      };
    }

    const seed = COUNTRY_PRICING_SEEDS.find(
      (p) =>
        p.countryCode === countryCode &&
        p.userType === userType &&
        p.planId === dto.planId,
    );

    if (!seed) {
      throw new NotFoundException('Pricing plan not found');
    }

    return seed;
  }

  private async createStripeCheckoutSession(params: {
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey) {
      const mockId = `cs_mock_${Date.now()}`;
      return {
        id: mockId,
        url: `${this.configService.get('APP_URL', 'http://localhost:3000')}/checkout/${mockId}`,
        clientSecret: `cs_secret_mock_${Date.now()}`,
      };
    }

    const body = new URLSearchParams();
    body.append('mode', 'payment');
    body.append('success_url', params.successUrl);
    body.append('cancel_url', params.cancelUrl);
    body.append('line_items[0][price_data][currency]', params.currency.toLowerCase());
    body.append(
      'line_items[0][price_data][unit_amount]',
      String(Math.round(params.amount * 100)),
    );
    body.append('line_items[0][price_data][product_data][name]', 'Legal by OdaFlow subscription');
    body.append('line_items[0][quantity]', '1');

    for (const [key, value] of Object.entries(params.metadata)) {
      body.append(`metadata[${key}]`, value);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Stripe checkout session failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      id: string;
      url?: string;
      client_secret?: string;
    };

    return {
      id: payload.id,
      url: payload.url,
      clientSecret: payload.client_secret,
    };
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
    };
  };
};

type RazorpaySubscriptionEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { order_id?: string; notes?: Record<string, string> } };
    order?: { entity?: { id?: string; notes?: Record<string, string> } };
  };
};
