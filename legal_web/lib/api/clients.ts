import { apiFetch } from "./client"
import type {
  ApiClient,
  CreateClientRequest,
  UpdateClientRequest,
} from "./types"

export async function listClients(
  tenantId: string,
  search?: string,
): Promise<ApiClient[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : ""
  return apiFetch<ApiClient[]>(`/clients${query}`, { tenantId })
}

export async function getClient(
  tenantId: string,
  clientId: string,
): Promise<ApiClient> {
  return apiFetch<ApiClient>(`/clients/${clientId}`, { tenantId })
}

export async function createClient(
  tenantId: string,
  data: CreateClientRequest,
): Promise<ApiClient> {
  return apiFetch<ApiClient>("/clients", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateClient(
  tenantId: string,
  clientId: string,
  data: UpdateClientRequest,
): Promise<ApiClient> {
  return apiFetch<ApiClient>(`/clients/${clientId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export interface ApiClientActivitySummary {
  clientId: string
  items: Array<{
    id: string
    type:
      | "CLIENT_UPDATED"
      | "MATTER_UPDATED"
      | "DOCUMENT_ADDED"
      | "KYC_DOCUMENT_RECEIVED"
      | "MEETING_RECORDED"
    title: string
    description?: string
    occurredAt: string
  }>
}

export async function getClientActivitySummary(
  tenantId: string,
  clientId: string,
): Promise<ApiClientActivitySummary> {
  return apiFetch<ApiClientActivitySummary>(
    `/clients/${clientId}/activity-summary`,
    { tenantId },
  )
}
