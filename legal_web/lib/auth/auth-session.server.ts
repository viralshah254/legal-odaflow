import { NextRequest, NextResponse } from "next/server"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"
import {
  clearAuthSessionCookies,
  clearPortalSessionCookies,
  readRefreshTokenFromCookies,
  setAuthSessionCookies,
} from "@/lib/auth/session-cookies.server"
import type { ApiUser, AuthResponse } from "@/lib/api/types"

export type ResolvedServerSession = {
  user: ApiUser
  accessToken: string
}

const AUTH_UPSTREAM_TIMEOUT_MS = 15_000

async function fetchMe(token: string): Promise<Response> {
  return fetch(backendApiUrl("/users/me"), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(AUTH_UPSTREAM_TIMEOUT_MS),
  })
}

function connectionErrorResponse(): NextResponse {
  return NextResponse.json({ message: USER_CONNECTION_ERROR }, { status: 502 })
}

async function fetchJsonResponse(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(backendApiUrl(path), {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(AUTH_UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return null
  }
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<string | null> {
  const refreshed = await fetchJsonResponse("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
  if (!refreshed) return null
  const auth = (await refreshed.json().catch(() => ({}))) as AuthResponse
  if (!refreshed.ok || !auth.accessToken) return null
  return auth.accessToken
}

/** Resolve a bearer token + user for server actions/pages (no cookie writes). */
export async function resolveAuthenticatedSession(): Promise<ResolvedServerSession | null> {
  const { readAccessTokenFromCookies } = await import(
    "@/lib/auth/session-cookies.server"
  )

  let accessToken = await readAccessTokenFromCookies()
  if (!accessToken) {
    const refreshToken = await readRefreshTokenFromCookies()
    if (!refreshToken) return null
    accessToken = await refreshAccessToken(refreshToken)
    if (!accessToken) return null
  }

  let upstream = await fetchMe(accessToken).catch(() => null)
  if (!upstream) return null
  if (upstream.status === 401) {
    const refreshToken = await readRefreshTokenFromCookies()
    if (!refreshToken) return null
    accessToken = await refreshAccessToken(refreshToken)
    if (!accessToken) return null
    upstream = await fetchMe(accessToken).catch(() => null)
    if (!upstream) return null
  }

  if (!upstream.ok) return null
  const user = (await upstream.json().catch(() => null)) as ApiUser | null
  if (!user?.id) return null
  return { user, accessToken }
}

async function parseAuthResponse(response: Response): Promise<{
  ok: boolean
  status: number
  data: AuthResponse | { message?: string }
}> {
  const data = (await response.json().catch(() => ({}))) as
    | AuthResponse
    | { message?: string }
  return { ok: response.ok, status: response.status, data }
}

function stripTokens(auth: AuthResponse) {
  return {
    user: auth.user,
    tokenType: auth.tokenType,
    expiresIn: auth.expiresIn,
  }
}

export async function establishAuthSession(
  auth: AuthResponse,
  status = 200,
): Promise<NextResponse> {
  const response = NextResponse.json(stripTokens(auth), { status })
  setAuthSessionCookies(response, auth.accessToken, auth.refreshToken)
  return response
}

export async function proxyAuthPost(
  req: NextRequest,
  backendPath: string,
): Promise<NextResponse> {
  const body = await req.text()
  let upstream: Response
  try {
    upstream = await fetch(backendApiUrl(backendPath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(AUTH_UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return connectionErrorResponse()
  }
  const parsed = await parseAuthResponse(upstream)
  if (!parsed.ok || !("accessToken" in parsed.data)) {
    return NextResponse.json(parsed.data, { status: parsed.status })
  }
  return establishAuthSession(parsed.data as AuthResponse, parsed.status)
}

export async function proxyAuthenticatedAuthPost(
  req: NextRequest,
  backendPath: string,
): Promise<NextResponse> {
  const { readAccessTokenFromCookies } = await import(
    "@/lib/auth/session-cookies.server"
  )
  const accessToken = await readAccessTokenFromCookies()
  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
  }

  const body = await req.text()
  const upstream = await fetch(backendApiUrl(backendPath), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body,
    signal: AbortSignal.timeout(AUTH_UPSTREAM_TIMEOUT_MS),
  }).catch((error) => {
    console.error("[auth proxy] fetch error:", error)
    return null
  })

  if (!upstream) {
    return connectionErrorResponse()
  }

  const parsed = await parseAuthResponse(upstream)
  if (!parsed.ok || !("accessToken" in parsed.data)) {
    return NextResponse.json(parsed.data, { status: parsed.status })
  }
  return establishAuthSession(parsed.data as AuthResponse, parsed.status)
}

export async function refreshAuthSession(): Promise<NextResponse> {
  const refreshToken = await readRefreshTokenFromCookies()
  if (!refreshToken) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
  }

  const upstream = await fetchJsonResponse("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
  if (!upstream) return connectionErrorResponse()
  const parsed = await parseAuthResponse(upstream)
  if (!parsed.ok || !("accessToken" in parsed.data)) {
    const response = NextResponse.json(parsed.data, { status: parsed.status })
    clearAuthSessionCookies(response)
    return response
  }
  return establishAuthSession(parsed.data as AuthResponse, parsed.status)
}

export async function logoutAuthSession(): Promise<NextResponse> {
  const refreshToken = await readRefreshTokenFromCookies()
  if (refreshToken) {
    await fetch(backendApiUrl("/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined)
  }

  const response = NextResponse.json({ success: true })
  clearAuthSessionCookies(response)
  clearPortalSessionCookies(response)
  return response
}

export async function getAuthSession(): Promise<NextResponse> {
  const { readAccessTokenFromCookies } = await import(
    "@/lib/auth/session-cookies.server"
  )

  let accessToken = await readAccessTokenFromCookies()
  if (!accessToken) {
    // Access cookie missing but refresh cookie may exist — attempt a silent
    // refresh before giving up (handles the edge case where the access token
    // cookie expired/was cleared independently of the refresh token).
    const refreshToken = await readRefreshTokenFromCookies()
    if (!refreshToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
    }
    const refreshed = await fetchJsonResponse("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!refreshed) return connectionErrorResponse()
    const auth = (await refreshed.json().catch(() => ({}))) as AuthResponse
    if (!refreshed.ok || !auth.accessToken) {
      const response = NextResponse.json(auth, { status: refreshed.status })
      clearAuthSessionCookies(response)
      return response
    }
    accessToken = auth.accessToken
    // Fall through — fetchMe below will use the refreshed access token,
    // and we return the new cookies alongside the user data at the end.
    const meRes = await fetchJsonResponse("/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!meRes) return connectionErrorResponse()
    if (meRes.status >= 500) return connectionErrorResponse()
    const cookieResponse = NextResponse.json({})
    setAuthSessionCookies(cookieResponse, auth.accessToken, auth.refreshToken)
    const data = await meRes.json().catch(() => ({}))
    return NextResponse.json(data, { status: meRes.status, headers: cookieResponse.headers })
  }

  let upstream = await fetchMe(accessToken).catch(() => null)
  if (!upstream) return connectionErrorResponse()
  if (upstream.status === 401) {
    const refreshToken = await readRefreshTokenFromCookies()
    if (!refreshToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
    }

    const refreshed = await fetchJsonResponse("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!refreshed) return connectionErrorResponse()
    const auth = (await refreshed.json().catch(() => ({}))) as AuthResponse
    if (!refreshed.ok || !auth.accessToken) {
      const response = NextResponse.json(auth, { status: refreshed.status })
      clearAuthSessionCookies(response)
      return response
    }

    accessToken = auth.accessToken
    const response = NextResponse.json({})
    setAuthSessionCookies(response, auth.accessToken, auth.refreshToken)
    upstream = await fetchMe(accessToken).catch(() => null)
    if (!upstream) return connectionErrorResponse()
    if (upstream.status >= 500) return connectionErrorResponse()

    const data = await upstream.json().catch(() => ({}))
    return NextResponse.json(data, { status: upstream.status, headers: response.headers })
  }

  if (upstream.status >= 500) return connectionErrorResponse()
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
