import type { LegalDomain } from '@/ai/legal-research/legal-research-classifier.service';

export type SourceTier = 'primary' | 'case_law' | 'firm' | 'web' | 'seed';

export type TreatmentStatus = 'good_law' | 'overruled' | 'distinguished' | 'superseded' | 'repealed';

export type SourceCompleteness = 'COMPLETE' | 'PARTIAL' | 'EXCERPT' | 'UNKNOWN';
export type ExtractionMethod =
  | 'NATIVE_TEXT'
  | 'STRUCTURED_API'
  | 'OCR'
  | 'MANUAL'
  | 'WEB_SCRAPE'
  | 'UNKNOWN';
export type AuthoritativeStatus =
  | 'OFFICIAL'
  | 'AUTHENTICATED_COPY'
  | 'REPORTED'
  | 'CURATED'
  | 'AGGREGATOR'
  | 'SECONDARY'
  | 'UNKNOWN';
export type UserAuthorityStatus =
  | 'LEGAL_AUTHORITY'
  | 'PERSUASIVE_MATERIAL'
  | 'FACTUAL_MATERIAL_ONLY'
  | 'UNVERIFIED'
  | 'NOT_AUTHORITY';
export type UserCitationVerificationStatus =
  | 'VERIFIED_EXACT'
  | 'VERIFIED_WITH_CORRECTION'
  | 'MULTIPLE_POSSIBLE_MATCHES'
  | 'NOT_FOUND'
  | 'CONTRADICTS_REQUESTED_PROPOSITION';
export type PassageClassification =
  | 'HOLDING'
  | 'RATIO'
  | 'DICTA'
  | 'PROCEDURAL_HISTORY'
  | 'PARTY_SUBMISSION'
  | 'LOWER_COURT_FINDING'
  | 'FACT'
  | 'HEADNOTE'
  | 'STATUTORY_TEXT'
  | 'REGULATORY_TEXT'
  | 'COMMENTARY'
  | 'CONCURRENCE'
  | 'DISSENT'
  | 'EDITORIAL_SUMMARY'
  | 'UNKNOWN';

export interface OcrIntegrity {
  used: boolean;
  confidence?: number;
  humanReviewed?: boolean;
  pageCoverage?: number;
}

export interface LanguageTranslationIntegrity {
  sourceLanguage?: string;
  extractedLanguage?: string;
  translated?: boolean;
  targetLanguage?: string;
  method?: 'HUMAN' | 'MACHINE' | 'OFFICIAL' | 'UNKNOWN';
  humanReviewed?: boolean;
}

/** Chain-of-custody and content-integrity metadata for an exact retrieved document. */
export interface SourceProvenance {
  provider: string;
  retrievedAt: string;
  canonicalIdentity?: string;
  canonicalUrl?: string;
  documentHash?: string;
  edition?: string;
  pageCount?: number;
  missingPages?: number[];
  paragraphNumberingIntegrity?: 'INTACT' | 'CORRUPT' | 'UNKNOWN';
  dispositionComplete?: boolean;
  duplicateFamilyId?: string;
  completeness: SourceCompleteness;
  extractionMethod: ExtractionMethod;
  authoritativeStatus: AuthoritativeStatus;
  ocr?: OcrIntegrity;
  language?: LanguageTranslationIntegrity;
  userAuthorityStatus?: UserAuthorityStatus;
  userCitationVerificationStatus?: UserCitationVerificationStatus;
  extractorVersion?: string;
}

export interface ProceduralPostureMetadata {
  stage?: 'TRIAL' | 'INTERLOCUTORY_APPEAL' | 'APPEAL' | 'FINAL_APPEAL' | 'REVIEW' | 'OTHER';
  disposition?: string;
  originatingCourt?: string;
  appealedFrom?: string;
  finalJudgment?: boolean;
}

export interface PrecedentMetadata {
  bindingStatus?: 'BINDING' | 'PERSUASIVE' | 'NON_PRECEDENTIAL' | 'UNKNOWN';
  courtLevel?: string;
  benchStrength?: number;
  enBancOrFullBench?: boolean;
  controllingJurisdiction?: string;
  treatmentStatus?: TreatmentStatus | 'reversed' | 'doubted' | 'followed' | 'affirmed';
  treatmentVerified?: boolean;
  treatmentSourceUrl?: string;
}

export interface RetrievedSourcePassage {
  text: string;
  paragraph?: string;
  page?: number;
  /** True only when the pinpoint came from source metadata/markup. */
  sourcePinpoint?: boolean;
  classification?: PassageClassification;
  classificationConfidence?: number;
}

/** Structured signals produced by matter classification/planning, when available. */
export type RequestedAuthorityType =
  | 'CASE_LAW'
  | 'BINDING_PRECEDENT'
  | 'ADVERSE_AUTHORITY'
  | 'STATUTE'
  | 'RULE'
  | 'REGULATION'
  | 'CITATION';

export interface LegalQueryEntity {
  text: string;
  type?: 'PERSON' | 'ORGANISATION' | 'COURT' | 'REGULATOR' | 'STATUTE' | 'LEGAL_RELATIONSHIP' | 'OTHER';
}

export interface LegalIssueDecomposition {
  issue: string;
  subIssues?: string[];
}

export interface StructuredLegalQueryContext {
  legalIssues?: string[];
  statuteSections?: string[];
  doctrines?: string[];
  proceduralPosture?: string;
  propositionPhrases?: string[];
  entities?: LegalQueryEntity[];
  remedies?: string[];
  requestedAuthorityTypes?: RequestedAuthorityType[];
  issueDecomposition?: LegalIssueDecomposition[];
}

export interface RetrievedAuthority {
  id: string;
  title: string;
  citation: string | null;
  neutralCitation?: string | null;
  sourceName: string;
  summary: string | null;
  fullText?: string | null;
  sourceUrl?: string | null;
  sourceTier: SourceTier;
  authorityType?: string;
  court?: string | null;
  decisionDate?: string | Date | null;
  practiceAreas?: string[];
  topics?: string[];
  paragraph?: string | null;
  page?: number | null;
  actName?: string | null;
  actYear?: number | null;
  section?: string | null;
  heading?: string | null;
  regulator?: string | null;
  instrumentType?: string | null;
  instrumentNumber?: string | null;
  instrumentDate?: string | Date | null;
  score?: number;
  isRepealed?: boolean;
  repealNotes?: string | null;
  /** Treatment status — good_law is the default; overruled authorities should be excluded from drafts. */
  treatmentStatus?: TreatmentStatus;
  /** Year of decision, for recency ranking. */
  decisionYear?: number;
  /** Court level for authority ranking (0 = Supreme Court, higher = lower courts). */
  courtTierRank?: number;
  /** Deterministic live-candidate admission score and audit explanation. */
  relevanceScore?: number;
  relevanceReason?: string;
  relevanceGate?: 'admitted' | 'rejected';
  /** Source-preserved passages used to create exact evidence-pack entries. */
  sourcePassages?: RetrievedSourcePassage[];
  sourceProvenance?: SourceProvenance;
  userAuthorityStatus?: UserAuthorityStatus;
  proceduralPosture?: ProceduralPostureMetadata;
  precedent?: PrecedentMetadata;
}

export interface LegalRetrievalInput extends StructuredLegalQueryContext {
  query: string;
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  /** Detected legal domain used to construct and rank topic-appropriate retrieval. */
  legalDomain?: LegalDomain;
  subPracticeArea?: string;
  nature?: string;
  expandedQueries?: string[];
  searchTopics?: string[];
  isBareActQuery?: boolean;
  tenantId?: string;
  userId?: string;
  matterId?: string;
  consumerCaseId?: string;
  intakeFacts?: string;
  limit?: number;
  supplementLive?: boolean;
  priorAuthorities?: RetrievedAuthority[];
  /** Restrict retrieval to these source categories (e.g. ['statutes','case_law','firm_vault']). When omitted all are queried. */
  knowledgeSources?: string[];
  /** FAST mode uses fewer query variants and lighter live-connector policy. */
  researchMode?: 'FAST' | 'DEEP' | 'GUIDANCE';
  /** When true, skip Tavily web supplement unless user explicitly selected web sources. */
  skipTavilyInFast?: boolean;
  /** Run-scoped: skip India Kanoon after unauthorized/circuit_open this research job. */
  skipIndiaKanoon?: boolean;
  /** Run-scoped: skip Tavily after repeated provider failures this research job. */
  skipTavily?: boolean;
  /** Run-scoped: skip RBI live fetches after circuit/block failures this research job. */
  skipLiveRegulations?: boolean;
}

export interface LegalRetrievalResult {
  authorities: RetrievedAuthority[];
  isBareActQuery: boolean;
  confidence: 'high' | 'medium' | 'low';
  primaryTierCount: number;
  queryHash: string;
  /** Populated when the query names a specific statute section (e.g. BNSS s.101). */
  requestedSection?: { actId: string; section: string; statuteShortName?: string };
  /** True when the exact section was found in corpus and pinned at rank 0. */
  exactSectionFound?: boolean;
  /** Nearby sections returned as suggestions only — never used in synthesis context. */
  suggestedSections?: RetrievedAuthority[];
  /** True when the final authority set is materially off-topic for the detected domain. */
  domainFitLow?: boolean;
  /** Candidates excluded by permanent integrity gates and never sent to synthesis. */
  rejectedCandidates?: Array<{
    authorityId: string;
    reason: string;
    gate: 'heading_only_statute' | 'citation_metadata' | 'case_relevance';
  }>;
  /** Diagnostics are retained for admin telemetry and retrieval deduplication. */
  connectorDiagnostics?: Array<{
    provider: string;
    status: string;
    durationMs?: number;
    hitCount?: number;
    message?: string;
    error?: string;
  }>;
  retrievalTimings?: Record<string, number>;
}

export interface AuthorityBundleEntry {
  authorityId: string;
  title: string;
  citation: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  sourceTier: SourceTier;
  retrievedAt: string;
}

export interface AuthorityBundle {
  id: string;
  scope: 'intake' | 'lead' | 'matter' | 'research';
  scopeId: string;
  query: string;
  queryHash: string;
  countryCode: string;
  jurisdiction?: string;
  entries: AuthorityBundleEntry[];
  parentBundleId?: string;
  createdAt: string;
}

export type VerificationStatus = 'passed' | 'warning' | 'failed' | 'insufficient';

export interface ProvenanceMetadata {
  verificationStatus: VerificationStatus;
  sourceTierSummary: string;
  corpusEdition?: string;
  groundedQuoteRate?: number;
  requiresLawyerReview: boolean;
  jurisdictionNotice?: string;
  findings?: unknown;
  dimensions?: unknown;
  publicationState?: string;
  outputHash?: string;
}
