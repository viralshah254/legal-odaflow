import { Injectable } from '@nestjs/common';

export interface BudgetPolicy {
  feature: string;
  riskLevel: string;
  softLimitUsd: number;
  hardLimitUsd: number;
  maxModelTier: string;
  maxRepairIterations: number;
  allowDeepResearch: boolean;
}

const DEFAULT_POLICIES: BudgetPolicy[] = [
  {
    feature: 'research',
    riskLevel: 'low',
    softLimitUsd: 0.10,
    hardLimitUsd: 0.50,
    maxModelTier: 'tier2_medium',
    maxRepairIterations: 2,
    allowDeepResearch: false,
  },
  {
    feature: 'research',
    riskLevel: 'high',
    softLimitUsd: 0.50,
    hardLimitUsd: 2.00,
    maxModelTier: 'tier3_large',
    maxRepairIterations: 3,
    allowDeepResearch: true,
  },
  {
    feature: 'drafting',
    riskLevel: 'medium',
    softLimitUsd: 0.30,
    hardLimitUsd: 1.50,
    maxModelTier: 'tier2_medium',
    maxRepairIterations: 3,
    allowDeepResearch: false,
  },
  {
    feature: 'drafting',
    riskLevel: 'high',
    softLimitUsd: 1.00,
    hardLimitUsd: 5.00,
    maxModelTier: 'tier3_large',
    maxRepairIterations: 5,
    allowDeepResearch: true,
  },
  {
    feature: 'document_review',
    riskLevel: 'medium',
    softLimitUsd: 0.20,
    hardLimitUsd: 1.00,
    maxModelTier: 'tier2_medium',
    maxRepairIterations: 2,
    allowDeepResearch: false,
  },
  {
    feature: 'contract_review',
    riskLevel: 'high',
    softLimitUsd: 0.50,
    hardLimitUsd: 2.00,
    maxModelTier: 'tier2_medium',
    maxRepairIterations: 3,
    allowDeepResearch: false,
  },
  {
    feature: 'copilot',
    riskLevel: 'low',
    softLimitUsd: 0.05,
    hardLimitUsd: 0.20,
    maxModelTier: 'tier1_small',
    maxRepairIterations: 1,
    allowDeepResearch: false,
  },
];

const FALLBACK_POLICY: BudgetPolicy = {
  feature: 'default',
  riskLevel: 'low',
  softLimitUsd: 0.10,
  hardLimitUsd: 0.50,
  maxModelTier: 'tier2_medium',
  maxRepairIterations: 2,
  allowDeepResearch: false,
};

@Injectable()
export class CostBudgetPolicyService {
  getPolicy(feature: string, riskLevel: string): BudgetPolicy {
    const exact = DEFAULT_POLICIES.find(
      (p) => p.feature === feature && p.riskLevel === riskLevel,
    );
    if (exact) return exact;

    // Fall back to any policy for this feature
    const byFeature = DEFAULT_POLICIES.find((p) => p.feature === feature);
    return byFeature ?? FALLBACK_POLICY;
  }

  checkBudget(
    _workflowId: string,
    _tenantId: string,
    currentCostUsd: number,
    policy: BudgetPolicy,
  ): 'ok' | 'soft_limit' | 'hard_limit' {
    if (currentCostUsd >= policy.hardLimitUsd) {
      return 'hard_limit';
    }
    if (currentCostUsd >= policy.softLimitUsd) {
      return 'soft_limit';
    }
    return 'ok';
  }
}
