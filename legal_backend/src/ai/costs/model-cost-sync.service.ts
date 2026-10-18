import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MODEL_COSTS } from '@/ai/model-costs.config';

/** Speech-to-text providers billed per minute (stored as synthetic token rates for admin UI). */
export const STT_MODEL_COSTS: Array<{
  provider: string;
  modelName: string;
  modelTier: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  label: string;
}> = [
  {
    provider: 'openai',
    modelName: 'whisper-1',
    modelTier: 'cheap',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    label: 'Whisper-1 STT ($0.006/min)',
  },
  {
    provider: 'deepgram',
    modelName: 'nova-3',
    modelTier: 'cheap',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    label: 'Deepgram Nova-3 STT ($0.0077/min)',
  },
];

@Injectable()
export class ModelCostSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncFromRegistry(): Promise<{ synced: number; models: string[] }> {
    const synced: string[] = [];

    for (const [modelName, rates] of Object.entries(MODEL_COSTS)) {
      await this.prisma.aIModelCostConfig.upsert({
        where: {
          provider_modelName: { provider: rates.provider, modelName },
        },
        create: {
          provider: rates.provider,
          modelName,
          modelTier: rates.tier,
          inputCostPer1M: rates.inputPer1M,
          outputCostPer1M: rates.outputPer1M,
          isActive: true,
        },
        update: {
          modelTier: rates.tier,
          inputCostPer1M: rates.inputPer1M,
          outputCostPer1M: rates.outputPer1M,
          isActive: true,
        },
      });
      synced.push(modelName);
    }

    for (const stt of STT_MODEL_COSTS) {
      await this.prisma.aIModelCostConfig.upsert({
        where: {
          provider_modelName: { provider: stt.provider, modelName: stt.modelName },
        },
        create: {
          provider: stt.provider,
          modelName: stt.modelName,
          modelTier: stt.modelTier,
          inputCostPer1M: stt.inputCostPer1M,
          outputCostPer1M: stt.outputCostPer1M,
          isActive: true,
        },
        update: {
          modelTier: stt.modelTier,
          isActive: true,
        },
      });
      synced.push(stt.modelName);
    }

    return { synced: synced.length, models: synced };
  }
}
