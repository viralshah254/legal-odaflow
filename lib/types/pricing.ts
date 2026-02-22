export interface PricingTier {
  name: string
  pricePerUser: number // Base price per user per month
  currency: string
  currencySymbol: string
  features: string[]
  maxUsers?: number
  popular?: boolean
}

export interface LocationPricing {
  countryCode: string
  countryName: string
  currency: string
  currencySymbol: string
  pricePerUser: number // Starter: per seat/month
  professionalPricePerUser?: number // Professional plan per seat/month (defaults to pricePerUser * 1.5 if unset)
  annualDiscount: number // Percentage discount for annual (e.g., 20)
}

// Pricing tiers - feature-based packages (per seat/month)
export const PRICING_TIERS = {
  STARTER: {
    name: "Starter",
    features: [
      "Unlimited clients & matters",
      "Tasks, calendar & matters",
      "Basic reporting",
      "Email support",
    ],
  },
  PROFESSIONAL: {
    name: "Professional",
    features: [
      "Everything in Starter",
      "Copilot (AI assistant)",
      "Meeting transcripts & recording",
      "Advanced reporting",
      "Client portal",
      "API access",
      "Priority support",
    ],
    popular: true,
  },
  ENTERPRISE: {
    name: "Enterprise",
    features: [
      "Everything in Professional",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
      "On-premise option",
    ],
  },
}

// Location-based pricing mapping
export const LOCATION_PRICING: Record<string, LocationPricing> = {
  // US and Canada
  US: {
    countryCode: "US",
    countryName: "United States",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 20,
    professionalPricePerUser: 25,
    annualDiscount: 20,
  },
  CA: {
    countryCode: "CA",
    countryName: "Canada",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 20,
    professionalPricePerUser: 25,
    annualDiscount: 20,
  },
  // UK
  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    currency: "GBP",
    currencySymbol: "£",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  // European Union countries
  IE: {
    countryCode: "IE",
    countryName: "Ireland",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  FR: {
    countryCode: "FR",
    countryName: "France",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  DE: {
    countryCode: "DE",
    countryName: "Germany",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  IT: {
    countryCode: "IT",
    countryName: "Italy",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  ES: {
    countryCode: "ES",
    countryName: "Spain",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  NL: {
    countryCode: "NL",
    countryName: "Netherlands",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  BE: {
    countryCode: "BE",
    countryName: "Belgium",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  AT: {
    countryCode: "AT",
    countryName: "Austria",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  PT: {
    countryCode: "PT",
    countryName: "Portugal",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  // Add more EU countries
  GR: {
    countryCode: "GR",
    countryName: "Greece",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  FI: {
    countryCode: "FI",
    countryName: "Finland",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  SE: {
    countryCode: "SE",
    countryName: "Sweden",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  DK: {
    countryCode: "DK",
    countryName: "Denmark",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  PL: {
    countryCode: "PL",
    countryName: "Poland",
    currency: "EUR",
    currencySymbol: "€",
    pricePerUser: 20,
    annualDiscount: 20,
  },
  // Africa - $15 per user
  KE: {
    countryCode: "KE",
    countryName: "Kenya",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  NG: {
    countryCode: "NG",
    countryName: "Nigeria",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  ZA: {
    countryCode: "ZA",
    countryName: "South Africa",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  EG: {
    countryCode: "EG",
    countryName: "Egypt",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  GH: {
    countryCode: "GH",
    countryName: "Ghana",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  TZ: {
    countryCode: "TZ",
    countryName: "Tanzania",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  UG: {
    countryCode: "UG",
    countryName: "Uganda",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  ET: {
    countryCode: "ET",
    countryName: "Ethiopia",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  RW: {
    countryCode: "RW",
    countryName: "Rwanda",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  MW: {
    countryCode: "MW",
    countryName: "Malawi",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  ZW: {
    countryCode: "ZW",
    countryName: "Zimbabwe",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  ZM: {
    countryCode: "ZM",
    countryName: "Zambia",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  BW: {
    countryCode: "BW",
    countryName: "Botswana",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  MZ: {
    countryCode: "MZ",
    countryName: "Mozambique",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  AO: {
    countryCode: "AO",
    countryName: "Angola",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  SN: {
    countryCode: "SN",
    countryName: "Senegal",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  CI: {
    countryCode: "CI",
    countryName: "Ivory Coast",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  CM: {
    countryCode: "CM",
    countryName: "Cameroon",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
  // India - $15 per user
  IN: {
    countryCode: "IN",
    countryName: "India",
    currency: "USD",
    currencySymbol: "$",
    pricePerUser: 15,
    annualDiscount: 20,
  },
}

// Default pricing (fallback)
export const DEFAULT_PRICING: LocationPricing = {
  countryCode: "US",
  countryName: "United States",
  currency: "USD",
  currencySymbol: "$",
  pricePerUser: 20,
  professionalPricePerUser: 25,
  annualDiscount: 20,
}

/** Professional plan price per seat/month (defaults to Starter * 1.5 if not set). */
export function getProfessionalPricePerUser(pricing: LocationPricing): number {
  return pricing.professionalPricePerUser ?? pricing.pricePerUser * 1.5
}

// Get pricing for a country code
export function getPricingForCountry(countryCode: string): LocationPricing {
  return LOCATION_PRICING[countryCode] || DEFAULT_PRICING
}

// Calculate price with annual discount
export function calculateAnnualPrice(monthlyPrice: number, discount: number): number {
  const annualPrice = monthlyPrice * 12
  const discountAmount = annualPrice * (discount / 100)
  return annualPrice - discountAmount
}

