import { COUNTRY_NAMES } from "@/lib/geo/detect-country"

/** ITU calling codes for supported countries (ISO 3166-1 alpha-2). */
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  IN: "+91",
  US: "+1",
  KE: "+254",
  GB: "+44",
  AU: "+61",
  CA: "+1",
  NG: "+234",
  ZA: "+27",
  GH: "+233",
  TZ: "+255",
  UG: "+256",
  RW: "+250",
  PK: "+92",
  BD: "+880",
  LK: "+94",
  NP: "+977",
  PH: "+63",
  SG: "+65",
  MY: "+60",
  AE: "+971",
  QA: "+974",
  SA: "+966",
  EG: "+20",
  ZW: "+263",
  ET: "+251",
  DE: "+49",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  NL: "+31",
}

export const PHONE_COUNTRY_OPTIONS = Object.entries(COUNTRY_DIAL_CODES)
  .map(([code, dialCode]) => ({
    code,
    dialCode,
    label: COUNTRY_NAMES[code] ?? code,
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function getDialCodeForCountry(countryCode: string): string {
  return COUNTRY_DIAL_CODES[countryCode.toUpperCase()] ?? "+1"
}

export function formatPhoneNumber(countryCode: string, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D/g, "")
  if (!digits) return ""
  return `${getDialCodeForCountry(countryCode)} ${digits}`
}

export function parsePhoneNumber(
  value: string,
  fallbackCountryCode = "US",
): { countryCode: string; nationalNumber: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { countryCode: fallbackCountryCode, nationalNumber: "" }
  }

  const sorted = [...PHONE_COUNTRY_OPTIONS].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  )

  for (const option of sorted) {
    if (trimmed.startsWith(option.dialCode)) {
      const rest = trimmed.slice(option.dialCode.length).replace(/\D/g, "")
      return { countryCode: option.code, nationalNumber: rest }
    }
  }

  const digits = trimmed.replace(/\D/g, "")
  return { countryCode: fallbackCountryCode, nationalNumber: digits }
}
