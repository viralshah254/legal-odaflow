import type { UserRole } from "@/lib/types/roles"

export const DEV_ROLE_STORAGE_KEY = "dev-current-role"
export const DEV_USER_STORAGE_KEY = "dev-current-user"

const VALID_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "PARALEGAL",
  "FINANCE",
  "INTAKE",
  "OPS_HR",
  "RECEPTION",
  "READ_ONLY",
]

/** Dev-only role preview tooling; disabled in production builds. */
export function isDevRoleSwitcherEnabled(): boolean {
  return process.env.NODE_ENV !== "production"
}

export function isValidUserRole(value: string): value is UserRole {
  return (VALID_ROLES as string[]).includes(value)
}

export function clearDevRoleStorage(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(DEV_ROLE_STORAGE_KEY)
    localStorage.removeItem(DEV_USER_STORAGE_KEY)
  } catch {
    // ignore — storage unavailable
  }
}

export function loadDevRoleFromStorage(): UserRole | null {
  if (!isDevRoleSwitcherEnabled() || typeof window === "undefined") return null
  try {
    const savedRole = localStorage.getItem(DEV_ROLE_STORAGE_KEY)
    if (savedRole && isValidUserRole(savedRole)) return savedRole
  } catch {
    // ignore
  }
  return null
}

export function persistDevRole(role: UserRole): void {
  if (!isDevRoleSwitcherEnabled() || typeof window === "undefined") return
  try {
    localStorage.setItem(DEV_ROLE_STORAGE_KEY, role)
  } catch {
    // ignore
  }
}
