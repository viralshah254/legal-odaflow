import { NextRequest, NextResponse } from "next/server"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/session-config"
import {
  clearAuthSessionCookies,
  setAuthSessionCookies,
} from "@/lib/auth/session-cookies.server"

const PROTECTED_PREFIXES = ["/app", "/admin", "/consumer"] as const

/** Routes that should silently refresh auth cookies after external redirects (e.g. Stripe). */
const SESSION_REFRESH_PREFIXES = ["/subscription/success"] as const

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isSessionRefreshRoute(pathname: string): boolean {
  return SESSION_REFRESH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

async function fetchMe(accessToken: string): Promise<Response> {
  return fetch(backendApiUrl("/users/me"), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

interface RefreshedTokens {
  accessToken: string
  refreshToken: string
}

// Returns new tokens on success, or null if the refresh failed.
// The caller MUST write these tokens to response cookies — the backend has
// already rotated (consumed) the old refresh token at this point.
async function tryRefresh(refreshToken: string): Promise<RefreshedTokens | null> {
  const response = await fetch(backendApiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) return null

  const data = (await response.json().catch(() => ({}))) as {
    accessToken?: string
    refreshToken?: string
  }
  if (!data.accessToken || !data.refreshToken) return null
  return { accessToken: data.accessToken, refreshToken: data.refreshToken }
}

export interface MiddlewareSessionResult {
  ok: boolean
  /** New tokens to write to cookies when the session was silently refreshed. */
  newTokens?: RefreshedTokens
}

export async function validateMiddlewareSession(
  request: NextRequest,
): Promise<MiddlewareSessionResult> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value

  if (!accessToken && !refreshToken) {
    return { ok: false }
  }

  if (accessToken) {
    let upstream: Response
    try {
      upstream = await fetchMe(accessToken)
    } catch {
      // Network-level failure (ECONNREFUSED, DNS, timeout).
      // Allow through — client-side API calls will surface the real error.
      return { ok: true }
    }

    if (upstream.ok) {
      return { ok: true }
    }
    if (upstream.status === 401 && refreshToken) {
      try {
        const newTokens = await tryRefresh(refreshToken)
        return newTokens ? { ok: true, newTokens } : { ok: false }
      } catch {
        return { ok: false }
      }
    }
    if (upstream.status === 401) {
      return { ok: false }
    }
    // Non-401, non-2xx (e.g. 503) — backend up but degraded, allow through.
    return { ok: true }
  }

  if (refreshToken) {
    try {
      const newTokens = await tryRefresh(refreshToken)
      return newTokens ? { ok: true, newTokens } : { ok: false }
    } catch {
      // Network failure during refresh — allow through rather than log out.
      return { ok: true }
    }
  }

  return { ok: false }
}

export function buildSignInRedirect(request: NextRequest): NextResponse {
  const signInUrl = new URL("/auth", request.url)
  signInUrl.searchParams.set("redirect", request.nextUrl.pathname)
  const response = NextResponse.redirect(signInUrl)
  clearAuthSessionCookies(response)
  return response
}
