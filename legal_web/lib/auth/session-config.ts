export const ACCESS_TOKEN_COOKIE = "legal_access_token"
export const REFRESH_TOKEN_COOKIE = "legal_refresh_token"
export const PORTAL_TOKEN_COOKIE = "odaflow_portal_token"
export const PORTAL_CLIENT_COOKIE = "odaflow_portal_client_id"

/** Legacy keys cleared on bootstrap so tokens are never left in localStorage. */
export const LEGACY_ACCESS_TOKEN_KEY = "legal_access_token"
export const LEGACY_REFRESH_TOKEN_KEY = "legal_refresh_token"
/** Legacy cached user JSON (email, tenantId, userType) — cleared on bootstrap. */
export const LEGACY_USER_KEY = "legal_user"
export const LEGACY_PORTAL_TOKEN_KEY = "odaflow_portal_token"
export const LEGACY_PORTAL_CLIENT_KEY = "odaflow_portal_client_id"

export const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 7 // 7d — match backend JWT_EXPIRES_IN
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30d — match backend REFRESH_TOKEN_EXPIRES_IN
export const PORTAL_TOKEN_MAX_AGE = 60 * 60 * 24 * 7 // 7d

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

function shouldUseCookieSession(_hostname: string): boolean {
  if (
    process.env.NEXT_PUBLIC_USE_DIRECT_API === "true" &&
    process.env.NEXT_PUBLIC_API_URL
  ) {
    return false
  }

  return true
}

/** Cookie sessions only work through the same-origin /api/v1 BFF proxy. */
export function usesCookieSession(): boolean {
  if (typeof window === "undefined") return true
  return shouldUseCookieSession(window.location.hostname)
}

/** Server/middleware mirror of usesCookieSession() for route protection. */
export function usesCookieSessionOnServer(hostname: string): boolean {
  return shouldUseCookieSession(hostname)
}
