"use client"

import { useEffect, useState } from "react"
import { getCountries, type CountryConfig } from "@/lib/api/config"

let cachedCountries: CountryConfig[] | null = null
let inflight: Promise<CountryConfig[]> | null = null

function loadResearchCountries(): Promise<CountryConfig[]> {
  if (cachedCountries) return Promise.resolve(cachedCountries)
  if (!inflight) {
    inflight = getCountries()
      .then((data) => {
        cachedCountries = data
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Shared cache for backend tier-1 countries and their supported sub-national jurisdictions. */
export function useResearchCountries() {
  const [countries, setCountries] = useState<CountryConfig[]>(cachedCountries ?? [])
  const [loading, setLoading] = useState(!cachedCountries)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (cachedCountries) {
      setCountries(cachedCountries)
      setLoading(false)
      return
    }

    let cancelled = false
    void loadResearchCountries()
      .then((data) => {
        if (cancelled) return
        setCountries(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { countries, loading, error }
}

export function getCachedResearchCountries(): CountryConfig[] | null {
  return cachedCountries
}

export function findResearchCountry(
  countries: CountryConfig[],
  countryCode: string,
): CountryConfig | undefined {
  const code = countryCode?.toUpperCase()
  return countries.find((country) => country.code.toUpperCase() === code)
}
