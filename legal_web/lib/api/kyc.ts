import { apiFetch } from "./client"
import type { KycChecklist, KycDocStatus, KycDocType } from "@/lib/types/kyc"

export interface ApiKycDocument {
  id: string
  clientId: string
  docType: string
  label: string
  fileName?: string | null
  status: "missing" | "pending" | "verified" | "expired"
  uploadedAt?: string | null
  expiresAt?: string | null
  fileUrl?: string | null
}

export interface ApiKycChecklist {
  clientId: string
  documents: ApiKycDocument[]
  overallStatus: string
}

export interface KycAlertItem {
  clientId: string
  clientName: string
  docs: ApiKycDocument[]
}

export interface UpdateKycDocumentRequest {
  status?: string
  fileUrl?: string
  fileName?: string
  expiresAt?: string
  expiryDate?: Date | string
}

export async function getKycChecklist(
  tenantId: string,
  clientId: string,
): Promise<ApiKycChecklist> {
  return apiFetch<ApiKycChecklist>(`/kyc/clients/${clientId}`, { tenantId })
}

export async function initializeKycForClient(
  tenantId: string,
  clientId: string,
  clientType: string,
  countryCode?: string,
): Promise<ApiKycChecklist> {
  return apiFetch<ApiKycChecklist>(`/kyc/clients/${clientId}/initialize`, {
    method: "POST",
    tenantId,
    body: { clientType, countryCode },
  })
}

export async function updateKycDocument(
  tenantId: string,
  clientId: string,
  docType: string,
  data: UpdateKycDocumentRequest,
): Promise<ApiKycDocument> {
  const normalizedStatus =
    data.status?.toUpperCase() === "RECEIVED"
      ? "pending"
      : data.status?.toLowerCase()
  const expiresAt =
    data.expiresAt ??
    (data.expiryDate instanceof Date
      ? data.expiryDate.toISOString()
      : data.expiryDate)

  return apiFetch<ApiKycDocument>(
    `/kyc/clients/${clientId}/documents/${encodeURIComponent(docType)}`,
    {
      method: "PATCH",
      tenantId,
      body: {
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
        ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      },
    },
  )
}

export async function getMissingKycDocs(
  tenantId: string,
): Promise<KycAlertItem[]> {
  return apiFetch<KycAlertItem[]>(`/kyc/alerts/missing`, { tenantId })
}

export async function getExpiredKycDocs(
  tenantId: string,
): Promise<KycAlertItem[]> {
  return apiFetch<KycAlertItem[]>(`/kyc/alerts/expired`, { tenantId })
}

function mapApiKycStatus(status: string): KycDocStatus {
  switch (status.toLowerCase()) {
    case "verified":
      return "VERIFIED"
    case "pending":
      return "RECEIVED"
    case "expired":
      return "EXPIRED"
    default:
      return "MISSING"
  }
}

export function apiKycChecklistToDisplay(checklist: ApiKycChecklist): KycChecklist {
  const documents = checklist.documents.map((doc) => ({
    id: doc.id,
    docType: doc.docType as KycDocType,
    fileName: doc.fileName ?? undefined,
    fileUrl: doc.fileUrl ?? undefined,
    uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : undefined,
    expiryDate: doc.expiresAt ? new Date(doc.expiresAt) : undefined,
    status: mapApiKycStatus(doc.status),
  }))
  const completed =
    documents.length > 0 &&
    (checklist.overallStatus === "complete" ||
      checklist.overallStatus === "verified" ||
      documents.every((d) => d.status === "VERIFIED" || d.status === "RECEIVED"))
  return {
    clientId: checklist.clientId,
    documents,
    completed,
    lastUpdated: new Date(),
  }
}
