import {
  extractFollowUpQuestionsFromMarkdown,
  sanitizeResearchAnswer,
} from "@/lib/legal/research-answer"
import { apiFetch } from "./client"
import type {
  CaseLawSearchStatus,
  CapabilitySnapshot,
  LegalResearchDraft,
  LegalResearchRequest,
  LegalResearchResponse,
  RejectedResearchCandidate,
  ResearchAuditMetadata,
  ResearchConfidenceSummary,
  ResearchConflict,
  ResearchFactSummary,
  ResearchIssueGap,
  ResearchPlan,
  ResearchPropositionSummary,
  ResearchPublicationAssessment,
  ResearchPublicationDecision,
  ResearchSourceIntegrity,
  ResearchSourceProvenance,
  ResearchSourceDiagnostic,
  ResearchTaskProfile,
  UserAuthorityCheck,
} from "./types"
import type {
  CitationAuditEntry,
  CitationVerificationAudit,
  PublicationState,
  VerificationDimensions,
  VerificationFinding,
  VerifiedPropositionSummary,
} from "./verification"

const RESEARCH_DISCLAIMER =
  "This is AI-assisted research with citations. Verify all authorities before relying on them in court or client advice."

interface BackendLegalResearchResponse {
  answer?: string
  outputMarkdown?: string
  citations?: Array<
    | string
    | {
        title?: string
        caseName?: string
        parties?: string | string[]
        source?: string
        url?: string
        canonicalUrl?: string
        deepLinkUrl?: string
        sourceUrl?: string
        sourceName?: string
        sourceTier?: string
        retrievedAt?: string
        sourceHash?: string
        citation?: string
        neutralCitation?: string
        authorityId?: string
        confidence?: number
        summary?: string
        judgmentDate?: string
        decisionDate?: string
        date?: string
        relevantParagraphs?: string | string[]
        pinpoint?: string
        paragraph?: string
        propositionActuallyDecided?: string
        holding?: string
        exactPassage?: string
        passageText?: string
        excerpt?: string
        pinpointText?: string
        provenance?: ResearchSourceProvenance
        integrity?: ResearchSourceIntegrity
      }
  >
  mode?: string
  disclaimer?: string
  provider?: string
  modelName?: string
  countryCode?: string
  jurisdiction?: string
  creditsUsed?: number
  timeToFirstDraftMs?: number
  stageTimings?: { timeToFirstDraft?: number; total?: number; [key: string]: number | undefined }
  fromCache?: boolean
  generatedAt?: string
  cachedAt?: string
  sourceTrace?: string[]
  limitations?: string[]
  confidence?: "Low" | "Medium" | "High" | ResearchConfidenceSummary
  suggestedFollowUpQuestions?: string[]
  requiresLawyerReview?: boolean
  researchMode?: string
  analyticalMode?: boolean
  analyticalModeReasons?: string[]
  relianceMode?: "source-grounded" | "analytical-guidance"
  tripleCheck?: LegalResearchResponse["tripleCheck"]
  citationAudit?: CitationAuditSummary | null
  similarCases?: import("./types").SimilarCase[]
  similarCasesSearchOutcome?: LegalResearchResponse["similarCasesSearchOutcome"]
  intelligenceMap?: LegalResearchResponse["intelligenceMap"]
  issueCoverageMatrix?: LegalResearchResponse["issueCoverageMatrix"]
  researchTrail?: LegalResearchResponse["researchTrail"]
  unverifiedResearchLeads?: LegalResearchResponse["unverifiedResearchLeads"]
  adaptiveEvidenceSummary?: LegalResearchResponse["adaptiveEvidenceSummary"]
  caseEvidenceLayers?: LegalResearchResponse["caseEvidenceLayers"]
  sectionChecks?: import("./types").SectionChecksAudit | null
  findings?: VerificationFinding[]
  propositions?: VerifiedPropositionSummary[]
  dimensions?: VerificationDimensions
  publicationState?: PublicationState
  evidencePackId?: string
  outputHash?: string
  aiOutputId?: string
  caseLawSearchStatus?: CaseLawSearchStatus
  issueGaps?: Array<string | ResearchIssueGap>
  sourceDiagnostics?: ResearchSourceDiagnostic[]
  connectorDiagnostics?: ResearchSourceDiagnostic[]
  rejectedCandidates?: RejectedResearchCandidate[]
  structuredDraft?: import("./types").LegalResearchDraft
  taskProfile?: ResearchTaskProfile
  researchTaskProfile?: ResearchTaskProfile
  researchPlan?: ResearchPlan
  capabilitySnapshot?: CapabilitySnapshot
  sourceProvenance?: ResearchSourceProvenance[]
  sourceIntegrity?: ResearchSourceIntegrity
  conflicts?: Array<string | ResearchConflict>
  confidenceAssessment?: ResearchConfidenceSummary
  publicationDecision?: ResearchPublicationDecision | ResearchPublicationAssessment
  factSummaries?: ResearchFactSummary[]
  factSummary?: ResearchFactSummary[]
  propositionSummaries?: ResearchPropositionSummary[]
  propositionSummary?: ResearchPropositionSummary[]
  authoritySummaries?: string[]
  applicationSummaries?: string[]
  assumptions?: string[]
  unresolvedFacts?: string[]
  strategyGuidance?: string[]
  auditMetadata?: ResearchAuditMetadata
  researchAudit?: ResearchAuditMetadata
  userAuthorityChecks?: UserAuthorityCheck[]
  factLedger?: ResearchFactSummary[]
  propositionGraph?: LegalResearchResponse["propositionGraph"]
}

export type SourceQuality =
  | "OFFICIAL_PRIMARY"
  | "MIXED_PRIMARY_SECONDARY"
  | "SECONDARY_ONLY"
  | "INSUFFICIENT"

export type CitationAuditSummary = CitationVerificationAudit & {
  verifiedCitationCount: number
  unsupportedClaims: Array<{ claim: string; citations: string[] }>
  warnings: string[]
  totalClaims?: number
  supportedClaims?: number
  totalCitations?: number
  verifiedCitations?: number
  unverifiedCitations?: string[]
  sourceQuality?: SourceQuality | null
}

export type ResearchHistoryItem = {
  id: string
  inputQuery?: string | null
  outputMarkdown: string
  preview: string
  createdAt: string
  citationCount: number
  verified?: boolean
  jurisdiction?: string | null
  legalDomain?: string | null
  sourceQuality?: SourceQuality | string | null
  citationAudit?: CitationAuditSummary | null
  similarCases?: import("./types").SimilarCase[]
  sectionChecks?: import("./types").SectionChecksAudit | null
  publicationState?: import("./verification").PublicationState
  caseLawSearchStatus?: CaseLawSearchStatus
  citations?: BackendLegalResearchResponse["citations"]
  findings?: VerificationFinding[]
  propositions?: VerifiedPropositionSummary[]
  dimensions?: VerificationDimensions
  issueGaps?: Array<string | ResearchIssueGap>
  sourceDiagnostics?: ResearchSourceDiagnostic[]
  connectorDiagnostics?: ResearchSourceDiagnostic[]
  rejectedCandidates?: RejectedResearchCandidate[]
  structuredDraft?: import("./types").LegalResearchDraft
  outputHash?: string
  requiresLawyerReview?: boolean
  researchMode?: string
  generatedAt?: string
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
  propositionGraph?: LegalResearchResponse["propositionGraph"]
  unverifiedResearchLeads?: LegalResearchResponse["unverifiedResearchLeads"]
  adaptiveEvidenceSummary?: LegalResearchResponse["adaptiveEvidenceSummary"]
  caseEvidenceLayers?: LegalResearchResponse["caseEvidenceLayers"]
}

function normalizeCitations(
  citations: BackendLegalResearchResponse["citations"],
  audit?: CitationAuditSummary | null,
  rejectedCandidates?: RejectedResearchCandidate[],
): LegalResearchResponse["citations"] {
  if (!citations || !Array.isArray(citations)) return []
  const rejectedAuthorityIds = new Set(
    [
      ...(audit?.rejectedCitations ?? []).map((entry) => entry.authorityId),
      ...(rejectedCandidates ?? []).map((candidate) => candidate.authorityId),
    ].filter((authorityId): authorityId is string => Boolean(authorityId)),
  )
  const rejectedCitationKeys = new Set(
    (audit?.rejectedCitations ?? []).map((entry) => entry.citation.trim().toLowerCase()).filter(Boolean),
  )
  return citations.flatMap((c) => {
    if (typeof c === "string") {
      return rejectedCitationKeys.has(c.trim().toLowerCase()) ? [] : [{ title: c, source: c }]
    }
    if (
      (c.authorityId && rejectedAuthorityIds.has(c.authorityId)) ||
      (c.citation && rejectedCitationKeys.has(c.citation.trim().toLowerCase()))
    ) {
      return []
    }
    const title = c.caseName ?? c.title ?? c.citation ?? c.sourceName ?? "Source"
    const source = c.source ?? c.sourceName ?? c.citation ?? title
    return [{
      title,
      source,
      url: c.deepLinkUrl ?? c.url ?? c.sourceUrl,
      canonicalUrl: c.canonicalUrl ?? c.sourceUrl ?? c.url,
      deepLinkUrl: c.deepLinkUrl,
      citation: c.citation,
      neutralCitation: c.neutralCitation,
      authorityId: c.authorityId,
      summary: c.summary,
      caseName: c.caseName,
      parties: c.parties,
      judgmentDate: c.judgmentDate ?? c.decisionDate ?? c.date,
      relevantParagraphs: c.relevantParagraphs ?? c.pinpoint ?? c.paragraph,
      propositionActuallyDecided: c.propositionActuallyDecided ?? c.holding,
      exactPassage: c.exactPassage ?? c.passageText ?? c.excerpt ?? c.pinpointText,
      passageText: c.passageText,
      excerpt: c.excerpt,
      sourceName: c.sourceName,
      sourceTier: c.sourceTier,
      retrievedAt: c.retrievedAt,
      sourceHash: c.sourceHash,
      pinpoint: c.pinpoint,
      provenance: c.provenance,
      integrity: c.integrity,
    }]
  })
}

function confidenceLabel(
  confidence: BackendLegalResearchResponse["confidence"],
  fallback: LegalResearchResponse["confidence"],
): LegalResearchResponse["confidence"] {
  if (typeof confidence === "string") return confidence
  const level = confidence?.level.toUpperCase()
  if (level === "VERIFIED" || level === "CORROBORATED") return "High"
  if (level === "TENTATIVE") return "Medium"
  if (level === "CONFLICTED" || level === "UNKNOWN") return "Low"
  return fallback
}

function normalizeAuditEntry(entry: CitationAuditEntry): CitationAuditEntry {
  return {
    ...entry,
    citation: typeof entry.citation === "string" ? entry.citation : "Unlabelled citation",
    found: entry.found === true,
    verified: entry.verified === true,
    checks: Array.isArray(entry.checks) ? entry.checks : [],
    missingReasons: Array.isArray(entry.missingReasons) ? entry.missingReasons : [],
  }
}

export function normalizeCitationAudit(
  audit?: CitationAuditSummary | null,
): CitationAuditSummary | null {
  if (!audit || typeof audit !== "object") return null
  return {
    ...audit,
    verifiedCitationCount:
      typeof audit.verifiedCitationCount === "number"
        ? audit.verifiedCitationCount
        : typeof audit.verifiedCitations === "number"
          ? audit.verifiedCitations
          : 0,
    unsupportedClaims: Array.isArray(audit.unsupportedClaims) ? audit.unsupportedClaims : [],
    warnings: Array.isArray(audit.warnings) ? audit.warnings : [],
    citations: Array.isArray(audit.citations) ? audit.citations.map(normalizeAuditEntry) : undefined,
    rejectedCitations: Array.isArray(audit.rejectedCitations)
      ? audit.rejectedCitations.map(normalizeAuditEntry)
      : undefined,
    verificationGaps: Array.isArray(audit.verificationGaps)
      ? audit.verificationGaps.filter(
          (gap) => typeof gap?.citation === "string" && Array.isArray(gap.reasons),
        )
      : undefined,
  }
}

export function normalizeStructuredDraft(raw: unknown): LegalResearchDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const draft = raw as Partial<LegalResearchDraft>
  const directAnswer = draft.directAnswer ?? draft.shortAnswer
  const answerText = typeof directAnswer?.text === "string" ? directAnswer.text.trim() : ""
  if (!answerText) return undefined

  return {
    questionPresented: draft.questionPresented,
    shortAnswer: draft.shortAnswer ?? { text: answerText, confidence: directAnswer?.confidence ?? 0 },
    directAnswer: { text: answerText, confidence: directAnswer?.confidence ?? 0 },
    legalFramework: Array.isArray(draft.legalFramework) ? draft.legalFramework : [],
    issues: Array.isArray(draft.issues)
      ? draft.issues.map((issue) => ({
          ...issue,
          propositions: Array.isArray(issue.propositions) ? issue.propositions : [],
          rule: Array.isArray(issue.rule) ? issue.rule : undefined,
          application: Array.isArray(issue.application) ? issue.application : undefined,
          conclusion:
            issue.conclusion && typeof issue.conclusion === "object"
              ? {
                  ...issue.conclusion,
                  controllingReasons: Array.isArray(issue.conclusion.controllingReasons)
                    ? issue.conclusion.controllingReasons
                    : [],
                  factualDependencies: Array.isArray(issue.conclusion.factualDependencies)
                    ? issue.conclusion.factualDependencies
                    : [],
                  adverseConsiderations: Array.isArray(issue.conclusion.adverseConsiderations)
                    ? issue.conclusion.adverseConsiderations
                    : [],
                }
              : issue.conclusion,
        }))
      : [],
    risksAndDefences: Array.isArray(draft.risksAndDefences) ? draft.risksAndDefences : undefined,
    practicalSteps: Array.isArray(draft.practicalSteps) ? draft.practicalSteps : [],
    authoritiesReliedOn: Array.isArray(draft.authoritiesReliedOn) ? draft.authoritiesReliedOn : undefined,
    limitations: Array.isArray(draft.limitations) ? draft.limitations : [],
    unansweredQuestions: Array.isArray(draft.unansweredQuestions) ? draft.unansweredQuestions : [],
    verificationNotes: Array.isArray(draft.verificationNotes) ? draft.verificationNotes : undefined,
    scopeNote: draft.scopeNote,
    revisionMetadata: draft.revisionMetadata,
  }
}

function normalizeLegalResearchResponse(
  raw: BackendLegalResearchResponse,
): LegalResearchResponse {
  const citationAudit = normalizeCitationAudit(raw.citationAudit)
  const rejectedCandidates = Array.isArray(raw.rejectedCandidates) ? raw.rejectedCandidates : []
  const citations = normalizeCitations(raw.citations, citationAudit, rejectedCandidates)
  const rawAnswer = raw.answer ?? raw.outputMarkdown ?? ""
  const answer = sanitizeResearchAnswer(rawAnswer)
  const extractedFollowUps =
    raw.suggestedFollowUpQuestions?.length
      ? raw.suggestedFollowUpQuestions
      : extractFollowUpQuestionsFromMarkdown(rawAnswer)
  const fallbackConfidence = citations.length >= 3 ? "High" : citations.length > 0 ? "Medium" : "Low"
  const confidenceAssessment =
    raw.confidenceAssessment ??
    (raw.confidence && typeof raw.confidence === "object" ? raw.confidence : undefined)

  return {
    answer,
    citations,
    mode: raw.mode ?? "LAWYER_LEGAL_RESEARCH",
    disclaimer: raw.disclaimer ?? RESEARCH_DISCLAIMER,
    creditsUsed: raw.creditsUsed,
    timeToFirstDraftMs:
      typeof raw.timeToFirstDraftMs === "number"
        ? raw.timeToFirstDraftMs
        : typeof raw.stageTimings?.timeToFirstDraft === "number"
          ? raw.stageTimings.timeToFirstDraft
          : undefined,
    fromCache: raw.fromCache,
    generatedAt: raw.generatedAt ?? raw.cachedAt,
    modelName: raw.modelName,
    jurisdiction: raw.jurisdiction ?? raw.countryCode,
    countryCode:
      typeof raw.countryCode === "string" && raw.countryCode.trim()
        ? raw.countryCode.trim().toUpperCase()
        : undefined,
    confidence: confidenceLabel(raw.confidence ?? confidenceAssessment, fallbackConfidence),
    sourceTrace: raw.sourceTrace ?? citations.map((citation) => citation.source).slice(0, 6),
    limitations: raw.limitations ?? [
      "Verify all authorities before filing or advising a client.",
      "Treat unsupported statements as research leads, not conclusions.",
      "Confirm jurisdiction, date, and procedural posture before relying on a source.",
    ],
    suggestedFollowUpQuestions:
      extractedFollowUps.length > 0 ? extractedFollowUps : undefined,
    requiresLawyerReview: raw.requiresLawyerReview,
    researchMode: raw.researchMode,
    analyticalMode: raw.analyticalMode === true,
    analyticalModeReasons: Array.isArray(raw.analyticalModeReasons)
      ? raw.analyticalModeReasons.map(String)
      : undefined,
    relianceMode:
      raw.relianceMode === "analytical-guidance" || raw.relianceMode === "source-grounded"
        ? raw.relianceMode
        : raw.analyticalMode === true
          ? "analytical-guidance"
          : undefined,
    tripleCheck: raw.tripleCheck,
    citationAudit,
    similarCases: Array.isArray(raw.similarCases) ? raw.similarCases : [],
    similarCasesSearchOutcome: raw.similarCasesSearchOutcome,
    intelligenceMap: raw.intelligenceMap,
    issueCoverageMatrix: raw.issueCoverageMatrix,
    researchTrail: raw.researchTrail,
    unverifiedResearchLeads: Array.isArray(raw.unverifiedResearchLeads)
      ? raw.unverifiedResearchLeads
      : [],
    adaptiveEvidenceSummary: raw.adaptiveEvidenceSummary,
    caseEvidenceLayers: raw.caseEvidenceLayers,
    sectionChecks: raw.sectionChecks ?? null,
    findings: Array.isArray(raw.findings) ? raw.findings : [],
    propositions: Array.isArray(raw.propositions) ? raw.propositions : [],
    dimensions: raw.dimensions,
    publicationState: raw.publicationState,
    evidencePackId: raw.evidencePackId,
    outputHash: raw.outputHash,
    aiOutputId: typeof raw.aiOutputId === "string" ? raw.aiOutputId : undefined,
    caseLawSearchStatus: raw.caseLawSearchStatus,
    issueGaps: Array.isArray(raw.issueGaps) ? raw.issueGaps : [],
    sourceDiagnostics: Array.isArray(raw.sourceDiagnostics) ? raw.sourceDiagnostics : [],
    connectorDiagnostics: Array.isArray(raw.connectorDiagnostics) ? raw.connectorDiagnostics : [],
    rejectedCandidates,
    structuredDraft: normalizeStructuredDraft(raw.structuredDraft),
    taskProfile: raw.taskProfile ?? raw.researchTaskProfile,
    researchPlan: raw.researchPlan,
    capabilitySnapshot: raw.capabilitySnapshot,
    sourceProvenance: Array.isArray(raw.sourceProvenance) ? raw.sourceProvenance : undefined,
    sourceIntegrity: raw.sourceIntegrity,
    conflicts: Array.isArray(raw.conflicts) ? raw.conflicts : undefined,
    confidenceAssessment,
    publicationDecision: raw.publicationDecision ?? undefined,
    factSummaries: Array.isArray(raw.factSummaries)
      ? raw.factSummaries
      : Array.isArray(raw.factSummary)
        ? raw.factSummary
        : undefined,
    propositionSummaries: Array.isArray(raw.propositionSummaries)
      ? raw.propositionSummaries
      : Array.isArray(raw.propositionSummary)
        ? raw.propositionSummary
        : undefined,
    authoritySummaries: Array.isArray(raw.authoritySummaries) ? raw.authoritySummaries : undefined,
    applicationSummaries: Array.isArray(raw.applicationSummaries) ? raw.applicationSummaries : undefined,
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : undefined,
    unresolvedFacts: Array.isArray(raw.unresolvedFacts) ? raw.unresolvedFacts : undefined,
    strategyGuidance: Array.isArray(raw.strategyGuidance) ? raw.strategyGuidance : undefined,
    auditMetadata: raw.auditMetadata ?? raw.researchAudit,
    userAuthorityChecks: Array.isArray(raw.userAuthorityChecks)
      ? raw.userAuthorityChecks
      : undefined,
    factLedger: Array.isArray(raw.factLedger) ? raw.factLedger : undefined,
    propositionGraph: raw.propositionGraph,
  }
}

export interface MatterResearchContextResponse {
  matter: {
    id: string
    title: string
    factsSummary?: string | null
    updatedAt: string
  }
  documents: Array<{
    id: string
    fileName: string
    updatedAt: string
    hasExtractedText: boolean
  }>
  savedResearch: Array<{
    id: string
    title: string
    query: string
    createdAt: string
  }>
}

export async function getMatterResearchContext(
  tenantId: string,
  matterId: string,
): Promise<MatterResearchContextResponse> {
  const query = new URLSearchParams({ matterId })
  return apiFetch<MatterResearchContextResponse>(
    `/ai/research/matter-context?${query.toString()}`,
    { tenantId },
  )
}

export async function runLegalResearch(
  data: LegalResearchRequest,
  tenantId?: string,
): Promise<LegalResearchResponse> {
  const raw = await apiFetch<BackendLegalResearchResponse>("/ai/research", {
    method: "POST",
    body: data,
    tenantId,
  })
  return normalizeLegalResearchResponse(raw)
}

export async function startLegalResearchJob(
  data: LegalResearchRequest,
  tenantId?: string,
): Promise<{ jobId: string }> {
  return apiFetch<{ jobId: string }>("/ai/research/async", {
    method: "POST",
    body: data,
    tenantId,
  })
}

export function parseResearchJobResult(
  result: Record<string, unknown> | null | undefined,
): LegalResearchResponse | null {
  if (!result) return null
  const markdown =
    (typeof result.draftMarkdown === "string" && result.draftMarkdown) ||
    (typeof result.outputMarkdown === "string" && result.outputMarkdown) ||
    (typeof result.answer === "string" && result.answer) ||
    ""
  if (!markdown.trim()) return null

  return normalizeLegalResearchResponse({
    outputMarkdown: markdown,
    citations: result.citations as BackendLegalResearchResponse["citations"],
    researchMode: typeof result.researchMode === "string" ? result.researchMode : undefined,
    timeToFirstDraftMs:
      typeof result.timeToFirstDraftMs === "number"
        ? result.timeToFirstDraftMs
        : typeof (result.stageTimings as { timeToFirstDraft?: number } | undefined)?.timeToFirstDraft ===
            "number"
          ? (result.stageTimings as { timeToFirstDraft: number }).timeToFirstDraft
          : undefined,
    confidence:
      typeof result.confidence === "string" ||
      (result.confidence != null && typeof result.confidence === "object")
        ? (result.confidence as BackendLegalResearchResponse["confidence"])
        : undefined,
    citationAudit: result.citationAudit as CitationAuditSummary | null,
    requiresLawyerReview:
      typeof result.requiresLawyerReview === "boolean" ? result.requiresLawyerReview : undefined,
    similarCases: Array.isArray(result.similarCases)
      ? (result.similarCases as import("./types").SimilarCase[])
      : [],
    similarCasesSearchOutcome:
      typeof result.similarCasesSearchOutcome === "string"
        ? (result.similarCasesSearchOutcome as LegalResearchResponse["similarCasesSearchOutcome"])
        : undefined,
    intelligenceMap:
      result.intelligenceMap && typeof result.intelligenceMap === "object"
        ? (result.intelligenceMap as LegalResearchResponse["intelligenceMap"])
        : undefined,
    issueCoverageMatrix:
      result.issueCoverageMatrix && typeof result.issueCoverageMatrix === "object"
        ? (result.issueCoverageMatrix as LegalResearchResponse["issueCoverageMatrix"])
        : undefined,
    researchTrail:
      result.researchTrail && typeof result.researchTrail === "object"
        ? (result.researchTrail as LegalResearchResponse["researchTrail"])
        : undefined,
    unverifiedResearchLeads: Array.isArray(result.unverifiedResearchLeads)
      ? (result.unverifiedResearchLeads as NonNullable<
          LegalResearchResponse["unverifiedResearchLeads"]
        >)
      : [],
    adaptiveEvidenceSummary:
      result.adaptiveEvidenceSummary && typeof result.adaptiveEvidenceSummary === "object"
        ? (result.adaptiveEvidenceSummary as NonNullable<
            LegalResearchResponse["adaptiveEvidenceSummary"]
          >)
        : undefined,
    caseEvidenceLayers:
      result.caseEvidenceLayers && typeof result.caseEvidenceLayers === "object"
        ? (result.caseEvidenceLayers as NonNullable<
            LegalResearchResponse["caseEvidenceLayers"]
          >)
        : undefined,
    sectionChecks: (result.sectionChecks as import("./types").SectionChecksAudit | null) ?? null,
    findings: Array.isArray(result.findings) ? (result.findings as VerificationFinding[]) : [],
    propositions: Array.isArray(result.propositions)
      ? (result.propositions as VerifiedPropositionSummary[])
      : [],
    dimensions: result.dimensions as VerificationDimensions | undefined,
    publicationState: result.publicationState as PublicationState | undefined,
    evidencePackId: typeof result.evidencePackId === "string" ? result.evidencePackId : undefined,
    outputHash: typeof result.outputHash === "string" ? result.outputHash : undefined,
    modelName: typeof result.modelName === "string" ? result.modelName : undefined,
    jurisdiction: typeof result.jurisdiction === "string" ? result.jurisdiction : undefined,
    countryCode: typeof result.countryCode === "string" ? result.countryCode : undefined,
    fromCache: result.fromCache === true,
    generatedAt:
      typeof result.generatedAt === "string"
        ? result.generatedAt
        : typeof result.cachedAt === "string"
          ? result.cachedAt
          : undefined,
    creditsUsed: typeof result.creditsUsed === "number" ? result.creditsUsed : undefined,
    aiOutputId: typeof result.aiOutputId === "string" ? result.aiOutputId : undefined,
    caseLawSearchStatus: result.caseLawSearchStatus as CaseLawSearchStatus | undefined,
    issueGaps: Array.isArray(result.issueGaps)
      ? (result.issueGaps as Array<string | ResearchIssueGap>)
      : [],
    sourceDiagnostics: Array.isArray(result.sourceDiagnostics)
      ? (result.sourceDiagnostics as ResearchSourceDiagnostic[])
      : [],
    connectorDiagnostics: Array.isArray(result.connectorDiagnostics)
      ? (result.connectorDiagnostics as ResearchSourceDiagnostic[])
      : [],
    rejectedCandidates: Array.isArray(result.rejectedCandidates)
      ? (result.rejectedCandidates as RejectedResearchCandidate[])
      : [],
    structuredDraft:
      result.structuredDraft && typeof result.structuredDraft === "object"
        ? (result.structuredDraft as import("./types").LegalResearchDraft)
        : undefined,
    taskProfile:
      result.taskProfile && typeof result.taskProfile === "object"
        ? (result.taskProfile as ResearchTaskProfile)
        : result.researchTaskProfile && typeof result.researchTaskProfile === "object"
          ? (result.researchTaskProfile as ResearchTaskProfile)
          : undefined,
    researchPlan:
      result.researchPlan && typeof result.researchPlan === "object"
        ? (result.researchPlan as ResearchPlan)
        : undefined,
    capabilitySnapshot:
      result.capabilitySnapshot && typeof result.capabilitySnapshot === "object"
        ? (result.capabilitySnapshot as CapabilitySnapshot)
        : undefined,
    sourceProvenance: Array.isArray(result.sourceProvenance)
      ? (result.sourceProvenance as ResearchSourceProvenance[])
      : undefined,
    sourceIntegrity:
      result.sourceIntegrity && typeof result.sourceIntegrity === "object"
        ? (result.sourceIntegrity as ResearchSourceIntegrity)
        : undefined,
    conflicts: Array.isArray(result.conflicts)
      ? (result.conflicts as Array<string | ResearchConflict>)
      : undefined,
    confidenceAssessment:
      result.confidenceAssessment && typeof result.confidenceAssessment === "object"
        ? (result.confidenceAssessment as ResearchConfidenceSummary)
        : undefined,
    publicationDecision:
      typeof result.publicationDecision === "string" ||
      (result.publicationDecision != null && typeof result.publicationDecision === "object")
        ? (result.publicationDecision as ResearchPublicationDecision | ResearchPublicationAssessment)
        : undefined,
    factSummaries: Array.isArray(result.factSummaries)
      ? (result.factSummaries as ResearchFactSummary[])
      : Array.isArray(result.factSummary)
        ? (result.factSummary as ResearchFactSummary[])
        : undefined,
    propositionSummaries: Array.isArray(result.propositionSummaries)
      ? (result.propositionSummaries as ResearchPropositionSummary[])
      : Array.isArray(result.propositionSummary)
        ? (result.propositionSummary as ResearchPropositionSummary[])
        : undefined,
    authoritySummaries: Array.isArray(result.authoritySummaries)
      ? (result.authoritySummaries as string[])
      : undefined,
    applicationSummaries: Array.isArray(result.applicationSummaries)
      ? (result.applicationSummaries as string[])
      : undefined,
    assumptions: Array.isArray(result.assumptions) ? (result.assumptions as string[]) : undefined,
    unresolvedFacts: Array.isArray(result.unresolvedFacts)
      ? (result.unresolvedFacts as string[])
      : undefined,
    strategyGuidance: Array.isArray(result.strategyGuidance)
      ? (result.strategyGuidance as string[])
      : undefined,
    auditMetadata:
      result.auditMetadata && typeof result.auditMetadata === "object"
        ? (result.auditMetadata as ResearchAuditMetadata)
        : result.researchAudit && typeof result.researchAudit === "object"
          ? (result.researchAudit as ResearchAuditMetadata)
          : undefined,
    userAuthorityChecks: Array.isArray(result.userAuthorityChecks)
      ? (result.userAuthorityChecks as UserAuthorityCheck[])
      : undefined,
    factLedger: Array.isArray(result.factLedger)
      ? (result.factLedger as ResearchFactSummary[])
      : undefined,
    propositionGraph:
      result.propositionGraph && typeof result.propositionGraph === "object"
        ? (result.propositionGraph as LegalResearchResponse["propositionGraph"])
        : undefined,
  })
}

export type ResearchJobProgress = {
  phase?: string
  updatedAt?: string
  message?: string
}

export function getResearchJobProgress(
  payload: Record<string, unknown> | null | undefined,
): ResearchJobProgress | null {
  if (!payload || typeof payload !== "object") return null
  const progress = payload.progress
  if (!progress || typeof progress !== "object") return null
  return progress as ResearchJobProgress
}

export async function getResearchHistory(
  tenantId?: string,
): Promise<ResearchHistoryItem[]> {
  const items = await apiFetch<ResearchHistoryItem[]>("/ai/research/history", { tenantId })
  return Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        outputMarkdown: typeof item.outputMarkdown === "string" ? item.outputMarkdown : "",
        preview: typeof item.preview === "string" ? item.preview : "",
        citationCount: typeof item.citationCount === "number"
          ? item.citationCount
          : Array.isArray(item.citations)
            ? item.citations.length
            : 0,
        citationAudit: normalizeCitationAudit(item.citationAudit),
        citations: Array.isArray(item.citations) ? item.citations : undefined,
        findings: Array.isArray(item.findings) ? item.findings : undefined,
        propositions: Array.isArray(item.propositions) ? item.propositions : undefined,
        structuredDraft: normalizeStructuredDraft(item.structuredDraft),
        generatedAt: item.generatedAt ?? item.createdAt,
      }))
    : []
}

/** Rehydrate every field a current or future history payload already carries. */
export function researchResultFromHistory(item: ResearchHistoryItem): LegalResearchResponse {
  const storedJurisdiction = item.jurisdiction?.trim()
  const storedCountryCode =
    storedJurisdiction && /^[A-Z]{2}$/i.test(storedJurisdiction)
      ? storedJurisdiction.toUpperCase()
      : undefined
  const result = normalizeLegalResearchResponse({
    outputMarkdown: item.outputMarkdown,
    citations: item.citations,
    researchMode: item.researchMode ?? (item.verified ? "DEEP" : "FAST"),
    citationAudit: item.citationAudit,
    requiresLawyerReview: item.requiresLawyerReview,
    similarCases: item.similarCases,
    sectionChecks: item.sectionChecks,
    findings: item.findings,
    propositions: item.propositions,
    dimensions: item.dimensions,
    publicationState: item.publicationState,
    outputHash: item.outputHash,
    structuredDraft: item.structuredDraft,
    caseLawSearchStatus: item.caseLawSearchStatus,
    issueGaps: item.issueGaps,
    sourceDiagnostics: item.sourceDiagnostics,
    connectorDiagnostics: item.connectorDiagnostics,
    rejectedCandidates: item.rejectedCandidates,
    taskProfile: item.taskProfile,
    researchPlan: item.researchPlan,
    capabilitySnapshot: item.capabilitySnapshot,
    sourceProvenance: item.sourceProvenance,
    sourceIntegrity: item.sourceIntegrity,
    conflicts: item.conflicts,
    confidenceAssessment: item.confidenceAssessment,
    publicationDecision: item.publicationDecision,
    factSummaries: item.factSummaries,
    propositionSummaries: item.propositionSummaries,
    authoritySummaries: item.authoritySummaries,
    applicationSummaries: item.applicationSummaries,
    assumptions: item.assumptions,
    unresolvedFacts: item.unresolvedFacts,
    strategyGuidance: item.strategyGuidance,
    auditMetadata: item.auditMetadata,
    userAuthorityChecks: item.userAuthorityChecks,
    factLedger: item.factLedger,
    propositionGraph: item.propositionGraph,
    unverifiedResearchLeads: item.unverifiedResearchLeads,
    adaptiveEvidenceSummary: item.adaptiveEvidenceSummary,
    caseEvidenceLayers: item.caseEvidenceLayers,
    jurisdiction: storedCountryCode ? undefined : (item.jurisdiction ?? undefined),
    countryCode: storedCountryCode,
    aiOutputId: item.id,
    fromCache: true,
    generatedAt: item.generatedAt ?? item.createdAt,
  })
  return {
    ...result,
    citationCount: item.citationCount,
    disclaimer: "Loaded from research history. Check for later authorities and amendments.",
  } as LegalResearchResponse
}

export type ResearchEnrichMode = "case_laws" | "sections" | "both"

export interface ResearchEnrichResponse {
  aiOutputId: string
  answer: string
  similarCases: import("./types").SimilarCase[]
  sectionChecks: import("./types").SectionChecksAudit | null
  creditsCharged: number
  providerCostUsd: number
  mode: ResearchEnrichMode
  sectionsAdded: string[]
  casesAdded: number
  warning?: string
  citations?: Array<{
    title?: string
    source?: string
    citation?: string | null
    url?: string | null
    sourceUrl?: string | null
    authorityId?: string
    verified?: boolean
  }>
  findings?: import("./verification").VerificationFinding[]
  propositions?: import("./verification").VerifiedPropositionSummary[]
  dimensions?: import("./verification").VerificationDimensions
  publicationState?: import("./verification").PublicationState
  outputHash?: string
  requiresLawyerReview?: boolean
}

export async function ensureResearchOutput(
  body: {
    query: string
    answer: string
    countryCode?: string
    jurisdiction?: string
    aiOutputId?: string
  },
  tenantId?: string,
): Promise<{ aiOutputId: string }> {
  return apiFetch<{ aiOutputId: string }>("/ai/research/ensure-output", {
    method: "POST",
    body,
    tenantId,
  })
}

export async function enrichLegalResearch(
  outputId: string,
  body: {
    mode: ResearchEnrichMode
    query?: string
    countryCode?: string
    jurisdiction?: string
  },
  tenantId?: string,
): Promise<ResearchEnrichResponse> {
  return apiFetch<ResearchEnrichResponse>(`/ai/research/${outputId}/enrich`, {
    method: "POST",
    body,
    tenantId,
  })
}

export type ResearchAuthorityInput = {
  id?: string
  authorityId?: string
  title: string
  citation?: string | null
  sourceName?: string
  sourceUrl?: string | null
  summary?: string | null
  fullText?: string
  excerpt?: string
  sourceTier?: "primary" | "case_law" | "firm" | "web" | "seed"
  authorityType?: string
}

export type ResearchAuthoritySearchItem = ResearchAuthorityInput & {
  id: string
  authorityId: string
  citation: string | null
  sourceName: string
  sourceUrl: string | null
  summary: string | null
  relevanceScore: number
  relevanceReason: string
}

export async function searchResearchAuthorities(
  body: {
    query: string
    countryCode?: string
    jurisdiction?: string
    limit?: number
  },
  tenantId?: string,
): Promise<ResearchAuthoritySearchItem[]> {
  const response = await apiFetch<{ authorities: ResearchAuthoritySearchItem[] }>(
    "/ai/research/authorities/search",
    {
      method: "POST",
      body,
      tenantId,
    },
  )
  return response.authorities
}

export type RefineResearchRequest = {
  addedContext: string
  pinnedAuthorityIds: string[]
  excludedAuthorityIds: string[]
  addedAuthorities: ResearchAuthorityInput[]
  query?: string
  countryCode?: string
  jurisdiction?: string
  desiredOutput?: import("./types").LegalResearchRequest["desiredOutput"]
  requestedTaskKind?: import("./types").ResearchTaskKind
}

export async function refineLegalResearch(
  outputId: string,
  body: RefineResearchRequest,
  tenantId?: string,
): Promise<LegalResearchResponse> {
  const raw = await apiFetch<BackendLegalResearchResponse>(`/ai/research/${outputId}/refine`, {
    method: "POST",
    body,
    tenantId,
  })
  return normalizeLegalResearchResponse(raw)
}

export async function saveResearchToClient(
  payload: {
    clientId: string
    matterId?: string
    aiOutputId?: string
    title: string
    query: string
    countryCode?: string
    researchJson: Record<string, unknown>
  },
  tenantId?: string,
): Promise<{ id: string; clientId: string; matterId?: string | null; title: string; createdAt: string }> {
  return apiFetch("/ai/research/saved", {
    method: "POST",
    body: payload,
    tenantId,
  })
}

export interface SavedResearchItem {
  id: string
  userId?: string | null
  title: string
  query: string
  countryCode?: string | null
  clientId: string
  matterId?: string | null
  aiOutputId?: string | null
  createdAt: string
  client?: { id: string; name: string }
  matter?: { id: string; title: string } | null
  verification?: {
    status: string
    verified: boolean
    safeForReliance: boolean
    requiresLawyerReview: boolean
    approvedByLawyerId?: string | null
    manualReview: {
      total: number
      pending: number
      complete: boolean
    }
  }
  researchJson?: Record<string, unknown>
}

export async function listSavedResearch(
  tenantId?: string,
  params?: { clientId?: string; matterId?: string },
): Promise<SavedResearchItem[]> {
  const qs = new URLSearchParams()
  if (params?.clientId) qs.set("clientId", params.clientId)
  if (params?.matterId) qs.set("matterId", params.matterId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return apiFetch(`/ai/research/saved${suffix}`, { tenantId })
}

export async function getSavedResearch(
  id: string,
  tenantId?: string,
): Promise<SavedResearchItem> {
  return apiFetch<SavedResearchItem>(`/ai/research/saved/${id}`, { tenantId })
}

export function researchResultFromSaved(item: SavedResearchItem): LegalResearchResponse {
  const research = item.researchJson ?? {}
  const raw = research as unknown as BackendLegalResearchResponse
  return normalizeLegalResearchResponse({
    ...raw,
    answer: raw.answer ?? raw.outputMarkdown ?? undefined,
    aiOutputId: item.aiOutputId ?? undefined,
    countryCode: item.countryCode ?? undefined,
    generatedAt: item.createdAt,
    fromCache: true,
  })
}

export async function getAiUsageSummary(
  tenantId?: string,
): Promise<AiUsageSummary> {
  return apiFetch<AiUsageSummary>("/ai/usage", { tenantId })
}

export async function getAiHealth(): Promise<{ status: string; provider?: string }> {
  return apiFetch("/health/ai", { auth: true })
}

export interface AiUsageSummary {
  totalCredits: number
  totalCostUsd: number
  byTaskType: Array<{ taskType: string; credits: number; count: number }>
}

export interface CommandCenterSummary {
  newConsumerLeads: number
  aiDraftsAwaitingReview: number
  highRiskMatters: number
  documentsNeedingClassification: number
  missedUrgentDeadlines: number
  suggestedTimeEntries: number
  researchMemosGenerated: number
  opponentFilingsNeedingResponse: number
  aiCostThisMonthUsd: number
  aiCreditsUsed: number
  aiCreditsIncluded: number
  providerHealth?: { status: string; provider?: string }
}

export async function getCommandCenterSummary(
  tenantId?: string,
): Promise<CommandCenterSummary> {
  return apiFetch<CommandCenterSummary>("/ai/command-center/summary", { tenantId })
}

export interface ProactiveBriefDeadline {
  taskId: string
  title: string
  dueDate: string
  matterId: string | null
  matterTitle: string | null
}

export interface ProactiveBrief {
  generatedAt: string
  matterDeadlines: ProactiveBriefDeadline[]
  pendingApprovals: number
  leadCount: number
}

export async function getProactiveBrief(
  tenantId?: string,
): Promise<ProactiveBrief> {
  return apiFetch<ProactiveBrief>("/ai/proactive/brief", { tenantId })
}

// ---------------------------------------------------------------------------
// Document Review
// ---------------------------------------------------------------------------

export type DocumentReviewDocumentType =
  | 'CONTRACT'
  | 'LEGAL_NOTICE'
  | 'AGREEMENT'
  | 'PETITION'
  | 'MOU'
  | 'AFFIDAVIT'
  | 'WILL'
  | 'GENERAL'

export interface DocumentReviewParty {
  name: string
  role: string
}

export interface DocumentReviewKeyDate {
  date: string
  description: string
}

export interface DocumentReviewPro {
  title: string
  detail: string
  /** Verbatim excerpt from the document that this strength relates to. */
  sourceText?: string
}

export interface DocumentReviewCon {
  title: string
  detail: string
  /** Verbatim excerpt from the document that this weakness relates to. */
  sourceText?: string
}

export interface DocumentReviewRisk {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  detail: string
  legalBasis?: string
  /** Verbatim excerpt from the document that triggers this risk. Required for HIGH severity. */
  sourceText?: string
}

export interface DocumentReviewClause {
  title: string
  originalText: string
  analysis: string
  flagged: boolean
}

export interface DocumentReviewAmendment {
  clauseRef: string
  issue: string
  originalText: string
  suggestedText: string
  reason: string
}

export interface DocumentReviewResult {
  summary: string
  documentType: string
  parties: DocumentReviewParty[]
  keyDates: DocumentReviewKeyDate[]
  pros: DocumentReviewPro[]
  cons: DocumentReviewCon[]
  risks: DocumentReviewRisk[]
  keyClauses: DocumentReviewClause[]
  amendments: DocumentReviewAmendment[]
  overallRiskScore: number
  riskLabel: 'Low' | 'Moderate' | 'High' | 'Critical'
  complianceFlags: string[]
  recommendations: string[]
  suggestedFollowUpQuestions?: string[]
  extractedText?: string
  creditsUsed?: number
  modelName?: string
  analysisCoverage?: {
    totalChars: number
    analyzedChars: number
    chunkCount: number
    /** false when the document exceeded the analysis cap and trailing sections were skipped */
    fullCoverage: boolean
  }
}

export interface DocumentReviewRequest {
  documentId?: string
  extractedText?: string
  fileName?: string
  documentType?: DocumentReviewDocumentType
  countryCode?: string
  jurisdiction?: string
  matterId?: string
  aiModelMode?: 'AUTO' | 'PREMIUM'
  premiumModelId?: string
}

export async function runDocumentReview(
  payload: DocumentReviewRequest,
  tenantId?: string,
): Promise<DocumentReviewResult> {
  return apiFetch<DocumentReviewResult>("/ai/document-review", {
    method: "POST",
    body: payload,
    tenantId,
  })
}

export async function runDocumentReviewFile(
  file: File,
  opts: {
    documentType?: DocumentReviewDocumentType
    countryCode?: string
    jurisdiction?: string
    matterId?: string
    aiModelMode?: 'AUTO' | 'PREMIUM'
    premiumModelId?: string
  },
  tenantId?: string,
): Promise<DocumentReviewResult> {
  const form = new FormData()
  form.append("file", file)
  if (opts.documentType) form.append("documentType", opts.documentType)
  if (opts.countryCode) form.append("countryCode", opts.countryCode)
  if (opts.jurisdiction) form.append("jurisdiction", opts.jurisdiction)
  if (opts.matterId) form.append("matterId", opts.matterId)
  if (opts.aiModelMode) form.append("aiModelMode", opts.aiModelMode)
  if (opts.premiumModelId) form.append("premiumModelId", opts.premiumModelId)

  return apiFetch<DocumentReviewResult>("/ai/document-review/upload", {
    method: "POST",
    body: form,
    tenantId,
  })
}

export interface ExtractDocumentReviewTextResponse {
  extractedText: string
  fileName: string
  mimeType: string
}

export async function extractDocumentReviewText(
  file: File,
  tenantId?: string,
): Promise<ExtractDocumentReviewTextResponse> {
  const form = new FormData()
  form.append("file", file)

  return apiFetch<ExtractDocumentReviewTextResponse>("/ai/document-review/extract", {
    method: "POST",
    body: form,
    tenantId,
  })
}

// ---------------------------------------------------------------------------
// Saved Document Reviews
// ---------------------------------------------------------------------------

export interface SavedDocumentReviewSummary {
  id: string
  fileName: string
  documentType: string | null
  clientId: string | null
  matterId: string | null
  createdAt: string
  client: { id: string; name: string } | null
  matter: { id: string; title: string } | null
}

export interface SavedDocumentReviewFull extends SavedDocumentReviewSummary {
  reviewJson: DocumentReviewResult
  extractedText: string | null
}

export interface SaveDocumentReviewRequest {
  fileName: string
  documentType?: string
  clientId?: string
  matterId?: string
  reviewJson: DocumentReviewResult
  extractedText?: string
}

export async function saveDocumentReview(
  payload: SaveDocumentReviewRequest,
  tenantId?: string,
): Promise<SavedDocumentReviewSummary> {
  return apiFetch<SavedDocumentReviewSummary>("/ai/document-review/saved", {
    method: "POST",
    body: payload,
    tenantId,
  })
}

export async function listSavedDocumentReviews(
  params?: { clientId?: string; matterId?: string },
  tenantId?: string,
): Promise<SavedDocumentReviewSummary[]> {
  const qs = new URLSearchParams()
  if (params?.clientId) qs.set("clientId", params.clientId)
  if (params?.matterId) qs.set("matterId", params.matterId)
  const query = qs.toString() ? `?${qs.toString()}` : ""
  return apiFetch<SavedDocumentReviewSummary[]>(`/ai/document-review/saved${query}`, { tenantId })
}

export async function getSavedDocumentReview(
  id: string,
  tenantId?: string,
): Promise<SavedDocumentReviewFull> {
  return apiFetch<SavedDocumentReviewFull>(`/ai/document-review/saved/${id}`, { tenantId })
}

// ---------------------------------------------------------------------------
// Tabular Document Review (compare two documents)
// ---------------------------------------------------------------------------

export interface TabularDocumentReviewRequest {
  docAText: string
  docBText: string
  docAName?: string
  docBName?: string
  documentType?: string
  countryCode?: string
  aiModelMode?: 'AUTO' | 'PREMIUM'
  premiumModelId?: string
}

export interface TabularReviewRow {
  clauseName: string
  docAText: string | null
  docBText: string | null
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED'
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  riskDetail: string | null
  recommendation: string | null
}

export interface TabularReviewResult {
  rows: TabularReviewRow[]
  summary: string
  totalClauses: number
  changedClauses: number
  highRiskClauses: number
  creditsUsed: number
  modelName: string
}

export async function runTabularDocumentReview(
  payload: TabularDocumentReviewRequest,
  tenantId?: string,
): Promise<TabularReviewResult> {
  return apiFetch<TabularReviewResult>('/ai/document-review/tabular', {
    method: 'POST',
    body: payload,
    tenantId,
  })
}
