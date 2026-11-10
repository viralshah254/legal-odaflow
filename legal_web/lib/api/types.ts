export type UserType = "CONSUMER" | "LAWYER" | "SUPER_ADMIN"

export type TenantRole =
  | "FIRM_ADMIN"
  | "PARTNER"
  | "ASSOCIATE"
  | "FINANCE"
  | "INTAKE"

/** Full ISO-3166 alpha-2 country code. Tier-1 (IN/US/KE/GB) gets deep legal analysis; all others get best-effort. */
export type CountryCode = string

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export interface ApiUser {
  id: string
  email: string
  name: string | null
  userType: UserType
  countryCode: string | null
  tenantId?: string
  tenantRole?: TenantRole
  mustChangePassword?: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: string
  user: ApiUser
}

export interface RegisterRequest {
  email: string
  password: string
  userType: UserType
  countryCode: CountryCode
  jurisdiction?: string
  name?: string
  phone?: string
  firmName?: string
  referralCode?: string
  deviceFingerprint?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface RefreshRequest {
  refreshToken: string
}

export interface ConsumerCase {
  id: string
  userId: string
  countryCode: string
  jurisdiction?: string | null
  issueType: string
  title: string
  facts?: string | null
  desiredOutcome?: string | null
  urgencyLevel?: UrgencyLevel
  status: string
  riskScore?: number | null
  createdAt: string
  updatedAt: string
  reports?: ConsumerLegalReport[]
  documents?: ConsumerDocument[]
  reviewRequests?: unknown[]
}

export interface ConsumerLegalReport {
  id: string
  userId: string
  consumerCaseId: string
  countryCode: string
  reportType: string
  title: string
  contentMarkdown: string
  citations?: unknown
  riskLevel?: string | null
  requiresLawyer?: boolean
  isPreview: boolean
  createdAt: string
}

export interface ConsumerDocument {
  id: string
  userId?: string
  consumerCaseId: string
  fileName: string
  fileUrl?: string
  mimeType?: string | null
  fileSizeBytes?: number | null
  documentType?: string | null
  extractedText?: string | null
  aiSummary?: string | null
  ocrStatus?: string
  createdAt: string
}

export interface UploadConsumerDocumentRequest {
  consumerCaseId: string
  fileName: string
  fileUrl: string
  mimeType?: string
  documentType?: string
  fileSizeBytes?: number
}

export interface UploadConsumerDocumentResponse {
  document: ConsumerDocument
  ocrJob: {
    status: string
    message: string
    agentJobId?: string
  }
}

export interface DocumentJobStatus {
  id: string
  status: string
  jobType?: string
  error?: string | null
  document?: ConsumerDocument
  ocrStatus?: string
  aiSummary?: string | null
  extractedText?: string | null
}

export interface TenantInfo {
  id: string
  name: string
  type: string
  primaryCountry: string
  defaultCurrency: string
  billingPlan: string | null
  dataRegion: string | null
  ssoConfig?: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TenantMembership {
  tenantId: string
  role: TenantRole
  tenant: TenantInfo
}

export interface ApiMatter {
  id: string
  tenantId: string
  clientId: string | null
  title: string
  countryCode: string
  jurisdiction?: string | null
  courtName?: string | null
  courtLevel?: string | null
  caseNumber?: string | null
  practiceArea: string
  matterType: string
  stage?: import("@/lib/matters/lifecycle").MatterStage | string | null
  status: import("@/lib/matters/lifecycle").MatterStatus | string
  factsSummary?: string | null
  desiredOutcome?: string | null
  opposingParty?: string | null
  riskScore?: number | null
  planningAnswers?: Record<string, unknown> | null
  draftWorkspace?: Record<string, unknown> | null
  matterProfile?: import("@/lib/matter-intelligence").MatterProfile | null
  matterGraph?: import("@/lib/matter-intelligence").MatterGraph | null
  matterTaskGraph?: import("@/lib/matter-intelligence").MatterTaskGraph | null
  createdAt: string
  updatedAt: string
  client?: ApiClient | null
}

export interface ContactPerson {
  name: string
  role?: string
  email?: string
  phone?: string
}

export interface ApiClient {
  id: string
  tenantId: string
  clientCode: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  type: string
  countryCode?: string | null
  contactPeople?: ContactPerson[] | null
  createdAt: string
  updatedAt: string
}

export interface CreateMatterRequest {
  clientId: string
  title: string
  countryCode: CountryCode
  jurisdiction?: string
  courtName?: string
  courtLevel?: string
  caseNumber?: string
  practiceArea: string
  matterType: string
  factsSummary?: string
  desiredOutcome?: string
  opposingParty?: string
}

export interface UpdateMatterRequest {
  clientId?: string
  title?: string
  jurisdiction?: string
  courtName?: string
  courtLevel?: string
  caseNumber?: string
  practiceArea?: string
  matterType?: string
  status?: string
  stage?: string
  factsSummary?: string
  desiredOutcome?: string
  opposingParty?: string
  riskScore?: number
}

export type ClientType = "INDIVIDUAL" | "COMPANY" | "NGO" | "PARTNERSHIP"

export interface CreateClientRequest {
  name: string
  email?: string
  phone?: string
  address?: string
  type?: ClientType
  countryCode?: CountryCode
  contactPeople?: ContactPerson[]
}

export interface UpdateClientRequest {
  name?: string
  email?: string
  phone?: string
  address?: string
  type?: ClientType
  countryCode?: CountryCode
  contactPeople?: ContactPerson[]
}

export interface ApiInvoice {
  id: string
  tenantId: string
  clientId: string | null
  matterId?: string | null
  invoiceNumber: string
  amount: string | number
  currency: string
  status: string
  billingModel?: string | null
  metadata?: {
    matterId?: string
    description?: string
    lineItems?: Array<{ description: string; amount: number; dueDate?: string }>
    contingencyPercent?: number
    contingencyTrigger?: string
  } | null
  dueDate: string | null
  createdAt: string
}

export interface CreateInvoiceRequest {
  clientId?: string
  matterId?: string
  invoiceNumber: string
  amount: number
  currency: string
  dueDate?: string
}

export interface ApiTrustAccount {
  id: string
  tenantId: string
  name: string
  currency: string
  balance: string | number
  createdAt: string
  entries?: ApiTrustEntry[]
}

export interface ApiTrustEntry {
  id: string
  accountId: string
  matterId?: string | null
  type: string
  amount: string | number
  description: string | null
  status: string
  reviewedAt?: string | null
  reviewNote?: string | null
  createdAt: string
}

export interface CreateTrustAccountRequest {
  name: string
  currency: string
}

export interface CreateTrustEntryRequest {
  type: string
  amount: number
  matterId?: string
  description?: string
}

export interface LegalResearchRequest {
  query: string
  countryCode: CountryCode
  jurisdiction?: string
  matterId?: string
  /** Explicit matter documents authorized for this run. Empty means no document text. */
  selectedDocumentIds?: string[]
  /** Explicit filed research authorized for this run. Empty means no prior research text. */
  selectedSavedResearchIds?: string[]
  contextScope?: "SELECTED" | "MATTER" | "FOLDERS"
  selectedFolderIds?: string[]
  aiModelMode?: "AUTO" | "PREMIUM"
  premiumModelId?: string
  researchMode?: "FAST" | "DEEP" | "GUIDANCE"
  /** Summarised prior exchange(s) from the same session for conversation-aware follow-ups. */
  priorContext?: string
  outputLanguage?: "en" | "hi" | "hinglish"
  /** Explicit knowledge sources to search (e.g. statutes, case_law, firm_vault). */
  knowledgeSources?: string[]
  asOfDate?: string
  eventDate?: string
  desiredOutput?: "ANSWER" | "AUTHORITY_LIST" | "ANALYSIS" | "MEMO" | "VERIFICATION"
  requestedTaskKind?: ResearchTaskKind
}

export type CaseVerificationStatus = "verified" | "needs_verification" | "source_only"

export interface SimilarCase {
  keyHolding?: string | null
  outcome?: string | null
  proceduralStage?: string | null
  relevantPassage?: string | null
  authorityId: string
  title: string
  citation: string | null
  neutralCitation?: string | null
  court: string | null
  year: string | null
  sourceUrl: string | null
  sourceName: string
  summary: string | null
  relevantSections: string[]
  relevance: string | null
  bindingWeight: "binding" | "persuasive" | "informational" | null
  confidence: number
  verificationStatus: CaseVerificationStatus
}

export interface SectionCheckEntry {
  originalSection: string
  caseSuggestedSections: string[]
  confirmedSections: string[]
  warnings: string[]
  corrected: boolean
}

export interface SectionChecksAudit {
  entries: SectionCheckEntry[]
  anyCorrections: boolean
  anyUnconfirmedMismatches: boolean
}

export type CaseLawSearchStatus =
  | "not_configured"
  | "searched"
  | "no_hits"
  | "error"
  | "timeout"
  | "rate_limited"
  | "unauthorized"
  | "circuit_open"

export interface ResearchIssueGap {
  issueId?: string
  issue?: string
  gapType?: string
  description?: string
  reason?: string
  expectedAuthority?: string
  severity?: string
  [key: string]: unknown
}

export interface ResearchSourceDiagnostic {
  provider?: string
  source?: string
  status?: "searched" | "skipped" | "error" | string
  durationMs?: number
  hitCount?: number
  admittedCount?: number
  rejectedCount?: number
  hydratedCount?: number
  message?: string
  error?: string
  [key: string]: unknown
}

export interface RejectedResearchCandidate {
  authorityId: string
  reason: string
  gate: "heading_only_statute" | "citation_metadata" | "case_relevance" | string
  [key: string]: unknown
}

export type ResearchTaskKind =
  | "SECTION_LOOKUP"
  | "STATUTORY_INTERPRETATION"
  | "CASE_LOOKUP"
  | "CASE_SURVEY"
  | "CASE_ANALYSIS"
  | "CASE_COMPARISON"
  | "CITATION_VERIFICATION"
  | "CURRENT_LAW"
  | "ADVERSE_AUTHORITY"
  | "PROCEDURE"
  | "GENERAL_RESEARCH"
  | "MATTER_OPINION"

export interface ResearchTaskProfile {
  taskKind?: ResearchTaskKind | string
  kind?: ResearchTaskKind | string
  primary?: ResearchTaskKind | string
  label?: string
  objective?: string
  jurisdiction?: string
  matterAware?: boolean
  requiresCurrentLaw?: boolean
  asOfDate?: string
  archetype?: string
  answerShape?: {
    desiredOutput?: LegalResearchRequest["desiredOutput"]
    includeCaseSurveyLayers?: boolean
    [key: string]: unknown
  }
  evidenceBundle?: {
    targetCases?: number
    targetSections?: number
    minCases?: number
    requireTreatment?: boolean
    requireSimilarCases?: boolean
    sourceClasses?: string[]
    [key: string]: unknown
  }
  publicationPolicy?: {
    allowPartialPublication?: boolean
    allowResearchLeads?: boolean
    [key: string]: unknown
  }
  sourcePlan?: {
    mode: "AUTO" | "CUSTOM"
    effectiveSources: string[]
    discoverySources?: string[]
    reasons?: string[]
  }
  [key: string]: unknown
}

export interface ResearchPlan {
  id?: string
  objective?: string
  jurisdiction?: string | { country: string; region?: string; court?: string }
  subQuestions?: string[]
  sourceRequirements?: string[]
  freshnessRequirement?: "current" | "as_of_date" | "historical" | string
  asOfDate?: string
  request?: { asOfDate?: string; eventDate?: string; objective?: string }
  exclusionRules?: string[]
  outputFormat?: "memo" | "summary" | "answer" | "brief" | string
  issues?: Array<{
    id: string
    question: string
    materiality?: string
    status?: string
    dependsOn?: string[]
    contraryPositionRequired?: boolean
  }>
  queries?: Array<{ id: string; issueId: string; family: string; query: string; purpose?: string }>
  blockers?: string[]
  executable?: boolean
  contraryChecks?: Array<{ issueId: string; required: boolean; complete: boolean }>
  [key: string]: unknown
}

export interface CapabilitySnapshot {
  capturedAt?: string
  currentLawCheck?: boolean
  sourceRetrieval?: boolean
  citationVerification?: boolean
  factAccess?: boolean
  matterAccess?: boolean
  unavailableCapabilities?: string[]
  availableCapabilities?: string[]
  limitations?: string[]
  generatedAt?: string
  confidenceCeiling?: "HIGH" | "MEDIUM" | "LOW" | "NONE" | string
  coveredJurisdictions?: string[]
  courtCoverage?: Array<{ court: string; fromDate?: string; toDate?: string; complete?: boolean }>
  statuteEditions?: Array<{ corpusId: string; edition: string; asOfDate?: string }>
  treatmentGraphAvailable?: boolean
  pinpointSupport?: boolean
  officialSourceAccess?: boolean
  fullTextSupport?: boolean
  ocrSupport?: boolean
  languageSupport?: string[]
  connectorAvailability?: Record<string, boolean>
  sources?: Array<{
    id: string
    kind?: string
    jurisdiction?: string
    capabilities?: string[]
    available?: boolean
    reason?: string
  }>
  [key: string]: unknown
}

export interface ResearchSourceProvenance {
  sourceId?: string
  sourceName?: string
  sourceType?: string
  sourceTier?: string
  uri?: string
  retrievedAt?: string
  contentHash?: string
  authorityIdentity?: string
  provider?: string
  canonicalUrl?: string
  documentHash?: string
  completeness?: "COMPLETE" | "PARTIAL" | "EXCERPT" | "UNKNOWN" | string
  extractionMethod?: string
  authoritativeStatus?: string
  pageCount?: number
  missingPages?: number[]
  paragraphNumberingIntegrity?: string
  dispositionComplete?: boolean
  language?: {
    sourceLanguage?: string
    extractedLanguage?: string
    translated?: boolean
    targetLanguage?: string
    method?: string
    humanReviewed?: boolean
  }
  [key: string]: unknown
}

export interface ResearchSourceIntegrity {
  status?: "VERIFIED" | "PARTIAL" | "FAILED" | "UNKNOWN" | string
  hashVerified?: boolean
  identityVerified?: boolean
  passageVerified?: boolean
  issues?: string[]
  reason?: string
  [key: string]: unknown
}

export type ResearchConfidenceLevel =
  | "CONFLICTED"
  | "UNKNOWN"
  | "TENTATIVE"
  | "CORROBORATED"
  | "VERIFIED"

export interface ResearchConfidenceSummary {
  level: ResearchConfidenceLevel | string
  score?: number
  ceiling?: ResearchConfidenceLevel | string
  reasons?: string[]
  blockers?: string[]
  [key: string]: unknown
}

export type ResearchPublicationDecision = "VERIFIED" | "PARTIAL" | "GAP" | "ABSTAIN"

export interface ResearchPublicationAssessment {
  decision: ResearchPublicationDecision | string
  reasons?: string[]
  blockers?: string[]
  publishableNodeIds?: string[]
  issues?: Array<{
    code?: string
    message: string
    blocking?: boolean
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface ResearchConflict {
  id?: string
  issue?: string
  description?: string
  authorities?: string[]
  unresolved?: boolean
  resolution?: string
  [key: string]: unknown
}

export interface ResearchFactSummary {
  id?: string
  statement: string
  status?: "VERIFIED" | "DISPUTED" | "ASSUMED" | "UNVERIFIED" | string
  materiality?: "DISPOSITIVE" | "MATERIAL" | "CONTEXT" | string
  sourceIds?: string[]
  [key: string]: unknown
}

export interface ResearchPropositionSummary {
  id?: string
  statement: string
  kind?: "LEGAL_RULE" | "FACT" | "APPLICATION" | "CONCLUSION" | string
  supportStatus?: string
  confidence?: ResearchConfidenceSummary
  evidenceIds?: string[]
  [key: string]: unknown
}

export interface ResearchAuditMetadata {
  packetId?: string
  schemaVersion?: string
  packetHash?: string
  outputHash?: string
  createdAt?: string
  models?: Array<{ id: string; version: string; hash?: string }>
  prompts?: Array<{ id: string; version: string; hash?: string }>
  humanApproval?: {
    status: "not_requested" | "pending" | "approved" | "rejected" | string
    decidedAt?: string
  }
  [key: string]: unknown
}

export interface UserAuthorityCheck {
  suppliedCitation: string
  status:
    | "VERIFIED_EXACT"
    | "VERIFIED_WITH_CORRECTION"
    | "MULTIPLE_POSSIBLE_MATCHES"
    | "NOT_FOUND"
    | "CONTRADICTS_REQUESTED_PROPOSITION"
  authorityId?: string
  resolvedCitation?: string
}

export interface LegalResearchResponse {
  answer: string
  citations: Array<{
    sourceVerified?: boolean
    currentLawVerified?: boolean
    title: string
    source: string
    url?: string
    canonicalUrl?: string
    deepLinkUrl?: string
    citation?: string
    authorityId?: string
    summary?: string
    caseName?: string
    parties?: string | string[]
    judgmentDate?: string
    neutralCitation?: string
    relevantParagraphs?: string | string[]
    propositionActuallyDecided?: string
    exactPassage?: string
    passageText?: string
    excerpt?: string
    sourceName?: string
    sourceTier?: string
    retrievedAt?: string
    sourceHash?: string
    pinpoint?: string
    provenance?: ResearchSourceProvenance
    integrity?: ResearchSourceIntegrity
  }>
  /** Structured memo emitted by the verified research synthesis pipeline. */
  structuredDraft?: LegalResearchDraft
  mode: string
  disclaimer: string
  creditsUsed?: number
  timeToFirstDraftMs?: number
  /** When true, no research credit was charged because retrieval produced no admissible authority. */
  creditWaived?: boolean
  fromCache?: boolean
  /** Creation/retrieval timestamp used to warn when cached or historical law may be stale. */
  generatedAt?: string
  modelName?: string
  confidence?: "Low" | "Medium" | "High"
  jurisdiction?: string
  countryCode?: string
  sourceTrace?: string[]
  limitations?: string[]
  /** AI-generated follow-up question chips specific to the current research. */
  suggestedFollowUpQuestions?: string[]
  requiresLawyerReview?: boolean
  researchMode?: string
  /** Thin-RAG / best-effort doctrine synthesis (not source-verified). */
  analyticalMode?: boolean
  analyticalModeReasons?: string[]
  relianceMode?: "source-grounded" | "analytical-guidance"
  tripleCheck?: {
    verifiedCount: number
    correctedCount: number
    unverifiedCount: number
    authorities: Array<{
      raw: string
      state: "verified" | "corrected" | "unverified"
      agreementCount: number
      checks: { corpus: boolean; connector: boolean; web: boolean }
      correctedTo?: string
    }>
  }
  citationAudit?: {
    verifiedCitationCount: number
    unsupportedClaims: Array<{ claim: string; citations: string[] }>
    warnings: string[]
    totalClaims?: number
    supportedClaims?: number
    totalCitations?: number
    verifiedCitations?: number
    unverifiedCitations?: string[]
    foundCitationCount?: number
    citations?: import("./verification").CitationAuditEntry[]
    rejectedCitations?: import("./verification").CitationAuditEntry[]
    verificationGaps?: import("./verification").CitationVerificationGap[]
    safeForReliance?: boolean
    kenyaVerified?: boolean
    verificationDowngradeReasons?: string[]
    sourceQuality?:
      | "OFFICIAL_PRIMARY"
      | "MIXED_PRIMARY_SECONDARY"
      | "SECONDARY_ONLY"
      | "INSUFFICIENT"
      | null
  } | null
  /** Similar case-law authorities retrieved to cross-check sections and reasoning. */
  similarCases?: SimilarCase[]
  /** Honest empty-state taxonomy for similar cases. */
  similarCasesSearchOutcome?:
    | "NO_RESULTS_AFTER_SUCCESSFUL_SEARCH"
    | "SEARCH_INCOMPLETE"
    | "PROVIDER_FAILURE"
    | "AUTHORITIES_FOUND_BUT_UNVERIFIED"
    | "CASES_FOUND"
    | "NOT_ATTEMPTED"
  intelligenceMap?: {
    degraded?: boolean
    jurisdiction?: string[]
    issues?: Array<{ id: string; label: string }>
    likelyCases?: unknown[]
    likelyStatutes?: unknown[]
    likelyRegulations?: unknown[]
  }
  issueCoverageMatrix?: {
    complete: boolean
    loopsRun: number
    redCells?: unknown[]
    cells?: unknown[]
  }
  researchTrail?: {
    mapDegraded?: boolean
    candidateDiagnostics?: Array<{
      candidateId: string
      title: string
      status: string
      hitCount: number
      queriesTried: string[]
    }>
    coverageLoops?: number
    liveRetrievalForced?: boolean
    sourceRegistryJurisdiction?: string
  }
  unverifiedResearchLeads?: Array<{
    title: string
    citation?: string | null
    court?: string | null
    searchPhrase?: string | null
    note?: string | null
  }>
  adaptiveEvidenceSummary?: {
    targetCases: number
    targetSections: number
    casesAdded: number
    sectionsAdded: number
    verifiedCases: number
    partialCases: number
    researchLeads: number
    automaticEnrichmentCredits: number
  }
  caseEvidenceLayers?: {
    verifiedCases: SimilarCase[]
    partiallyVerifiedCases: SimilarCase[]
    researchLeads: NonNullable<LegalResearchResponse["unverifiedResearchLeads"]>
  }
  /** Audit of statute/section cross-checks performed against similar cases. */
  sectionChecks?: SectionChecksAudit | null
  findings?: import("./verification").VerificationFinding[]
  propositions?: import("./verification").VerifiedPropositionSummary[]
  dimensions?: import("./verification").VerificationDimensions
  publicationState?: import("./verification").PublicationState
  evidencePackId?: string
  outputHash?: string
  /** Persisted AIOutput id for save/enrich actions. */
  aiOutputId?: string
  caseLawSearchStatus?: CaseLawSearchStatus
  /** Issues for which the retrieval/publication pipeline could not establish adequate support. */
  issueGaps?: Array<string | ResearchIssueGap>
  /** User-safe source diagnostics returned by the publication pipeline. */
  sourceDiagnostics?: ResearchSourceDiagnostic[]
  /** Per-connector retrieval outcomes retained for end-to-end diagnostics. */
  connectorDiagnostics?: ResearchSourceDiagnostic[]
  /** Candidates excluded before synthesis by integrity and subject-matter gates. */
  rejectedCandidates?: RejectedResearchCandidate[]
  taskProfile?: ResearchTaskProfile
  researchPlan?: ResearchPlan
  capabilitySnapshot?: CapabilitySnapshot
  sourceProvenance?: ResearchSourceProvenance[]
  sourceIntegrity?: ResearchSourceIntegrity
  conflicts?: Array<string | ResearchConflict>
  confidenceAssessment?: ResearchConfidenceSummary
  publicationDecision?: ResearchPublicationDecision | ResearchPublicationAssessment
  factSummaries?: ResearchFactSummary[]
  propositionSummaries?: ResearchPropositionSummary[]
  authoritySummaries?: string[]
  applicationSummaries?: string[]
  assumptions?: string[]
  unresolvedFacts?: string[]
  strategyGuidance?: string[]
  auditMetadata?: ResearchAuditMetadata
  userAuthorityChecks?: UserAuthorityCheck[]
  factLedger?: ResearchFactSummary[]
  propositionGraph?: {
    tenantId?: string
    matterId?: string
    nodes: Array<Record<string, unknown>>
    edges: Array<Record<string, unknown>>
  }
}

export interface LegalResearchClaim {
  claimId: string
  text: string
  type?: string
  evidenceIds?: string[]
}

export type LegalResearchConclusionStrength =
  | "STRONG"
  | "MODERATE"
  | "TENTATIVE"
  | "INSUFFICIENT"

export interface LegalResearchCalibratedConclusion {
  text: string
  confidence: number
  strength: LegalResearchConclusionStrength
  controllingReasons: string[]
  factualDependencies: string[]
  adverseConsiderations: string[]
}

export interface LegalResearchIssue {
  issueId: string
  heading: string
  rule?: LegalResearchClaim[]
  application?: LegalResearchClaim[]
  conclusion: string | LegalResearchCalibratedConclusion
  propositions: LegalResearchClaim[]
}

export type LegalResearchUnansweredQuestion =
  | string
  | ({
      id?: string
      whyItMatters?: string
    } & (
      | { question: string; text?: string }
      | { question?: string; text: string }
    ))

export type LegalResearchPracticalStepTiming =
  | "NOW"
  | "BEFORE_FILING_OR_ADVISING"
  | "IF_FACTS_SUPPORT"
  | "IF_FACTS_SUPPORT_IT"
  | "Now"
  | "Before filing or advising"
  | "If facts support it"

export type LegalResearchPracticalStep =
  | string
  | ({
      id?: string
      timing?: LegalResearchPracticalStepTiming
      stage?: LegalResearchPracticalStepTiming
      purpose?: string
      evidence?: string | string[]
      evidenceNeeded?: string | string[]
      dependencies?: string[]
    } & (
      | { action: string; step?: string }
      | { action?: string; step: string }
    ))

export interface LegalResearchRevisionMetadata {
  revisionId?: string
  previousRevisionId?: string
  sourceOutputId?: string
  revisionNumber?: number
  revisedAt?: string
  createdAt?: string
  reason?: string
  summary?: string
  incorporatedQuestionIds?: string[]
  answeredQuestions?: Array<{
    question: string
    answer: string
    questionId?: string
  }>
}

export interface LegalResearchDraft {
  questionPresented?: string
  shortAnswer?: { text: string; confidence: number }
  legalFramework?: Array<{
    evidenceId: string
    authorityType: "STATUTE" | "REGULATION" | "CASE" | "OTHER"
    claimIds: string[]
  }>
  directAnswer: { text: string; confidence: number }
  issues: LegalResearchIssue[]
  risksAndDefences?: Array<{ risk: string; defence?: string }>
  practicalSteps: LegalResearchPracticalStep[]
  authoritiesReliedOn?: Array<{ evidenceId: string; claimIds: string[] }>
  limitations: string[]
  unansweredQuestions: LegalResearchUnansweredQuestion[]
  verificationNotes?: string[]
  scopeNote?: string
  revisionMetadata?: LegalResearchRevisionMetadata
}

export interface MarketplaceLead {
  id: string
  countryCode: string
  issueType: string
  title: string
  status: string
  createdAt: string
  consumerCaseId?: string
}

export interface AiUsageSummary {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  byMode: Array<{ mode: string; count: number; costUsd: number }>
}

export interface InternalAgent {
  id: string
  name: string
  description: string
  queue: string
  capabilities: string[]
  requiresApproval?: boolean
}

export interface AutomationRecipe {
  name: string
  trigger: string
  conditions: Record<string, unknown>
  actions: Array<Record<string, unknown>>
}

export interface AgentJob {
  id: string
  queue: string
  jobType: string
  status: string
  userId?: string | null
  tenantId?: string | null
  payload?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
  error?: string | null
  attempts: number
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  agent?: Pick<InternalAgent, "id" | "name" | "description"> | null
}

export interface CreateConsumerCaseRequest {
  countryCode: CountryCode
  jurisdiction?: string
  issueType: string
  title: string
  facts?: string
  desiredOutcome?: string
  urgencyLevel?: UrgencyLevel
}

export interface UpdateConsumerCaseRequest {
  title?: string
  facts?: string
  desiredOutcome?: string
  jurisdiction?: string
  issueType?: string
  urgencyLevel?: UrgencyLevel
  status?: string
}

export interface IssueCheckerPreviewRequest {
  countryCode: CountryCode
  jurisdiction?: string
  issueType: string
  title: string
  facts?: string
  desiredOutcome?: string
  parties?: string
  urgencyLevel?: UrgencyLevel
  consumerCaseId?: string
  mode?: "SELF" | "FIRM_INTAKE"
  clientName?: string
  clientReference?: string
  internalNotes?: string
  anonymousSessionId?: string
  planningAnswers?: Record<string, string | string[]>
  suggestedOutcomes?: string[]
}

export interface IssueCheckerClassifyRequest {
  countryCode: CountryCode
  facts: string
  mode?: "SELF" | "FIRM_INTAKE"
  captchaToken?: string
  deviceFingerprint?: string
}

export interface IssueCheckerClassifyResponse {
  issueType: string
  suggestedTitle: string
  urgencyLevel: UrgencyLevel
  confidence: number
  parties?: string
  suggestedClientName?: string
  suggestedOutcomes?: string[]
  followUpQuestions?: Array<{
    question: string
    answerType: string
    options?: string[]
  }>
  matterProfile?: import("@/lib/matter-intelligence").MatterProfile
  matterGraph?: import("@/lib/matter-intelligence").MatterGraph
  taskGraph?: import("@/lib/matter-intelligence").MatterTaskGraph
  recommendationMode?: import("@/lib/matter-intelligence").RecommendationMode
  clarifyingQuestions?: import("@/lib/matter-intelligence").ClarifyingQuestion[]
  recommendedActions?: string[]
  issues?: string[]
  nextBestAction?: string
  intakeIntelligence?: {
    intent?: string
    jurisdictionHints?: string[]
    missingSlots?: string[]
    toolPlan?: Array<"retrieve" | "section_finder" | "draft" | "strategy">
    recommendedNextTool?: "retrieve" | "section_finder" | "draft" | "strategy"
  }
  recommendedNextTool?: "retrieve" | "section_finder" | "draft" | "strategy"
}

export interface IssueCheckerTeaserRequest {
  countryCode: CountryCode
  jurisdiction?: string
  issueType: string
  title: string
  facts: string
  desiredOutcome?: string
  parties?: string
  urgencyLevel?: UrgencyLevel
  mode?: "SELF" | "FIRM_INTAKE"
  clientName?: string
  clientReference?: string
  internalNotes?: string
  planningAnswers?: Record<string, string | string[]>
  captchaToken?: string
  deviceFingerprint?: string
}

export interface IssueCheckerTeaserResponse {
  anonymousSessionId: string
  detectedIssueType: string
  suggestedTitle: string
  teaserMarkdown: string
  keyBullets: string[]
  requiresLawyer: boolean
  disclaimer: string
  mode: string
  provider: string
  winProbability?: { low: number; mid: number; high: number } | null
  matterProfile?: import("@/lib/matter-intelligence").MatterProfile
  taskGraph?: import("@/lib/matter-intelligence").MatterTaskGraph
  recommendedActions?: string[]
  issues?: string[]
  nextBestAction?: string
}

export interface LegalResearchTeaserRequest {
  query: string
  countryCode: "IN" | "US"
  locale?: string
}

export interface LegalResearchTeaserResponse {
  anonymousSessionId: string
  teaserMarkdown: string
  keyBullets: string[]
  disclaimer: string
  provider: string
  requiresLawyerReview: boolean
}

export interface IssueCheckerPreviewResponse {
  caseId: string
  leadId?: string
  report: ConsumerLegalReport
  disclaimer: string
  creditsRemaining: number
  mode: string
  provider: string
  intakeMode?: "SELF" | "FIRM_INTAKE"
  documentsIncluded?: number
  winProbability?: { low: number; mid: number; high: number } | null
  riskLevel?: string
  matterProfile?: import("@/lib/matter-intelligence").MatterProfile
  matterGraph?: import("@/lib/matter-intelligence").MatterGraph
  taskGraph?: import("@/lib/matter-intelligence").MatterTaskGraph
  recommendedActions?: string[]
  issues?: string[]
  nextBestAction?: string
  suggestedOutcomes?: string[]
}

export interface ApiError {
  message: string
  statusCode: number
  error?: string
  /** Set when the backend signals the error is transient and the client should retry */
  code?: string
  retryable?: boolean
  retryAfterSeconds?: number
  details?: Record<string, unknown>
  requestId?: string
}

export interface PaginationMeta {
  page?: number
  pageSize?: number
  total?: number
  cursor?: string
  hasMore?: boolean
}

export interface ApiResponse<T> {
  data: T
  meta?: {
    requestId?: string
    pagination?: PaginationMeta
  }
}

export class ApiResponseError extends Error {
  constructor(
    public readonly error: ApiError,
    public readonly statusCode: number,
  ) {
    super(error.message)
    this.name = 'ApiResponseError'
  }
}
