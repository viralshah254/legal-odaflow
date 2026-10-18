import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  getModelCostSync,
  TYPICAL_COPILOT_INPUT_TOKENS,
  TYPICAL_COPILOT_OUTPUT_TOKENS,
} from '@/ai/model-costs.config';
import { getCreditCost } from './credit-costs';
import {
  computeCreditsFromProviderCost,
  DEFAULT_CREDIT_USD_VALUE,
  estimateTokenCostUsd,
} from './credit-pricing.util';
import { computeResearchCreditsFromCost } from '@/ai/legal-research/research-mode';
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
    const mode = this.configService.get<string>('AI_CHARGE_MODE', 'token_based');
    return mode !== 'flat';
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
    maxCredits?: number,
    billingPlan?: string | null,
  ): number {
    let credits = computeCreditsFromProviderCost(
      providerCostUsd,
      this.creditPricing.getCreditUsdValue(),
      this.getNetMarginPercent(billingPlan),
      minCredits,
    );
    if (maxCredits != null) {
      credits = Math.min(credits, maxCredits);
    }
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
    const costs = getModelCostSync(params.modelName);
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
    minCredits?: number;
    maxCredits?: number;
    tenantId?: string;
    userId?: string;
    billingPlan?: string | null;
  }): Promise<TokenCreditEstimate> {
    const billingPlan =
      params.billingPlan ?? (await this.resolveBillingPlan(params.tenantId, params.userId));

    if (!this.isTokenBased()) {
      const flat = getCreditCost(params.taskType ?? 'LAWYER_MATTER_QA');
      return {
        providerCostUsd: 0,
        credits: flat,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        modelName: params.modelName,
        netMarginPercent: this.getNetMarginPercent(billingPlan),
      };
    }

    const providerCostUsd = estimateTokenCostUsd(
      getModelCostSync(params.modelName).inputPer1M,
      getModelCostSync(params.modelName).outputPer1M,
      params.inputTokens,
      params.outputTokens,
    );
    const taskFloor = getCreditCost(params.taskType ?? 'LAWYER_MATTER_QA');
    const credits =
      params.taskType === 'LEGAL_RESEARCH'
        ? computeResearchCreditsFromCost(
            providerCostUsd,
            this.creditPricing.getCreditUsdValue() || DEFAULT_CREDIT_USD_VALUE,
            params.minCredits ?? taskFloor,
          )
        : this.computeCreditsFromProviderCost(
            providerCostUsd,
            params.minCredits ?? taskFloor,
            params.maxCredits,
            billingPlan,
          );
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
