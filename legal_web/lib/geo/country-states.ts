import { State } from "country-state-city"

import { US_JURISDICTIONS } from "./us-states"
import { resolveRegionName } from "./region-codes"

/** Sentinel value for state/region pickers — means no specific sub-national region. */
export const ALL_REGIONS_VALUE = "All regions"

export function isAllRegionsSelection(value?: string | null): boolean {
  if (!value?.trim()) return true
  const v = value.trim()
  return v === ALL_REGIONS_VALUE || v === "All jurisdictions"
}

/** State / region lists for countries where we provide a dropdown. */
export const COUNTRY_STATES: Record<string, string[]> = {
  IN: [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    // Union Territories
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi (NCT)",
    "Jammu & Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ],
  KE: [
    "Baringo",
    "Bomet",
    "Bungoma",
    "Busia",
    "Elgeyo-Marakwet",
    "Embu",
    "Garissa",
    "Homa Bay",
    "Isiolo",
    "Kajiado",
    "Kakamega",
    "Kericho",
    "Kiambu",
    "Kilifi",
    "Kirinyaga",
    "Kisii",
    "Kisumu",
    "Kitui",
    "Kwale",
    "Laikipia",
    "Lamu",
    "Machakos",
    "Makueni",
    "Mandera",
    "Marsabit",
    "Meru",
    "Migori",
    "Mombasa",
    "Murang'a",
    "Nairobi",
    "Nakuru",
    "Nandi",
    "Narok",
    "Nyamira",
    "Nyandarua",
    "Nyeri",
    "Samburu",
    "Siaya",
    "Taita-Taveta",
    "Tana River",
    "Tharaka-Nithi",
    "Trans-Nzoia",
    "Turkana",
    "Uasin Gishu",
    "Vihiga",
    "Wajir",
    "West Pokot",
  ],
  GB: [
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
    // Major English regions
    "London",
    "South East England",
    "South West England",
    "East of England",
    "East Midlands",
    "West Midlands",
    "Yorkshire and the Humber",
    "North West England",
    "North East England",
  ],
  AU: [
    "Australian Capital Territory",
    "New South Wales",
    "Northern Territory",
    "Queensland",
    "South Australia",
    "Tasmania",
    "Victoria",
    "Western Australia",
  ],
  CA: [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Northwest Territories",
    "Nova Scotia",
    "Nunavut",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Yukon",
  ],
  ZA: [
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "Northern Cape",
    "North West",
    "Western Cape",
  ],
  NG: [
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "FCT Abuja",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara",
  ],
}

/** Returns true when a country supports the region dropdown (all except OTHER / empty). */
export function hasStateDropdown(countryCode: string): boolean {
  const code = countryCode?.toUpperCase()
  return !!code && code !== "OTHER"
}

/**
 * Returns states / provinces for a country. Curated lists are preferred; otherwise
 * falls back to the worldwide ISO subdivision dataset.
 */
export function getStateOptions(countryCode: string): readonly string[] {
  const code = countryCode?.toUpperCase()
  if (!code || code === "OTHER") return []

  if (code === "US") return US_JURISDICTIONS
  if (COUNTRY_STATES[code]) return COUNTRY_STATES[code]

  return State.getStatesOfCountry(code)
    .map((state) => state.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/** Map IP / geo provider region labels to dropdown option names. */
const REGION_ALIASES: Record<string, string> = {
  delhi: "Delhi (NCT)",
  "new delhi": "Delhi (NCT)",
  "national capital territory of delhi": "Delhi (NCT)",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  pondicherry: "Puducherry",
  "jammu and kashmir": "Jammu & Kashmir",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "washington dc": "Washington D.C.",
  "district of columbia": "Washington D.C.",
  "nairobi city": "Nairobi",
  "nairobi county": "Nairobi",
}

function normalizeRegionLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Map IP-detected region names to a value in a jurisdiction option list. */
export function matchRegionToJurisdictionList(
  options: readonly string[],
  regionName: string | null | undefined,
): string | null {
  if (!regionName?.trim() || isAllRegionsSelection(regionName)) return null
  if (!options.length) return null

  const normalized = normalizeRegionLabel(regionName)
  const aliased = REGION_ALIASES[normalized]
  const candidates = [aliased, regionName.trim()].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const candidateNorm = normalizeRegionLabel(candidate)
    const exact = options.find((option) => normalizeRegionLabel(option) === candidateNorm)
    if (exact) return exact

    const partial = options.find((option) => {
      const optionNorm = normalizeRegionLabel(option)
      return optionNorm.includes(candidateNorm) || candidateNorm.includes(optionNorm)
    })
    if (partial) return partial
  }

  return null
}

/** Map IP-detected region names to a value in the country state dropdown. */
export function matchRegionToStateOption(
  countryCode: string,
  regionName: string | null | undefined,
): string | null {
  return matchRegionToJurisdictionList(getStateOptions(countryCode), regionName)
}

/**
 * Resolve IP geo region code + name to a state dropdown value for a country.
 */
export function resolveGeoJurisdiction(
  countryCode: string,
  regionCode?: string | null,
  regionName?: string | null,
): string | null {
  const code = countryCode?.toUpperCase()
  if (!code) return null

  let subdivision = regionCode?.trim().toUpperCase() || null
  if (subdivision?.includes("-")) {
    subdivision = subdivision.split("-").pop()?.toUpperCase() ?? null
  }

  const fromCode = subdivision ? resolveRegionName(code, subdivision) : null

  for (const candidate of [fromCode, regionName]) {
    const matched = matchRegionToStateOption(code, candidate)
    if (matched) return matched
  }

  return null
}
