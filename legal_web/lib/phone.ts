/**
 * Phone number utilities: country dial codes, validation, normalization, and deduplication.
 *
 * Normalization strips all non-digit characters and builds a canonical
 * "+{dialCode}{localDigits}" string so two numbers entered in different
 * formats (spaces, dashes, parentheses) are recognised as identical.
 */

export interface PhoneCountry {
  iso2: string
  name: string
  dialCode: string
  flag: string
  /** Regex applied to the LOCAL part (after the dial code is stripped). */
  pattern: RegExp
  /** Example display format for the placeholder. */
  example: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso2: "US", name: "United States",   dialCode: "1",   flag: "🇺🇸", pattern: /^\d{10}$/,          example: "201 555 0123" },
  { iso2: "CA", name: "Canada",          dialCode: "1",   flag: "🇨🇦", pattern: /^\d{10}$/,          example: "416 555 0123" },
  { iso2: "GB", name: "United Kingdom",  dialCode: "44",  flag: "🇬🇧", pattern: /^\d{10,11}$/,       example: "7911 123456" },
  { iso2: "IN", name: "India",           dialCode: "91",  flag: "🇮🇳", pattern: /^[6-9]\d{9}$/,      example: "98765 43210" },
  { iso2: "KE", name: "Kenya",           dialCode: "254", flag: "🇰🇪", pattern: /^\d{9}$/,           example: "712 345678" },
  { iso2: "TZ", name: "Tanzania",        dialCode: "255", flag: "🇹🇿", pattern: /^\d{9}$/,           example: "712 345678" },
  { iso2: "UG", name: "Uganda",          dialCode: "256", flag: "🇺🇬", pattern: /^\d{9}$/,           example: "712 345678" },
  { iso2: "RW", name: "Rwanda",          dialCode: "250", flag: "🇷🇼", pattern: /^\d{9}$/,           example: "781 234567" },
  { iso2: "NG", name: "Nigeria",         dialCode: "234", flag: "🇳🇬", pattern: /^\d{10}$/,          example: "8012 345678" },
  { iso2: "GH", name: "Ghana",           dialCode: "233", flag: "🇬🇭", pattern: /^\d{9}$/,           example: "242 345678" },
  { iso2: "ZA", name: "South Africa",    dialCode: "27",  flag: "🇿🇦", pattern: /^\d{9}$/,           example: "82 345 6789" },
  { iso2: "AU", name: "Australia",       dialCode: "61",  flag: "🇦🇺", pattern: /^\d{9,10}$/,        example: "412 345 678" },
  { iso2: "NZ", name: "New Zealand",     dialCode: "64",  flag: "🇳🇿", pattern: /^\d{8,10}$/,        example: "21 123 4567" },
  { iso2: "SG", name: "Singapore",       dialCode: "65",  flag: "🇸🇬", pattern: /^\d{8}$/,           example: "9123 4567" },
  { iso2: "AE", name: "UAE",             dialCode: "971", flag: "🇦🇪", pattern: /^\d{9}$/,           example: "50 123 4567" },
  { iso2: "PK", name: "Pakistan",        dialCode: "92",  flag: "🇵🇰", pattern: /^\d{10}$/,          example: "301 2345678" },
  { iso2: "BD", name: "Bangladesh",      dialCode: "880", flag: "🇧🇩", pattern: /^\d{10}$/,          example: "1712 345678" },
  { iso2: "DE", name: "Germany",         dialCode: "49",  flag: "🇩🇪", pattern: /^\d{10,12}$/,       example: "1512 3456789" },
  { iso2: "FR", name: "France",          dialCode: "33",  flag: "🇫🇷", pattern: /^\d{9}$/,           example: "6 12 34 56 78" },
  { iso2: "IE", name: "Ireland",         dialCode: "353", flag: "🇮🇪", pattern: /^\d{9}$/,           example: "83 123 4567" },
]

/** Map from ISO-2 country code to PhoneCountry entry. */
const BY_ISO2 = Object.fromEntries(PHONE_COUNTRIES.map((c) => [c.iso2, c]))

/** Puts [preferredIso2] first in the list (when present), preserving relative order of the rest. */
export function orderPhoneCountries(
  countries: PhoneCountry[],
  preferredIso2?: string | null,
): PhoneCountry[] {
  const preferred = preferredIso2?.toUpperCase()
  if (!preferred) return countries
  const match = countries.find((c) => c.iso2 === preferred)
  if (!match) return countries
  return [match, ...countries.filter((c) => c.iso2 !== preferred)]
}

/** Get PhoneCountry by ISO-2 code, defaulting to US. */
export function getPhoneCountry(iso2: string): PhoneCountry {
  return BY_ISO2[iso2.toUpperCase()] ?? PHONE_COUNTRIES[0]
}

/**
 * Strip all non-digit characters from a string.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Normalise a phone number to E.164-like format: "+{dialCode}{localDigits}".
 * Returns null if input is clearly empty.
 */
export function normalizePhone(dialCode: string, local: string): string | null {
  const localDigits = digitsOnly(local)
  if (!localDigits) return null
  return `+${digitsOnly(dialCode)}${localDigits}`
}

/**
 * Validate the LOCAL part of a number against its country pattern.
 */
export function validatePhone(country: PhoneCountry, local: string): boolean {
  const localDigits = digitsOnly(local)
  return country.pattern.test(localDigits)
}

/**
 * Parse a full phone string (e.g. "+91 98765 43210", "0091…", "+19…") into
 * { country, local } by trying each dial code from longest to shortest.
 * Falls back to US if no match.
 */
export function parsePhone(full: string): { country: PhoneCountry; local: string } {
  if (!full) return { country: PHONE_COUNTRIES[0], local: "" }

  let digits = digitsOnly(full)

  // Strip leading zeros used in some "international" formats (e.g. 0091…)
  if (digits.startsWith("00")) digits = digits.slice(2)

  // Try longest dial codes first to avoid "1" matching before "91"
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const c of sorted) {
    if (digits.startsWith(c.dialCode)) {
      return { country: c, local: digits.slice(c.dialCode.length) }
    }
  }

  return { country: PHONE_COUNTRIES[0], local: digits }
}

/**
 * Returns true if two phone numbers normalise to the same canonical form.
 * Used for server-side or client-side duplicate detection.
 */
export function isSamePhone(a: string, b: string): boolean {
  if (!a || !b) return false
  const dA = digitsOnly(a)
  const dB = digitsOnly(b)
  if (!dA || !dB) return false
  // Compare the last 9 digits as a fast local-number match
  return dA.slice(-9) === dB.slice(-9) && dA === dB
}

/**
 * Fuzzy-match: two numbers are likely the same if their last 9 digits match
 * AND neither is shorter than 7 digits. This catches +1-XXX vs 1-XXX etc.
 */
export function isFuzzyDuplicate(a: string, b: string): boolean {
  const dA = digitsOnly(a)
  const dB = digitsOnly(b)
  if (dA.length < 7 || dB.length < 7) return false
  return dA.slice(-9) === dB.slice(-9)
}

/**
 * Best-effort country guess from a country code string (ISO-2).
 */
export function countryToPhoneCountry(iso2: string | undefined | null): PhoneCountry {
  if (!iso2) return PHONE_COUNTRIES[0]
  return BY_ISO2[iso2.toUpperCase()] ?? PHONE_COUNTRIES[0]
}
