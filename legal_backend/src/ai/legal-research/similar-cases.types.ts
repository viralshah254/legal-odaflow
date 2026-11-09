/**
 * Types for similar-case retrieval and section mismatch auditing
 * used in the AI Legal Research pipeline.
 */

export type CaseVerificationStatus = 'verified' | 'needs_verification' | 'source_only';

export type SimilarCasesSearchOutcome =
  | 'NO_RESULTS_AFTER_SUCCESSFUL_SEARCH'
  | 'SEARCH_INCOMPLETE'
  | 'PROVIDER_FAILURE'
  | 'AUTHORITIES_FOUND_BUT_UNVERIFIED'
  | 'CASES_FOUND'
  | 'NOT_ATTEMPTED';

export interface SimilarCase {
  authorityId: string;
  title: string;
  citation: string | null;
  neutralCitation?: string | null;
  court: string | null;
  year: string | null;
  sourceUrl: string | null;
  sourceName: string;
  summary: string | null;
  /** Ranked relevance to the query — primary statute sections this case applies. */
  relevantSections: string[];
  /** Why this case is relevant to the current query. */
  relevance: string | null;
  /** How strongly this case supports or corroborates the query result. */
  bindingWeight: 'binding' | 'persuasive' | 'informational' | null;
  /** Confidence score 0–1 from retrieval + ranking. */
  confidence: number;
  verificationStatus: CaseVerificationStatus;
  /** Optional richer card fields for lawyer UI. */
  keyHolding?: string | null;
  outcome?: string | null;
  proceduralStage?: string | null;
  relevantPassage?: string | null;
  whyItMatters?: string | null;
  factualSimilarity?: string | null;
  importantDifferences?: string | null;
  dispositionStance?: 'supports' | 'opposes' | 'mixed' | null;
  subsequentTreatment?: string | null;
  caseScoreBreakdown?: {
    authorityWeight: number;
    jurisdictionWeight: number;
    issueSimilarity: number;
    factualSimilarity: number;
    treatmentWeight: number;
    recencyWeight: number;
    citationNetworkWeight: number;
  };
}

export interface SectionCheckEntry {
  /** Statute/code section as cited in the original AI answer, e.g. "BNSS s.436". */
  originalSection: string;
  /** Section(s) that appear repeatedly in similar cases for the same issue. */
  caseSuggestedSections: string[];
  /** Sections confirmed by primary-law lookup after mismatch was detected. */
  confirmedSections: string[];
  /** Human-readable warnings. */
  warnings: string[];
  /** Whether the answer was corrected before being returned. */
  corrected: boolean;
}

export interface SectionChecksAudit {
  entries: SectionCheckEntry[];
  /** True if at least one section was corrected. */
  anyCorrections: boolean;
  /** True if any mismatch could not be confirmed — caller should set requiresLawyerReview. */
  anyUnconfirmedMismatches: boolean;
}
