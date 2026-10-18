import { NextRequest, NextResponse } from "next/server"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"
import {
  ACCESS_TOKEN_COOKIE,
  PORTAL_TOKEN_COOKIE,
} from "@/lib/auth/session-config"
import { bearerFromRequestCookies } from "@/lib/auth/session-cookies.server"

export const maxDuration = 300

const FORWARD_REQUEST_HEADERS = [
  "authorization",
  "x-tenant-id",
  "content-type",
  "accept",
  "accept-language",
  "x-locale",
  "x-output-language",
  "range",
  "if-none-match",
  "if-range",
]

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "accept-ranges",
  "content-range",
  "content-length",
  "etag",
]

function resolveBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization")
  if (header) return header.replace(/^Bearer\s+/i, "")

  const cookieHeader = req.headers.get("cookie")
  return (
    bearerFromRequestCookies(cookieHeader, [ACCESS_TOKEN_COOKIE]) ??
    bearerFromRequestCookies(cookieHeader, [PORTAL_TOKEN_COOKIE])
  )
}

/** Fail fast when the Nest host is down; keep long budgets for AI/draft jobs. */
function upstreamTimeoutMs(subPath: string): number {
  const path = subPath.replace(/\/+$/, "")
  if (
    path.startsWith("ai/") ||
    path.startsWith("draft-jobs") ||
    path.includes("india-draft") ||
    path.includes("consumers/issue-checker")
  ) {
    return 290_000
  }
  if (path.startsWith("analytics/")) {
    return 8_000
  }
  return 25_000
}

async function proxyRequest(
  req: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const subPath = pathSegments.join("/")
  const query = req.nextUrl.search
  const upstreamUrl = backendApiUrl(`/${subPath}${query ? query : ""}`)

  const outHeaders: Record<string, string> = {}
  for (const key of FORWARD_REQUEST_HEADERS) {
    const val = req.headers.get(key)
    if (val) outHeaders[key] = val
  }

  const bearer = resolveBearer(req)
  if (bearer && !outHeaders.authorization) {
    outHeaders.authorization = `Bearer ${bearer}`
  }

  const method = req.method.toUpperCase()
  const hasBody = !["GET", "HEAD"].includes(method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: outHeaders,
    body: body && body.byteLength > 0 ? body : undefined,
    signal: AbortSignal.timeout(upstreamTimeoutMs(subPath)),
  }).catch((error) => {
    console.error("[api/v1 proxy] fetch error:", error)
    return null
  })

  if (!upstream) {
    return NextResponse.json({ message: USER_CONNECTION_ERROR }, { status: 502 })
  }

  const responseHeaders = new Headers()
  for (const key of FORWARD_RESPONSE_HEADERS) {
    const val = upstream.headers.get(key)
    if (val) responseHeaders.set(key, val)
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

type RouteContext = { params: { path: string[] } }

async function handle(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  return proxyRequest(req, params.path ?? [])
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
export const HEAD = handle
export const OPTIONS = handle
