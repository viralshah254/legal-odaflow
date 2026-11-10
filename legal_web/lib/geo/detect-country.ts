/**
 * Client-side country detection for the web app.
 *
 * Priority chain:
 *   1. Explicitly requested, user-confirmed manual selection
 *   2. Fresh first-party /api/geo — CDN edge headers, then IP providers
 *   3. Account/stored country only when current location is unavailable
 *   4. Backend GET /geo/client — IP fallback when Next geo route misses
 *   5. Browser Geolocation API — only with explicit user permission
 *   6. Explicit NEXT_PUBLIC_DEFAULT_COUNTRY, otherwise unresolved until selected
 *
 * Device language is intentionally not used — UI locale ≠ physical location.
 */

export type SupportedCountry = "IN" | "US" | "KE" | "GB"

const SUPPORTED_COUNTRIES: SupportedCountry[] = ["IN", "US", "KE", "GB"]

/** Tier-1 countries — full legal analysis support. */
export const TIER1_COUNTRY_CODES: string[] = ["IN", "US", "KE", "GB"]

/** Human-readable country names keyed by ISO-3166 alpha-2. */
export const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  KE: "Kenya",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  CH: "Switzerland",
  JP: "Japan",
  SG: "Singapore",
  HK: "Hong Kong",
  AE: "United Arab Emirates",
  IE: "Ireland",
  AT: "Austria",
  BE: "Belgium",
  FI: "Finland",
  LU: "Luxembourg",
  ZA: "South Africa",
  NG: "Nigeria",
  GH: "Ghana",
  TZ: "Tanzania",
  UG: "Uganda",
  RW: "Rwanda",
  ET: "Ethiopia",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  PH: "Philippines",
  ID: "Indonesia",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
  CO: "Colombia",
  OTHER: "Other / Not listed",
}

/** Returns the display name for a country code. */
export function getCountryName(countryCode: string): string {
  return COUNTRY_NAMES[countryCode.toUpperCase()] ?? countryCode
}

/** Returns true if the country has full tier-1 legal analysis support. */
export function isTier1Country(countryCode: string): boolean {
  return TIER1_COUNTRY_CODES.includes(countryCode.toUpperCase())
}

/** Countries classified as "developed" for pricing / credit-tier purposes. */
const DEVELOPED_MARKET_COUNTRIES = new Set([
  "US", "GB", "CA", "AU", "NZ", "DE", "FR", "NL", "SE", "NO", "DK", "CH",
  "JP", "SG", "HK", "AE", "IE", "AT", "BE", "FI", "LU",
])

export function isDevelopedMarket(countryCode: string): boolean {
  return DEVELOPED_MARKET_COUNTRIES.has(countryCode.toUpperCase())
}

const COUNTRY_STORAGE_KEY = "odaflow_detected_country"
export const USER_COUNTRY_CONFIRMED_KEY = "odaflow_country_user_confirmed"

/** When IP geo and confirmed storage are unavailable. */
const FALLBACK_COUNTRY_CODE = ""

/** Tier percentages (must match backend pricing.config.ts). */
export const AI_CREDIT_TIER_PCT: Record<"developing" | "developed", number> = {
  developing: 60,
  developed: 50,
}

export interface DetectedCountry {
  countryCode: string
  /** State / province / county from IP geolocation (e.g. "Nairobi City"). Only set when source is "ip". */
  jurisdiction?: string
  /** @deprecated Use `jurisdiction` — kept for backwards compatibility */
  region?: string
  source: "ip" | "stored" | "default"
  /** true if country qualifies for the developed-market pricing tier */
  isDeveloped: boolean
  /** AI credit budget as % of plan price (50 or 60) */
  creditTierPct: number
}

function resultFor(
  countryCode: string,
  source: DetectedCountry["source"],
  region?: string,
): DetectedCountry {
  const developed = isDevelopedMarket(countryCode)
  return {
    countryCode: countryCode.toUpperCase(),
    jurisdiction: region,
    region,
    source,
    isDeveloped: developed,
    creditTierPct: developed ? AI_CREDIT_TIER_PCT.developed : AI_CREDIT_TIER_PCT.developing,
  }
}

/**
 * Returns the compile-time / env-supplied default country code.
 * Returns "" (empty) when the env var is absent or unrecognised — callers
 * should show a loading state and wait for geo-detection to fill in the
 * real value rather than assuming any country.
 */
export function getDefaultCountryCode(): string {
  const envDefault = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY?.toUpperCase()
  if (envDefault && envDefault.length === 2) return envDefault
  return ""
}

/**
 * Normalise any ISO-3166 alpha-2 code to a displayable country string.
 * Any valid 2-letter code is kept as-is (we no longer restrict to 4 tier-1
 * countries). Returns "" for null/empty input so callers can distinguish
 * "not yet detected" from a real country.
 */
export function normalizeToSupportedCountry(
  countryCode: string | null | undefined,
): string {
  if (!countryCode) return ""
  const upper = countryCode.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(upper) && !["ZZ", "XX"].includes(upper) ? upper : ""
}

/** Persist the user's country to localStorage. Set userConfirmed when the user manually picks a country. */
export function persistCountrySelection(
  countryCode: string,
  opts?: { userConfirmed?: boolean },
): void {
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, countryCode.toUpperCase())
    if (opts?.userConfirmed) {
      localStorage.setItem(USER_COUNTRY_CONFIRMED_KEY, "1")
    }
  } catch {
    // private browsing / storage full — ignore
  }
}

export function isUserConfirmedCountry(): boolean {
  try {
    return localStorage.getItem(USER_COUNTRY_CONFIRMED_KEY) === "1"
  } catch {
    return false
  }
}

export function getStoredCountryIfConfirmed(): string | null {
  if (!isUserConfirmedCountry()) return null
  const stored = getStoredCountry()
  const normalized = normalizeToSupportedCountry(stored)
  return normalized || null
}

/** Account default: user profile country, then firm tenant primary country. */
export function resolveAccountCountryCode(
  userCountryCode?: string | null,
  tenantPrimaryCountry?: string | null,
): string {
  return (
    normalizeToSupportedCountry(userCountryCode) ||
    normalizeToSupportedCountry(tenantPrimaryCountry) ||
    ""
  )
}

/**
 * Workspace country for signed-in chrome (nav flags, Section Finder, drafting).
 * Current location supplies new-work defaults; account settings are fallbacks.
 * Explicit current-session and matter choices are handled by the caller.
 */
export function resolveWorkspaceCountryCode(input: {
  tenantPrimary?: string | null
  profile?: string | null
  confirmedOverride?: string | null
  currentLocation?: string | null
}): string {
  return (
    normalizeToSupportedCountry(input.currentLocation) ||
    normalizeToSupportedCountry(input.confirmedOverride) ||
    normalizeToSupportedCountry(input.tenantPrimary) ||
    normalizeToSupportedCountry(input.profile) ||
    ""
  )
}

function getStoredCountry(): string | null {
  try {
    return localStorage.getItem(COUNTRY_STORAGE_KEY)
  } catch {
    return null
  }
}

function resolveFallbackCountryCode(): string {
  return getDefaultCountryCode() || FALLBACK_COUNTRY_CODE
}

/**
 * Detect the user's country AND region (state/province).
 *
 * Uses first-party /api/geo (CDN headers + ipapi), then backend /geo/client in dev.
 *
 * `preferStored` is retained for API compatibility, but fresh geo is always
 * attempted first. Stored values are only used when live detection fails.
 */
export async function detectCountry(opts?: {
  preferStored?: boolean
  skipUserProfile?: boolean
  /** Signed-in account fallback when physical location cannot be determined. */
  accountCountryCode?: string | null
}): Promise<DetectedCountry> {
  void opts?.preferStored
  void opts?.skipUserProfile

  const accountCountry = normalizeToSupportedCountry(opts?.accountCountryCode)

  const confirmed = getStoredCountryIfConfirmed()
  if (opts?.preferStored && confirmed) return resultFor(confirmed, "stored")

  const internalResult = await fetchInternalGeo()
  if (internalResult?.countryCode) {
    const ipCountry = normalizeToSupportedCountry(internalResult.countryCode)
    return resultFor(ipCountry || internalResult.countryCode, "ip", internalResult.region)
  }
  if (confirmed) return resultFor(confirmed, "stored")
  if (accountCountry) return resultFor(accountCountry, "stored")

  const geoCode = await detectFromBrowserGeolocation()
  if (geoCode) {
    const browserCountry = normalizeToSupportedCountry(geoCode)
    if (browserCountry) {
      return resultFor(browserCountry, "ip")
    }
  }

  return resultFor(resolveFallbackCountryCode(), "default")
}

/** Sources that are not real visitor detections — must not drive mismatch UI. */
const NON_IP_GEO_SOURCES = new Set(["default", "none", "dev-mock"])

const VISITOR_GEO_SOURCES = new Set([
  "cf-ipcountry",
  "vercel-ip-country",
  "cloudfront-viewer-country",
  "ip-geo",
  "backend-ipapi",
])

function isUsableIpGeoSource(
  source: string | null | undefined,
  via?: string | null,
): boolean {
  if (via === "egress") return false
  if (!source) return true
  if (NON_IP_GEO_SOURCES.has(source)) return false
  return VISITOR_GEO_SOURCES.has(source)
}

async function fetchInternalGeo(): Promise<{ countryCode: string; region?: string } | null> {
  const fromNext = await fetchNextGeo()
  if (fromNext) return fromNext
  return fetchBackendGeo()
}

/** Raw IP geo only — does not prefer profile/stored country. Used for mismatch prompts. */
export async function detectIpLocation(): Promise<{
  countryCode: string
  region: string | null
} | null> {
  const internalResult = await fetchInternalGeo()
  if (!internalResult?.countryCode) return null
  const countryCode = normalizeToSupportedCountry(internalResult.countryCode)
  if (!countryCode) return null
  return {
    countryCode,
    region: internalResult.region ?? null,
  }
}

async function fetchNextGeo(): Promise<{ countryCode: string; region?: string } | null> {
  try {
    const { resolveGeoJurisdiction } = await import("./country-states")
    const res = await fetch("/api/geo/", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      countryCode?: string | null
      regionCode?: string | null
      regionName?: string | null
      source?: string | null
      via?: string | null
    }
    if (!data.countryCode || data.countryCode === "XX") return null
    // Invented defaults / server egress must not appear as "current location".
    if (!isUsableIpGeoSource(data.source, data.via)) return null
    const region =
      resolveGeoJurisdiction(data.countryCode, data.regionCode, data.regionName) ?? undefined
    return { countryCode: data.countryCode, region }
  } catch {
    return null
  }
}

async function fetchBackendGeo(): Promise<{ countryCode: string; region?: string } | null> {
  try {
    const { resolveGeoJurisdiction } = await import("./country-states")
    const { detectClientGeoFromBackend } = await import("@/lib/api/geo")
    const data = await detectClientGeoFromBackend()
    if (!data.countryCode || data.countryCode === "XX") return null
    if (!isUsableIpGeoSource(data.source)) return null
    const region =
      resolveGeoJurisdiction(data.countryCode, data.regionCode, data.regionName) ?? undefined
    return { countryCode: data.countryCode, region }
  } catch {
    return null
  }
}

/**
 * Ask the browser for precise GPS coordinates, then reverse-geocode to a
 * country code via OpenStreetMap Nominatim.
 *
 * Only runs in a browser; silently returns null if permission is denied or
 * the API is unavailable.  A cached result (maximumAge 1 h) is used so the
 * permission prompt is only shown once per session.
 */
async function detectFromBrowserGeolocation(): Promise<string | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return null
  }

  const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 8000, maximumAge: 3_600_000 },
    )
  })

  if (!coords) return null

  try {
    const { latitude, longitude } = coords
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: { "User-Agent": "UmbrellaLegal/1.0 (legal.odaflow.com)" },
        signal: AbortSignal.timeout(6000),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { address?: { country_code?: string } }
    const code = data?.address?.country_code?.toUpperCase()
    return code && code.length === 2 ? code : null
  } catch {
    return null
  }
}

/** Best-effort country from browser geolocation (requires user permission). */
export async function tryBrowserGeolocationCountry(): Promise<string | null> {
  return detectFromBrowserGeolocation()
}

/**
 * Infer country from free-text (jurisdiction mentions).
 * Simple keyword heuristic — used when the user types their legal issue.
 */
export function inferCountryFromText(text: string): SupportedCountry | null {
  if (!text) return null
  const t = text.toLowerCase()

  if (
    /\b(india|indian|delhi|mumbai|bangalore|chennai|hyderabad|kolkata|rupee|rs\.|ipc|crpc|ipc |cpc )\b/.test(t)
  )
    return "IN"
  if (
    /\b(kenya|kenyan|nairobi|mombasa|shilling|ksh|kra|bbi|nema|nhif)\b/.test(t)
  )
    return "KE"
  if (
    /\b(united kingdom|uk\b|england|wales|scotland|gbp|hmrc|dvla|nhs\b|paye|solicitor)\b/.test(t)
  )
    return "GB"
  if (
    /\b(usa|united states|american|federal|irs\b|fbi|sec\b|doj|ssn|medicare|medicaid)\b/.test(t)
  )
    return "US"

  return null
}
