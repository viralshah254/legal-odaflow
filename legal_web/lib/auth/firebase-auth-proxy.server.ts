import { NextRequest, NextResponse } from "next/server"

function resolveFirebaseAuthHandlerHost(): string | null {
  const explicit = process.env.FIREBASE_AUTH_HANDLER_HOST?.trim()
  if (explicit) return explicit.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  if (projectId) return `${projectId}.firebaseapp.com`
  return null
}

const STRIPPED_UPSTREAM_HEADERS = new Set([
  "strict-transport-security",
  "transfer-encoding",
  "connection",
  "content-encoding",
])

/** True when OAuth must stay on plain HTTP (local Next dev has no TLS). */
export function isLocalFirebaseAuthProxyHost(host: string): boolean {
  return /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host)
}

/**
 * Proxy /__/auth/* to the Firebase project handler and strip HSTS.
 * Firebase's handler sets Strict-Transport-Security; on localhost that makes
 * browsers upgrade to https://localhost:3000 and hit ERR_SSL_PROTOCOL_ERROR.
 */
export async function proxyFirebaseAuthHandler(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse | null> {
  const handlerHost = resolveFirebaseAuthHandlerHost()
  if (!handlerHost) return null

  const upstreamUrl = new URL(
    `https://${handlerHost}${pathname}${request.nextUrl.search}`,
  )

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: {
        Accept: request.headers.get("accept") ?? "*/*",
      },
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? await request.arrayBuffer()
          : undefined,
      redirect: "manual",
    })
  } catch {
    return NextResponse.json(
      { message: "Firebase auth handler unreachable" },
      { status: 502 },
    )
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  })

  upstream.headers.forEach((value, key) => {
    if (STRIPPED_UPSTREAM_HEADERS.has(key.toLowerCase())) return
    response.headers.set(key, value)
  })

  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.delete("Content-Security-Policy")
  response.headers.delete("Content-Security-Policy-Report-Only")

  return response
}
