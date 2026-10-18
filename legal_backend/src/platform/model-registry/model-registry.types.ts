import { ModelCapability } from '../gateways/ai-gateway.interface';
import { RiskLevel } from '../../common/types';

export interface ModelCostProfile {
  inputCostPer1kTokensUsd: number;
  outputCostPer1kTokensUsd: number;
}

export type ModelTier = 'tier0_deterministic' | 'tier1_small' | 'tier2_medium' | 'tier3_large';

export interface ModelRegistryEntry {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  tier: ModelTier;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsToolUse: boolean;
  costProfile: ModelCostProfile;
  latencyClass: 'fast' | 'medium' | 'slow';
  dataResidency: string[];
  approvedRiskLevels: RiskLevel[];
  status: 'active' | 'deprecated' | 'disabled' | 'beta';
  notes?: string;
}
