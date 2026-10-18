import { NextRequest, NextResponse } from "next/server"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/session-config"
import { bearerFromRequestCookies } from "@/lib/auth/session-cookies.server"

export const MAX_RESEARCH_BODY_BYTES = 64 * 1024
export const RESEARCH_RATE_LIMIT = { limit: 20, windowMs: 60_000 }

type RateBucket = { count: number; resetAt: number }

const rateLimitBuckets = new Map<string, RateBucket>()

export function getResearchProxyClientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = req.headers.get("x-real-ip")?.trim()
  return forwarded || realIp || "unknown"
}

export function checkResearchRateLimit(
  clientKey: string,
  now = Date.now(),
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  for (const [key, bucket] of rateLimitBuckets) {
    if (now >= bucket.resetAt) {
      rateLimitBuckets.delete(key)
    }
  }

  const bucket = rateLimitBuckets.get(clientKey)
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(clientKey, {
      count: 1,
      resetAt: now + RESEARCH_RATE_LIMIT.windowMs,
    })
    return { allowed: true }
  }

  if (bucket.count >= RESEARCH_RATE_LIMIT.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  return { allowed: true }
}

export function resetResearchRateLimitForTests(): void {
  rateLimitBuckets.clear()
}

function exceedsBodyLimit(req: NextRequest, bodyBytes: number): boolean {
  const contentLength = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_RESEARCH_BODY_BYTES) {
    return true
  }
  return bodyBytes > MAX_RESEARCH_BODY_BYTES
}

async function fetchMe(accessToken: string): Promise<Response> {
  return fetch(backendApiUrl("/users/me"), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch(backendApiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) return null

  const data = (await response.json().catch(() => ({}))) as {
    accessToken?: string
  }
  return data.accessToken ?? null
}

export async function resolveValidatedResearchAccessToken(
  req: NextRequest,
): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie")
  let accessToken =
    bearerFromRequestCookies(cookieHeader, [ACCESS_TOKEN_COOKIE]) ?? null

  if (!accessToken) {
    const header = req.headers.get("authorization")
    if (header?.startsWith("Bearer ")) {
      accessToken = header.slice(7).trim() || null
    }
  }

  if (!accessToken) return null

  const me = await fetchMe(accessToken)
  if (me.ok) return accessToken

  if (me.status === 401) {
    const refreshToken = bearerFromRequestCookies(cookieHeader, [
      REFRESH_TOKEN_COOKIE,
    ])
    if (!refreshToken) return null
    return refreshAccessToken(refreshToken)
  }

  if (me.status >= 500) {
    return accessToken
  }

  return null
}

export type ResearchProxyGuardResult =
  | { ok: true; accessToken: string; body: string }
  | { ok: false; response: NextResponse }

export async function enforceResearchProxyGuards(
  req: NextRequest,
): Promise<ResearchProxyGuardResult> {
  const clientKey = getResearchProxyClientKey(req)
  const rate = checkResearchRateLimit(clientKey)
  if (!rate.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Too many research requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      ),
    }
  }

  const accessToken = await resolveValidatedResearchAccessToken(req)
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      ),
    }
  }

  const bodyBuffer = await req.arrayBuffer()
  if (exceedsBodyLimit(req, bodyBuffer.byteLength)) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Request body too large" },
        { status: 413 },
      ),
    }
  }

  const body = new TextDecoder().decode(bodyBuffer)
  return { ok: true, accessToken, body }
}
