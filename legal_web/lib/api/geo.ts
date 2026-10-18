import { apiFetch } from "./client"

export interface GeoDetectResult {
  countryCode: string
  countryName: string
  source: "cf-ipcountry" | "ipapi" | "default"
  detectedRaw?: string
  region?: string
}

export interface ClientGeoDetectResult {
  countryCode: string
  regionCode?: string | null
  regionName?: string | null
  source: "cf-ipcountry" | "ipapi" | "default" | "none" | "backend-ipapi"
}

/** Tier-1 billing geo (legacy mobile / pricing paths). */
export async function detectBillingCountry(forwardedFor?: string): Promise<GeoDetectResult> {
  const headers: HeadersInit = {}
  if (forwardedFor) {
    headers["x-forwarded-for"] = forwardedFor
  }

  return apiFetch<GeoDetectResult>("/geo/detect", {
    auth: false,
    headers,
  })
}

/** Raw ISO country + region for web issue-checker (any country code). */
export async function detectClientGeoFromBackend(): Promise<ClientGeoDetectResult> {
  return apiFetch<ClientGeoDetectResult>("/geo/client", {
    auth: false,
  })
}

/** @deprecated Use detectBillingCountry */
export const detectCountry = detectBillingCountry
