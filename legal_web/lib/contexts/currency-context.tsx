"use client"

import React, { createContext, useContext, useState, useEffect, useMemo } from "react"
import {
  Currency,
  COUNTRY_TO_CURRENCY,
  DEFAULT_CURRENCY,
  resolveCurrency,
} from "@/lib/types/currency"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"

interface CurrencyContextType {
  currency: Currency
  currencyCode: string
  setCurrency: (code: string) => void
  isLoading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

async function detectCurrencyFromIP(): Promise<string> {
  try {
    const response = await fetch("https://ipapi.co/json/", {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch location")
    }

    const data = await response.json()
    const countryCode = data.country_code

    if (countryCode && COUNTRY_TO_CURRENCY[countryCode]) {
      return COUNTRY_TO_CURRENCY[countryCode]
    }

    if (data.currency) {
      return String(data.currency).toUpperCase()
    }
  } catch (error) {
    console.warn("Failed to detect currency from IP, using default:", error)
  }

  return DEFAULT_CURRENCY
}

function currencyFromCountry(countryCode?: string | null): string | null {
  if (!countryCode) return null
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? null
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const { activeTenant } = useTenant()
  const [currencyCode, setCurrencyCode] = useState<string>(DEFAULT_CURRENCY)
  const [isLoading, setIsLoading] = useState(true)

  const tenantCurrency = activeTenant?.tenant.defaultCurrency
  const tenantCountry = activeTenant?.tenant.primaryCountry
  const userCountryCurrency = currencyFromCountry(user?.countryCode)

  useEffect(() => {
    async function initializeCurrency() {
      // Firm dashboard: always use tenant billing currency (matches profile / billing page)
      if (tenantCurrency) {
        const code = tenantCurrency.toUpperCase()
        setCurrencyCode(code)
        localStorage.setItem("user-currency", code)
        setIsLoading(false)
        return
      }

      // Authenticated user country (profile selection)
      if (isAuthenticated && userCountryCurrency) {
        setCurrencyCode(userCountryCurrency)
        localStorage.setItem("user-currency", userCountryCurrency)
        setIsLoading(false)
        return
      }

      // Tenant country before tenant currency loads
      const fromTenantCountry = currencyFromCountry(tenantCountry)
      if (fromTenantCountry) {
        setCurrencyCode(fromTenantCountry)
        localStorage.setItem("user-currency", fromTenantCountry)
        setIsLoading(false)
        return
      }

      const savedCurrency = localStorage.getItem("user-currency")
      if (savedCurrency) {
        setCurrencyCode(savedCurrency.toUpperCase())
        setIsLoading(false)
        return
      }

      try {
        const detectedCurrency = await detectCurrencyFromIP()
        setCurrencyCode(detectedCurrency)
        localStorage.setItem("user-currency", detectedCurrency)
      } catch (error) {
        console.warn("Currency detection failed, using default:", error)
        setCurrencyCode(DEFAULT_CURRENCY)
      } finally {
        setIsLoading(false)
      }
    }

    void initializeCurrency()
  }, [
    tenantCurrency,
    tenantCountry,
    userCountryCurrency,
    isAuthenticated,
  ])

  const setCurrency = (code: string) => {
    const normalized = code.toUpperCase()
    setCurrencyCode(normalized)
    localStorage.setItem("user-currency", normalized)
  }

  const currency = useMemo(() => resolveCurrency(currencyCode), [currencyCode])

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyCode,
        setCurrency,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider")
  }
  return context
}
