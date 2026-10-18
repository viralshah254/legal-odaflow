import type { QualityTier } from './model-aliases';

export type SectionModelTier = 'cheap' | 'standard' | 'strong' | 'premium';

export interface SectionPlan {
  sectionId: string;
  title: string;
  sectionType: string;
  purpose: string;
  requiredFactIds: string[];
  allowedSourceIds: string[];
  /** Section IDs that must be generated before this one. */
  dependencySectionIds: string[];
  tokenBudget: number;
  modelTier: SectionModelTier;
  verificationRules: string[];
  /** Whether this section can be batched with others in the same wave. */
  batchable: boolean;
}

export interface ModelBudget {
  maximumUsd: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  premiumModelAllowed: boolean;
}

export interface ComplexityScore {
  proceduralAmbiguity: number;
  disputedIssues: number;
  authorityConflict: number;
  factualConflict: number;
  reliefSeverity: number;
  filingRisk: number;
  documentLength: number;
  total: number;
}

export interface DraftExecutionPlan {
  jobId: string;
  documentKind: string;
  qualityTier: QualityTier;
  sections: SectionPlan[];
  /**
   * Ordered list of section ID arrays.
   * Sections within the same wave run in parallel.
   * Waves execute sequentially.
   */
  generationWaves: string[][];
  globalTokenBudget: number;
  modelBudget: ModelBudget;
  complexityScore: ComplexityScore;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  builtAt: string;
}

export type DraftJobStatus =
  | 'queued'
  | 'normalizing'
  | 'procedural_check'
  | 'retrieving'
  | 'planning'
  | 'generating'
  | 'verifying'
  | 'repairing'
  | 'assembling'
  | 'reviewing'
  | 'applying_fixes'
  | 'final_verify'
  | 'ready'
  | 'blocked'
  | 'failed'
  | 'cancelled';

export type DraftProfile =
  | 'india_court'
  | 'matter_workspace'
  | 'template_automation'
  | 'legal_notice'
  | 'contract'
  | 'legal_opinion';

export interface GeneratedSection {
  sectionId: string;
  content: string;
  factIdsUsed: string[];
  sourceIdsUsed: string[];
  unresolvedPlaceholders: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface RepairRequest {
  sectionId: string;
  paragraphId?: string;
  currentText: string;
  issueIds: string[];
  allowedFactIds: string[];
  allowedSourceIds: string[];
  neighboringContext: string;
  outputConstraint: 'sentence' | 'paragraph' | 'section';
  attemptNumber: number;
}
