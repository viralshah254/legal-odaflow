import { apiFetch } from "./client"
import { validateUploadFile } from "@/lib/security/validate-upload-file"
import type {
  ConsumerDocument,
  DocumentJobStatus,
  UploadConsumerDocumentRequest,
  UploadConsumerDocumentResponse,
} from "./types"

export interface ApiTenantDocument {
  id: string
  tenantId: string
  matterId?: string | null
  clientId?: string | null
  documentCode?: string
  fileName: string
  fileUrl?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  documentType?: string | null
  version?: number
  extractedText?: string | null
  visibility?: string | null
  status: "ACTIVE" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  client?: { id: string; name: string; clientCode: string } | null
  matter?: { id: string; title: string } | null
}

export type DocumentListScope = "all" | "general" | "client"

export interface ListTenantDocumentsParams {
  matterId?: string
  folderId?: string
  search?: string
  clientId?: string
  scope?: DocumentListScope
  status?: "ACTIVE" | "ARCHIVED" | "all"
}

export interface UpdateTenantDocumentRequest {
  clientId?: string | null
  matterId?: string | null
  folderId?: string | null
  status?: "ACTIVE" | "ARCHIVED"
}

export interface ApiDocumentFolder {
  id: string
  tenantId: string
  name: string
  parentId?: string | null
  clientId?: string | null
  matterId?: string | null
  createdAt: string
}

export interface ApiDocumentVersion {
  id: string
  tenantId: string
  documentId: string
  version: number
  fileName: string
  fileUrl: string
  uploadedById?: string | null
  createdAt: string
}

export interface UploadTenantDocumentRequest {
  fileName: string
  fileUrl: string
  mimeType?: string
  matterId?: string
  clientId?: string
  documentType?: string
  fileSizeBytes?: number
  folderId?: string
}

export interface CreateFolderRequest {
  name: string
  parentId?: string
  clientId?: string
  matterId?: string
}

export async function createConsumerUploadUrl(
  consumerCaseId: string,
  fileName: string,
): Promise<{ uploadUrl: string; fileUrl: string; key: string; uploadHeaders?: Record<string, string> }> {
  return apiFetch<{ uploadUrl: string; fileUrl: string; key: string; uploadHeaders?: Record<string, string> }>(
    "/documents/consumer/upload-url",
    {
      method: "POST",
      body: { consumerCaseId, fileName },
    },
  )
}

export async function uploadConsumerFile(
  consumerCaseId: string,
  file: File,
  documentType = "FIRM_INTAKE",
): Promise<UploadConsumerDocumentResponse> {
  await validateUploadFile(file, "document")
  const form = new FormData()
  form.append("file", file)
  form.append("consumerCaseId", consumerCaseId)
  form.append("documentType", documentType)

  return apiFetch<UploadConsumerDocumentResponse>("/documents/consumer/upload-file", {
    method: "POST",
    body: form,
  })
}

export async function uploadConsumerDocument(
  data: UploadConsumerDocumentRequest,
): Promise<UploadConsumerDocumentResponse> {
  return apiFetch<UploadConsumerDocumentResponse>("/documents/consumer/upload", {
    method: "POST",
    body: data,
  })
}

export async function getConsumerDocuments(
  caseId: string,
): Promise<ConsumerDocument[]> {
  return apiFetch<ConsumerDocument[]>(`/documents/consumer/${caseId}`)
}

export async function getDocumentJobStatus(
  jobId: string,
): Promise<DocumentJobStatus> {
  return apiFetch<DocumentJobStatus>(`/documents/jobs/${jobId}`)
}

export async function listTenantDocuments(
  tenantId: string,
  params?: ListTenantDocumentsParams,
): Promise<ApiTenantDocument[]> {
  const query = new URLSearchParams()
  if (params?.matterId) query.set("matterId", params.matterId)
  if (params?.folderId) query.set("folderId", params.folderId)
  if (params?.search) query.set("search", params.search)
  if (params?.clientId) query.set("clientId", params.clientId)
  if (params?.scope) query.set("scope", params.scope)
  if (params?.status) query.set("status", params.status)
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return apiFetch<ApiTenantDocument[]>(`/documents${suffix}`, { tenantId })
}

export async function getTenantDocument(
  tenantId: string,
  documentId: string,
): Promise<ApiTenantDocument> {
  return apiFetch<ApiTenantDocument>(`/documents/${documentId}`, { tenantId })
}

export async function uploadTenantDocument(
  tenantId: string,
  data: UploadTenantDocumentRequest,
): Promise<ApiTenantDocument> {
  const result = await apiFetch<{ document: ApiTenantDocument }>("/documents/upload", {
    method: "POST",
    tenantId,
    body: data,
  })
  return result.document
}

export async function updateTenantDocument(
  tenantId: string,
  documentId: string,
  data: UpdateTenantDocumentRequest,
): Promise<ApiTenantDocument> {
  return apiFetch<ApiTenantDocument>(`/documents/${documentId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function archiveTenantDocument(
  tenantId: string,
  documentId: string,
): Promise<ApiTenantDocument> {
  return updateTenantDocument(tenantId, documentId, { status: "ARCHIVED" })
}

export async function listDocumentFolders(
  tenantId: string,
  params?: { matterId?: string; clientId?: string },
): Promise<ApiDocumentFolder[]> {
  const query = new URLSearchParams()
  if (params?.matterId) query.set("matterId", params.matterId)
  if (params?.clientId) query.set("clientId", params.clientId)
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return apiFetch<ApiDocumentFolder[]>(`/documents/folders${suffix}`, { tenantId })
}

export async function createDocumentFolder(
  tenantId: string,
  data: CreateFolderRequest,
): Promise<ApiDocumentFolder> {
  return apiFetch<ApiDocumentFolder>("/documents/folders", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listDocumentVersions(
  tenantId: string,
  documentId: string,
): Promise<ApiDocumentVersion[]> {
  return apiFetch<ApiDocumentVersion[]>(`/documents/${documentId}/versions`, { tenantId })
}

export async function createDocumentVersion(
  tenantId: string,
  documentId: string,
  data: { fileName: string; fileUrl: string },
): Promise<ApiDocumentVersion> {
  return apiFetch<ApiDocumentVersion>(`/documents/${documentId}/versions`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function getDocumentDownloadUrl(
  tenantId: string,
  documentId: string,
): Promise<{ documentId: string; fileName: string; fileUrl: string; mimeType?: string | null; version: number }> {
  return apiFetch(`/documents/${documentId}/download`, { tenantId })
}

export async function createUploadUrl(
  tenantId: string,
  data: { fileName: string; mimeType?: string; scope?: string },
): Promise<{ uploadUrl: string; fileUrl: string; key: string; uploadHeaders?: Record<string, string> }> {
  return apiFetch<{ uploadUrl: string; fileUrl: string; key: string; uploadHeaders?: Record<string, string> }>(
    "/documents/upload-url",
    { method: "POST", tenantId, body: data },
  )
}

export async function uploadFileViaPresignedUrl(
  tenantId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ fileUrl: string; fileName: string }> {
  await validateUploadFile(file, "document")
  const { uploadUrl, fileUrl, uploadHeaders } = await createUploadUrl(tenantId, {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    scope: "tenant",
  })

  if (uploadUrl.startsWith("local://")) {
    onProgress?.(100)
    return { fileUrl, fileName: file.name }
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", uploadUrl)
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    Object.entries(uploadHeaders ?? {}).forEach(([name, value]) =>
      request.setRequestHeader(name, value),
    )
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error(`Upload failed with status ${request.status}`))
      }
    })
    request.addEventListener("error", () => reject(new Error("Upload failed")))
    request.addEventListener("abort", () => reject(new Error("Upload cancelled")))
    request.send(file)
  })

  return { fileUrl, fileName: file.name }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
