/** True for a real ISO country header — not Cloudflare/Vercel unknowns. */
export function isUsableCountryCode(code?: string | null): code is string {
  const upper = code?.trim().toUpperCase()
  return Boolean(upper && upper.length === 2 && upper !== "XX" && upper !== "T1")
}

export interface CdnCountryHeaders {
  cfIpCountry?: string | null
  cfRegion?: string | null
  vercelIpCountry?: string | null
  vercelRegion?: string | null
  cloudfrontCountry?: string | null
}

export interface ResolvedCdnCountry {
  countryCode: string
  regionCode: string | null
  source: "cf-ipcountry" | "vercel-ip-country" | "cloudfront-viewer-country"
}

/**
 * Visitor country from CDN headers.
 * Cloudflare's CF-IPCountry is the browser. Vercel's header is the connecting
 * hop — often a Cloudflare Lagos colo when the site is proxied.
 */
export function resolveCdnCountry(headers: CdnCountryHeaders): ResolvedCdnCountry | null {
  const cf = headers.cfIpCountry?.trim().toUpperCase()
  if (isUsableCountryCode(cf)) {
    return {
      countryCode: cf,
      regionCode: headers.cfRegion?.trim().toUpperCase() || null,
      source: "cf-ipcountry",
    }
  }

  const vercel = headers.vercelIpCountry?.trim().toUpperCase()
  if (isUsableCountryCode(vercel)) {
    return {
      countryCode: vercel,
      regionCode: headers.vercelRegion?.trim().toUpperCase() || null,
      source: "vercel-ip-country",
    }
  }

  const cloudfront = headers.cloudfrontCountry?.trim().toUpperCase()
  if (isUsableCountryCode(cloudfront)) {
    return {
      countryCode: cloudfront,
      regionCode: null,
      source: "cloudfront-viewer-country",
    }
  }

  return null
}
