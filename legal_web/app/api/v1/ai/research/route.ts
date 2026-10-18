import { NextRequest, NextResponse } from "next/server"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"
import { enforceResearchProxyGuards } from "@/lib/api/research-proxy-guards.server"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"

export const maxDuration = 300

const FORWARD_HEADERS = [
  "x-tenant-id",
  "content-type",
  "accept-language",
  "x-locale",
  "x-output-language",
]

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await enforceResearchProxyGuards(req)
  if (!guard.ok) {
    return guard.response
  }

  const backendUrl = backendApiUrl("/ai/research")

  const outHeaders: Record<string, string> = {
    authorization: `Bearer ${guard.accessToken}`,
  }
  for (const key of FORWARD_HEADERS) {
    const val = req.headers.get(key)
    if (val) outHeaders[key] = val
  }

  const upstream = await fetch(backendUrl, {
    method: "POST",
    headers: outHeaders,
    body: guard.body,
  }).catch((err) => {
    console.error("[research-proxy] fetch error:", err)
    return null
  })

  if (!upstream) {
    return NextResponse.json({ message: USER_CONNECTION_ERROR }, { status: 502 })
  }

  const data = await upstream.text()
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  })
}
