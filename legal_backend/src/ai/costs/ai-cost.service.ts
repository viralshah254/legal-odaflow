import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { getModelCostForUsage, OPENAI_MODEL_COSTS } from '@/ai/model-costs.config';
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

  async getModelCost(provider: string, modelName: string, inputTokens = 0) {
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
    return OPENAI_MODEL_COSTS[modelName] ?? getModelCostForUsage(modelName, inputTokens);
  }

  async computeActualCostUsd(params: {
    provider: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
  }) {
    const cost = await this.getModelCost(params.provider, params.modelName, params.inputTokens);
    return estimateTokenCostUsd(
      cost.inputPer1M,
      cost.outputPer1M,
      params.inputTokens,
      params.outputTokens,
    );
  }

  computeCreditValueUsd(chargedCredits: number, _countryCode = 'US'): number {
    // Credits share one USD denomination. Currency conversion belongs at checkout,
    // not here: multiplying again made funded India/Kenya tasks appear unprofitable.
    return this.creditPricing.computeCreditValueUsd(chargedCredits);
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
