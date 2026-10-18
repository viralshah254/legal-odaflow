import { apiFetch } from "./client"
import type { TenantInfo, TenantMembership } from "./types"

const ACTIVE_TENANT_KEY = "legal_active_tenant_id"

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_TENANT_KEY)
}

export function setActiveTenant(tenantId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_TENANT_KEY, tenantId)
}

export function clearActiveTenant(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACTIVE_TENANT_KEY)
}

export async function listMyTenants(): Promise<TenantMembership[]> {
  return apiFetch<TenantMembership[]>("/tenants")
}

export async function getCurrentTenant(
  tenantId: string,
): Promise<TenantMembership> {
  return apiFetch<TenantMembership>("/tenants/current", { tenantId })
}

export async function getTenant(
  tenantId: string,
): Promise<TenantMembership> {
  return apiFetch<TenantMembership>(`/tenants/${tenantId}`)
}

export async function updateTenant(
  tenantId: string,
  data: { name?: string; billingPlan?: string; dataRegion?: string },
): Promise<TenantInfo> {
  return apiFetch(`/tenants/${tenantId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}
