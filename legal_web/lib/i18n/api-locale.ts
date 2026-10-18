import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, normalizeLocale } from '@/lib/i18n/locales'

/** Read active UI locale for API requests (client-side). */
export function getClientLocale(): string {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`))
    if (match?.[1]) return normalizeLocale(match[1])
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored) return normalizeLocale(stored)
  }
  return 'en'
}

export function localeHeaders(): Record<string, string> {
  return { 'Accept-Language': getClientLocale() }
}
