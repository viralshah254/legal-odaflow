"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { LocationPricing } from "@/lib/types/pricing"
import {
  getPricingForCountry,
  DEFAULT_PRICING,
  calculateAnnualPrice,
  getProfessionalPricePerUser as getProPricePerUser,
} from "@/lib/types/pricing"
import { detectCountry, persistCountrySelection } from "@/lib/geo/detect-country"
import { useTenant } from "@/lib/contexts/tenant-context"

interface PricingContextType {
  pricing: LocationPricing
  countryCode: string
  countryName: string
  isLoading: boolean
  billingCycle: "monthly" | "annual"
  setBillingCycle: (cycle: "monthly" | "annual") => void
  getPricePerUser: () => number
  getProfessionalPricePerUser: () => number
  getAnnualPricePerUser: () => number
}

const PricingContext = createContext<PricingContextType | undefined>(undefined)

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const { activeTenant } = useTenant()
  const [pricing, setPricing] = useState<LocationPricing>(DEFAULT_PRICING)
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_PRICING.countryCode)
  const [countryName, setCountryName] = useState<string>(DEFAULT_PRICING.countryName)
  const [isLoading, setIsLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")

  // Firm dashboard: price tiers follow tenant country, not geo/IP alone.
  useEffect(() => {
    const tenantCountry = activeTenant?.tenant.primaryCountry?.toUpperCase()
    if (!tenantCountry) return
    const tenantPricing = getPricingForCountry(tenantCountry)
    setPricing(tenantPricing)
    setCountryCode(tenantPricing.countryCode)
    setCountryName(tenantPricing.countryName)
  }, [activeTenant?.tenant.primaryCountry])

  useEffect(() => {
    async function initializePricing() {
      // Logged-in firm: tenant country wins over geo/localStorage
      const tenantCountry = activeTenant?.tenant.primaryCountry?.toUpperCase()
      if (tenantCountry) {
        const tenantPricing = getPricingForCountry(tenantCountry)
        setPricing(tenantPricing)
        setCountryCode(tenantPricing.countryCode)
        setCountryName(tenantPricing.countryName)
        setIsLoading(false)
        return
      }

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

      try {
        const detected = await detectCountry({ preferStored: true })
        const detectedPricing = getPricingForCountry(detected.countryCode)

        setPricing(detectedPricing)
        setCountryCode(detected.countryCode)
        setCountryName(detectedPricing.countryName)

        persistCountrySelection(detected.countryCode)
        localStorage.setItem("user-country-code", detected.countryCode)
        localStorage.setItem("user-country-name", detectedPricing.countryName)
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
  }, [activeTenant?.tenant.primaryCountry])

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

  const getProfessionalPricePerUser = (): number => {
    return getProPricePerUser(pricing)
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
        getProfessionalPricePerUser,
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




