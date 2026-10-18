import { apiFetch } from "./client"
import type { CountryCode } from "./types"

export interface CountryConfig {
  code: CountryCode
  name: string
  currency: string
  currencySymbol?: string
  defaultLocale?: string
  dataRegion?: string
  timezone?: string
  paymentProviders?: string[]
  defaultPaymentProvider?: string
  consumerFreePreviews?: number
  supportedJurisdictions: string[]
}

export async function getCountries(): Promise<CountryConfig[]> {
  return apiFetch<CountryConfig[]>("/config/countries", { auth: false })
}

export async function getJurisdictions(
  countryCode: CountryCode,
): Promise<{ countryCode: string; countryName: string; jurisdictions: string[] }> {
  return apiFetch(`/config/countries/${countryCode}/jurisdictions`, { auth: false })
}
