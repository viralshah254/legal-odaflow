/** Canonical locale configuration — single source of truth for web, app, and backend. */

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE'
export const LOCALE_STORAGE_KEY = 'umbrella_locale'

export interface LocaleDefinition {
  code: string
  englishName: string
  nativeName: string
  rtl: boolean
  /** BCP 47 tag for Intl APIs */
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

export const I18N_NAMESPACES = [
  'common',
  'auth',
  'marketing',
  'legalGuides',
  'issueChecker',
  'consumer',
  'lawyer',
  'admin',
  'legal',
  'settings',
] as const

export type I18nNamespace = (typeof I18N_NAMESPACES)[number]

/** Languages available per country code */
export function getLocalesForCountry(countryCode: string): string[] {
  if (countryCode.toUpperCase() === 'IN') {
    return [...INDIA_LOCALE_CODES]
  }
  return [...GLOBAL_LOCALE_CODES]
}

export function isLocaleValidForCountry(locale: string, countryCode: string): boolean {
  return getLocalesForCountry(countryCode).includes(locale)
}

export function getDefaultLocaleForCountry(countryCode: string): string {
  return 'en'
}

export function getLocaleOptionsForCountry(countryCode: string): LocaleDefinition[] {
  return getLocalesForCountry(countryCode).map((code) => ALL_LOCALES[code] ?? ALL_LOCALES.en)
}

export function pickDefaultLocaleForCountry(
  countryCode: string,
  preferred?: string | null,
): string {
  const codes = getLocalesForCountry(countryCode)
  const normalizedPreferred = preferred?.split('-')[0]?.toLowerCase()
  if (normalizedPreferred && codes.includes(normalizedPreferred)) return normalizedPreferred
  return getDefaultLocaleForCountry(countryCode)
}

export function isRtlLocale(locale: string): boolean {
  return ALL_LOCALES[locale]?.rtl ?? false
}

export function getLanguageNameForAi(locale: string): string {
  return ALL_LOCALES[locale]?.englishName ?? 'English'
}
