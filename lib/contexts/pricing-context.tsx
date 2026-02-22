"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import {
  LocationPricing,
  getPricingForCountry,
  DEFAULT_PRICING,
  calculateAnnualPrice,
} from "@/lib/types/pricing"

interface PricingContextType {
  pricing: LocationPricing
  countryCode: string
  countryName: string
  isLoading: boolean
  billingCycle: "monthly" | "annual"
  setBillingCycle: (cycle: "monthly" | "annual") => void
  getPricePerUser: () => number
  getAnnualPricePerUser: () => number
}

const PricingContext = createContext<PricingContextType | undefined>(undefined)

async function detectLocationFromIP(): Promise<{ countryCode: string; countryName: string }> {
  try {
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
    const countryName = data.country_name || "Unknown"

    if (countryCode) {
      return { countryCode, countryName }
    }
  } catch (error) {
    console.warn("Failed to detect location from IP, using default:", error)
  }

  // Fallback to default
  return {
    countryCode: DEFAULT_PRICING.countryCode,
    countryName: DEFAULT_PRICING.countryName,
  }
}

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const [pricing, setPricing] = useState<LocationPricing>(DEFAULT_PRICING)
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_PRICING.countryCode)
  const [countryName, setCountryName] = useState<string>(DEFAULT_PRICING.countryName)
  const [isLoading, setIsLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")

  useEffect(() => {
    async function initializePricing() {
      // Check if pricing is saved in localStorage
      const savedCountryCode = localStorage.getItem("user-country-code")
      const savedCountryName = localStorage.getItem("user-country-name")
      
      if (savedCountryCode && savedCountryName) {
        const savedPricing = getPricingForCountry(savedCountryCode)
        if (savedPricing) {
          setPricing(savedPricing)
          setCountryCode(savedCountryCode)
          setCountryName(savedCountryName)
          setIsLoading(false)
          return
        }
      }

      // Try to detect from IP
      try {
        const { countryCode: detectedCode, countryName: detectedName } = await detectLocationFromIP()
        const detectedPricing = getPricingForCountry(detectedCode)
        
        setPricing(detectedPricing)
        setCountryCode(detectedCode)
        setCountryName(detectedName)
        
        localStorage.setItem("user-country-code", detectedCode)
        localStorage.setItem("user-country-name", detectedName)
      } catch (error) {
        console.warn("Pricing detection failed, using default:", error)
        setPricing(DEFAULT_PRICING)
        setCountryCode(DEFAULT_PRICING.countryCode)
        setCountryName(DEFAULT_PRICING.countryName)
      } finally {
        setIsLoading(false)
      }
    }

    initializePricing()
  }, [])

  // Load billing cycle preference
  useEffect(() => {
    const savedBillingCycle = localStorage.getItem("billing-cycle") as "monthly" | "annual" | null
    if (savedBillingCycle === "monthly" || savedBillingCycle === "annual") {
      setBillingCycle(savedBillingCycle)
    }
  }, [])

  const handleSetBillingCycle = (cycle: "monthly" | "annual") => {
    setBillingCycle(cycle)
    localStorage.setItem("billing-cycle", cycle)
  }

  const getPricePerUser = (): number => {
    return pricing.pricePerUser
  }

  const getAnnualPricePerUser = (): number => {
    return calculateAnnualPrice(pricing.pricePerUser, pricing.annualDiscount)
  }

  return (
    <PricingContext.Provider
      value={{
        pricing,
        countryCode,
        countryName,
        isLoading,
        billingCycle,
        setBillingCycle: handleSetBillingCycle,
        getPricePerUser,
        getAnnualPricePerUser,
      }}
    >
      {children}
    </PricingContext.Provider>
  )
}

export function usePricing() {
  const context = useContext(PricingContext)
  if (context === undefined) {
    throw new Error("usePricing must be used within a PricingProvider")
  }
  return context
}




