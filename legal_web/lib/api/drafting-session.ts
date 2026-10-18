import { apiFetch } from "./client"

export interface ClauseCatalogEntry {
  title: string
  mandatory: boolean
  description?: string
}

export interface DraftingQuestion {
  id: string
  text: string
  required: boolean
  type: "single" | "multi" | "text"
  options: string[]
  allowAllOfAbove?: boolean
}

export interface DraftingJurisdictionMetadata {
  countryCode: string
  jurisdiction: string
  advocateReviewStatus: "pending" | "reviewed"
  advocateReviewed: boolean
  reviewedBy?: string
  reviewedAt?: string
  authorityVerificationRequired: boolean
  filingRequirementsVerificationRequired: boolean
  requiredAuthorityFields: Array<{
    id: string
    label: string
    required: boolean
    description: string
  }>
}

export interface DraftingSession {
  id: string
  mode: "template" | "import" | "generate"
  status: string
  templateId: string | null
  forkedTemplateId: string | null
  templateName?: string
  documentKind: string | null
  countryCode: string | null
  sourceQuery: string | null
  fieldValues: Record<string, string>
  clauseAnswers: Record<string, string | boolean>
  workingHtml: string | null
  unresolvedQuestions: DraftingQuestion[]
  sourceDocumentId: string | null
  sourceFileName: string | null
  sourceFormat: string | null
  extractionStatus: string | null
  documentId: string | null
  clientId: string | null
  matterId: string | null
  completionScore: number
  clauseCatalog: ClauseCatalogEntry[]
  jurisdictionMetadata?: DraftingJurisdictionMetadata
  createdAt: string
  updatedAt: string
}

export async function createDraftingSession(
  tenantId: string,
  body: {
    templateId?: string
    systemTemplateId?: string
    documentKind?: string
    countryCode?: string
    sourceQuery?: string
  },
): Promise<DraftingSession> {
  return apiFetch<DraftingSession>("/drafting-sessions", {
    method: "POST",
    tenantId,
    body,
  })
}

export async function getDraftingSession(
  tenantId: string,
  sessionId: string,
): Promise<DraftingSession> {
  return apiFetch<DraftingSession>(`/drafting-sessions/${sessionId}`, { tenantId })
}

export async function updateDraftingSessionFields(
  tenantId: string,
  sessionId: string,
  fieldValues: Record<string, string | boolean>,
  clauseAnswers?: Record<string, string | boolean>,
): Promise<DraftingSession> {
  return apiFetch<DraftingSession>(`/drafting-sessions/${sessionId}/fields`, {
    method: "PATCH",
    tenantId,
    body: { fieldValues, clauseAnswers },
  })
}

export async function extractDraftingSessionFields(
  tenantId: string,
  sessionId: string,
  text?: string,
): Promise<DraftingSession & { extractedFields?: Record<string, string> }> {
  return apiFetch(`/drafting-sessions/${sessionId}/extract`, {
    method: "POST",
    tenantId,
    body: text ? { text } : {},
  })
}

export async function assembleDraftingSession(
  tenantId: string,
  sessionId: string,
): Promise<DraftingSession & { assembled?: { body: string } }> {
  return apiFetch(`/drafting-sessions/${sessionId}/assemble`, {
    method: "POST",
    tenantId,
  })
}

export async function generateDraftingSession(
  tenantId: string,
  sessionId: string,
  knowledgeSources?: string[],
): Promise<
  DraftingSession & {
    draftHtml?: string
    disclaimer?: string
    verification?: import("@/lib/api/draft-verification").DraftVerificationAudit
  }
> {
  return apiFetch(`/drafting-sessions/${sessionId}/generate`, {
    method: "POST",
    tenantId,
    body: knowledgeSources?.length ? { knowledgeSources } : {},
  })
}

export async function finalizeDraftingSession(
  tenantId: string,
  sessionId: string,
  body: {
    clientId?: string
    matterId?: string
    fileName?: string
    actions?: Array<"save" | "sign" | "review" | "export_docx" | "export_pdf">
    signers?: Array<{ name: string; email: string; routingOrder?: number }>
    reviewMessage?: string
  },
): Promise<{ documentId: string; fileUrl: string; fileName: string }> {
  return apiFetch(`/drafting-sessions/${sessionId}/finalize`, {
    method: "POST",
    tenantId,
    body,
  })
}

export async function importDraftingDocument(
  tenantId: string,
  file: File,
): Promise<DraftingSession> {
  const form = new FormData()
  form.append("file", file)
  return apiFetch<DraftingSession>("/drafting-sessions/import", {
    method: "POST",
    tenantId,
    body: form,
  })
}

export async function analyzeDraftingSession(
  tenantId: string,
  sessionId: string,
): Promise<DraftingSession> {
  return apiFetch(`/drafting-sessions/${sessionId}/analyze`, {
    method: "POST",
    tenantId,
  })
}

export async function editDraftingSession(
  tenantId: string,
  sessionId: string,
  body: { instruction: string; selectedText?: string; context?: string },
): Promise<DraftingSession & { revisedText?: string; explanation?: string; creditsUsed?: number }> {
  return apiFetch(`/drafting-sessions/${sessionId}/edit`, {
    method: "POST",
    tenantId,
    body,
  })
}

export async function exportDraftingSession(
  tenantId: string,
  sessionId: string,
  format: "docx" | "pdf",
): Promise<{ url: string; format: string; fileName: string }> {
  return apiFetch(`/drafting-sessions/${sessionId}/export`, {
    method: "POST",
    tenantId,
    body: { format },
  })
}
