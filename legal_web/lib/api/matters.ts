import { apiFetch } from "./client"
import type { ApiMatter, CreateMatterRequest, UpdateMatterRequest } from "./types"

export type { ApiMatter }

export interface ListMattersFilters {
  search?: string
  status?: string
  stage?: string
  assignee?: string
  dateFrom?: string
  dateTo?: string
  clientId?: string
  page?: number
  limit?: number
}

export async function listMatters(
  tenantId: string,
  filters: ListMattersFilters = {},
): Promise<ApiMatter[]> {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set("q", filters.search.trim())
  if (filters.status) params.set("status", filters.status)
  if (filters.stage) params.set("stage", filters.stage)
  if (filters.assignee) params.set("assignee", filters.assignee)
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.clientId) params.set("clientId", filters.clientId)
  if (filters.page != null) params.set("page", String(filters.page))
  if (filters.limit != null) params.set("limit", String(filters.limit))
  const query = params.toString()
  const result = await apiFetch<ApiMatter[] | { items: ApiMatter[] }>(
    `/matters${query ? `?${query}` : ""}`,
    {
    tenantId,
    },
  )
  return Array.isArray(result) ? result : result.items
}

export async function getMatter(
  tenantId: string,
  matterId: string,
): Promise<ApiMatter> {
  return apiFetch<ApiMatter>(`/matters/${matterId}`, { tenantId })
}

export async function createMatter(
  tenantId: string,
  body: CreateMatterRequest,
): Promise<ApiMatter> {
  return apiFetch<ApiMatter>(`/matters`, {
    method: "POST",
    tenantId,
    body,
  })
}

export async function updateMatter(
  tenantId: string,
  matterId: string,
  body: UpdateMatterRequest,
): Promise<ApiMatter> {
  return apiFetch<ApiMatter>(`/matters/${matterId}`, {
    method: "PATCH",
    tenantId,
    body,
  })
}

export async function deleteMatter(
  tenantId: string,
  matterId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/matters/${matterId}`, {
    method: "DELETE",
    tenantId,
  })
}

/** Returns matterIds that have at least one completed auto-triggered analysis run. */
export async function getAutoAnalyzedIds(tenantId: string): Promise<string[]> {
  return apiFetch<string[]>(`/matters/auto-analyzed-ids`, { tenantId })
}
