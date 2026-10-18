import type { TenantRole } from "@/lib/api/types"
import type { UserRole } from "@/lib/types/roles"

const TENANT_TO_USER_ROLE: Record<TenantRole, UserRole> = {
  FIRM_ADMIN: "PARTNER_ADMIN",
  PARTNER: "JUNIOR_PARTNER",
  ASSOCIATE: "ASSOCIATE",
  FINANCE: "FINANCE",
  INTAKE: "INTAKE",
}

const USER_TO_TENANT_ROLE: Partial<Record<UserRole, TenantRole>> = {
  PARTNER_ADMIN: "FIRM_ADMIN",
  JUNIOR_PARTNER: "PARTNER",
  ASSOCIATE: "ASSOCIATE",
  FINANCE: "FINANCE",
  INTAKE: "INTAKE",
}

export function mapTenantRoleToUserRole(
  tenantRole: TenantRole | string | null | undefined,
): UserRole {
  if (!tenantRole) return "READ_ONLY"
  return TENANT_TO_USER_ROLE[tenantRole as TenantRole] ?? "READ_ONLY"
}

export function mapUserRoleToTenantRole(
  userRole: UserRole,
): TenantRole | null {
  return USER_TO_TENANT_ROLE[userRole] ?? null
}

/** Roles that can be assigned when creating or editing firm users. */
export const ASSIGNABLE_FIRM_USER_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "FINANCE",
  "INTAKE",
]
