import { getCountryName, normalizeToSupportedCountry } from "@/lib/geo/detect-country"

const FLAGS: Record<string, string> = {
  IN: "🇮🇳",
  US: "🇺🇸",
  GB: "🇬🇧",
  KE: "🇰🇪",
}

const SECTION_FINDER_COUNTRIES = new Set(["IN", "US", "GB", "KE"])

/** Flag emoji for a supported workspace country. Empty / unknown → no badge. */
export function countryFlag(countryCode: string | null | undefined): string | undefined {
  const code = normalizeToSupportedCountry(countryCode)
  if (!code) return undefined
  return FLAGS[code]
}

export function countryFlagLabel(countryCode: string | null | undefined): string {
  const code = normalizeToSupportedCountry(countryCode)
  if (!code) return ""
  return getCountryName(code)
}

export function isSectionFinderCountry(countryCode: string | null | undefined): boolean {
  const code = normalizeToSupportedCountry(countryCode)
  return Boolean(code && SECTION_FINDER_COUNTRIES.has(code))
}

/** Href country query only when we have a real workspace country. */
export function sectionFinderCountryParam(
  countryCode: string | null | undefined,
): string | null {
  const code = normalizeToSupportedCountry(countryCode)
  if (!code || !SECTION_FINDER_COUNTRIES.has(code)) return null
  return code
}
