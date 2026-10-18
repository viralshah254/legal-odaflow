import type { ApiTenantDocument } from "@/lib/api/documents"

export type ReviewDocument = ApiTenantDocument & {
  ocrStatus?: string | null
  extractionStatus?: string | null
}

export const FILE_CENTER_VIEWS = ["files", "ai-review", "generate", "esign"] as const
export type FileCenterView = (typeof FILE_CENTER_VIEWS)[number]

export function resolveFileCenterView(value: string | null | undefined): FileCenterView {
  return FILE_CENTER_VIEWS.includes(value as FileCenterView)
    ? (value as FileCenterView)
    : "files"
}

export function buildFileCenterHref(
  matterId: string,
  view: FileCenterView,
  currentQuery = "",
): string {
  const query = new URLSearchParams(currentQuery)
  if (view === "files") query.delete("view")
  else query.set("view", view)
  const suffix = query.toString()
  return `/app/matters/${matterId}/documents${suffix ? `?${suffix}` : ""}`
}

export function isDocumentReviewReady(document: ReviewDocument): boolean {
  const status = (document.ocrStatus ?? document.extractionStatus ?? "").toUpperCase()
  return Boolean(
    document.extractedText ||
      document.mimeType?.startsWith("text/") ||
      ["COMPLETE", "COMPLETED", "SKIPPED"].includes(status),
  )
}

export function selectAllFiltered(current: string[], filtered: string[]): string[] {
  return Array.from(new Set([...current, ...filtered]))
}

export function toggleDocumentSelection(current: string[], documentId: string): string[] {
  return current.includes(documentId)
    ? current.filter((id) => id !== documentId)
    : [...current, documentId]
}
