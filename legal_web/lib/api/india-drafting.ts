import { apiFetch, buildAuthHeaders, ApiClientError } from "./client"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import type { ExtractedParties } from "@/lib/india-drafting/extract-field-hints"

/** @deprecated Use DraftVerificationAudit */
export type IndiaDraftVerificationAudit = DraftVerificationAudit
export type { DraftVerificationAudit }

export type DraftPartiesPayload = ExtractedParties

export interface GenerateIndiaDraftRequest {
  kind: string
  caseDetails: string
  clientName?: string
  courtName?: string
  opposingParty?: string
  /** Structured multi-party extraction (preferred when multiple plaintiffs/defendants). */
  parties?: DraftPartiesPayload
  language?: string
  formNumber?: string
  formTitle?: string
  authority?: string
  jurisdiction?: string
  practiceArea?: string
  category?: string
  attachmentContext?: string
  bundleMode?: boolean
  bundleIndex?: number
  /**
   * AUTO (default) — autonomous model selection (cheapest that meets accuracy bar).
   * PREMIUM — "Higher accuracy" mode; uses best-in-class models for all sections.
   */
  modelMode?: "AUTO" | "PREMIUM"
  /** Active drafting style: "my_style" or a preset ID e.g. "concise_direct" */
  styleId?: string
  pinnedSections?: PinnedSection[]
  pinnedCaseLaws?: PinnedCaseLaw[]
  confirmedCaseRecord?: Record<string, unknown>
  /** Restrict retrieval to selected knowledge sources (statutes, case_law, etc.). */
  knowledgeSources?: string[]
}

export type PinnedSectionSource = "section_finder" | "user_unresolved" | "resolved_ingest"
export type PinnedCaseLawSource = "user" | "research" | "form_metadata"

export interface PinnedSection {
  actId?: string
  section: string
  label?: string
  authorityId?: string
  textExcerpt?: string
  source: PinnedSectionSource
}

export interface PinnedCaseLaw {
  citation: string
  caseName?: string
  holding?: string
  authorityId?: string
  source: PinnedCaseLawSource
}

// ── v2 engine types ───────────────────────────────────────────────────────────

export type SectionType =
  | "heading"
  | "parties"
  | "maintainability"
  | "facts"
  | "grounds"
  | "law"
  | "arguments"
  | "prayer"
  | "verification"
  | "annexures"
  | "boilerplate"

export type SectionVerificationStatus =
  | "verified"
  | "needs_review"
  | "limited_sources"
  | "repair_needed"
  | "repair_failed"

export interface ConfidenceScore {
  score: number
  grade: "high" | "medium" | "low" | "unverified"
  citationVerified: boolean
  groundedSentenceRate: number
  ungroundedCount: number
  contradictions: number
  signals: string[]
}

export interface EvidenceItem {
  type: "statute" | "case_law" | "client_evidence" | "fact" | "rule"
  ref: string
  source?: string
  jurisdiction?: string
  verified: boolean
  confidence: number
  excerpt?: string
}

export interface EvidenceChain {
  paragraphIndex: number
  paragraphText: string
  statutes: EvidenceItem[]
  caseLaw: EvidenceItem[]
  clientEvidence: EvidenceItem[]
  missingEvidence: string[]
  whyIncluded?: string
  whichRule?: string
}

export interface SectionExplainability {
  whyIncluded: string
  applicableLaw: string[]
  applicableEvidence: string[]
  applicableCases: string[]
  applicableRules: string[]
}

export interface SectionResult {
  sectionId: string
  type: SectionType
  title: string
  content: string
  confidence: ConfidenceScore
  evidenceChains: EvidenceChain[]
  verificationStatus: SectionVerificationStatus
  repairAttempts: number
  verificationWarnings: string[]
  citationWarnings: string[]
  modelUsed: string
  tokensUsed: { input: number; output: number }
  explainability: SectionExplainability
  isInjectedBoilerplate: boolean
}

export interface ConfidenceReport {
  overallScore: number
  overallGrade: "high" | "medium" | "low" | "unverified"
  sectionScores: Array<{
    sectionId: string
    type: SectionType
    score: number
    grade: string
  }>
  totalSections: number
  verifiedSections: number
  needsReviewSections: number
  repairTriggered: boolean
  totalRepairs: number
  belowThresholdSections: string[]
}

export interface VerificationReport {
  status: "verified" | "needs_review" | "limited_sources"
  canCertify: boolean
  certificationLabel: "lawyer_ready" | "verified_for_filing" | "complete_missing_facts" | "needs_review"
  sectionStatuses: Array<{
    sectionId: string
    type: SectionType
    status: SectionVerificationStatus
    warnings: string[]
  }>
  overallWarnings: string[]
  requiresLawyerReview: boolean
}

export interface CitationAppendixEntry {
  sectionId: string
  sectionTitle: string
  paragraphIndex: number
  citation: string
  /** "case" is a legacy alias emitted by older engine paths; treat as "case_law" */
  type: "statute" | "case_law" | "case"
  verified: boolean
  source?: string
  sourceUrl?: string
  treatmentStatus?: "good_law" | "overruled" | "distinguished" | "superseded" | "repealed"
  neutralCitation?: string
  decisionYear?: number
  holding?: string
  identityStatus?: "pass" | "fail" | "indeterminate"
  relevanceStatus?: "pass" | "fail" | "indeterminate"
  authorityType?: string
  citedInDraft?: boolean
  excluded?: boolean
  exclusionReason?: string
  dimensions?: import("./verification").VerificationDimensions
  verificationFindings?: import("./verification").VerificationFinding[]
  issue?: string
}

// ── Main response shape ───────────────────────────────────────────────────────

export interface GenerateIndiaDraftResponse {
  draft: string
  creditsUsed: number
  modelUsed?: string
  verification?: DraftVerificationAudit
  draftId?: string
  authorityEvidenceBundle?: {
    bundleId: string
    consumer: "legal_research" | "draft_generation" | "draft_enrich" | "draft_reverify"
    jurisdiction: string
    documentKind?: string
    asOfDate: string
    sourceRegistry: VerifiedSourceRegistry
    publicationState: string
    presentation: {
      allowInlineCitation: boolean
      maxInlineCaseCites: number
      appendixOnly: boolean
    }
  }
  proceduralDetermination?: {
    recommendedKind: string
    userSelectedKind: string
    kindOverridden: boolean
    maintainabilityNotes: string[]
    governingSections: Array<{ actId: string; section: string; label: string }>
  }
  researchPhase?: {
    retrievalConfidence: "high" | "medium" | "low"
    usedDeepResearch: boolean
    authorityCount: number
  }
  preDraftChecklist?: Record<string, boolean>
  resolvedItems?: string[]
  unresolvedItems?: string[]
  counselChecklist?: string
  accuracyGate?: {
    canCertify: boolean
    canExport: boolean
    exportWatermark?: string
    certificationLabel: "lawyer_ready" | "verified_for_filing" | "complete_missing_facts" | "needs_review"
    unresolvedFacts?: string[]
    filingReadiness?: {
      status: "working_draft" | "lawyer_review_ready" | "filing_ready"
      canExportDraft: boolean
      canExportForFiling: boolean
      mandatoryBlockers: string[]
      checks: Record<string, "pass" | "blocked" | "review">
    }
  }
  finalResolutionStatus?:
    | "clean"
    | "repaired"
    | "needs_user_confirmation"
    | "needs_advocate_review"
    | "blocked"
  repairAttemptCount?: number
  resolvedFindingCodes?: string[]
  unresolvedFindingCodes?: string[]
  confirmationQuestions?: Array<{
    findingCode: string
    field: string
    question: string
    options?: Array<{ label: string; value: unknown; sourceIds: string[] }>
  }>
  accuracyFindings?: Array<{
    code: string
    severity: string
    message: string
    repairHint?: string
  }>
  /** v2 engine outputs — present only when DRAFT_ENGINE_V2=true */
  sections?: SectionResult[]
  confidenceReport?: ConfidenceReport
  verificationReport?: VerificationReport
  citationAppendix?: CitationAppendixEntry[]
  engineVersion?: "v1" | "v2" | "v3"
  /** v3 unified engine — present when UNIFIED_DRAFT_ENGINE_ENABLED=true */
  jobId?: string
  migratedToAsyncEngine?: boolean
  estimatedCredits?: number
}

export type IndiaDraftAccuracyGate = NonNullable<GenerateIndiaDraftResponse["accuracyGate"]>

export interface FillIndiaDraftBlanksRequest {
  documentKind: string
  context?: Record<string, string>
  emptyFields: string[]
}

export interface FillIndiaDraftBlanksResponse {
  suggestions: Record<string, string>
  creditsUsed: number
}

export type EditInstruction =
  | "strengthen"
  | "make_formal"
  | "make_concise"
  | "check_law"
  | "add_citations"
  | "retrieve_authority"
  | "qualify_claim"
  | "expand_grounds"
  | "rephrase"
  | "fix_grammar"

export interface EditIndiaDraftRequest {
  documentKind: string
  selectedText: string
  instruction: EditInstruction | string
  context?: string
  caseDetails?: string
  jurisdiction?: string
}

export interface EditIndiaDraftResponse {
  revisedText: string
  explanation: string
  creditsUsed: number
  verification?: DraftVerificationAudit
  accuracyGate?: IndiaDraftAccuracyGate
}

export interface ReverifyIndiaDraftRequest {
  documentKind: string
  draft: string
  caseDetails?: string
  jurisdiction?: string
  sourceRegistry?: VerifiedSourceRegistry
}

export interface VerifiedSourceRegistry {
  jobId: string
  builtAt: string
  sources: Array<{
    id: string
    type: "statute" | "case" | "rule" | "template" | "matter_document"
    jurisdiction: string
    title: string
    citation?: string
    court?: string
    date?: string
    section?: string
    text?: string
    proposition?: string
    verificationStatus: "verified" | "partially_verified" | "rejected"
    contentHash: string
  }>
}

export interface ReverifyIndiaDraftResponse {
  draft: string
  verification: DraftVerificationAudit
  accuracyGate: IndiaDraftAccuracyGate
  creditsUsed: number
}

export interface FixVerificationRequest extends ReverifyIndiaDraftRequest {
  instruction: "retrieve_authority" | "qualify_claim" | "remove_claim" | "check_law" | "add_citations"
  selectedText?: string
  findingId?: string
}

export async function extractCaseRecord(
  payload: {
    kind: string
    caseDetails: string
    clientName?: string
    courtName?: string
    opposingParty?: string
    jurisdiction?: string
    attachmentContext?: string
  },
  tenantId?: string,
): Promise<import("@/components/india-drafting/CaseRecordConfirmPanel").CaseRecordConfirmPayload> {
  return apiFetch("/ai/india-draft/extract-case-record", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export interface ExtractFormFieldsResponse {
  clientName?: string
  opposingParty?: string
  courtName?: string
  parties?: ExtractedParties
  source?: "regex" | "llm" | "hybrid"
}

/** Prefill client / opposing / court from case details (regex + optional AI). */
export async function extractIndiaDraftFormFields(
  payload: {
    caseDetails: string
    kind?: string
    category?: string
  },
  tenantId?: string,
): Promise<ExtractFormFieldsResponse> {
  return apiFetch("/ai/india-draft/extract-form-fields", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function confirmCaseRecord(
  payload: {
    caseRecord: Record<string, unknown>
    resolutions?: Array<{ contradictionId: string; chosenFactId: string; note?: string }>
  },
  tenantId?: string,
): Promise<{ caseRecord: Record<string, unknown> }> {
  return apiFetch("/ai/india-draft/confirm-case-record", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export type DraftRepairConfirmationQuestion = NonNullable<
  GenerateIndiaDraftResponse["confirmationQuestions"]
>[number]

export type FinalDraftResolutionStatus = NonNullable<
  GenerateIndiaDraftResponse["finalResolutionStatus"]
>

export async function applyIndiaDraftRepairConfirmations(
  payload: {
    documentKind: string
    draft: string
    caseRecord: Record<string, unknown>
    answers: Array<{ findingCode: string; field: string; value: unknown }>
    caseDetails?: string
    accuracyMode?: "fast" | "balanced" | "strict"
  },
  tenantId?: string,
): Promise<{
  draft: string
  caseRecord: Record<string, unknown>
  finalResolutionStatus: FinalDraftResolutionStatus
  confirmationQuestions: DraftRepairConfirmationQuestion[]
  unresolvedFindingCodes: string[]
  resolvedFindingCodes: string[]
  accuracyGate: IndiaDraftAccuracyGate
  accuracyFindings: NonNullable<GenerateIndiaDraftResponse["accuracyFindings"]>
}> {
  return apiFetch("/ai/india-draft/apply-repair-confirmations", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function approveHumanReview(
  payload: {
    draftId: string
    caseRecordId: string
    caseRecordVersion: number
    playbookVersion: string
    draftHash: string
    notes?: string
  },
  tenantId?: string,
): Promise<{ humanReview: Record<string, unknown> }> {
  return apiFetch("/ai/india-draft/human-review/approve", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function getHumanReviewStatus(
  payload: {
    draftId: string
    caseRecordId: string
    caseRecordVersion: number
    playbookVersion: string
    draftHash: string
  },
  tenantId?: string,
): Promise<{ valid: boolean; reason?: string; record?: Record<string, unknown> }> {
  return apiFetch("/ai/india-draft/human-review/status", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function exportIndiaDraft(
  payload: {
    documentKind: string
    html: string
    fileName: string
    format: "pdf" | "docx"
    citationAppendix?: CitationAppendixEntry[]
    draftId: string
    exportMode: "filing"
  },
  tenantId?: string,
): Promise<{ html: string }> {
  return apiFetch("/ai/india-draft/export", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function generateIndiaDraft(
  payload: GenerateIndiaDraftRequest & { confirmedCaseRecord?: Record<string, unknown> },
  tenantId?: string,
  signal?: AbortSignal,
): Promise<GenerateIndiaDraftResponse> {
  // In production on Vercel the Next.js API proxy has a hard 300s serverless
  // function limit (maxDuration=300). Complex writ/bail drafts exceed this.
  // When NEXT_PUBLIC_WS_URL is set (production only — it's the backend origin
  // already used for Socket.IO), call the backend directly from the browser so
  // the request never passes through Vercel at all. Auth is resolved first via
  // a fast same-origin /api/auth/access-token call to exchange the cookie for
  // a Bearer token, then the direct fetch carries that token to the backend.
  const directBackendOrigin =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_WS_URL ?? "").replace(/\/$/, "")
      : ""

  if (directBackendOrigin && !/localhost|127\.0\.0\.1/.test(directBackendOrigin)) {
    const headers = await buildAuthHeaders(true, tenantId)
    headers.set("Content-Type", "application/json")

    const response = await fetch(
      `${directBackendOrigin}/api/v1/ai/india-draft/generate/`,
      { method: "POST", headers, body: JSON.stringify(payload), signal },
    ).catch((err: unknown) => {
      if (signal?.aborted) throw err
      throw new Error("Network error — could not reach the API. Check your connection and try again.")
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      let message = text
      try { message = (JSON.parse(text) as { message?: string }).message ?? text } catch { /* noop */ }
      throw new ApiClientError(message || response.statusText, response.status)
    }

    return response.json() as Promise<GenerateIndiaDraftResponse>
  }

  // Local dev / SSR fallback — go through the Next.js proxy as normal.
  return apiFetch<GenerateIndiaDraftResponse>("/ai/india-draft/generate", {
    method: "POST",
    tenantId,
    body: payload,
    signal,
  })
}

export async function fillIndiaDraftBlanks(
  payload: FillIndiaDraftBlanksRequest,
  tenantId?: string,
): Promise<FillIndiaDraftBlanksResponse> {
  return apiFetch<FillIndiaDraftBlanksResponse>("/ai/india-draft/fill-blanks", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

/** Alias used by india-draft-editor questionnaire flow. */
export const fillBlanks = fillIndiaDraftBlanks

export async function editIndiaDraft(
  payload: EditIndiaDraftRequest,
  tenantId?: string,
): Promise<EditIndiaDraftResponse> {
  return apiFetch<EditIndiaDraftResponse>("/ai/india-draft/edit", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function reverifyIndiaDraft(
  payload: ReverifyIndiaDraftRequest,
  tenantId?: string,
): Promise<ReverifyIndiaDraftResponse> {
  return apiFetch<ReverifyIndiaDraftResponse>("/ai/india-draft/reverify", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function fixIndiaDraftVerification(
  payload: FixVerificationRequest,
  tenantId?: string,
): Promise<ReverifyIndiaDraftResponse> {
  return apiFetch<ReverifyIndiaDraftResponse>("/ai/india-draft/fix-verification", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export interface ExtractDraftContextResponse {
  extractedText: string
  fileName: string
  mimeType: string
}

export async function extractDraftContext(
  file: File,
  tenantId?: string,
): Promise<ExtractDraftContextResponse> {
  const form = new FormData()
  form.append("file", file)
  const { getApiBaseUrl, buildAuthHeaders } = await import("./client")
  const base = getApiBaseUrl()
  const headers = await buildAuthHeaders(true, tenantId)
  const res = await fetch(`${base}/ai/india-draft/extract-context`, {
    method: "POST",
    headers,
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Extract failed: ${res.status}`)
  }
  return res.json() as Promise<ExtractDraftContextResponse>
}

export interface LinkedDraftDocket {
  clientId: string
  clientName: string
  matterId?: string
  matterTitle?: string
}

export async function linkDraftToClient(
  draftId: string,
  payload: { clientId: string; matterId?: string; clientName?: string },
  tenantId?: string,
): Promise<{ success: boolean; clientId: string; clientName: string | null; matterId: string | null }> {
  return apiFetch<{ success: boolean; clientId: string; clientName: string | null; matterId: string | null }>(
    `/ai/drafts/${draftId}/link-to-client`,
    {
      method: "PATCH",
      tenantId,
      body: payload,
    },
  )
}

export interface RegenerateSectionRequest {
  sectionId: string
  kind: string
  caseDetails: string
  clientName?: string
  courtName?: string
  opposingParty?: string
  jurisdiction?: string
  practiceArea?: string
  attachmentContext?: string
}

/**
 * v2 engine only: targeted repair of a single section by sectionId.
 * Returns the regenerated SectionResult. The caller replaces only that
 * section in its local document state.
 */
export async function regenerateSection(
  payload: RegenerateSectionRequest,
  tenantId?: string,
  signal?: AbortSignal,
): Promise<SectionResult> {
  return apiFetch<SectionResult>("/ai/india-draft/regenerate-section", {
    method: "POST",
    tenantId,
    body: payload,
    signal,
  })
}

// ── Unified Drafting Engine (v3) job helpers ───────────────────────────────

type CertificationLabel = NonNullable<
  GenerateIndiaDraftResponse["accuracyGate"]
>["certificationLabel"]

const CERTIFICATION_LABELS: readonly CertificationLabel[] = [
  "lawyer_ready",
  "verified_for_filing",
  "complete_missing_facts",
  "needs_review",
]

function toCertificationLabel(value: string | undefined): CertificationLabel {
  if (value && CERTIFICATION_LABELS.includes(value as CertificationLabel)) {
    return value as CertificationLabel
  }
  return "needs_review"
}

interface DraftJobResultRaw {
  jobId: string
  draftId: string
  courtDraftRecordId: string
  status: string
  assembledDraft: {
    fullText: string
    citationAppendix: CitationAppendixEntry[]
    sectionSummary: Array<{ sectionKey: string; title: string; status: string; wordCount: number }>
    totalWordCount: number
    assembledAt: string
    canExport?: boolean
    userLabel?: string
    certificationLabel?: string
    lawyerReady?: boolean
    finalResolutionStatus?: string
    confirmationQuestions?: GenerateIndiaDraftResponse["confirmationQuestions"]
    repairAttemptCount?: number
    unresolvedFindingCodes?: string[]
    releaseGate?: {
      canExport?: boolean
      canCertify?: boolean
      userLabel?: string
      certificationLabel?: string
      finalResolutionStatus?: string
      confirmationQuestions?: GenerateIndiaDraftResponse["confirmationQuestions"]
      repairAttemptCount?: number
      unresolvedFindingCodes?: string[]
    } | null
  } | null
  verificationReport: VerificationReport | null
  sections: Array<{ sectionKey: string; title: string; content: string; status: string }> | null
  totalCostUsd: number | null
  completedAt: string | null
}

function getDirectBackendOrigin(): string {
  return typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ?? "").replace(/\/$/, "")
    : ""
}

/**
 * Fetches the completed result for a unified draft job and maps it to the
 * same GenerateIndiaDraftResponse shape used by the legacy synchronous API.
 */
export async function fetchDraftJobResult(
  jobId: string,
  tenantId?: string,
): Promise<GenerateIndiaDraftResponse> {
  const directOrigin = getDirectBackendOrigin()

  let raw: DraftJobResultRaw

  if (directOrigin && !/localhost|127\.0\.0\.1/.test(directOrigin)) {
    const headers = await buildAuthHeaders(true, tenantId)
    const res = await fetch(`${directOrigin}/api/v1/draft-jobs/${jobId}/result`, { headers })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let message = text
      try { message = (JSON.parse(text) as { message?: string }).message ?? text } catch { /* noop */ }
      throw new ApiClientError(message || res.statusText, res.status)
    }
    raw = await res.json() as DraftJobResultRaw
  } else {
    raw = await apiFetch<DraftJobResultRaw>(`/draft-jobs/${jobId}/result`, { tenantId })
  }

  const assembled = raw.assembledDraft
  const gate = assembled?.releaseGate
  const finalResolutionStatus = (assembled?.finalResolutionStatus ??
    gate?.finalResolutionStatus) as GenerateIndiaDraftResponse["finalResolutionStatus"] | undefined
  const canExport = assembled?.canExport ?? gate?.canExport
  const confirmationQuestions =
    assembled?.confirmationQuestions ?? gate?.confirmationQuestions
  const repairAttemptCount = assembled?.repairAttemptCount ?? gate?.repairAttemptCount
  const unresolvedFindingCodes =
    assembled?.unresolvedFindingCodes ?? gate?.unresolvedFindingCodes
  const certificationLabel = toCertificationLabel(
    assembled?.certificationLabel ?? gate?.certificationLabel,
  )

  return {
    draft: assembled?.fullText ?? "",
    creditsUsed: 0,
    engineVersion: "v3",
    jobId: raw.jobId,
    draftId: raw.draftId,
    verificationReport: raw.verificationReport ?? undefined,
    citationAppendix: assembled?.citationAppendix?.map((e) => ({
      ...e,
      type: e.type === 'case' ? ('case_law' as const) : e.type,
    })),
    // v3 section shape is simpler than SectionResult; omit to avoid type mismatch.
    // The rendered draft (fullText) already contains all section content.
    sections: undefined,
    finalResolutionStatus,
    confirmationQuestions,
    repairAttemptCount,
    unresolvedFindingCodes,
    accuracyGate: {
      canExport: Boolean(canExport),
      canCertify: Boolean(gate?.canCertify ?? assembled?.lawyerReady),
      certificationLabel,
    },
  }
}

/** Cancels an in-progress unified draft job. */
export async function cancelDraftJob(
  jobId: string,
  tenantId?: string,
): Promise<void> {
  const directOrigin = getDirectBackendOrigin()

  if (directOrigin && !/localhost|127\.0\.0\.1/.test(directOrigin)) {
    const headers = await buildAuthHeaders(true, tenantId)
    await fetch(`${directOrigin}/api/v1/draft-jobs/${jobId}/cancel`, { method: "POST", headers })
    return
  }
  await apiFetch(`/draft-jobs/${jobId}/cancel`, { method: "POST", tenantId })
}

// ── Case-law enrichment types ──────────────────────────────────────────────

export interface CaseLawArea {
  caseId: string
  citation: string
  title: string
  areas: string[]
  proposition: string
  treatmentStatus: "good_law" | "overruled" | "distinguished" | "superseded" | "repealed" | "unknown"
  court: string
  decisionYear?: number
  sourceUrl?: string
  authorityType?: "case" | "statute" | "rule" | "regulation" | "constitution" | "notification" | "secondary_source"
  identityStatus?: "pass" | "fail" | "indeterminate"
  relevanceStatus?: "pass" | "fail" | "indeterminate"
  citedInDraft?: boolean
  excluded?: boolean
  exclusionReason?: string
  issue?: string
}

export interface AuthorityEnrichGateResult {
  canExport: boolean
  status: "pass" | "fail"
  userLabel: string
  blockers: string[]
  verifiedCount: number
  excludedCount: number
}

export type DraftEnrichMode = "case_laws" | "sections" | "both"

export interface EnrichCaseLawsResponse {
  enrichedDraft: string
  citationAppendix: CitationAppendixEntry[]
  caseLawAreas: CaseLawArea[]
  creditsCharged: number
  providerCostUsd: number
  canExport?: boolean
  releaseGate?: AuthorityEnrichGateResult
  excludedAuthorities?: CaseLawArea[]
  mode?: DraftEnrichMode
  sectionsAdded?: string[]
}

/**
 * Enrich an existing draft with verified authorities (case laws, sections, or both).
 */
export async function enrichDraftWithAuthorities(
  jobId: string,
  payload: {
    draftText: string
    documentKind: string
    rawFacts?: string
    mode?: DraftEnrichMode
  },
  tenantId?: string,
): Promise<EnrichCaseLawsResponse> {
  const directOrigin = getDirectBackendOrigin()
  if (directOrigin && !/localhost|127\.0\.0\.1/.test(directOrigin)) {
    const headers = await buildAuthHeaders(true, tenantId)
    const res = await fetch(`${directOrigin}/api/v1/draft-jobs/${jobId}/enrich`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let message = text
      try { message = (JSON.parse(text) as { message?: string }).message ?? text } catch { /* noop */ }
      throw new ApiClientError(message || res.statusText, res.status)
    }
    return res.json() as Promise<EnrichCaseLawsResponse>
  }
  return apiFetch<EnrichCaseLawsResponse>(`/draft-jobs/${jobId}/enrich`, {
    method: "POST",
    tenantId,
    body: payload,
  })
}

/**
 * @deprecated Use enrichDraftWithAuthorities
 */
export async function enrichDraftWithCaseLaws(
  jobId: string,
  payload: { draftText: string; documentKind: string; rawFacts?: string },
  tenantId?: string,
): Promise<EnrichCaseLawsResponse> {
  return enrichDraftWithAuthorities(jobId, { ...payload, mode: "case_laws" }, tenantId)
}

export interface ResolveCaseLawResponse {
  status: "found" | "not_found" | "invalid"
  pin?: PinnedCaseLaw
  message?: string
}

export async function resolveIndiaDraftCaseLaw(
  payload: {
    citation: string
    caseName?: string
    holding?: string
    kind?: string
    jurisdiction?: string
    allowSoftPin?: boolean
  },
  tenantId?: string,
): Promise<ResolveCaseLawResponse> {
  return apiFetch<ResolveCaseLawResponse>("/ai/india-draft/resolve-case-law", {
    method: "POST",
    tenantId,
    body: payload,
  })
}
