import { Injectable } from '@nestjs/common';
import { ModelCapability } from '../gateways/ai-gateway.interface';
import { RiskLevel } from '../../common/types';
import { MODEL_REGISTRY } from './model-registry.data';
import { ModelRegistryEntry, ModelTier } from './model-registry.types';

const TIER_ORDER: Record<ModelTier, number> = {
  tier0_deterministic: 0,
  tier1_small: 1,
  tier2_medium: 2,
  tier3_large: 3,
};

export interface FindForTaskOptions {
  capabilities: ModelCapability[];
  maxTier?: ModelTier;
  riskLevel?: RiskLevel;
  maxCostPer1kInputUsd?: number;
}

@Injectable()
export class ModelRegistryService {
  private readonly entries: ModelRegistryEntry[] = MODEL_REGISTRY;

  getAll(): ModelRegistryEntry[] {
    return this.entries.filter((e) => e.status === 'active');
  }

  findById(id: string): ModelRegistryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  findByCapability(capability: ModelCapability): ModelRegistryEntry[] {
    return this.entries.filter(
      (e) => e.status === 'active' && e.capabilities.includes(capability),
    );
  }

  findForTask(options: FindForTaskOptions): ModelRegistryEntry[] {
    const { capabilities, maxTier, riskLevel, maxCostPer1kInputUsd } = options;
    const maxTierRank = maxTier !== undefined ? TIER_ORDER[maxTier] : Infinity;

    const matches = this.entries.filter((entry) => {
      if (entry.status !== 'active') return false;

      const hasAllCapabilities = capabilities.every((cap) =>
        entry.capabilities.includes(cap),
      );
      if (!hasAllCapabilities) return false;

      if (TIER_ORDER[entry.tier] > maxTierRank) return false;

      if (riskLevel && !entry.approvedRiskLevels.includes(riskLevel)) return false;

      if (
        maxCostPer1kInputUsd !== undefined &&
        entry.costProfile.inputCostPer1kTokensUsd > maxCostPer1kInputUsd
      ) {
        return false;
      }

      return true;
    });

    return matches.sort(
      (a, b) =>
        a.costProfile.inputCostPer1kTokensUsd - b.costProfile.inputCostPer1kTokensUsd,
    );
  }
}
