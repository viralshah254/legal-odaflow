import type { StatuteCorrection } from '@/ai/india-draft/india-draft-statute-normalizer';
import type { SectionChecksAudit, SimilarCase } from '@/ai/legal-research/similar-cases.types';
import type {
  PublicationState,
  VerificationDimensions,
  VerificationFinding,
  VerifiedPropositionSummary,
} from '@/ai/verification/verification-finding.types';

export type DraftVerificationStatus = 'verified' | 'needs_review' | 'limited_sources';

export interface StrippedCitation {
  original: string;
  reason: string;
}

export interface DraftSentenceAuditSummary {
  coverageRate: number;
  ungroundedCount: number;
}

export interface DraftCitationAudit {
  verified: number;
  total: number;
  unverifiable: string[];
}

export interface DraftVerificationAudit {
  corrections: StatuteCorrection[];
  similarCases: SimilarCase[];
  sectionChecks: SectionChecksAudit;
  citationWarnings: string[];
  strippedCitations: StrippedCitation[];
  citationAudit?: DraftCitationAudit;
  sentenceAudit?: DraftSentenceAuditSummary;
  proceduralWarnings: string[];
  completenessGaps: string[];
  requiresLawyerReview: boolean;
  verificationStatus: DraftVerificationStatus;
  canCertify?: boolean;
  certificationLabel?:
    | 'lawyer_ready'
    | 'verified_for_filing'
    | 'complete_missing_facts'
    | 'needs_review';
  unresolvedFacts?: string[];
  lawyerReady?: boolean;
  factCoverageRate?: number;
  missingDefenceFacts?: string[];
  autoAppliedFixes?: Array<{ originalText: string; suggestedText: string; reason: string }>;
  findings?: VerificationFinding[];
  propositions?: VerifiedPropositionSummary[];
  evidencePackId?: string;
  outputHash?: string;
  dimensions?: VerificationDimensions;
  publicationState?: PublicationState;
  filingReadiness?: FilingReadinessReport;
}

export interface FilingReadinessReport {
  status: 'working_draft' | 'lawyer_review_ready' | 'filing_ready';
  canExportDraft: boolean;
  canExportForFiling: boolean;
  mandatoryBlockers: string[];
  checks: Record<
    | 'facts'
    | 'forum'
    | 'limitation'
    | 'maintainability'
    | 'procedure'
    | 'calculation'
    | 'relief'
    | 'evidence'
    | 'annexures'
    | 'verification'
    | 'currentLaw'
    | 'humanReview',
    'pass' | 'blocked' | 'review'
  >;
}

export interface DraftVerifyInput {
  draft: string;
  kind: string;
  caseDetails: string;
  countryCode: string;
  jurisdiction?: string;
  tenantId: string;
  userId: string;
  proceduralWarnings?: string[];
  completenessGaps?: string[];
  recommendedKind?: string;
  causeTitleVehicle?: string;
  authoritiesOnPoint?: boolean;
  /** Authorities used during draft generation (curated + retrieved). Merged with
   * fresh retrieval so the sanitizer never strips a cite that was explicitly
   * provided to the LLM as a verified authority. */
  groundingAuthorities?: import('@/legal-search/legal-retrieval.types').RetrievedAuthority[];
  offenceDate?: string;
  filingDate?: string;
  /** Optional Case Brief for timeline + fact coverage gates. */
  caseBrief?: import('./draft-case-brief.types').DraftCaseBrief;
  filingGrade?: boolean;
}

export interface DraftVerifyResult {
  draft: string;
  audit: DraftVerificationAudit;
}

export interface AddVerifiedCitationsInput {
  selectedText: string;
  kind: string;
  caseDetails: string;
  countryCode: string;
  jurisdiction?: string;
  tenantId: string;
  userId: string;
  instruction: 'add_citations' | 'strengthen';
}

export interface AddVerifiedCitationsResult {
  revisedText: string;
  explanation: string;
  audit: DraftVerificationAudit;
  inputTokens?: number;
  outputTokens?: number;
  modelName?: string;
}

/** @deprecated Use DraftVerificationAudit */
export type IndiaDraftVerificationAudit = DraftVerificationAudit;
