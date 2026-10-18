import {
  apiFetch,
  ApiClientError,
  clearSession,
  clearTokens,
  setTokens,
} from "./client"
import { extractApiErrorMessage } from "@/lib/errors/user-facing-messages"
import { usesCookieSession } from "@/lib/auth/session-config"
import {
  getMemoryAccessToken,
  getMemoryRefreshToken,
} from "@/lib/auth/token-store"
import type {
  ApiUser,
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
} from "./types"

async function cookieAuthPost<T>(
  route: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string
  }
  if (!response.ok) {
    throw new Error(
      extractApiErrorMessage(data, "Authentication failed"),
    )
  }
  return data
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  if (usesCookieSession()) {
    const response = await cookieAuthPost<{ user: ApiUser; expiresIn: string; tokenType: string }>(
      "/api/auth/register/",
      data,
    )
    return {
      user: response.user,
      expiresIn: response.expiresIn,
      tokenType: response.tokenType,
      accessToken: "",
      refreshToken: "",
    }
  }

  const response = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: data,
    auth: false,
  })
  setTokens(response.accessToken, response.refreshToken)
  return response
}

export type EmailLookupResult = {
  exists: boolean
  hasPassword: boolean
  hasFirebaseAccount: boolean
  prospectPrefill?: ProspectPrefill
}

export type ProspectPrefill = {
  name: string
  firmName?: string
  practiceType: "SOLO" | "FIRM"
  phone?: string
  countryCode: string
  jurisdiction?: string
}

export async function lookupAuthEmail(email: string): Promise<EmailLookupResult> {
  if (usesCookieSession()) {
    const response = await fetch("/api/auth/email-lookup/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = (await response.json().catch(() => ({}))) as EmailLookupResult & {
      message?: string
    }
    if (!response.ok) {
      throw new Error(data.message ?? "Could not look up email")
    }
    return {
      exists: Boolean(data.exists),
      hasPassword: Boolean(data.hasPassword),
      hasFirebaseAccount: Boolean(data.hasFirebaseAccount),
      prospectPrefill: data.prospectPrefill,
    }
  }

  const data = await apiFetch<EmailLookupResult>("/auth/email-lookup", {
    method: "POST",
    body: { email: email.trim() },
    auth: false,
  })
  return {
    exists: Boolean(data.exists),
    hasPassword: Boolean(data.hasPassword),
    hasFirebaseAccount: Boolean(data.hasFirebaseAccount),
    prospectPrefill: data.prospectPrefill,
  }
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  if (usesCookieSession()) {
    const response = await cookieAuthPost<{ user: ApiUser; expiresIn: string; tokenType: string }>(
      "/api/auth/login/",
      data,
    )
    return {
      user: response.user,
      expiresIn: response.expiresIn,
      tokenType: response.tokenType,
      accessToken: "",
      refreshToken: "",
    }
  }

  const response = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: data,
    auth: false,
  })
  setTokens(response.accessToken, response.refreshToken)
  return response
}

export async function changePassword(
  data: ChangePasswordRequest,
): Promise<AuthResponse> {
  if (usesCookieSession()) {
    const response = await cookieAuthPost<{
      user: ApiUser
      expiresIn: string
      tokenType: string
    }>("/api/auth/change-password/", data)
    return {
      user: response.user,
      expiresIn: response.expiresIn,
      tokenType: response.tokenType,
      accessToken: "",
      refreshToken: "",
    }
  }

  const response = await apiFetch<AuthResponse>("/auth/change-password", {
    method: "POST",
    body: data,
  })
  setTokens(response.accessToken, response.refreshToken)
  return response
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  if (usesCookieSession()) {
    const response = await fetch("/api/auth/refresh/", {
      method: "POST",
      credentials: "include",
    })
    const data = (await response.json().catch(() => ({}))) as AuthResponse
    if (!response.ok) {
      throw new Error((data as { message?: string }).message ?? "Refresh failed")
    }
    return data
  }

  const payload: RefreshRequest = { refreshToken }
  const response = await apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: payload,
    auth: false,
  })
  setTokens(response.accessToken, response.refreshToken)
  return response
}

export async function logout(refreshToken?: string | null): Promise<void> {
  if (usesCookieSession()) {
    await clearSession()
    return
  }

  const token = refreshToken ?? null
  if (token) {
    try {
      await apiFetch<{ success: boolean }>("/auth/logout", {
        method: "POST",
        body: { refreshToken: token },
        auth: false,
      })
    } catch {
      // Ignore logout errors — clear local session regardless
    }
  }
  clearTokens()
}

export async function fetchSession(): Promise<ApiUser | null> {
  if (usesCookieSession()) {
    const response = await fetch("/api/auth/session/", { credentials: "include" })
    if (response.ok) {
      return (await response.json()) as ApiUser
    }
    if (response.status === 401 || response.status === 403) {
      await clearSession()
    }
    return null
  }

  if (!getMemoryAccessToken() && !getMemoryRefreshToken()) {
    return null
  }

  try {
    return await apiFetch<ApiUser>("/users/me")
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      (error.statusCode === 401 || error.statusCode === 403)
    ) {
      clearTokens()
    }
    return null
  }
}
