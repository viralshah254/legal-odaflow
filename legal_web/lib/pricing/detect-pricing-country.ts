import { resolveCdnCountry } from "@/lib/geo/cdn-country"
import { CANONICAL_PRICING_COUNTRY } from "@/lib/pricing/country-pricing"
import { normalizeToSupportedCountry } from "@/lib/geo/detect-country"

/**
 * Resolve pricing country for SSR.
 *
 * Priority:
 *   1. Explicit ?country= query param
 *   2. Cloudflare CF-IPCountry (visitor) when the site is proxied
 *   3. Vercel x-vercel-ip-country when Cloudflare is absent
 *   4. Default (US)
 */
export async function resolvePricingCountry(options?: {
  explicitCountry?: string | null
  forwardedFor?: string | null
  cfIpCountry?: string | null
  /** x-vercel-ip-country header — set automatically by Vercel on every request */
  vercelIpCountry?: string | null
}): Promise<{ countryCode: string; source: string }> {
  if (options?.explicitCountry) {
    return {
      countryCode: normalizeToSupportedCountry(options.explicitCountry),
      source: "query",
    }
  }

  const edge = resolveCdnCountry({
    cfIpCountry: options?.cfIpCountry,
    vercelIpCountry: options?.vercelIpCountry,
  })
  if (edge) {
    return {
      countryCode: normalizeToSupportedCountry(edge.countryCode),
      source: edge.source,
    }
  }

  return { countryCode: CANONICAL_PRICING_COUNTRY, source: "default" }
}
