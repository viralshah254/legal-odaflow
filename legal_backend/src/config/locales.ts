import { getCountryConfig } from '@/config/countries';

export const LOCALE_DEFINITIONS: Record<
  string,
  { code: string; englishName: string; nativeName: string; rtl: boolean }
> = {
  en: { code: 'en', englishName: 'English', nativeName: 'English', rtl: false },
  fr: { code: 'fr', englishName: 'French', nativeName: 'Français', rtl: false },
  de: { code: 'de', englishName: 'German', nativeName: 'Deutsch', rtl: false },
  hi: { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', rtl: false },
  bn: { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', rtl: false },
  te: { code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', rtl: false },
  mr: { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', rtl: false },
  ta: { code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', rtl: false },
  gu: { code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false },
  kn: { code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', rtl: false },
  ml: { code: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം', rtl: false },
  ur: { code: 'ur', englishName: 'Urdu', nativeName: 'اردو', rtl: true },
  pa: { code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', rtl: false },
  or: { code: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', rtl: false },
  as: { code: 'as', englishName: 'Assamese', nativeName: 'অসমীয়া', rtl: false },
};

export function getLanguageNameForAi(locale: string): string {
  return LOCALE_DEFINITIONS[locale]?.englishName ?? 'English';
}

export function normalizeLocale(value?: string | null): string {
  if (!value) return 'en';
  const base = value.split('-')[0]?.toLowerCase();
  if (base && LOCALE_DEFINITIONS[base]) return base;
  return 'en';
}

export function isLocaleValidForCountry(locale: string, countryCode: string): boolean {
  try {
    const config = getCountryConfig(countryCode);
    return config.supportedUiLocales.includes(locale);
  } catch {
    return locale === 'en';
  }
}

export const INDIA_LOCALE_CODES = [
  'en',
  'hi',
  'bn',
  'te',
  'mr',
  'ta',
  'gu',
  'kn',
  'ml',
  'ur',
  'pa',
  'or',
  'as',
] as const;

export type IndiaLocaleCode = (typeof INDIA_LOCALE_CODES)[number];

const DRAFT_SCRIPT_HINTS: Partial<Record<string, string>> = {
  hi: 'Devanagari script',
  mr: 'Devanagari script',
  bn: 'Bengali script',
  as: 'Assamese script',
  te: 'Telugu script',
  ta: 'Tamil script',
  gu: 'Gujarati script',
  kn: 'Kannada script',
  ml: 'Malayalam script',
  ur: 'Perso-Arabic (Nastaliq) script',
  pa: 'Gurmukhi script',
  or: 'Odia script',
};

export function buildLocalePromptInstruction(locale?: string | null): string {
  const normalized = normalizeLocale(locale);
  if (normalized === 'en') return '';
  const languageName = getLanguageNameForAi(normalized);
  return `Respond entirely in ${languageName}. Use formal legal register appropriate for ${languageName}-speaking users.`;
}

export function buildDraftLanguageInstruction(locale?: string | null): string {
  const normalized = normalizeLocale(locale);
  if (normalized === 'en') return '';
  const languageName = getLanguageNameForAi(normalized);
  const scriptHint = DRAFT_SCRIPT_HINTS[normalized];
  const scriptPart = scriptHint ? ` (${scriptHint})` : '';
  return `\n\nDraft the entire document in ${languageName}${scriptPart}. Use formal legal register appropriate for Indian courts. Court headings and clause numbering may follow standard English legal format where customary, but the substantive text must be in ${languageName}.`;
}

/** Parse the first supported locale from an Accept-Language header value. */
export function resolveLocaleFromAcceptLanguage(header?: string | null): string {
  if (!header) return 'en';
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim();
    if (!tag) continue;
    const normalized = normalizeLocale(tag);
    if (LOCALE_DEFINITIONS[normalized]) return normalized;
  }
  return 'en';
}

/** Resolve locale for an AI request: Accept-Language → user preference → en. */
export function resolveRequestLocale(
  acceptLanguage?: string | null,
  userPreferredLocale?: string | null,
): string {
  if (acceptLanguage?.trim()) {
    return resolveLocaleFromAcceptLanguage(acceptLanguage);
  }
  if (userPreferredLocale?.trim()) {
    return normalizeLocale(userPreferredLocale);
  }
  return 'en';
}
