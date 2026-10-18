import { apiFetch } from "./client"

export interface MiMetadataAsset {
  id: string
  formName: string
  practiceArea: string
  countryCode: string
  jurisdiction: string | null
  metadata: Record<string, unknown> | null
  source: "jurisdiction_form" | "template_kind"
}

export interface MiMetadataListResponse {
  items: MiMetadataAsset[]
  total: number
  page: number
  pageSize: number
}

export interface MiTaxonomyCoverage {
  coverage: {
    total: number
    full: number
    partial: number
    missing: number
    pctFull: number
  }
  untaggedCount: number
  templateKindOverrides: number
  lowConfidenceCount: number
}

export async function listMiMetadataAssets(params: {
  page?: number
  pageSize?: number
  practiceArea?: string
  countryCode?: string
} = {}): Promise<MiMetadataListResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  if (params.practiceArea) qs.set("practiceArea", params.practiceArea)
  if (params.countryCode) qs.set("countryCode", params.countryCode)
  const query = qs.toString()
  return apiFetch<MiMetadataListResponse>(
    `/admin/mi-metadata/assets${query ? `?${query}` : ""}`,
  )
}

export async function updateMiMetadataAsset(
  assetId: string,
  metadata: Record<string, unknown>,
): Promise<{ updated: boolean; reEmbedded: boolean }> {
  return apiFetch(`/admin/mi-metadata/assets/${assetId}`, {
    method: "PATCH",
    body: metadata,
  })
}

export async function getMiTaxonomyCoverage(): Promise<MiTaxonomyCoverage> {
  return apiFetch("/admin/mi-metadata/taxonomy/coverage")
}

export interface MiAuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  metadata?: Record<string, unknown>
  user?: { email: string; name: string | null } | null
}

export async function listMiAuditLogs(params: {
  consumer?: string
  practiceArea?: string
  limit?: number
} = {}): Promise<{ items: MiAuditLogEntry[]; total: number }> {
  const qs = new URLSearchParams()
  if (params.consumer) qs.set("consumer", params.consumer)
  if (params.practiceArea) qs.set("practiceArea", params.practiceArea)
  if (params.limit) qs.set("limit", String(params.limit))
  const query = qs.toString()
  return apiFetch(`/admin/mi-metadata/audit${query ? `?${query}` : ""}`)
}

export async function listMiReviews(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch(`/admin/mi-metadata/reviews${qs}`)
}
