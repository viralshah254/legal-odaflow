import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  getModelCostForUsage,
  TYPICAL_COPILOT_INPUT_TOKENS,
  TYPICAL_COPILOT_OUTPUT_TOKENS,
} from '@/ai/model-costs.config';
import {
  computeCreditsFromProviderCost,
  estimateTokenCostUsd,
} from './credit-pricing.util';
import { CreditPricingService } from './credit-pricing.service';

export interface TokenCreditEstimate {
  providerCostUsd: number;
  credits: number;
  inputTokens: number;
  outputTokens: number;
  modelName: string;
  netMarginPercent: number;
}

@Injectable()
export class TokenCreditChargeService {
  constructor(
    private readonly configService: ConfigService,
    private readonly creditPricing: CreditPricingService,
    private readonly prisma: PrismaService,
  ) {}

  getNetMarginPercent(billingPlan?: string | null): number {
    return this.creditPricing.getNetMarginPercent(billingPlan);
  }

  isTokenBased(): boolean {
    return true;
  }

  async resolveBillingPlan(tenantId?: string, userId?: string): Promise<string | null> {
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { billingPlan: true },
      });
      return tenant?.billingPlan ?? null;
    }
    if (userId) {
      const sub = await this.prisma.subscription.findFirst({
        where: { userId, userType: 'CONSUMER', status: 'ACTIVE' },
        select: { planId: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (sub?.planId === 'consumer_plus') return 'consumer_plus';
      return 'consumer_free';
    }
    return null;
  }

  computeCreditsFromProviderCost(
    providerCostUsd: number,
    minCredits = 1,
    _maxCredits?: number,
    billingPlan?: string | null,
  ): number {
    const credits = computeCreditsFromProviderCost(
      providerCostUsd,
      this.creditPricing.getCreditUsdValue(),
      this.getNetMarginPercent(billingPlan),
      minCredits,
    );
    // A budget cap belongs before execution; never truncate recorded usage charges.
    return credits;
  }

  estimateCreditsForModel(params: {
    modelName: string;
    provider?: string;
    inputTokens?: number;
    outputTokens?: number;
    minCredits?: number;
    maxCredits?: number;
    billingPlan?: string | null;
  }): TokenCreditEstimate {
    const inputTokens = params.inputTokens ?? TYPICAL_COPILOT_INPUT_TOKENS;
    const outputTokens = params.outputTokens ?? TYPICAL_COPILOT_OUTPUT_TOKENS;
    const costs = getModelCostForUsage(params.modelName, inputTokens);
    const providerCostUsd = estimateTokenCostUsd(
      costs.inputPer1M,
      costs.outputPer1M,
      inputTokens,
      outputTokens,
    );
    const credits = this.computeCreditsFromProviderCost(
      providerCostUsd,
      params.minCredits ?? 1,
      params.maxCredits,
      params.billingPlan,
    );
    return {
      providerCostUsd,
      credits,
      inputTokens,
      outputTokens,
      modelName: params.modelName,
      netMarginPercent: this.getNetMarginPercent(params.billingPlan),
    };
  }

  async computeCreditsForUsage(params: {
    provider?: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    taskType?: string;
    providerCostUsd?: number;
    minCredits?: number;
    maxCredits?: number;
    tenantId?: string;
    userId?: string;
    billingPlan?: string | null;
  }): Promise<TokenCreditEstimate> {
    const billingPlan =
      params.billingPlan ?? (await this.resolveBillingPlan(params.tenantId, params.userId));

    const rates = getModelCostForUsage(params.modelName, params.inputTokens);
    const providerCostUsd = params.providerCostUsd ?? estimateTokenCostUsd(
      rates.inputPer1M,
      rates.outputPer1M,
      params.inputTokens,
      params.outputTokens,
    );
    const credits = this.computeCreditsFromProviderCost(providerCostUsd);
    return {
      providerCostUsd,
      credits,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      modelName: params.modelName,
      netMarginPercent: this.getNetMarginPercent(billingPlan),
    };
  }
}
