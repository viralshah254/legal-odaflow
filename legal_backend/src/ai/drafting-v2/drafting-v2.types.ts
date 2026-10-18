/**
 * Core type definitions for the v2 Legal Operating System drafting engine.
 *
 * Design contract:
 * - A `DocumentOutline` of independently addressable `SectionPlan` nodes is the
 *   spine of every document.
 * - Each section carries its own grounding, generation, verification result,
 *   `confidence`, and `evidenceChain`.
 * - The orchestrator only regenerates sections whose confidence is below threshold.
 */

import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { MatterProfile, MatterGraph, EvidenceRef } from '@/ai/matter-intelligence/matter-intelligence.types';
import type { ProceduralRouterResult } from '@/ai/drafting/draft-procedural-router.types';

// ─── Section type taxonomy ────────────────────────────────────────────────────

export type SectionType =
  | 'heading'
  | 'parties'
  | 'maintainability'
  | 'facts'
  | 'grounds'
  | 'law'
  | 'arguments'
  | 'prayer'
  | 'verification'
  | 'annexures'
  | 'boilerplate';

/** Model cost tier for this section. Boilerplate uses cheap; Grounds/Arguments use premium. */
export type SectionModelTier = 'cheap' | 'mid' | 'premium';

// ─── Legal Plan (Stage 2 output) ─────────────────────────────────────────────

export interface LegalIssue {
  id: string;
  description: string;
  applicableLaw: string[];
  requiredIngredients: string[];
  requiredEvidence: string[];
  requiredAuthorities: string[];
  exceptions?: string[];
}

export interface LegalPlan {
  id: string;
  documentKind: string;
  documentTitle: string;
  documentClass: 'pleading' | 'contract' | 'form' | 'application' | 'memo' | 'reply' | 'notice';
  jurisdiction: string;
  countryCode: string;
  forum?: string;
  issues: LegalIssue[];
  applicableLaw: string[];
  requiredIngredients: string[];
  mandatorySections: string[];
  requiredEvidence: string[];
  requiredAuthorities: string[];
  proceduralRules: string[];
  formattingRules: string[];
  causeTitleVehicle: string;
  filingGrade: boolean;
  ruleContext?: RuleEngineResult;
  createdAt: string;
}

// ─── Document Outline (Stage 6 output) ───────────────────────────────────────

export interface SectionPlan {
  id: string;
  type: SectionType;
  title: string;
  order: number;
  /** IDs of sections that must be generated before this one. */
  dependsOn: string[];
  requiredIngredients: string[];
  requiredEvidence: string[];
  requiredAuthorities: string[];
  /** Pre-verified boilerplate content — inject directly, skip generation. */
  boilerplateContent?: string;
  /** Target model tier. */
  modelTier: SectionModelTier;
  /** Max tokens for this section's generation call. */
  maxTokens: number;
  /** Prompt block injected into the section prompt from structural references. */
  structuralGuide?: string;
  /** Rule engine outputs relevant to this section. */
  ruleOutputs?: string[];
  /** Issues this section addresses. */
  issueIds: string[];
}

export interface DocumentOutline {
  planId: string;
  documentKind: string;
  documentTitle: string;
  jurisdiction: string;
  countryCode: string;
  sections: SectionPlan[];
  globalContext: {
    matterProfile: MatterProfile;
    proceduralResult: ProceduralRouterResult;
    verifiedAuthorities: RetrievedAuthority[];
    statuteGrounding: string;
    caseDetails: string;
    clientName?: string;
    courtName?: string;
    opposingParty?: string;
    attachmentContext?: string;
    /** User ID — used to resolve personal drafting style block */
    userId?: string;
    /** Active style selection: "my_style" or a preset ID */
    styleId?: string;
  };
}

// ─── Evidence Validation (Stage 7) ───────────────────────────────────────────

export type EvidenceStatus = 'supplied' | 'missing' | 'weak' | 'contradictory';

export interface EvidenceAssessment {
  evidenceRef: EvidenceRef;
  status: EvidenceStatus;
  statusReason: string;
  requiredForIssueId: string;
}

export interface SectionEvidenceValidation {
  sectionId: string;
  issueId?: string;
  assessments: EvidenceAssessment[];
  suppliedCount: number;
  missingCount: number;
  weakCount: number;
  contradictoryCount: number;
  missingDescriptions: string[];
  generatorInstruction: string;
}

export interface EvidenceValidationReport {
  sections: SectionEvidenceValidation[];
  overallStatus: 'complete' | 'partial' | 'insufficient';
}

// ─── Confidence + Evidence Chain (Stage 9 / Confidence Engine) ───────────────

export interface EvidenceItem {
  type: 'statute' | 'case_law' | 'client_evidence' | 'fact' | 'rule';
  ref: string;
  source?: string;
  jurisdiction?: string;
  verified: boolean;
  confidence: number;
  excerpt?: string;
}

export interface EvidenceChain {
  /** 0-based paragraph index within the section. */
  paragraphIndex: number;
  paragraphText: string;
  statutes: EvidenceItem[];
  caseLaw: EvidenceItem[];
  clientEvidence: EvidenceItem[];
  missingEvidence: string[];
  /** Why this paragraph is included (explainability). */
  whyIncluded?: string;
  /** Which procedural rule or court rule required this. */
  whichRule?: string;
}

export interface ConfidenceScore {
  /** 0–100 numeric score. */
  score: number;
  grade: 'high' | 'medium' | 'low' | 'unverified';
  citationVerified: boolean;
  groundedSentenceRate: number;
  ungroundedCount: number;
  contradictions: number;
  signals: string[];
}

// ─── Section Result (output of Stage 8–11 per section) ───────────────────────

export type SectionVerificationStatus =
  | 'verified'
  | 'needs_review'
  | 'limited_sources'
  | 'repair_needed'
  | 'repair_failed';

export interface SectionExplainability {
  whyIncluded: string;
  applicableLaw: string[];
  applicableEvidence: string[];
  applicableCases: string[];
  applicableRules: string[];
}

export interface SectionResult {
  sectionId: string;
  type: SectionType;
  title: string;
  content: string;
  confidence: ConfidenceScore;
  evidenceChains: EvidenceChain[];
  verificationStatus: SectionVerificationStatus;
  verificationAudit?: DraftVerificationAudit;
  repairAttempts: number;
  verificationWarnings: string[];
  citationWarnings: string[];
  modelUsed: string;
  tokensUsed: { input: number; output: number };
  explainability: SectionExplainability;
  /** Injected from building-block library — not LLM-generated. */
  isInjectedBoilerplate: boolean;
}

// ─── Rule Engine (Stage 5) ────────────────────────────────────────────────────

export interface LimitationPeriodResult {
  applicable: boolean;
  periodDays?: number;
  rule?: string;
  accrualDate?: string;
  deadlineDate?: string;
  withinLimitation?: boolean;
  notes: string[];
}

export interface CourtFeeResult {
  applicable: boolean;
  feeAmount?: number;
  feeCurrency?: string;
  feeScheduleRef?: string;
  calculationBasis?: string;
  notes: string[];
}

export interface StampDutyResult {
  applicable: boolean;
  dutyRate?: number;
  dutyAmount?: number;
  stateRef?: string;
  notes: string[];
}

export interface ForumJurisdictionResult {
  hasJurisdiction: boolean;
  pecuniaryJurisdiction?: boolean;
  territorialJurisdiction?: boolean;
  correctForum?: string;
  warnings: string[];
  notes: string[];
}

export interface MandatoryAnnexureResult {
  required: string[];
  optional: string[];
  notes: string[];
}

export interface RuleEngineResult {
  limitation: LimitationPeriodResult;
  courtFee: CourtFeeResult;
  stampDuty: StampDutyResult;
  forum: ForumJurisdictionResult;
  annexures: MandatoryAnnexureResult;
  /** Formatted prompt block to inject into section generation. */
  promptBlock: string;
}

// ─── Legal Graph (Stage 3) ────────────────────────────────────────────────────

export interface LegalGraphNode {
  id: string;
  type: 'issue' | 'statute' | 'section' | 'ingredient' | 'exception' | 'case' | 'procedure' | 'evidence' | 'form';
  label: string;
  jurisdiction?: string;
  countryCode?: string;
  authorityId?: string;
}

export interface LegalGraphEdge {
  from: string;
  to: string;
  relation: 'governs' | 'requires' | 'excepts' | 'cites' | 'procedural_step' | 'leads_to';
}

export interface LegalGraph {
  issue: string;
  nodes: LegalGraphNode[];
  edges: LegalGraphEdge[];
  retrievedAt: string;
}

// ─── Final Assembly + Reports (Stage 12) ─────────────────────────────────────

export interface CitationAppendixEntry {
  sectionId: string;
  sectionTitle: string;
  paragraphIndex: number;
  citation: string;
  type: 'statute' | 'case_law';
  verified: boolean;
  source?: string;
  sourceUrl?: string;
  treatmentStatus?: 'good_law' | 'overruled' | 'distinguished' | 'superseded' | 'repealed';
  neutralCitation?: string;
  court?: string;
  decisionYear?: number;
  holding?: string;
  /** Proposition-first verification fields (optional for legacy paths). */
  identityStatus?: 'pass' | 'fail' | 'indeterminate';
  relevanceStatus?: 'pass' | 'fail' | 'indeterminate';
  authorityType?: string;
  citedInDraft?: boolean;
  excluded?: boolean;
  exclusionReason?: string;
  /** Six-dimension verification summary from DraftAuthorityVerificationService. */
  dimensions?: import('@/ai/verification/verification-finding.types').VerificationDimensions;
  verificationFindings?: import('@/ai/verification/verification-finding.types').VerificationFinding[];
  issue?: string;
}

export interface ConfidenceReport {
  overallScore: number;
  overallGrade: 'high' | 'medium' | 'low' | 'unverified';
  sectionScores: Array<{
    sectionId: string;
    type: SectionType;
    score: number;
    grade: string;
  }>;
  totalSections: number;
  verifiedSections: number;
  needsReviewSections: number;
  repairTriggered: boolean;
  totalRepairs: number;
  belowThresholdSections: string[];
}

export interface VerificationReport {
  status: 'verified' | 'needs_review' | 'limited_sources';
  canCertify: boolean;
  certificationLabel: 'lawyer_ready' | 'verified_for_filing' | 'complete_missing_facts' | 'needs_review';
  sectionStatuses: Array<{
    sectionId: string;
    type: SectionType;
    status: SectionVerificationStatus;
    warnings: string[];
  }>;
  overallWarnings: string[];
  requiresLawyerReview: boolean;
}

export interface DraftV2Result {
  /** Merged, formatted document text. */
  draft: string;
  sections: SectionResult[];
  outline: DocumentOutline;
  legalPlan: LegalPlan;
  confidenceReport: ConfidenceReport;
  verificationReport: VerificationReport;
  citationAppendix: CitationAppendixEntry[];
  evidenceValidationReport: EvidenceValidationReport;
  ruleEngineResult: RuleEngineResult;
  creditsUsed: number;
  modelUsed: string;
  draftId?: string;
  /** Top ranked case-law authorities relevant to this draft, for the similar-cases audit panel. */
  similarCases?: import('@/ai/legal-research/similar-cases.types').SimilarCase[];
  counselChecklist?: string;
  proceduralDetermination?: {
    recommendedKind: string;
    userSelectedKind: string;
    kindOverridden: boolean;
    maintainabilityNotes: string[];
    governingSections: Array<{ actId: string; section: string; label: string }>;
  };
  researchPhase?: {
    retrievalConfidence: 'high' | 'medium' | 'low';
    usedDeepResearch: boolean;
    authorityCount: number;
  };
}

// ─── Orchestrator inputs ──────────────────────────────────────────────────────

export interface DraftV2Context {
  userId: string;
  tenantId: string;
}

export interface DraftV2Input {
  kind: string;
  caseDetails: string;
  matterId?: string;
  clientName?: string;
  courtName?: string;
  opposingParty?: string;
  jurisdiction?: string;
  language?: string;
  formNumber?: string;
  formTitle?: string;
  authority?: string;
  practiceArea?: string;
  category?: string;
  attachmentContext?: string;
  label?: string;
  bundleMode?: boolean;
  bundleIndex?: number;
  /** AUTO (default) or PREMIUM — controls model selection and deep-research gating. */
  modelMode?: 'AUTO' | 'PREMIUM';
  pinnedSections?: import('@/ai/drafting/draft-pinned-authorities').PinnedSection[];
  pinnedCaseLaws?: import('@/ai/drafting/draft-pinned-authorities').PinnedCaseLaw[];
  knowledgeSources?: string[];
}

// ─── Memory + Building Blocks (Phase 9) ──────────────────────────────────────

export interface BuildingBlock {
  id: string;
  type: SectionType;
  documentKind?: string;
  title: string;
  content: string;
  jurisdiction?: string;
  verified: boolean;
  lastVerifiedAt?: string;
  usageCount: number;
}

export interface MatterMemoryContext {
  hasPriorDrafts: boolean;
  priorFacts?: string;
  priorEvidence?: EvidenceRef[];
  priorGraph?: MatterGraph;
  factsHash?: string;
}
