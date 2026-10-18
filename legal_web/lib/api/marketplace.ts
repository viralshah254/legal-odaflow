import { apiFetch } from "./client"
import type { ConsumerCase, ConsumerDocument, ConsumerLegalReport } from "./types"

export type IntakeStage = "NEW" | "SCREENING" | "CONSULT" | "ENGAGED" | "CONVERTED"

export type IntakeIntent = "TRANSACTIONAL_DRAFT" | "DISPUTE_ADVISORY" | "GENERAL_ADVISORY"

export interface LawyerLead {
  id: string
  userId?: string | null
  tenantId?: string | null
  consumerCaseId?: string | null
  issueType: string
  countryCode: string
  jurisdiction?: string | null
  urgency: string
  summary?: string | null
  status: string
  clientName?: string | null
  clientId?: string | null
  intakeStage?: IntakeStage | string | null
  convertedMatterId?: string | null
  lawyerContextMarkdown?: string | null
  planningAnswers?: Record<string, string | string[]> | null
  slaEscalatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadDocument {
  id: string
  leadId: string
  tenantId: string
  uploadedById: string
  fileName: string
  fileUrl: string
  mimeType?: string | null
  fileSizeBytes?: number | null
  extractedText?: string | null
  aiSummary?: string | null
  ocrStatus: string
  createdAt: string
}

export interface RunLeadAnalysisRequest {
  additionalContext?: string
  focusPrompt?: string
  documentIds?: string[]
}

export interface CaseAnalysisRun {
  id: string
  tenantId?: string | null
  consumerCaseId: string
  lawyerLeadId?: string | null
  runType: string
  trigger: string
  structuredOutput?: Record<string, unknown> | null
  contentMarkdown?: string | null
  citations?: unknown
  status: string
  createdAt: string
}

export interface AnalysisQuotaStatus {
  plan: string
  includesDeepAnalysis: boolean
  creditsRemaining?: number
  deepAnalysisPremiumModelId?: string
  estimatedCredits?: {
    similarCases?: { min: number; max: number }
    opponentAngles?: { min: number; max: number }
    strategyMemo?: { min: number; max: number }
  }
  /** @deprecated — kept for backwards compat; no longer used for gating */
  quotas?: {
    similarCases: number
    opponentAngles: number
    strategyMemo: number
  }
  /** @deprecated */
  used?: {
    similarCases: number
    opponentAngles: number
    strategyMemo: number
  }
}

export interface LeadDetailResponse {
  lead: LawyerLead
  consumerCase: ConsumerCase | null
  previewReport: ConsumerLegalReport | null
  documents: ConsumerDocument[]
  leadDocuments?: LeadDocument[]
  analysisRuns: CaseAnalysisRun[]
  quotaStatus: AnalysisQuotaStatus | null
  convertedMatter: { id: string; title: string; status: string } | null
  intakeIntent?: IntakeIntent
  intakeCaseBrief?: {
    suggestedOutcomes?: string[]
    parties?: string
    toolPlan?: Array<"retrieve" | "section_finder" | "draft" | "strategy">
    missingSlots?: string[]
    recommendedNextTool?: "retrieve" | "section_finder" | "draft" | "strategy"
  } | null
  recommendedNextTool?: "retrieve" | "section_finder" | "draft" | "strategy"
  /** Top-level convenience fields for dialog pre-fill (from lead.clientName/clientId) */
  clientName?: string | null
  clientId?: string | null
}

export interface DraftingIntakeStructuredOutput {
  documentType?: string
  documentTitle?: string
  situation?: string
  clauseOutline?: { title: string; summary: string }[]
  missingFields?: { field: string; question: string; options?: string[] }[]
  smartNextSteps?: SmartStep[]
  sourcesCited?: string[]
  draftMarkdown?: string
}

export interface SmartStep {
  type: "confirm" | "question" | "multiselect" | "gather_info" | "generate_section" | "open_draft"
  label: string
  detail?: string
  options?: string[]
  fieldId?: string
}

export interface FirmIntakeStructuredOutput {
  situation?: string
  legalIssues?: string[]
  strengths?: string[]
  risksAndGaps?: string[]
  recommendedNextSteps?: string[]
  sourcesCited?: string[]
}

export async function listLeads(): Promise<LawyerLead[]> {
  return apiFetch<LawyerLead[]>("/marketplace/leads")
}

export async function listPipelineLeads(
  tenantId: string,
  intakeStage?: IntakeStage,
): Promise<LawyerLead[]> {
  const query = intakeStage ? `?intakeStage=${encodeURIComponent(intakeStage)}` : ""
  return apiFetch<LawyerLead[]>(`/marketplace/leads/pipeline${query}`, { tenantId })
}

export async function updateIntakeStage(
  leadId: string,
  intakeStage: IntakeStage,
): Promise<LawyerLead> {
  return apiFetch<LawyerLead>(`/marketplace/leads/${leadId}/stage`, {
    method: "PATCH",
    body: { intakeStage },
  })
}

export async function getLead(leadId: string): Promise<LeadDetailResponse> {
  return apiFetch<LeadDetailResponse>(`/marketplace/leads/${leadId}`)
}

export async function acceptLead(leadId: string): Promise<LawyerLead> {
  return apiFetch<LawyerLead>(`/marketplace/leads/${leadId}/accept`, {
    method: "POST",
  })
}

export async function rejectLead(
  leadId: string,
  reason?: string,
): Promise<LawyerLead> {
  return apiFetch<LawyerLead>(`/marketplace/leads/${leadId}/reject`, {
    method: "POST",
    body: { reason },
  })
}

export async function convertLead(
  leadId: string,
  clientId?: string,
  options?: { overrideConflict?: boolean },
): Promise<{
  matter?: { id: string; title?: string; status?: string } | null
  convertedMatterId?: string | null
  playbookApplied?: { name: string; tasksCreated: number } | null
  intakeIntent?: IntakeIntent
  openDocumentsTab?: boolean
  conflictStatus?: "CLEAR" | "REVIEW_REQUIRED" | "SKIPPED"
  conflicts?: {
    clear?: boolean
    matchCount?: number
    summary?: string
    matches?: Array<{ type?: string; name?: string; reason?: string }>
  } | null
  limitation?: { calculated?: boolean; reason?: string } | null
}> {
  return apiFetch(`/marketplace/leads/${leadId}/convert`, {
    method: "POST",
    body: {
      ...(clientId ? { clientId } : {}),
      ...(options?.overrideConflict ? { overrideConflict: true } : {}),
    },
  })
}

export async function listAnalysisRuns(
  leadId: string,
): Promise<CaseAnalysisRun[]> {
  return apiFetch<CaseAnalysisRun[]>(
    `/marketplace/leads/${leadId}/analysis/runs`,
  )
}

export async function runSimilarCases(
  leadId: string,
  body?: RunLeadAnalysisRequest,
): Promise<CaseAnalysisRun> {
  return apiFetch<CaseAnalysisRun>(
    `/marketplace/leads/${leadId}/analysis/similar-cases`,
    { method: "POST", body: body ?? {} },
  )
}

export async function runOpponentAngles(
  leadId: string,
  body?: RunLeadAnalysisRequest,
): Promise<CaseAnalysisRun> {
  return apiFetch<CaseAnalysisRun>(
    `/marketplace/leads/${leadId}/analysis/opponent-angles`,
    { method: "POST", body: body ?? {} },
  )
}

export async function runStrategyMemo(
  leadId: string,
  body?: RunLeadAnalysisRequest,
): Promise<CaseAnalysisRun> {
  return apiFetch<CaseAnalysisRun>(
    `/marketplace/leads/${leadId}/analysis/strategy`,
    { method: "POST", body: body ?? {} },
  )
}

export async function updateLeadContext(
  leadId: string,
  lawyerContextMarkdown: string,
): Promise<LawyerLead> {
  return apiFetch<LawyerLead>(`/marketplace/leads/${leadId}/context`, {
    method: "PATCH",
    body: { lawyerContextMarkdown },
  })
}

export async function createLeadDocumentUploadUrl(
  leadId: string,
  fileName: string,
): Promise<{ uploadUrl: string; fileUrl: string; key: string; uploadHeaders?: Record<string, string> }> {
  return apiFetch<{ uploadUrl: string; fileUrl: string; key: string; uploadHeaders?: Record<string, string> }>(
    `/marketplace/leads/${leadId}/documents/upload-url`,
    {
      method: "POST",
      body: { fileName },
    },
  )
}

export async function createLeadDocument(
  leadId: string,
  data: {
    fileName: string
    fileUrl: string
    mimeType?: string
    fileSizeBytes?: number
  },
): Promise<LeadDocument> {
  return apiFetch<LeadDocument>(`/marketplace/leads/${leadId}/documents`, {
    method: "POST",
    body: data,
  })
}

export async function listLeadDocuments(leadId: string): Promise<LeadDocument[]> {
  return apiFetch<LeadDocument[]>(`/marketplace/leads/${leadId}/documents`)
}

// --- Public marketplace (lawyer directory & consumer review) ---

export interface MarketplaceLawyer {
  id: string
  userId: string
  slug?: string
  countryCode: string
  name?: string | null
  headline?: string | null
  practiceAreas?: string[] | null
  jurisdictions?: string[] | null
  languages?: string[] | null
  currency?: string | null
  consultationFee?: number | null
  acceptsLeads?: boolean
  verified?: boolean
  user?: {
    name?: string | null
    email?: string
  }
}

export async function listLawyers(
  countryCode?: string,
  issueType?: string,
): Promise<MarketplaceLawyer[]> {
  const params = new URLSearchParams()
  if (countryCode) params.set("countryCode", countryCode)
  if (issueType) params.set("issueType", issueType)
  const query = params.toString() ? `?${params.toString()}` : ""
  return apiFetch<MarketplaceLawyer[]>(`/marketplace/lawyers${query}`, {
    auth: false,
  })
}

export async function getLawyerBySlug(
  lawyerSlug: string,
): Promise<MarketplaceLawyer> {
  return apiFetch<MarketplaceLawyer>(`/marketplace/lawyers/${lawyerSlug}`, {
    auth: false,
  })
}

export interface PublicBookingPayload {
  lawyerId: string
  slot: string
  clientName: string
  clientEmail: string
  clientPhone?: string
  issueType: string
  countryCode: string
  jurisdiction?: string
  description?: string
}

export async function createPublicBooking(
  data: PublicBookingPayload,
): Promise<{ lead: LawyerLead; slot: string }> {
  return apiFetch<{ lead: LawyerLead; slot: string }>("/marketplace/booking", {
    method: "POST",
    body: data,
    auth: false,
  })
}

export interface CreateReviewRequestPayload {
  consumerCaseId: string
  countryCode: string
  issueType: string
  price: number
  currency: string
  summary?: string
  consumerReportId?: string
  jurisdiction?: string
}

export async function createReviewRequest(
  data: CreateReviewRequestPayload,
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    "/marketplace/review-requests",
    { method: "POST", body: data },
  )
}

export async function payForReviewRequest(
  reviewRequestId: string,
  phone?: string,
): Promise<{
  reviewRequestId: string
  checkoutUrl?: string
  clientSecret?: string
  provider?: string
  status: string
}> {
  return apiFetch(
    `/marketplace/review-requests/${reviewRequestId}/pay`,
    { method: "POST", body: phone ? { phone } : {} },
  )
}
