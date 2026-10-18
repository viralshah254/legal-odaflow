import type { ApiError, AuthResponse } from "./types"
import { getApiBaseUrl, wrapFetchError } from "./api-base"
import { localeHeaders } from "@/lib/i18n/api-locale"
import {
  LEGACY_ACCESS_TOKEN_KEY,
  LEGACY_REFRESH_TOKEN_KEY,
  LEGACY_USER_KEY,
  usesCookieSession,
} from "@/lib/auth/session-config"
import {
  clearMemoryTokens,
  getMemoryAccessToken,
  getMemoryRefreshToken,
  setMemoryTokens,
} from "@/lib/auth/token-store"
import { clearPortalSession } from "@/lib/portal/portal-session"
import {
  extractApiErrorMessage,
  USER_CONNECTION_ERROR,
} from "@/lib/errors/user-facing-messages"

export { getApiBaseUrl } from "./api-base"

/** Dispatched when refresh fails after a 401 — AuthProvider clears session and redirects. */
export const AUTH_EXPIRED_EVENT = "legal:auth-expired"

/** Short-lived in-memory cache after /api/auth/access-token (cookie mode only). */
let cachedAccessToken: string | null = null

export function clearLegacyStoredTokens(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY)
    localStorage.removeItem(LEGACY_USER_KEY)
    localStorage.removeItem("accessToken")
  } catch {
    // ignore — storage unavailable (e.g. iOS Safari private mode)
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  if (usesCookieSession()) return cachedAccessToken
  return getMemoryAccessToken()
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  if (usesCookieSession()) return null
  return getMemoryRefreshToken()
}

export async function resolveAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null
  if (!usesCookieSession()) return getMemoryAccessToken()

  if (cachedAccessToken) return cachedAccessToken

  const response = await fetch("/api/auth/access-token/", {
    credentials: "include",
  }).catch(() => null)

  if (!response?.ok) return null

  const data = (await response.json().catch(() => null)) as { token?: string } | null
  cachedAccessToken = data?.token ?? null
  return cachedAccessToken
}

/** Clear cached bearer and re-read from cookies (call after login/logout). */
export async function primeAuthSession(): Promise<void> {
  cachedAccessToken = null
  if (usesCookieSession()) {
    await resolveAccessToken()
  }
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return
  if (usesCookieSession()) return
  setMemoryTokens(accessToken, refreshToken)
}

export function clearTokens(): void {
  if (typeof window === "undefined") return
  cachedAccessToken = null
  if (usesCookieSession()) return
  clearMemoryTokens()
}

export async function clearSession(): Promise<void> {
  if (typeof window === "undefined") return
  cachedAccessToken = null
  clearLegacyStoredTokens()

  if (usesCookieSession()) {
    await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined)
  } else {
    clearMemoryTokens()
  }

  await clearPortalSession()
}

async function refreshCookieSession(): Promise<boolean> {
  const response = await fetch("/api/auth/refresh/", {
    method: "POST",
    credentials: "include",
  }).catch(() => null)

  if (!response?.ok) {
    cachedAccessToken = null
    return false
  }

  cachedAccessToken = null
  return true
}

async function refreshDirectApiSession(): Promise<boolean> {
  const refreshToken = getMemoryRefreshToken()
  if (!refreshToken) return false

  const headers = new Headers({ "Content-Type": "application/json" })
  for (const [key, value] of Object.entries(localeHeaders())) {
    headers.set(key, value)
  }

  const response = await fetch(
    `${getApiBaseUrl()}${resolveApiPath("/auth/refresh")}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken }),
    },
  ).catch(() => null)

  if (!response?.ok) return false

  const data = (await response.json().catch(() => null)) as AuthResponse | null
  if (!data?.accessToken || !data.refreshToken) return false

  setMemoryTokens(data.accessToken, data.refreshToken)
  return true
}

async function attemptSessionRefresh(): Promise<boolean> {
  if (usesCookieSession()) return refreshCookieSession()
  return refreshDirectApiSession()
}

function shouldAttemptSessionRefresh(): boolean {
  if (usesCookieSession()) return true
  return Boolean(getMemoryRefreshToken())
}

function shouldForceLogoutAfterRefreshFailure(): boolean {
  if (usesCookieSession()) return cachedAccessToken !== null
  return Boolean(getMemoryAccessToken() || getMemoryRefreshToken())
}

async function handleUnauthorizedResponse(): Promise<boolean> {
  if (!shouldAttemptSessionRefresh()) return false

  const refreshed = await attemptSessionRefresh()
  if (refreshed) return true

  if (shouldForceLogoutAfterRefreshFailure()) {
    await handleAuthRefreshFailure()
  }

  return false
}

async function handleAuthRefreshFailure(): Promise<void> {
  await clearSession()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
  }
}

export class ApiClientError extends Error {
  statusCode: number
  body: ApiError | unknown

  constructor(message: string, statusCode: number, body?: unknown) {
    super(message)
    this.name = "ApiClientError"
    this.statusCode = statusCode
    this.body = body
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  auth?: boolean
  tenantId?: string
  /** Internal: skip one 401 refresh retry. */
  _retried?: boolean
}

/** Next.js `trailingSlash: true` redirects bare paths with 308; POST must include trailing slash. */
function withTrailingSlash(path: string): string {
  const queryIndex = path.indexOf("?")
  const base = queryIndex >= 0 ? path.slice(0, queryIndex) : path
  const query = queryIndex >= 0 ? path.slice(queryIndex) : ""
  if (!base.endsWith("/")) {
    return `${base}/${query}`
  }
  return path
}

function resolveApiPath(path: string): string {
  if (typeof window === "undefined") return path
  const base = getApiBaseUrl()
  if (!base.startsWith("/")) return path
  return withTrailingSlash(path)
}

/** Same path normalization as apiFetch (trailing slash for same-origin /api/v1 proxy). */
export function resolveApiFetchPath(path: string): string {
  return resolveApiPath(path)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

/** Build fetch headers; inject Bearer only in direct-API mode. */
export async function buildAuthHeaders(
  auth: boolean,
  tenantId?: string,
  customHeaders?: HeadersInit,
): Promise<Headers> {
  const headers = new Headers(customHeaders)

  for (const [key, value] of Object.entries(localeHeaders())) {
    if (!headers.has(key)) headers.set(key, value)
  }

  if (auth) {
    const token = usesCookieSession()
      ? await resolveAccessToken()
      : getMemoryAccessToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
  }

  if (tenantId) {
    headers.set("X-Tenant-Id", tenantId)
  }

  return headers
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    body,
    auth = true,
    tenantId,
    headers: customHeaders,
    _retried = false,
    ...rest
  } = options

  const headers = await buildAuthHeaders(auth, tenantId, customHeaders)

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${getApiBaseUrl()}${resolveApiPath(path)}`, {
    ...rest,
    headers,
    credentials: usesCookieSession() ? "include" : rest.credentials,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  }).catch((error) => {
    throw wrapFetchError(error)
  })

  if (response.status === 401 && auth && !_retried) {
    const refreshed = await handleUnauthorizedResponse()
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true })
    }
  }

  if (!response.ok) {
    const errorBody = await parseResponse<ApiError>(response)
    const fallback =
      response.status === 502 ? USER_CONNECTION_ERROR : response.statusText || "Request failed"
    const message = extractApiErrorMessage(errorBody, fallback)
    throw new ApiClientError(message, response.status, errorBody)
  }

  return parseResponse<T>(response)
}

/** Authenticated fetch for blob/binary downloads. */
export async function authorizedFetch(
  path: string,
  init: RequestInit & { tenantId?: string; _retried?: boolean } = {},
): Promise<Response> {
  const { tenantId, headers: customHeaders, _retried = false, ...rest } = init
  const headers = await buildAuthHeaders(true, tenantId, customHeaders)

  const response = await fetch(`${getApiBaseUrl()}${resolveApiFetchPath(path)}`, {
    ...rest,
    headers,
    credentials: usesCookieSession() ? "include" : rest.credentials,
  })

  if (response.status === 401 && !_retried) {
    const refreshed = await handleUnauthorizedResponse()
    if (refreshed) {
      return authorizedFetch(path, { ...init, _retried: true })
    }
  }

  return response
}

// ─── Minimal base apiClient for Phase 6 features ─────────────────────────────

async function baseRequest<T>(
  path: string,
  options: RequestInit & { token?: string },
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string> ?? {}),
  }
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...rest, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const fallback =
      res.status === 502 ? USER_CONNECTION_ERROR : res.statusText || "Request failed"
    throw new ApiClientError(extractApiErrorMessage(body, fallback), res.status, body)
  }
  return res.json() as Promise<T>
}

export const apiClient = { request: baseRequest }
