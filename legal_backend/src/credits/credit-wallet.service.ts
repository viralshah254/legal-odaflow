import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiModelResolverService } from '@/ai-credits/ai-model-resolver.service';
import { AiPreferencesService } from '@/ai-credits/ai-preferences.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { PremiumAllowanceService } from '@/ai-credits/premium-allowance.service';
import { getTenantPlanCreditAllowance, normalizeBillingPlan } from '@/config/billing-plans';
import { CreditPacksService, type ResolvedCreditPack } from '@/ai-credits/credit-packs.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ModelRouterService } from '@/ai/model-router/model-router.service';
import { AiModelMode } from '@/ai/premium-models.config';
import { AutoTopUpService } from './auto-topup.service';

export interface CreditWalletView {
  balance: number;
  planCreditsMonthly: number;
  usedCreditsThisCycle: number;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  userSegment: string;
  countryCode: string;
  currency: string;
  percentUsed: number;
  creditsRemaining: number;
  autoCreditsUsedThisCycle: number;
  premiumCreditsUsedThisCycle: number;
  premiumAllowanceCredits: number;
  premiumAllowanceRemaining: number;
  autoPercentUsed: number;
  premiumPercentUsed: number;
  onDemandCredits: number;
  aiModelMode: AiModelMode;
  premiumModelId: string;
  autoTopUp: {
    enabled: boolean;
    threshold: number;
    packId: string;
    hasPaymentMethod: boolean;
  };
  availablePremiumModels: Array<{
    modelId: string;
    label: string;
    creditMultiplier: number;
  }>;
  autoModelName: string;
}

@Injectable()
export class CreditWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AICreditLedgerService,
    private readonly modelRouter: ModelRouterService,
    private readonly configService: ConfigService,
    private readonly premiumAllowance: PremiumAllowanceService,
    private readonly aiPreferences: AiPreferencesService,
    private readonly aiModelResolver: AiModelResolverService,
    private readonly autoTopUp: AutoTopUpService,
    private readonly creditPacks: CreditPacksService,
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

    const planCreditsMonthly = subscription
      ? await this.resolvePlanCredits(subscription.planId, subscription.countryCode, 'CONSUMER')
      : profile.aiCreditsRemaining;

    const cycleStart = subscription?.currentPeriodStart ?? profile.createdAt;
    const cycleEnd = subscription?.currentPeriodEnd ?? null;
    const usedThisCycle = await this.getUsageSince(userId, undefined, cycleStart);
    const cycleUsage = await this.premiumAllowance.getCycleUsage({
      userId,
      cycleStart,
    });
    const prefs = await this.aiPreferences.getForConsumer(userId);
    const onDemandCredits = await this.premiumAllowance.getOnDemandCredits({ userId });

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
      packs: await this.creditPacks.listCreditPacks(profile.countryCode, 'CONSUMER_PLUS'),
      prefs,
      onDemandCredits,
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
      : getTenantPlanCreditAllowance(tenant.billingPlan);

    const cycleStart = subscription?.currentPeriodStart ?? tenant.createdAt;
    const cycleEnd = subscription?.currentPeriodEnd ?? null;
    const usedThisCycle = await this.getUsageSince(undefined, tenantId, cycleStart);
    const cycleUsage = await this.premiumAllowance.getCycleUsage({
      tenantId,
      cycleStart,
    });
    const prefs = await this.aiPreferences.getForTenant(tenantId);
    const onDemandCredits = await this.premiumAllowance.getOnDemandCredits({ tenantId });

    const billingPlan = normalizeBillingPlan(tenant.billingPlan);
    const userSegment =
      billingPlan === 'ENTERPRISE'
        ? 'ENTERPRISE'
        : billingPlan === 'PROFESSIONAL'
          ? 'FIRM'
          : 'LAWYER_SOLO';

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
      packs: await this.creditPacks.listCreditPacks(tenant.primaryCountry, userSegment),
      prefs,
      onDemandCredits,
    });
  }

  async getPlanUsage(userId: string, tenantId?: string) {
    const wallet = tenantId
      ? await this.getTenantWallet(tenantId)
      : await this.getConsumerWallet(userId);
    return wallet;
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
        : getTenantPlanCreditAllowance(tenant?.billingPlan);
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
        : profile?.aiCreditsRemaining ?? 3;
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

    return {
      taskType: params.taskType,
      estimatedCredits: modelContext.route.estimatedCredits,
      modelTier: modelContext.route.tier,
      modelName: modelContext.route.modelName,
      modelMode: modelContext.route.modelMode,
      premiumFallback: modelContext.route.premiumFallback,
      requiresConfirmation: modelContext.route.requiresConfirmation,
      balance,
      balanceAfter: Math.max(0, balance - modelContext.route.estimatedCredits),
      sufficient: balance >= modelContext.route.estimatedCredits,
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
    packs: ResolvedCreditPack[];
    prefs: Awaited<ReturnType<AiPreferencesService['getForConsumer']>>;
    onDemandCredits: number;
  }) {
    const premiumAllowanceCredits = this.premiumAllowance.computePremiumAllowance(
      input.planCreditsMonthly,
    );
    const premiumAllowanceRemaining = Math.max(
      0,
      premiumAllowanceCredits - input.premiumCreditsUsedThisCycle,
    );
    const total = Math.max(input.planCreditsMonthly, input.balance + input.usedCreditsThisCycle);
    const percentUsed =
      total > 0 ? Math.min(100, Math.round((input.usedCreditsThisCycle / total) * 100)) : 0;
    const autoDenominator = Math.max(1, total - premiumAllowanceCredits);
    const autoPercentUsed = Math.min(
      100,
      Math.round((input.autoCreditsUsedThisCycle / autoDenominator) * 100),
    );
    const premiumPercentUsed =
      premiumAllowanceCredits > 0
        ? Math.min(
            100,
            Math.round((input.premiumCreditsUsedThisCycle / premiumAllowanceCredits) * 100),
          )
        : 0;

    return {
      wallet: {
        balance: input.balance,
        planCreditsMonthly: input.planCreditsMonthly,
        usedCreditsThisCycle: input.usedCreditsThisCycle,
        cycleStartAt: input.cycleStartAt.toISOString(),
        cycleEndAt: input.cycleEndAt?.toISOString() ?? null,
        userSegment: input.userSegment,
        countryCode: input.countryCode,
        currency: input.currency,
        percentUsed,
        creditsRemaining: input.balance,
        autoCreditsUsedThisCycle: input.autoCreditsUsedThisCycle,
        premiumCreditsUsedThisCycle: input.premiumCreditsUsedThisCycle,
        premiumAllowanceCredits,
        premiumAllowanceRemaining,
        autoPercentUsed,
        premiumPercentUsed,
        onDemandCredits: input.onDemandCredits,
        aiModelMode: input.prefs.aiModelMode,
        premiumModelId: input.prefs.premiumModelId,
        autoTopUp: {
          enabled: input.prefs.autoTopUpEnabled,
          threshold: input.prefs.autoTopUpThresholdCredits,
          packId: input.prefs.autoTopUpPackId,
          hasPaymentMethod: input.prefs.hasPaymentMethod,
        },
        availablePremiumModels: input.prefs.availablePremiumModels,
        autoModelName: input.prefs.autoModelName,
      } satisfies CreditWalletView,
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
