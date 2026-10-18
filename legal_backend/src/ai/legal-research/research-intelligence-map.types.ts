/**
 * AI-first research planning artifact.
 * Candidates are hypotheses from model knowledge until retrieved and verified.
 */

export type CandidateOrigin = 'MODEL_KNOWLEDGE' | 'CORPUS' | 'LIVE';

export type CandidateVerificationStatus =
  | 'CANDIDATE'
  | 'RETRIEVED'
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'REJECTED';

export interface CandidateAuthority {
  id: string;
  kind: 'statute' | 'regulation' | 'case' | 'regulator' | 'doctrine' | 'secondary';
  title: string;
  citation?: string | null;
  court?: string | null;
  proposition?: string | null;
  searchHints: string[];
  origin: CandidateOrigin;
  verificationStatus: CandidateVerificationStatus;
  confidence?: 'high' | 'medium' | 'low';
  note?: string | null;
  /** Resolved authority id after live/corpus retrieval. */
  resolvedAuthorityId?: string | null;
}

export interface LegalIssueMapEntry {
  id: string;
  label: string;
  kind?:
    | 'substantive'
    | 'procedural'
    | 'evidentiary'
    | 'remedy'
    | 'limitation'
    | 'forum'
    | 'interim'
    | 'other';
  priority?: number;
}

export interface CandidateDoctrine {
  name: string;
  proposition?: string | null;
  searchHints: string[];
}

export interface CandidateRoute {
  forum: string;
  procedure?: string | null;
  relief?: string | null;
  searchHints: string[];
}

export interface ResearchQueryPlan {
  id: string;
  query: string;
  purpose:
    | 'statute'
    | 'case'
    | 'regulation'
    | 'regulator'
    | 'procedure'
    | 'contrary'
    | 'current_law'
    | 'general';
  issueIds?: string[];
  priority: number;
}

export interface ResearchIntelligenceMap {
  version: 1;
  modelName: string;
  degraded: boolean;
  degradationReason?: string;
  jurisdiction: string[];
  jurisdictionConfidence: number;
  issues: LegalIssueMapEntry[];
  likelyDoctrines: CandidateDoctrine[];
  likelyStatutes: CandidateAuthority[];
  likelyRegulations: CandidateAuthority[];
  likelyCases: CandidateAuthority[];
  likelyProceduralRoutes: CandidateRoute[];
  likelyRegulators: CandidateAuthority[];
  terminology: string[];
  alternateTerminology: string[];
  unresolvedQuestions: string[];
  researchQueries: ResearchQueryPlan[];
  contraryAuthorityQueries: ResearchQueryPlan[];
  generatedAt: string;
}

export type SimilarCasesSearchOutcome =
  | 'NO_RESULTS_AFTER_SUCCESSFUL_SEARCH'
  | 'SEARCH_INCOMPLETE'
  | 'PROVIDER_FAILURE'
  | 'AUTHORITIES_FOUND_BUT_UNVERIFIED'
  | 'CASES_FOUND'
  | 'NOT_ATTEMPTED';

export interface IssueCoverageCell {
  issueId: string;
  issueLabel: string;
  law: boolean;
  cases: boolean;
  current: boolean;
  contrary: boolean;
}

export interface IssueCoverageMatrix {
  cells: IssueCoverageCell[];
  redCells: Array<{
    issueId: string;
    dimension: 'law' | 'cases' | 'current' | 'contrary';
    suggestedQueries: string[];
    /** When true, coverage loops must not schedule more retrieves for this cell. */
    nonRetryable?: boolean;
    reason?: string;
  }>;
  complete: boolean;
  loopsRun: number;
  /** Dimensions that remain incomplete because live providers failed (honest UI signal). */
  providerLimitedDimensions?: Array<'cases' | 'law' | 'current' | 'contrary'>;
}
