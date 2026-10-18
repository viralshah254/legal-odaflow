/**
 * Dev-only stand-in for Vercel/Cloudflare edge IP geo headers.
 * Used by /api/geo when NODE_ENV=development and no edge headers are present.
 */

export interface DevGeoMock {
  countryCode: string
  regionCode: string | null
}

export function getDevGeoMock(): DevGeoMock | null {
  if (process.env.NODE_ENV !== "development") return null
  if (process.env.DEV_GEO_MOCK === "false") return null

  const country = (
    process.env.DEV_GEO_COUNTRY ?? process.env.NEXT_PUBLIC_DEFAULT_COUNTRY
  )
    ?.trim()
    .toUpperCase()

  if (!country || country.length !== 2) return null

  const region = process.env.DEV_GEO_REGION?.trim().toUpperCase() || null
  return { countryCode: country, regionCode: region }
}
