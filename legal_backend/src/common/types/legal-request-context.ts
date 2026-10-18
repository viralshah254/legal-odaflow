export type LegalFeature =
  | 'research'
  | 'drafting'
  | 'issue_analysis'
  | 'document_review'
  | 'contract_review'
  | 'matter_intelligence'
  | 'strategy'
  | 'hearing_prep'
  | 'negotiation'
  | 'verification'
  | 'copilot';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CostBudget {
  softLimitUsd: number;
  hardLimitUsd: number;
}

export interface LegalRequestContext {
  requestId: string;
  tenantId: string;
  userId: string;
  userRole?: string;
  locale: string;
  timezone: string;
  countryCode?: string;
  jurisdictionCode?: string;
  matterId?: string;
  clientId?: string;
  feature: LegalFeature;
  riskLevel: RiskLevel;
  costBudget?: CostBudget;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}
