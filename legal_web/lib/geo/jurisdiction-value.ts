import type { CountryCode } from "@/lib/api/types"
import {
  ALL_REGIONS_VALUE,
  isAllRegionsSelection,
} from "@/lib/geo/country-states"

export function encodeJurisdictionValue(
  countryCode: string,
  jurisdiction: string,
): string {
  const code = countryCode?.toUpperCase() || ""
  const region = isAllRegionsSelection(jurisdiction)
    ? ALL_REGIONS_VALUE
    : jurisdiction.trim()
  return `${code}|${region || ALL_REGIONS_VALUE}`
}

export function decodeJurisdictionValue(value: string): {
  countryCode: CountryCode
  jurisdiction: string
} {
  const [code, ...rest] = value.split("|")
  const region = rest.join("|") || ALL_REGIONS_VALUE
  return {
    countryCode: (code?.toUpperCase() || "IN") as CountryCode,
    jurisdiction: region,
  }
}
