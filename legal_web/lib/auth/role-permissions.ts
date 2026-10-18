import {
  ROLE_PERMISSIONS,
  type RolePermissions,
  type UserRole,
} from "@/lib/types/roles"
import type { TenantRolePermissionsMap } from "@/lib/api/governance"

/** Merge tenant governance overrides onto static role defaults. */
export function mergeTenantRolePermissions(
  remote?: TenantRolePermissionsMap | null,
): Record<UserRole, RolePermissions> {
  if (!remote) return ROLE_PERMISSIONS

  const merged = { ...ROLE_PERMISSIONS }
  for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
    const flat = remote[role]
    if (flat) {
      merged[role] = { ...merged[role], ...flat }
    }
  }
  return merged
}

export function permissionsForRole(
  role: UserRole,
  remote?: TenantRolePermissionsMap | null,
): RolePermissions {
  return mergeTenantRolePermissions(remote)[role]
}
