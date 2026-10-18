import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  PORTAL_CLIENT_COOKIE,
  PORTAL_TOKEN_COOKIE,
} from "@/lib/auth/session-config"
import {
  clearPortalSessionCookies,
  setPortalSessionCookies,
} from "@/lib/auth/session-cookies.server"

export async function GET(): Promise<NextResponse> {
  const jar = await cookies()
  const portalToken = jar.get(PORTAL_TOKEN_COOKIE)?.value
  const clientId = jar.get(PORTAL_CLIENT_COOKIE)?.value

  if (!portalToken || !clientId) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
  }

  return NextResponse.json({ clientId, authenticated: true })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    portalToken?: string
    clientId?: string
  } | null

  if (!body?.portalToken || !body?.clientId) {
    return NextResponse.json({ message: "Invalid portal session" }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  setPortalSessionCookies(response, body.portalToken, body.clientId)
  return response
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true })
  clearPortalSessionCookies(response)
  return response
}
