/**
 * Server-side IP geolocation — tries multiple free providers.
 *
 * Public client IPs are looked up by address. Private/loopback (localhost)
 * falls back to egress lookup (ipapi.co/json/) so local dev sees the machine's
 * real public country instead of inventing a default.
 */

export interface IpGeoResult {
  countryCode: string
  regionCode: string | null
  regionName: string | null
}

function stripIpv6MappedPrefix(ip: string): string {
  const value = ip.trim().toLowerCase()
  return value.startsWith("::ffff:") ? value.slice(7) : value
}

/** Private / loopback IPs cannot be geolocated by address — use egress lookup instead. */
export function isPrivateOrLocalIp(ip: string): boolean {
  const value = stripIpv6MappedPrefix(ip)
  if (!value || value === "::1" || value.startsWith("127.")) return true
  if (value.startsWith("10.")) return true
  if (value.startsWith("192.168.")) return true
  if (value.startsWith("169.254.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")) return true
  return false
}

/** First public hop in a comma-separated forwarded list. */
export function firstPublicIp(raw?: string | null): string | undefined {
  if (!raw) return undefined
  for (const part of raw.split(",")) {
    const ip = part.trim()
    if (ip && !isPrivateOrLocalIp(ip)) return ip
  }
  return undefined
}

function resolveLookupIp(clientIp?: string): string | undefined {
  return clientIp && !isPrivateOrLocalIp(clientIp) ? clientIp.trim() : undefined
}

function parseIpApiCoBody(data: {
  country_code?: string
  region_code?: string
  region?: string
  error?: boolean
}): IpGeoResult | null {
  if (data.error || !data.country_code) return null
  const countryCode = data.country_code.trim().toUpperCase()
  if (countryCode.length !== 2 || countryCode === "XX") return null
  return {
    countryCode,
    regionCode: data.region_code?.trim().toUpperCase() || null,
    regionName: data.region?.trim() || null,
  }
}

async function detectFromIpApiCo(lookupIp: string): Promise<IpGeoResult | null> {
  try {
    const url = `https://ipapi.co/${encodeURIComponent(lookupIp)}/json/`
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    return parseIpApiCoBody((await res.json()) as Parameters<typeof parseIpApiCoBody>[0])
  } catch {
    return null
  }
}

/** Geolocate this host's public egress IP (no client address in the URL). */
async function detectEgressFromIpApiCo(): Promise<IpGeoResult | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    return parseIpApiCoBody((await res.json()) as Parameters<typeof parseIpApiCoBody>[0])
  } catch {
    return null
  }
}

async function detectFromIpWhoIs(lookupIp: string): Promise<IpGeoResult | null> {
  try {
    const url = `https://ipwho.is/${encodeURIComponent(lookupIp)}`
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      success?: boolean
      country_code?: string
      region_code?: string
      region?: string
    }
    if (!data.success || !data.country_code) return null

    const countryCode = data.country_code.trim().toUpperCase()
    if (countryCode.length !== 2 || countryCode === "XX") return null

    return {
      countryCode,
      regionCode: data.region_code?.trim().toUpperCase() || null,
      regionName: data.region?.trim() || null,
    }
  } catch {
    return null
  }
}

/** Egress lookup via ipwho.is (omit IP → uses caller). */
async function detectEgressFromIpWhoIs(): Promise<IpGeoResult | null> {
  try {
    const res = await fetch("https://ipwho.is/", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      success?: boolean
      country_code?: string
      region_code?: string
      region?: string
    }
    if (!data.success || !data.country_code) return null

    const countryCode = data.country_code.trim().toUpperCase()
    if (countryCode.length !== 2 || countryCode === "XX") return null

    return {
      countryCode,
      regionCode: data.region_code?.trim().toUpperCase() || null,
      regionName: data.region?.trim() || null,
    }
  } catch {
    return null
  }
}

async function detectFromIpApiCom(lookupIp: string): Promise<IpGeoResult | null> {
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(lookupIp)}?fields=status,countryCode,regionName,region`
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      status?: string
      countryCode?: string
      region?: string
      regionName?: string
    }
    if (data.status !== "success" || !data.countryCode) return null

    const countryCode = data.countryCode.trim().toUpperCase()
    if (countryCode.length !== 2) return null

    return {
      countryCode,
      regionCode: data.region?.trim().toUpperCase() || null,
      regionName: data.regionName?.trim() || null,
    }
  } catch {
    return null
  }
}

async function detectEgressFromIpApiCom(): Promise<IpGeoResult | null> {
  try {
    const res = await fetch("http://ip-api.com/json/?fields=status,countryCode,regionName,region", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      status?: string
      countryCode?: string
      region?: string
      regionName?: string
    }
    if (data.status !== "success" || !data.countryCode) return null

    const countryCode = data.countryCode.trim().toUpperCase()
    if (countryCode.length !== 2) return null

    return {
      countryCode,
      regionCode: data.region?.trim().toUpperCase() || null,
      regionName: data.regionName?.trim() || null,
    }
  } catch {
    return null
  }
}

async function detectViaProviders(
  providers: Array<() => Promise<IpGeoResult | null>>,
): Promise<IpGeoResult | null> {
  for (const provider of providers) {
    const result = await provider()
    if (result) return result
  }
  return null
}

/** @deprecated Use detectFromIpGeo */
export type IpApiGeoResult = IpGeoResult

/**
 * Geolocate a public client IP, or (in development only) the host egress IP.
 * Production never uses server egress — that is the datacenter, not the visitor.
 */
export async function detectFromIpGeo(clientIp?: string): Promise<IpGeoResult | null> {
  const lookupIp = resolveLookupIp(clientIp)
  if (lookupIp) {
    return detectViaProviders([
      () => detectFromIpApiCo(lookupIp),
      () => detectFromIpWhoIs(lookupIp),
      () => detectFromIpApiCom(lookupIp),
    ])
  }

  if (process.env.NODE_ENV === "production") return null

  // Localhost / private IP — resolve this machine's public egress country.
  return detectViaProviders([
    () => detectEgressFromIpApiCo(),
    () => detectEgressFromIpWhoIs(),
    () => detectEgressFromIpApiCom(),
  ])
}

/** @deprecated Use detectFromIpGeo */
export const detectFromIpApi = detectFromIpGeo

export function readClientIp(headers: Headers): string | undefined {
  const cf = headers.get("cf-connecting-ip")?.trim()
  if (cf && !isPrivateOrLocalIp(cf)) return cf

  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp && !isPrivateOrLocalIp(realIp)) return realIp

  const publicForwarded = firstPublicIp(headers.get("x-forwarded-for"))
  if (publicForwarded) return publicForwarded

  const firstForwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return firstForwarded || cf || realIp || undefined
}
