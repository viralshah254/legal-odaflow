import { ALL_REGIONS_VALUE, isAllRegionsSelection } from "@/lib/geo/country-states"
import { getCountryName, normalizeToSupportedCountry } from "@/lib/geo/detect-country"

export type JurisdictionChoice = "profile" | "ip"

export const RESEARCH_JURISDICTION_CHOICE_KEY = "odaflow_research_jurisdiction_choice"

export type JurisdictionLocation = {
  countryCode: string
  region: string | null
}

export function formatJurisdictionLocation(location: JurisdictionLocation): string {
  const country = getCountryName(location.countryCode) || location.countryCode
  if (!location.region || isAllRegionsSelection(location.region)) return country
  return `${country} · ${location.region}`
}

function normalizeRegion(region: string | null | undefined): string | null {
  if (!region?.trim() || isAllRegionsSelection(region)) return null
  return region.trim()
}

/**
 * True when profile and IP disagree on country, or (same country) on a known region.
 * Missing IP data is not a mismatch.
 */
export function hasJurisdictionMismatch(
  profile: JurisdictionLocation | null | undefined,
  ip: JurisdictionLocation | null | undefined,
): boolean {
  const profileCountry = normalizeToSupportedCountry(profile?.countryCode)
  const ipCountry = normalizeToSupportedCountry(ip?.countryCode)
  if (!profileCountry || !ipCountry) return false
  if (profileCountry !== ipCountry) return true

  const profileRegion = normalizeRegion(profile?.region)
  const ipRegion = normalizeRegion(ip?.region)
  if (!profileRegion || !ipRegion) return false
  return profileRegion.toLowerCase() !== ipRegion.toLowerCase()
}

export function readResearchJurisdictionChoice(): JurisdictionChoice | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const value = sessionStorage.getItem(RESEARCH_JURISDICTION_CHOICE_KEY)
    if (value === "profile" || value === "ip") return value
    return null
  } catch {
    return null
  }
}

export function persistResearchJurisdictionChoice(choice: JurisdictionChoice): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(RESEARCH_JURISDICTION_CHOICE_KEY, choice)
  } catch {
    // private browsing / storage full
  }
}

/** Map a choice to the research country + region payload (region may still need list matching). */
export function resolveJurisdictionChoice(
  choice: JurisdictionChoice,
  profile: JurisdictionLocation,
  ip: JurisdictionLocation,
): JurisdictionLocation {
  if (choice === "ip") {
    return {
      countryCode: normalizeToSupportedCountry(ip.countryCode) || ip.countryCode,
      region: normalizeRegion(ip.region),
    }
  }
  return {
    countryCode: normalizeToSupportedCountry(profile.countryCode) || profile.countryCode,
    region: normalizeRegion(profile.region) ?? ALL_REGIONS_VALUE,
  }
}
