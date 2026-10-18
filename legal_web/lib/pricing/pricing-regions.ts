import { currencyForCountry } from "@/lib/pricing/country-pricing"
import { getCountryName } from "@/lib/geo/detect-country"

export const PRICING_REGION_CODES = ["US", "KE", "IN", "GB"] as const

export type PricingRegionCode = (typeof PRICING_REGION_CODES)[number]

export function getPricingRegionLabel(countryCode: string): string {
  const code = countryCode.toUpperCase()
  const currency = currencyForCountry(code)
  const name = getCountryName(code as PricingRegionCode)
  return `${name} (${currency})`
}

export function isPricingRegionCode(code: string): code is PricingRegionCode {
  return PRICING_REGION_CODES.includes(code.toUpperCase() as PricingRegionCode)
}
