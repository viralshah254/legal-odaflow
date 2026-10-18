"use client"

import { useMemo } from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getDefaultCountryCode } from "@/lib/geo/detect-country"

/**
 * Default dial-code country for phone inputs.
 *
 * Priority:
 *   1. Live geo (IP / browser geolocation / locale)
 *   2. User profile country from onboarding
 *   3. Firm tenant primary country
 *   4. Env default or US
 */
export function useDefaultPhoneCountry(): { countryCode: string; isLoading: boolean } {
  const { user } = useAuth()
  const { countryCode: detected, detectionSource, isLoading } = useDetectedCountry()
  const { activeTenant } = useTenant()

  const countryCode = useMemo(() => {
    if (isLoading) return ""

    const geoResolved =
      detected &&
      detectionSource &&
      detectionSource !== "default" &&
      detectionSource !== "stored"

    if (geoResolved) return detected
    if (user?.countryCode) return user.countryCode
    if (activeTenant?.tenant.primaryCountry) return activeTenant.tenant.primaryCountry
    return detected || getDefaultCountryCode() || "US"
  }, [
    detected,
    detectionSource,
    isLoading,
    user?.countryCode,
    activeTenant?.tenant.primaryCountry,
  ])

  return { countryCode, isLoading }
}
