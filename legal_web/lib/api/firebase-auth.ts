import { apiFetch, setTokens } from "./client"
import { usesCookieSession } from "@/lib/auth/session-config"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"
import {
  FirebaseProfileCompletionRequiredError,
  parseProfileCompletionError,
  readProfileFromBody,
} from "@/lib/auth/firebase-profile-completion"
import type { AuthResponse } from "./types"

function extractApiErrorMessage(
  body: unknown,
  fallback: string,
): string {
  if (!body || typeof body !== "object") return fallback
  const record = body as Record<string, unknown>

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message
    }
  }

  const msg = record.message
  if (typeof msg === "string" && msg.trim()) return msg
  if (Array.isArray(msg)) {
    const parts = msg.filter((part): part is string => typeof part === "string")
    if (parts.length) return parts.join(". ")
  }
  if (msg && typeof msg === "object") {
    const nested = msg as Record<string, unknown>
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message
    }
  }
  return fallback
}

export interface FirebaseLoginRequest {
  idToken: string
  userType?: "CONSUMER" | "LAWYER"
  countryCode?: string
  jurisdiction?: string
  firmName?: string
  name?: string
  referralCode?: string
  deviceFingerprint?: string
  phone?: string
}

export async function loginWithFirebase(
  data: FirebaseLoginRequest,
): Promise<AuthResponse> {
  if (usesCookieSession()) {
    const response = await fetch("/api/auth/firebase-login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    })
    const body = (await response.json().catch(() => ({}))) as AuthResponse & {
      message?: string | Record<string, unknown>
      code?: string
      email?: string
      name?: string | null
    }
    if (!response.ok) {
      const profile = readProfileFromBody(body)
      if (profile) {
        throw new FirebaseProfileCompletionRequiredError(profile)
      }
      const message = extractApiErrorMessage(body, USER_CONNECTION_ERROR)
      throw new Error(message)
    }
    return {
      user: body.user,
      expiresIn: body.expiresIn,
      tokenType: body.tokenType,
      accessToken: "",
      refreshToken: "",
    }
  }

  const response = await apiFetch<AuthResponse>("/auth/firebase/login", {
    method: "POST",
    body: data,
    auth: false,
  }).catch((error) => {
    const profile = parseProfileCompletionError(error)
    if (profile) {
      throw new FirebaseProfileCompletionRequiredError(profile)
    }
    throw error
  })
  setTokens(response.accessToken, response.refreshToken)
  return response
}
