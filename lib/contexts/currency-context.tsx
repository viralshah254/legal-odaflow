"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { Currency, CURRENCIES, COUNTRY_TO_CURRENCY, DEFAULT_CURRENCY } from "@/lib/types/currency"

interface CurrencyContextType {
  currency: Currency
  currencyCode: string
  setCurrency: (code: string) => void
  isLoading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

async function detectCurrencyFromIP(): Promise<string> {
  try {
    // Try using ipapi.co (free tier: 1000 requests/day)
    const response = await fetch("https://ipapi.co/json/", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch location")
    }

    const data = await response.json()
    const countryCode = data.country_code

    if (countryCode && COUNTRY_TO_CURRENCY[countryCode]) {
      return COUNTRY_TO_CURRENCY[countryCode]
    }

    // Fallback: try to get currency directly from the API response
    if (data.currency) {
      return data.currency
    }
  } catch (error) {
    console.warn("Failed to detect currency from IP, using default:", error)
  }

  // Fallback to default currency
  return DEFAULT_CURRENCY
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<string>(DEFAULT_CURRENCY)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function initializeCurrency() {
      // Check if currency is saved in localStorage
      const savedCurrency = localStorage.getItem("user-currency")
      if (savedCurrency && CURRENCIES[savedCurrency]) {
        setCurrencyCode(savedCurrency)
        setIsLoading(false)
        return
      }

      // Try to detect from IP
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

    initializeCurrency()
  }, [])

  const setCurrency = (code: string) => {
    if (CURRENCIES[code]) {
      setCurrencyCode(code)
      localStorage.setItem("user-currency", code)
    }
  }

  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY]

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




