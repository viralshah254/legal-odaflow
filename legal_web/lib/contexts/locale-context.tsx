"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  getAllLocaleOptions,
  getDefaultLocaleForCountry,
  getLocaleDefinition,
  isLocaleValidForCountry,
  isRtlLocale,
  isSupportedLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  type LocaleDefinition,
} from "@/lib/i18n/locales"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useAuth } from "@/lib/contexts/auth-context"

interface LocaleContextType {
  locale: string
  localeDefinition: LocaleDefinition
  isRtl: boolean
  availableLocales: LocaleDefinition[]
  setLocale: (code: string) => Promise<void>
  isLoading: boolean
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

function persistLocale(code: string) {
  if (typeof document !== "undefined") {
    const secureSuffix =
      process.env.NODE_ENV === "production" ? ";Secure" : ""
    document.cookie = `${LOCALE_COOKIE_NAME}=${code};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax${secureSuffix}`
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
  }
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale: string
}) {
  const { countryCode } = useDetectedCountry()
  const { isAuthenticated } = useAuth()
  const [locale, setLocaleState] = useState(() => normalizeLocale(initialLocale))
  const [isLoading, setIsLoading] = useState(false)

  const availableLocales = useMemo(() => getAllLocaleOptions(), [])

  // Server cookie is source of truth — keep client state and storage aligned after navigation/refresh.
  useEffect(() => {
    const serverLocale = normalizeLocale(initialLocale)
    const valid =
      isLocaleValidForCountry(serverLocale, countryCode)
        ? serverLocale
        : getDefaultLocaleForCountry(countryCode)
    setLocaleState(valid)
    persistLocale(valid)
  }, [initialLocale, countryCode])

  // Hydrate locale from server preferences when signed in and no local override.
  useEffect(() => {
    if (!isAuthenticated) return
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LOCALE_STORAGE_KEY)
        : null
    if (stored && isLocaleValidForCountry(normalizeLocale(stored), countryCode)) {
      return
    }
    void import("@/lib/api/profile")
      .then(({ getMyPreferences }) => getMyPreferences())
      .then((prefs) => {
        const preferred = prefs.preferredLocale
        if (
          preferred &&
          isLocaleValidForCountry(normalizeLocale(preferred), countryCode)
        ) {
          const normalized = normalizeLocale(preferred)
          setLocaleState(normalized)
          persistLocale(normalized)
        }
      })
      .catch(() => {
        /* non-blocking */
      })
  }, [isAuthenticated, countryCode])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale
      document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr"
    }
  }, [locale])

  const setLocale = useCallback(
    async (code: string) => {
      const normalized = normalizeLocale(code)
      if (!isSupportedLocale(normalized)) return
      setIsLoading(true)
      persistLocale(normalized)
      // Reload immediately so next-intl server messages match the cookie.
      // Backend sync is best-effort and must not block the reload.
      void import("@/lib/api/profile")
        .then(({ updateMyPreferences }) =>
          updateMyPreferences({ preferredLocale: normalized }),
        )
        .catch(() => {
          /* non-blocking if user is not signed in */
        })
      window.location.reload()
    },
    [countryCode],
  )

  const value = useMemo(
    () => ({
      locale,
      localeDefinition: getLocaleDefinition(locale),
      isRtl: isRtlLocale(locale),
      availableLocales,
      setLocale,
      isLoading,
    }),
    [locale, availableLocales, setLocale, isLoading],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider")
  }
  return context
}

export {
  getLocalesForCountry,
  isLocaleValidForCountry,
  getLocaleDefinition,
} from "@/lib/i18n/locales"
