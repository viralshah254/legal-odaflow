/** Locale configuration mirrored from shared/i18n/locales.config.ts */

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE'
export const LOCALE_STORAGE_KEY = 'umbrella_locale'
/** Set when the user confirms language on the landing issue checker. */
export const ISSUE_INTAKE_LOCALE_CONFIRMED_KEY = 'umbrella_issue_intake_locale_confirmed'

export interface LocaleDefinition {
  code: string
  englishName: string
  nativeName: string
  rtl: boolean
  bcp47: string
}

export const ALL_LOCALES: Record<string, LocaleDefinition> = {
  en: { code: 'en', englishName: 'English', nativeName: 'English', rtl: false, bcp47: 'en' },
  fr: { code: 'fr', englishName: 'French', nativeName: 'Français', rtl: false, bcp47: 'fr' },
  de: { code: 'de', englishName: 'German', nativeName: 'Deutsch', rtl: false, bcp47: 'de' },
  hi: { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', rtl: false, bcp47: 'hi' },
  bn: { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', rtl: false, bcp47: 'bn' },
  te: { code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', rtl: false, bcp47: 'te' },
  mr: { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', rtl: false, bcp47: 'mr' },
  ta: { code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', rtl: false, bcp47: 'ta' },
  gu: { code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false, bcp47: 'gu' },
  kn: { code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', rtl: false, bcp47: 'kn' },
  ml: { code: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം', rtl: false, bcp47: 'ml' },
  ur: { code: 'ur', englishName: 'Urdu', nativeName: 'اردو', rtl: true, bcp47: 'ur' },
  pa: { code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', rtl: false, bcp47: 'pa' },
  or: { code: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', rtl: false, bcp47: 'or' },
  as: { code: 'as', englishName: 'Assamese', nativeName: 'অসমীয়া', rtl: false, bcp47: 'as' },
}

export const SUPPORTED_LOCALE_CODES = Object.keys(ALL_LOCALES)

export const INDIA_LOCALE_CODES = [
  'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as',
] as const

export const GLOBAL_LOCALE_CODES = ['en', 'fr', 'de'] as const

export function getLocalesForCountry(countryCode: string): string[] {
  if (countryCode.toUpperCase() === 'IN') {
    return [...INDIA_LOCALE_CODES]
  }
  return [...GLOBAL_LOCALE_CODES]
}

/** Primary quick-pick languages on the landing page (non-India). */
export function getPrimaryLocaleCodesForCountry(countryCode: string): string[] {
  return getLocalesForCountry(countryCode)
}

/** Compact landing picker: en/hi for India, en/fr/de elsewhere. @deprecated Use getLandingLocaleOptionsOrdered */
export function getLandingQuickPickLocaleCodes(countryCode: string): string[] {
  return countryCode.toUpperCase() === 'IN' ? ['en', 'hi'] : ['en', 'fr', 'de']
}

const LANDING_LOCALE_PRIORITY = ['en', 'hi', 'fr', 'de'] as const

/** Languages available on the landing picker for this country. */
export function getLandingLocalePool(countryCode: string): string[] {
  return countryCode.toUpperCase() === 'IN'
    ? getLocalesForCountry(countryCode)
    : SUPPORTED_LOCALE_CODES
}

/** All landing languages in display order: English, Hindi, French, Deutsch, then A–Z. */
export function getLandingLocaleOptionsOrdered(countryCode: string): LocaleDefinition[] {
  const pool = new Set(getLandingLocalePool(countryCode))
  const priority = LANDING_LOCALE_PRIORITY.filter((code) => pool.has(code)).map((code) =>
    getLocaleDefinition(code),
  )
  const prioritySet = new Set(LANDING_LOCALE_PRIORITY)
  const rest = [...pool]
    .filter((code) => !prioritySet.has(code as (typeof LANDING_LOCALE_PRIORITY)[number]))
    .map((code) => getLocaleDefinition(code))
    .sort((a, b) => a.englishName.localeCompare(b.englishName))
  return [...priority, ...rest]
}

/** Remaining languages for the landing page dropdown (scroll in overlay, not page). @deprecated Use getLandingLocaleOptionsOrdered */
export function getLandingOtherLocaleOptions(countryCode: string): LocaleDefinition[] {
  const quickPick = new Set(getLandingQuickPickLocaleCodes(countryCode))
  const pool =
    countryCode.toUpperCase() === 'IN' ? getLocalesForCountry(countryCode) : SUPPORTED_LOCALE_CODES
  return pool
    .filter((code) => !quickPick.has(code))
    .map((code) => getLocaleDefinition(code))
    .sort((a, b) => a.englishName.localeCompare(b.englishName))
}

export function isSupportedLocale(locale: string): boolean {
  return SUPPORTED_LOCALE_CODES.includes(normalizeLocale(locale))
}

export function isLocaleValidForCountry(locale: string, _countryCode: string): boolean {
  return isSupportedLocale(locale)
}

export function getAllLocaleOptions(): LocaleDefinition[] {
  return SUPPORTED_LOCALE_CODES.map((code) => getLocaleDefinition(code))
}

/** All app languages except the primary set for this country (for the "Other languages" dropdown). */
export function getOtherLocaleOptions(countryCode: string): LocaleDefinition[] {
  const primary = new Set(getPrimaryLocaleCodesForCountry(countryCode))
  return SUPPORTED_LOCALE_CODES.filter((code) => !primary.has(code))
    .map((code) => getLocaleDefinition(code))
    .sort((a, b) => a.englishName.localeCompare(b.englishName))
}

export function getDefaultLocaleForCountry(_countryCode: string): string {
  return 'en'
}

export function getLocaleOptionsForCountry(countryCode: string): LocaleDefinition[] {
  return getLocalesForCountry(countryCode).map((code) => getLocaleDefinition(code))
}

export function pickDefaultLocaleForCountry(
  countryCode: string,
  preferred?: string | null,
): string {
  const normalizedPreferred = normalizeLocale(preferred)
  if (isSupportedLocale(normalizedPreferred)) return normalizedPreferred

  const primary = getLocalesForCountry(countryCode)
  if (typeof navigator !== "undefined") {
    const browser = normalizeLocale(navigator.language)
    if (primary.includes(browser)) return browser
    if (isSupportedLocale(browser)) return browser
  }

  return getDefaultLocaleForCountry(countryCode)
}

export function isRtlLocale(locale: string): boolean {
  return ALL_LOCALES[locale]?.rtl ?? false
}

export function getLocaleDefinition(code: string): LocaleDefinition {
  return ALL_LOCALES[code] ?? ALL_LOCALES.en
}

export function normalizeLocale(value: string | null | undefined): string {
  if (!value) return 'en'
  const base = value.split('-')[0]?.toLowerCase()
  if (base && ALL_LOCALES[base]) return base
  return 'en'
}
