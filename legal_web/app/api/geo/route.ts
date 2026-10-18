import { NextRequest, NextResponse } from "next/server"
import { resolveCdnCountry } from "@/lib/geo/cdn-country"
import { getDevGeoMock } from "@/lib/geo/dev-geo-mock"
import { detectFromIpGeo, isPrivateOrLocalIp, readClientIp } from "@/lib/geo/ip-api"
import { resolveRegionName } from "@/lib/geo/region-codes"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
}

function geoResponse(body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { headers: NO_STORE_HEADERS })
}

function buildForwardHeaders(req: NextRequest): HeadersInit {
  const headers: Record<string, string> = {}
  for (const name of [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-region",
    "x-vercel-ip-country",
    "x-vercel-ip-country-region",
  ]) {
    const value = req.headers.get(name)?.trim()
    if (value) headers[name] = value
  }
  return headers
}

async function fetchBackendClientGeo(req: NextRequest): Promise<{
  countryCode: string
  regionCode: string | null
  regionName: string | null
} | null> {
  const apiBase =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/v1/geo/client`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: buildForwardHeaders(req),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      countryCode?: string | null
      regionCode?: string | null
      regionName?: string | null
    }
    if (!data.countryCode || data.countryCode === "XX") return null
    return {
      countryCode: data.countryCode,
      regionCode: data.regionCode ?? null,
      regionName: data.regionName ?? null,
    }
  } catch {
    return null
  }
}

/**
 * First-party geo endpoint for client-side country resolution.
 *
 * Priority:
 *   1. Cloudflare CF-IPCountry (+ region) — real visitor when proxied
 *   2. Vercel x-vercel-ip-country — only when Cloudflare is absent
 *   3. CloudFront cloudfront-viewer-country
 *   4. IP geo — public client IP; egress only on localhost in development
 *   5. Backend /geo/client with forwarded client headers
 *   6. Dev mock (DEV_GEO_COUNTRY)
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest): Promise<NextResponse> {
  const edge = resolveCdnCountry({
    cfIpCountry: req.headers.get("cf-ipcountry"),
    cfRegion: req.headers.get("cf-region"),
    vercelIpCountry: req.headers.get("x-vercel-ip-country"),
    vercelRegion: req.headers.get("x-vercel-ip-country-region"),
    cloudfrontCountry: req.headers.get("cloudfront-viewer-country"),
  })
  if (edge) {
    return geoResponse({
      countryCode: edge.countryCode,
      regionCode: edge.regionCode,
      source: edge.source,
    })
  }

  const clientIp = readClientIp(req.headers)
  const lookupIsPrivate = !clientIp || isPrivateOrLocalIp(clientIp)
  const ipGeo = await detectFromIpGeo(clientIp)
  if (ipGeo) {
    return geoResponse({
      countryCode: ipGeo.countryCode,
      regionCode: ipGeo.regionCode,
      regionName: ipGeo.regionName,
      source: "ip-geo",
      ...(lookupIsPrivate ? { via: "egress" } : {}),
    })
  }

  const backend = await fetchBackendClientGeo(req)
  if (backend) {
    return geoResponse({ ...backend, source: "backend-ipapi" })
  }

  // Only an explicit DEV_GEO_COUNTRY counts as intentional local IP override.
  // NEXT_PUBLIC_DEFAULT_COUNTRY alone must not invent a "current location".
  const intentionalDevGeo = Boolean(process.env.DEV_GEO_COUNTRY?.trim())
  const devMock = intentionalDevGeo ? getDevGeoMock() : null
  if (devMock) {
    const regionName = devMock.regionCode
      ? resolveRegionName(devMock.countryCode, devMock.regionCode)
      : null
    return geoResponse({
      countryCode: devMock.countryCode,
      regionCode: devMock.regionCode,
      regionName,
      source: "dev-mock",
    })
  }

  return geoResponse({ countryCode: null, regionCode: null, source: "none" })
}
