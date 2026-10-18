import { sanitizeDocumentHtml } from "@/lib/security/sanitize-html"
import { apiFetch, authorizedFetch, getApiBaseUrl, resolveApiFetchPath } from "./client"

export interface AiDraftDocument {
  id: string
  fileName: string
  htmlContent: string | null
  aiDraftStatus: string | null
  generatedFromTemplateId: string | null
  docxUrl: string | null
  pdfUrl: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface AiDraftListItem {
  id: string
  fileName: string
  mimeType: string | null
  aiDraftStatus: string | null
  generatedFromTemplateId: string | null
  docxUrl: string | null
  pdfUrl: string | null
  version: number
  createdAt: string
}

export interface DraftWithAiResult {
  documentId: string
  draftHtml: string
  disclaimer: string
  provider: string
  modelName: string
  creditsCharged: number
  verification?: import("@/lib/api/draft-verification").DraftVerificationAudit
}

export interface ExportResult {
  url: string
  format: "docx" | "pdf"
  fileName: string
  downloadPath: string
}

export interface AssembleTemplateResult {
  body: string
  appliedClauses: string[]
  skippedClauses: string[]
}

export async function draftWithAi(
  tenantId: string,
  matterId: string,
  templateId: string,
  mergeFieldOverrides?: Record<string, string>,
): Promise<DraftWithAiResult> {
  return apiFetch<DraftWithAiResult>(
    `/document-automation/matters/${matterId}/templates/${templateId}/draft-with-ai`,
    { method: "POST", tenantId, body: mergeFieldOverrides ? { mergeFieldOverrides } : undefined },
  )
}

export async function listMatterDraftDocuments(
  tenantId: string,
  matterId: string,
): Promise<AiDraftListItem[]> {
  return apiFetch<AiDraftListItem[]>(
    `/document-automation/matters/${matterId}/documents`,
    { tenantId },
  )
}

export async function getDraftDocument(
  tenantId: string,
  documentId: string,
): Promise<AiDraftDocument> {
  return apiFetch<AiDraftDocument>(
    `/document-automation/documents/${documentId}`,
    { tenantId },
  )
}

export async function saveDraftDocument(
  tenantId: string,
  documentId: string,
  htmlContent: string,
): Promise<void> {
  await apiFetch(`/document-automation/documents/${documentId}`, {
    method: "PATCH",
    tenantId,
    body: { htmlContent: sanitizeDocumentHtml(htmlContent) },
  })
}

export async function exportDocx(
  tenantId: string,
  documentId: string,
): Promise<ExportResult> {
  return apiFetch<ExportResult>(
    `/document-automation/documents/${documentId}/export/docx`,
    { method: "POST", tenantId },
  )
}

export async function exportPdf(
  tenantId: string,
  documentId: string,
): Promise<ExportResult> {
  return apiFetch<ExportResult>(
    `/document-automation/documents/${documentId}/export/pdf`,
    { method: "POST", tenantId },
  )
}

/** Save HTML, export, and trigger a browser download with auth headers. */
export async function saveAndDownloadDraftExport(
  tenantId: string,
  documentId: string,
  htmlContent: string,
  format: "pdf" | "docx",
): Promise<ExportResult> {
  await saveDraftDocument(tenantId, documentId, htmlContent)
  const result =
    format === "pdf"
      ? await exportPdf(tenantId, documentId)
      : await exportDocx(tenantId, documentId)

  const downloadUrl = `${getApiBaseUrl()}${resolveApiFetchPath(result.downloadPath)}`
  const response = await authorizedFetch(result.downloadPath, {
    tenantId,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `Download failed (${response.status})`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = result.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)

  return result
}

export async function assembleTemplatePreview(
  tenantId: string,
  templateId: string,
  answers: Record<string, string | boolean>,
  context?: Record<string, string>,
): Promise<AssembleTemplateResult> {
  return apiFetch<AssembleTemplateResult>(
    `/document-automation/templates/${templateId}/assemble`,
    { method: "POST", tenantId, body: { answers, context } },
  )
}
