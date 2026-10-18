import { NextRequest, NextResponse } from "next/server"
import {
  bearerFromRequestCookies,
  readAccessTokenFromCookies,
} from "@/lib/auth/session-cookies.server"
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/session-config"
import { confirmCheckoutOnServer } from "@/lib/subscriptions/confirm-checkout.server"

export const maxDuration = 60

async function resolveToken(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization")
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim()
  }

  const fromCookie = await readAccessTokenFromCookies()
  if (fromCookie) return fromCookie

  return bearerFromRequestCookies(req.headers.get("cookie"), [ACCESS_TOKEN_COOKIE])
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await resolveToken(req)
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
  }

  let body: { sessionId?: string }
  try {
    body = (await req.json()) as { sessionId?: string }
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
  }

  const sessionId = body.sessionId?.trim()
  if (!sessionId) {
    return NextResponse.json({ message: "sessionId is required" }, { status: 400 })
  }

  const tenantId = req.headers.get("x-tenant-id") ?? undefined

  try {
    const result = await confirmCheckoutOnServer({ sessionId, token, tenantId })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm subscription"
    const status = /not configured/i.test(message) ? 503 : 400
    return NextResponse.json({ message }, { status })
  }
}
