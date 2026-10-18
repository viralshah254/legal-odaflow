import { apiFetch } from "./client"
import type { MatterAccessLevel } from "@/lib/types/matter-sharing"

export interface ApiMatterShare {
  id: string
  matterId: string
  userId: string
  userName?: string
  accessLevel: MatterAccessLevel
  sharedBy: string
  sharedByName?: string
  sharedAt: string
  createdAt: string
  updatedAt: string
}

export async function listMatterShares(
  tenantId: string,
  matterId: string,
): Promise<ApiMatterShare[]> {
  return apiFetch<ApiMatterShare[]>(`/matters/${matterId}/access`, { tenantId })
}

export async function shareMatter(
  tenantId: string,
  matterId: string,
  data: { userId: string; accessLevel: MatterAccessLevel },
): Promise<ApiMatterShare> {
  return apiFetch<ApiMatterShare>(`/matters/${matterId}/access`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateMatterShareAccess(
  tenantId: string,
  matterId: string,
  userId: string,
  accessLevel: MatterAccessLevel,
): Promise<ApiMatterShare> {
  return apiFetch<ApiMatterShare>(`/matters/${matterId}/access/${userId}`, {
    method: "PATCH",
    tenantId,
    body: { accessLevel },
  })
}

export async function removeMatterShare(
  tenantId: string,
  matterId: string,
  userId: string,
): Promise<void> {
  await apiFetch<void>(`/matters/${matterId}/access/${userId}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function getMatterAccessLevel(
  tenantId: string,
  matterId: string,
): Promise<{ accessLevel: MatterAccessLevel | null; isOwner: boolean }> {
  return apiFetch(`/matters/${matterId}/access/me`, { tenantId })
}
