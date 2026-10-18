import { City, State } from "country-state-city"

function normalizeLocationLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function findStateIsoCode(countryCode: string, stateName: string): string | null {
  const code = countryCode.trim().toUpperCase()
  const target = normalizeLocationLabel(stateName)
  if (!code || !target) return null

  const states = State.getStatesOfCountry(code)
  const exact = states.find((state) => normalizeLocationLabel(state.name) === target)
  if (exact?.isoCode) return exact.isoCode

  const contains = states.find((state) => {
    const normalized = normalizeLocationLabel(state.name)
    return normalized.includes(target) || target.includes(normalized)
  })
  return contains?.isoCode ?? null
}

/** Returns sorted city names for a country/state using the ISO subdivision dataset. */
export function getCityOptions(countryCode: string, stateName: string): readonly string[] {
  const isoCode = findStateIsoCode(countryCode, stateName)
  if (!isoCode) return []

  return City.getCitiesOfState(countryCode.trim().toUpperCase(), isoCode)
    .map((city) => city.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/** Pick preferred city when present, otherwise first city alphabetically. */
export function resolveDefaultCity(
  countryCode: string,
  stateName: string,
  preferredCity?: string,
): string {
  const cities = getCityOptions(countryCode, stateName)
  const preferred = preferredCity?.trim()
  if (preferred) {
    const match = cities.find((city) => city.toLowerCase() === preferred.toLowerCase())
    if (match) return match
    return preferred
  }
  return cities[0] ?? ""
}

export const DEFAULT_PROSPECT_COUNTRY_CODE = "IN"
export const DEFAULT_PROSPECT_STATE = "Gujarat"
export const DEFAULT_PROSPECT_CITY = "Ahmedabad"
