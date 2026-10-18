import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { getModelCostSync, OPENAI_MODEL_COSTS } from '@/ai/model-costs.config';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { estimateTokenCostUsd } from '@/ai-credits/credit-pricing.util';
import { CreditPricingService } from '@/ai-credits/credit-pricing.service';

@Injectable()
export class AiCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly creditPricing: CreditPricingService,
  ) {}

  async getModelCost(provider: string, modelName: string) {
    const db = await this.prisma.aIModelCostConfig.findUnique({
      where: {
        provider_modelName: { provider, modelName },
      },
    });
    if (db) {
      return {
        inputPer1M: Number(db.inputCostPer1M),
        outputPer1M: Number(db.outputCostPer1M),
        tier: db.modelTier,
      };
    }
    return OPENAI_MODEL_COSTS[modelName] ?? getModelCostSync(modelName);
  }

  async computeActualCostUsd(params: {
    provider: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
  }) {
    const cost = await this.getModelCost(params.provider, params.modelName);
    return estimateTokenCostUsd(
      cost.inputPer1M,
      cost.outputPer1M,
      params.inputTokens,
      params.outputTokens,
    );
  }

  computeCreditValueUsd(chargedCredits: number, countryCode = 'US'): number {
    const countryMultipliers: Record<string, number> = {
      US: 1,
      IN: 0.12,
      KE: 0.077,
      GB: 1.2,
    };
    const base = this.creditPricing.computeCreditValueUsd(chargedCredits);
    const multiplier = countryMultipliers[countryCode.toUpperCase()] ?? 1;
    return Number((base * multiplier).toFixed(6));
  }

  computeMargin(params: {
    creditValueUsd: number;
    actualCostUsd: number;
  }) {
    const platformMarginUsd = params.creditValueUsd - params.actualCostUsd;
    const grossMarginPercent =
      params.creditValueUsd > 0
        ? Number(((platformMarginUsd / params.creditValueUsd) * 100).toFixed(2))
        : 0;
    return { platformMarginUsd, grossMarginPercent };
  }

  shouldBlockNegativeMargin(params: {
    taskType: string;
    grossMarginPercent: number;
    isFreePreview?: boolean;
  }): boolean {
    const block = this.configService.get<string>('AI_BLOCK_TASK_IF_MARGIN_NEGATIVE', 'true');
    const allowFree =
      this.configService.get<string>('AI_ALLOW_NEGATIVE_MARGIN_FOR_FREE_PREVIEW', 'true') ===
      'true';
    const minMargin = Number(
      this.configService.get<string>(
        'AI_MIN_GROSS_MARGIN_PERCENT',
        String(Math.max(15, this.creditPricing.getNetMarginPercent() - 5)),
      ),
    );

    if (params.isFreePreview && allowFree) {
      return false;
    }

    if (block === 'false' || block === '0') {
      return false;
    }

    return params.grossMarginPercent < minMargin && getCreditCost(params.taskType) > 0;
  }
}
