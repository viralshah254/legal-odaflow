import { apiFetch } from "./client"

export interface ApiAssistanceRequest {
  id: string
  matterId: string
  matterTitle?: string
  requestedById: string
  requestedByName?: string
  assignedToId?: string | null
  status: string
  scope: string
  reason?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAssistanceRequest {
  matterId: string
  scope: string
  reason?: string
  assignedToId?: string
}

export async function listAssistanceRequests(
  tenantId: string,
  params?: { matterId?: string; status?: string },
): Promise<ApiAssistanceRequest[]> {
  const search = new URLSearchParams()
  if (params?.matterId) search.set("matterId", params.matterId)
  if (params?.status) search.set("status", params.status)
  const query = search.toString() ? `?${search.toString()}` : ""
  return apiFetch<ApiAssistanceRequest[]>(`/assistance${query}`, { tenantId })
}

export async function listPendingAssistance(
  tenantId: string,
): Promise<ApiAssistanceRequest[]> {
  return apiFetch<ApiAssistanceRequest[]>(`/assistance/pending`, { tenantId })
}

export async function createAssistanceRequest(
  tenantId: string,
  data: CreateAssistanceRequest,
): Promise<ApiAssistanceRequest> {
  return apiFetch<ApiAssistanceRequest>("/assistance", {
    method: "POST",
    tenantId,
    body: data,
  })
}
