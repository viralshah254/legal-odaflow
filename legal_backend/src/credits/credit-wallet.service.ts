import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AiModelResolverService } from '@/ai-credits/ai-model-resolver.service';
import { AiPreferencesService } from '@/ai-credits/ai-preferences.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { PremiumAllowanceService } from '@/ai-credits/premium-allowance.service';
import { getUnpaidTenantCreditAllowance, normalizeBillingPlan } from '@/config/billing-plans';
import {
  resolveConsumerSignupCredits,
} from '@/config/pricing.config';
import { CreditPacksService, type ResolvedCreditPack } from '@/ai-credits/credit-packs.service';
import { CreditPricingService } from '@/ai-credits/credit-pricing.service';
import { CurrencyFxService } from '@/config/currency-fx.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ModelRouterService } from '@/ai/model-router/model-router.service';
import { AiModelMode } from '@/ai/premium-models.config';
import { StripeService } from '@/payments/stripe.service';
import { AutoTopUpService } from './auto-topup.service';
import { resolveAppUrl } from '@/common/app-url';
import { syncUserCreditBalance } from '@/common/utils/firestore-sync.util';

const PLAN_LABELS: Record<string, string> = {
  consumer_free: 'Free',
  consumer_plus: 'Plus',
  lawyer_solo: 'Solo',
  firm_solo_entry: 'Solo Entry',
  firm_starter: 'Starter',
  firm_professional: 'Professional',
  firm_pro_plus: 'Pro Plus',
  firm_enterprise: 'Enterprise',
  SOLO: 'Solo',
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  PRO_PLUS: 'Pro Plus',
  ENTERPRISE: 'Enterprise',
  TRIAL_PENDING_PAYMENT: 'Trial',
  CONSUMER_FREE: 'Free',
  CONSUMER_PLUS: 'Plus',
};

export interface CreditWalletView {
  balance: number;
  planCreditsMonthly: number;
  /** User-facing: total credits consumed this cycle (auto + premium combined). */
  creditsUsedThisCycle: number;
  /** @deprecated use creditsUsedThisCycle */
  usedCreditsThisCycle: number;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  userSegment: string;
  countryCode: string;
  currency: string;
  percentUsed: number;
  creditsRemaining: number;
  /** Human-readable plan name shown to users. */
  planLabel: string;
  /** Monthly plan price for boost calculations. */
  planMonthlyPrice: number;
  planCurrency: string;
  /** Whether annual billing is available as an upgrade option. */
  annualPlanAvailable: boolean;
  /** True when an active Stripe (or provider) subscription exists. */
  hasActiveSubscription: boolean;
  /** Normalized billing plan enum (e.g. "PROFESSIONAL", "PRO_PLUS"). Used by the frontend to identify the current plan card. */
  billingPlan?: string;
  /** Whether the user can double their credits this cycle. */
  boostAvailable: boolean;
  /** Remaining included plan credits this billing cycle. */
  packageCreditsRemaining: number;
  /** Purchased top-up credits (never expire, separate from plan allowance). */
  onDemandCreditsRemaining: number;
  /** @deprecated use onDemandCreditsRemaining */
  onDemandCredits: number;
  aiModelMode: AiModelMode;
  premiumModelId: string;
  autoTopUp: {
    enabled: boolean;
    threshold: number;
    packId: string;
    hasPaymentMethod: boolean;
    /** Last 4 digits of the saved card, if available. */
    cardLast4?: string;
    /** Card brand (visa, mastercard, etc.), if available. */
    cardBrand?: string;
  };
  availablePremiumModels: Array<{
    modelId: string;
    label: string;
    creditMultiplier?: number;
    estimatedCreditsTypical?: number;
    inputPer1M?: number;
    outputPer1M?: number;
  }>;
  autoModelName: string;
  /** Internal analytics breakdown — not for user-facing display. */
  _internal: {
    autoCreditsUsedThisCycle: number;
    premiumCreditsUsedThisCycle: number;
    premiumAllowanceCredits: number;
    premiumAllowanceRemaining: number;
    autoPercentUsed: number;
    premiumPercentUsed: number;
  };
}

@Injectable()
export class CreditWalletService {
  private readonly logger = new Logger(CreditWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AICreditLedgerService,
    private readonly modelRouter: ModelRouterService,
    private readonly configService: ConfigService,
    private readonly premiumAllowance: PremiumAllowanceService,
    private readonly aiPreferences: AiPreferencesService,
    private readonly aiModelResolver: AiModelResolverService,
    private readonly aiCreditEnforcement: AiCreditEnforcementService,
    private readonly autoTopUp: AutoTopUpService,
    private readonly creditPacks: CreditPacksService,
    private readonly creditPricing: CreditPricingService,
    private readonly stripeService: StripeService,
    private readonly currencyFx: CurrencyFxService,
  ) {}

  async getConsumerWallet(userId: string) {
    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      return null;
    }

    const balance = await this.ledger.getBalance({ userId });
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, userType: 'CONSUMER', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });

    const signupCredits = resolveConsumerSignupCredits(
      this.configService.get<string>('CONSUMER_SIGNUP_CREDITS'),
    );

    // For free consumers the "cycle" is today — usage stats reset every day at midnight UTC.
    const todayUtcMidnight = (() => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();
    const tomorrowUtcMidnight = new Date(todayUtcMidnight.getTime() + 86_400_000);

    const cycleStart = subscription?.currentPeriodStart ?? todayUtcMidnight;
    const cycleEnd = subscription?.currentPeriodEnd ?? tomorrowUtcMidnight;
    const usedThisCycle = await this.getUsageSince(userId, undefined, cycleStart);

    const planCreditsMonthly = subscription
      ? await this.resolvePlanCredits(subscription.planId, subscription.countryCode, 'CONSUMER')
      : Math.max(balance + usedThisCycle, signupCredits);
    const cycleUsage = await this.premiumAllowance.getCycleUsage({
      userId,
      cycleStart,
    });
    const prefs = await this.aiPreferences.getForConsumer(userId);

    const planMonthlyPrice = subscription
      ? await this.resolvePlanPrice(subscription.planId, subscription.countryCode, 'CONSUMER', subscription.currency)
      : 0;
    const planCurrency = subscription?.currency ?? this.countryCurrency(profile.countryCode);
    const planLabel = subscription ? 'Plus' : 'Free';

    const boostAvailable = !!subscription
      && await this.checkBoostAvailable(userId, undefined, cycleStart);

    const cardDetails = profile.stripePaymentMethodId
      ? await this.stripeService.getPaymentMethodDetails(profile.stripePaymentMethodId).catch(() => null)
      : null;

    return this.buildWalletView({
      balance,
      planCreditsMonthly,
      usedCreditsThisCycle: usedThisCycle,
      autoCreditsUsedThisCycle: cycleUsage.autoCreditsUsed,
      premiumCreditsUsedThisCycle: cycleUsage.premiumCreditsUsed,
      cycleStartAt: cycleStart,
      cycleEndAt: cycleEnd,
      userSegment: subscription ? 'CONSUMER_PLUS' : 'CONSUMER_FREE',
      countryCode: profile.countryCode,
      currency: this.countryCurrency(profile.countryCode),
      planLabel,
      planMonthlyPrice,
      planCurrency,
      annualPlanAvailable: !!subscription,
      hasActiveSubscription: !!subscription,
      boostAvailable,
      cardLast4: cardDetails?.last4,
      cardBrand: cardDetails?.brand,
      packs: await this.creditPacks.listCreditPacks(profile.countryCode, 'CONSUMER_PLUS'),
      prefs,
    });
  }

  async getTenantWallet(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      return null;
    }

    const balance = await this.ledger.getBalance({ tenantId });
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, userType: 'LAW_FIRM', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });

    const planCreditsMonthly = subscription
      ? await this.resolvePlanCredits(subscription.planId, subscription.countryCode, 'LAW_FIRM')
      : getUnpaidTenantCreditAllowance();

    const planMonthlyPrice = subscription
      ? await this.resolvePlanPrice(subscription.planId, subscription.countryCode, 'LAW_FIRM', subscription.currency)
      : 0;
    const planCurrency = subscription?.currency ?? tenant.defaultCurrency ?? 'USD';
    const planLabel = subscription
      ? this.resolvePlanLabel(subscription.planId)
      : 'Free';

    const cycleStart = subscription?.currentPeriodStart ?? tenant.createdAt;
    const cycleEnd = subscription?.currentPeriodEnd ?? null;
    const usedThisCycle = await this.getUsageSince(undefined, tenantId, cycleStart);
    const cycleUsage = await this.premiumAllowance.getCycleUsage({
      tenantId,
      cycleStart,
    });
    const prefs = await this.aiPreferences.getForTenant(tenantId);

    const billingPlan = normalizeBillingPlan(tenant.billingPlan);
    const userSegment =
      billingPlan === 'ENTERPRISE'
        ? 'ENTERPRISE'
        : billingPlan === 'PRO_PLUS'
          ? 'FIRM'
          : billingPlan === 'PROFESSIONAL'
            ? 'FIRM'
            : 'LAWYER_SOLO';

    const boostAvailable = subscription
      ? await this.checkBoostAvailable(undefined, tenantId, cycleStart)
      : false;

    const cardDetails = tenant.stripePaymentMethodId
      ? await this.stripeService.getPaymentMethodDetails(tenant.stripePaymentMethodId).catch(() => null)
      : null;

    return this.buildWalletView({
      balance,
      planCreditsMonthly,
      usedCreditsThisCycle: usedThisCycle,
      autoCreditsUsedThisCycle: cycleUsage.autoCreditsUsed,
      premiumCreditsUsedThisCycle: cycleUsage.premiumCreditsUsed,
      cycleStartAt: cycleStart,
      cycleEndAt: cycleEnd,
      userSegment,
      countryCode: tenant.primaryCountry,
      currency: tenant.defaultCurrency,
      planLabel,
      planMonthlyPrice,
      planCurrency,
      annualPlanAvailable: !!subscription,
      hasActiveSubscription: !!subscription,
      billingPlan: billingPlan ?? undefined,
      boostAvailable,
      cardLast4: cardDetails?.last4,
      cardBrand: cardDetails?.brand,
      packs: await this.creditPacks.listCreditPacks(
        subscription?.countryCode ?? tenant.primaryCountry,
        userSegment,
        tenant.billingPlan,
      ),
      prefs,
    });
  }

  async getPlanUsage(userId: string, tenantId?: string) {
    const wallet = tenantId
      ? await this.getTenantWallet(tenantId)
      : await this.getConsumerWallet(userId);
    return wallet;
  }

  /**
   * Seed Firestore `users/{firebaseUid}/credits/wallet` from the authoritative
   * Postgres balance. Called after wallet REST reads so the web client can
   * subscribe without performing client-side writes.
   */
  async syncBalanceToFirestore(
    userId: string,
    result: { wallet: Pick<CreditWalletView, 'balance' | 'userSegment' | 'countryCode' | 'currency'> } | null,
  ): Promise<void> {
    if (!result?.wallet) return;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firebaseUid: true },
      });
      if (!user?.firebaseUid) return;

      await syncUserCreditBalance({
        firebaseUid: user.firebaseUid,
        balance: result.wallet.balance,
        userSegment: result.wallet.userSegment,
        countryCode: result.wallet.countryCode,
        currency: result.wallet.currency,
      });
    } catch (err) {
      this.logger.warn(`[Firestore] syncBalanceToFirestore failed: ${(err as Error).message}`);
    }
  }

  async estimateTask(params: {
    taskType: string;
    userId?: string;
    tenantId?: string;
    userSegment?: string;
    modelMode?: AiModelMode;
    premiumModelId?: string;
  }) {
    let planCreditsMonthly = 50;
    let cycleStart = new Date();

    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
      });
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId: params.tenantId, userType: 'LAW_FIRM', status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });
      planCreditsMonthly = subscription
        ? await this.resolvePlanCredits(subscription.planId, subscription.countryCode, 'LAW_FIRM')
        : getUnpaidTenantCreditAllowance();
      cycleStart = subscription?.currentPeriodStart ?? tenant?.createdAt ?? new Date();
    } else if (params.userId) {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: params.userId },
      });
      const subscription = await this.prisma.subscription.findFirst({
        where: { userId: params.userId, userType: 'CONSUMER', status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });
      planCreditsMonthly = subscription
        ? await this.resolvePlanCredits(subscription.planId, subscription.countryCode, 'CONSUMER')
        : profile?.aiCreditsRemaining ?? resolveConsumerSignupCredits();
      cycleStart = subscription?.currentPeriodStart ?? profile?.createdAt ?? new Date();
    }

    const modelContext = params.userId
      ? await this.aiModelResolver.resolveForTask({
          userId: params.userId,
          tenantId: params.tenantId,
          taskType: params.taskType,
          planCreditsMonthly,
          cycleStart,
          overrideMode: params.modelMode,
          overridePremiumModelId: params.premiumModelId,
        })
      : {
          modelMode: (params.modelMode ?? 'AUTO') as AiModelMode,
          premiumFallback: false,
          route: this.modelRouter.resolveRoute(params.taskType, params.userSegment, {
            modelMode: params.modelMode,
            premiumModelId: params.premiumModelId,
          }),
        };

    const balance =
      params.tenantId != null
        ? await this.ledger.getBalance({ tenantId: params.tenantId })
        : params.userId
          ? await this.ledger.getBalance({ userId: params.userId })
          : 0;

    const accessCheck = await this.aiCreditEnforcement.checkUsageAccess({
      userId: params.tenantId ? undefined : params.userId,
      tenantId: params.tenantId,
      modelMode: modelContext.modelMode,
      modelName: modelContext.route.modelName,
      planCreditsMonthly,
      cycleStart,
      inputTokens: modelContext.route.estimatedInputTokens,
      outputTokens: modelContext.route.estimatedOutputTokens,
    });

    return {
      taskType: params.taskType,
      estimatedCredits: modelContext.route.estimatedCredits,
      estimatedProviderCostUsd: modelContext.route.estimatedProviderCostUsd,
      estimatedInputTokens: modelContext.route.estimatedInputTokens,
      estimatedOutputTokens: modelContext.route.estimatedOutputTokens,
      netMarginPercent: this.creditPricing.getNetMarginPercent(),
      modelTier: modelContext.route.tier,
      modelName: modelContext.route.modelName,
      modelMode: modelContext.route.modelMode,
      premiumFallback: false,
      requiresConfirmation: modelContext.route.requiresConfirmation,
      balance,
      balanceAfter: Math.max(0, balance - modelContext.route.estimatedCredits),
      sufficient: accessCheck.allowed,
      premiumAllowanceRemaining: accessCheck.premiumAllowanceRemaining,
      topUpBalance: accessCheck.topUpBalance,
      blockedReason: accessCheck.reason,
    };
  }

  async getLedger(params: {
    userId?: string;
    tenantId?: string;
    limit?: number;
  }) {
    return this.prisma.aICreditLedger.findMany({
      where: {
        userId: params.userId,
        tenantId: params.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
    });
  }

  async checkAutoTopUp(params: {
    userId: string;
    tenantId?: string;
    balance: number;
    countryCode: string;
  }) {
    return this.autoTopUp.maybeTriggerAutoTopUp(params);
  }

  private async resolvePlanCredits(
    planId: string,
    countryCode: string,
    userType: string,
  ): Promise<number> {
    const dbPlan = await this.prisma.countryPricing.findUnique({
      where: {
        countryCode_userType_planId: {
          countryCode: countryCode.toUpperCase(),
          userType,
          planId,
        },
      },
    });
    return dbPlan?.aiCredits ?? getCreditCost('ISSUE_CHECKER') * 3;
  }

  private async resolvePlanPrice(
    planId: string,
    countryCode: string,
    userType: string,
    targetCurrency?: string,
  ): Promise<number> {
    const dbPlan = await this.prisma.countryPricing.findUnique({
      where: {
        countryCode_userType_planId: {
          countryCode: countryCode.toUpperCase(),
          userType,
          planId,
        },
      },
    });
    if (!dbPlan) return 0;

    const storedAmount = Number(dbPlan.amount);
    const storedCurrency = (dbPlan.currency ?? 'USD').toUpperCase();
    const desired = (targetCurrency ?? storedCurrency).toUpperCase();

    // If the stored currency already matches what the subscription uses, return as-is.
    if (storedCurrency === desired) return storedAmount;

    // CountryPricing rows for developing-market countries (KE, NG, etc.) store the USD
    // seed amount. Convert to the subscription's local currency on the fly.
    if (storedCurrency === 'USD') {
      return this.currencyFx.convertUsdAmount(storedAmount, desired, countryCode);
    }

    // Stored in local currency but caller wants a different currency — convert to USD
    // first then to target. Rare edge-case, but handled gracefully.
    const usdRate = await this.currencyFx.getUsdToLocalRate(storedCurrency);
    const asUsd = usdRate > 0 ? storedAmount / usdRate : storedAmount;
    return desired === 'USD'
      ? asUsd
      : this.currencyFx.convertUsdAmount(asUsd, desired, countryCode);
  }

  private resolvePlanLabel(planIdOrBillingPlan: string): string {
    return PLAN_LABELS[planIdOrBillingPlan] ?? PLAN_LABELS[planIdOrBillingPlan?.toUpperCase()] ?? 'Plan';
  }

  /** Returns true if no plan_boost ledger credit has been granted since the cycle start. */
  private async checkBoostAvailable(
    userId: string | undefined,
    tenantId: string | undefined,
    cycleStart: Date,
  ): Promise<boolean> {
    const boostCount = await this.prisma.aICreditLedger.count({
      where: {
        userId,
        tenantId,
        eventType: 'CREDIT',
        taskType: 'plan_boost',
        createdAt: { gte: cycleStart },
      },
    });
    return boostCount === 0;
  }

  /**
   * Creates a Stripe Checkout session to double the user's plan credits
   * for the remainder of the current billing cycle at a pro-rated price.
   */
  async boostPlan(params: { userId: string; tenantId?: string }) {
    const subscription = params.tenantId
      ? await this.prisma.subscription.findFirst({
          where: { tenantId: params.tenantId, userType: 'LAW_FIRM', status: 'ACTIVE' },
          orderBy: { updatedAt: 'desc' },
        })
      : await this.prisma.subscription.findFirst({
          where: { userId: params.userId, userType: 'CONSUMER', status: 'ACTIVE' },
          orderBy: { updatedAt: 'desc' },
        });

    if (!subscription) {
      throw new BadRequestException('No active subscription found. Subscribe to a plan first.');
    }

    const cycleStart = subscription.currentPeriodStart ?? new Date();
    const cycleEnd = subscription.currentPeriodEnd ?? new Date(Date.now() + 30 * 86_400_000);

    const alreadyBoosted = !(await this.checkBoostAvailable(
      params.tenantId ? undefined : params.userId,
      params.tenantId,
      cycleStart,
    ));
    if (alreadyBoosted) {
      throw new BadRequestException('Plan already boosted this billing cycle.');
    }

    const planPrice = await this.resolvePlanPrice(
      subscription.planId,
      subscription.countryCode,
      params.tenantId ? 'LAW_FIRM' : 'CONSUMER',
      subscription.currency,
    );
    const planCredits = await this.resolvePlanCredits(
      subscription.planId,
      subscription.countryCode,
      params.tenantId ? 'LAW_FIRM' : 'CONSUMER',
    );

    const now = new Date();
    const totalCycleDays = Math.max(
      1,
      Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000),
    );
    const daysRemaining = Math.max(
      1,
      Math.round((cycleEnd.getTime() - now.getTime()) / 86_400_000),
    );
    const proRatedPrice = Number(
      ((planPrice * daysRemaining) / totalCycleDays).toFixed(2),
    );

    const baseUrl = resolveAppUrl(
      this.configService.get<string>('APP_URL') ??
        this.configService.get<string>('APP_BASE_URL'),
    );

    let stripeSession: { id: string; url?: string };
    try {
      stripeSession = await this.stripeService.createDynamicCheckoutSession({
        amountMinorUnits: Math.round(proRatedPrice * 100),
        currency: subscription.currency,
        productName: `${this.resolvePlanLabel(subscription.planId)} Credit Boost`,
        productDescription: `+${planCredits.toLocaleString()} credits · expires at cycle end`,
        mode: 'payment',
        successUrl: `${baseUrl}/app/settings/plan-usage?boost=success`,
        cancelUrl: `${baseUrl}/app/settings/plan-usage?boost=cancelled`,
        metadata: {
          type: 'plan_boost',
          userId: params.userId,
          tenantId: params.tenantId ?? '',
          planId: subscription.planId,
          planCredits: String(planCredits),
          cycleEndAt: cycleEnd.toISOString(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe checkout failed';
      this.logger.error(`boostPlan checkout failed: ${message}`);
      throw new BadRequestException(
        message.includes('Stripe')
          ? 'Could not start checkout. Check Stripe configuration and try again.'
          : message,
      );
    }

    return {
      checkoutUrl: stripeSession.url,
      proRatedPrice,
      currency: subscription.currency,
      planCredits,
      daysRemaining,
    };
  }

  private async getUsageSince(
    userId: string | undefined,
    tenantId: string | undefined,
    since: Date,
  ): Promise<number> {
    const entries = await this.prisma.aICreditLedger.findMany({
      where: {
        userId,
        tenantId,
        eventType: 'DEBIT',
        createdAt: { gte: since },
      },
    });
    return entries.reduce((sum, entry) => sum + entry.credits, 0);
  }

  private buildWalletView(input: {
    balance: number;
    planCreditsMonthly: number;
    usedCreditsThisCycle: number;
    autoCreditsUsedThisCycle: number;
    premiumCreditsUsedThisCycle: number;
    cycleStartAt: Date;
    cycleEndAt: Date | null;
    userSegment: string;
    countryCode: string;
    currency: string;
    planLabel: string;
    planMonthlyPrice: number;
    planCurrency: string;
    annualPlanAvailable: boolean;
    hasActiveSubscription: boolean;
    billingPlan?: string;
    boostAvailable: boolean;
    cardLast4?: string;
    cardBrand?: string;
    packs: ResolvedCreditPack[];
    prefs: Awaited<ReturnType<AiPreferencesService['getForConsumer']>>;
  }) {
    const premiumAllowanceCredits = this.premiumAllowance.computePremiumAllowance(
      input.planCreditsMonthly,
    );
    const premiumAllowanceRemaining = Math.max(
      0,
      premiumAllowanceCredits - input.premiumCreditsUsedThisCycle,
    );

    const planRemaining = Math.max(0, input.planCreditsMonthly - input.usedCreditsThisCycle);
    const packageCreditsRemaining = Math.min(input.balance, planRemaining);
    const onDemandCreditsRemaining = Math.max(0, input.balance - packageCreditsRemaining);
    // Cursor-style: percentUsed = usedThisCycle / planCreditsMonthly (plan allowance, not running total)
    const percentUsed =
      input.planCreditsMonthly > 0
        ? Math.min(100, Math.round((input.usedCreditsThisCycle / input.planCreditsMonthly) * 100))
        : 0;
    // Auto: % of total plan consumed by auto tasks (same denominator as percentUsed)
    const autoPercentUsed =
      input.planCreditsMonthly > 0
        ? Math.min(
            100,
            Math.round((input.autoCreditsUsedThisCycle / input.planCreditsMonthly) * 100),
          )
        : 0;
    // Premium: % of premium allowance consumed (most actionable metric for the user)
    const premiumPercentUsed =
      premiumAllowanceCredits > 0
        ? Math.min(
            100,
            Math.round((input.premiumCreditsUsedThisCycle / premiumAllowanceCredits) * 100),
          )
        : 0;

    // Rough task credit estimates using current model preference
    const deepModelId = (input.prefs as any).deepAnalysisPremiumModelId ?? input.prefs.premiumModelId;
    const estimatedCreditsByTask = {
      similarCases: this.modelRouter.resolveRoute('LEGAL_RESEARCH', undefined, {
        modelMode: 'PREMIUM',
        premiumModelId: deepModelId,
      }).estimatedCredits,
      opponentAngles: this.modelRouter.resolveRoute('OPPONENT_ANALYZER', undefined, {
        modelMode: 'PREMIUM',
        premiumModelId: deepModelId,
      }).estimatedCredits,
      strategyMemo: this.modelRouter.resolveRoute('STRATEGY_MEMO', undefined, {
        modelMode: 'PREMIUM',
        premiumModelId: deepModelId,
      }).estimatedCredits,
      legalResearch: this.modelRouter.resolveRoute('LEGAL_RESEARCH', undefined, {
        modelMode: input.prefs.aiModelMode,
        premiumModelId: input.prefs.premiumModelId,
      }).estimatedCredits,
      copilot: this.modelRouter.resolveRoute('COPILOT', undefined, {
        modelMode: input.prefs.aiModelMode,
        premiumModelId: input.prefs.premiumModelId,
      }).estimatedCredits,
    };

    return {
      wallet: {
        balance: input.balance,
        planCreditsMonthly: input.planCreditsMonthly,
        creditsUsedThisCycle: input.usedCreditsThisCycle,
        usedCreditsThisCycle: input.usedCreditsThisCycle,
        cycleStartAt: input.cycleStartAt.toISOString(),
        cycleEndAt: input.cycleEndAt?.toISOString() ?? null,
        userSegment: input.userSegment,
        countryCode: input.countryCode,
        currency: input.currency,
        percentUsed,
        creditsRemaining: input.balance,
        planLabel: input.planLabel,
        planMonthlyPrice: input.planMonthlyPrice,
        planCurrency: input.planCurrency,
        annualPlanAvailable: input.annualPlanAvailable,
        hasActiveSubscription: input.hasActiveSubscription,
        billingPlan: input.billingPlan,
        boostAvailable: input.boostAvailable,
        packageCreditsRemaining,
        onDemandCreditsRemaining,
        onDemandCredits: onDemandCreditsRemaining,
        aiModelMode: input.prefs.aiModelMode,
        premiumModelId: input.prefs.premiumModelId,
        deepAnalysisPremiumModelId: (input.prefs as any).deepAnalysisPremiumModelId ?? input.prefs.premiumModelId,
        autoTopUp: {
          enabled: input.prefs.autoTopUpEnabled,
          threshold: input.prefs.autoTopUpThresholdCredits,
          packId: input.prefs.autoTopUpPackId,
          hasPaymentMethod: input.prefs.hasPaymentMethod,
          cardLast4: input.cardLast4,
          cardBrand: input.cardBrand,
        },
        availablePremiumModels: input.prefs.availablePremiumModels,
        autoModelName: input.prefs.autoModelName,
        estimatedCreditsByTask,
        _internal: {
          autoCreditsUsedThisCycle: input.autoCreditsUsedThisCycle,
          premiumCreditsUsedThisCycle: input.premiumCreditsUsedThisCycle,
          premiumAllowanceCredits,
          premiumAllowanceRemaining,
          autoPercentUsed,
          premiumPercentUsed,
        },
      },
      packs: input.packs,
    };
  }

  private countryCurrency(countryCode: string): string {
    const map: Record<string, string> = {
      IN: 'INR',
      US: 'USD',
      KE: 'KES',
      GB: 'GBP',
    };
    return map[countryCode.toUpperCase()] ?? 'USD';
  }
}
