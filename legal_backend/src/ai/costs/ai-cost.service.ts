import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { estimateCostUsd } from '@/common/utils/prompt-hash.util';
import { getCreditCost } from '@/ai-credits/credit-costs';

const DEFAULT_MODEL_COSTS: Record<
  string,
  { inputPer1M: number; outputPer1M: number; tier: string }
> = {
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6, tier: 'cheap' },
  'gpt-4.1': { inputPer1M: 3.0, outputPer1M: 12.0, tier: 'premium' },
};

@Injectable()
export class AiCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
    return DEFAULT_MODEL_COSTS[modelName] ?? { inputPer1M: 0.4, outputPer1M: 1.6, tier: 'cheap' };
  }

  async computeActualCostUsd(params: {
    provider: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
  }) {
    const cost = await this.getModelCost(params.provider, params.modelName);
    return estimateCostUsd(
      params.inputTokens,
      params.outputTokens,
      cost.inputPer1M / 1_000_000,
      cost.outputPer1M / 1_000_000,
    );
  }

  computeCreditValueUsd(chargedCredits: number, countryCode = 'US'): number {
    const unitValues: Record<string, number> = {
      US: 0.1,
      IN: 0.012,
      KE: 0.0077,
      GB: 0.12,
    };
    const unit = unitValues[countryCode.toUpperCase()] ?? 0.1;
    return Number((chargedCredits * unit).toFixed(6));
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
      this.configService.get<string>('AI_MIN_GROSS_MARGIN_PERCENT', '65'),
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
