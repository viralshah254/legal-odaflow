import type { CountryCode } from "@/lib/api/types"

/** Canonical USD list prices — non-USD markets convert at FX + markup. */
export const CANONICAL_PRICING_COUNTRY = "US"
export const CANONICAL_CURRENCY = "USD"
export const FX_MARKUP_PERCENT = 1.5

/**
 * Countries charged at 2× the USD base price.
 * Developing/emerging markets pay 1× for accessibility.
 */
const DEVELOPED_COUNTRY_CODES = new Set([
  "US", "GB", "CA", "AU", "NZ",
  "DE", "FR", "NL", "SE", "NO", "DK", "FI", "CH", "BE", "AT", "IE",
  "JP", "KR", "SG", "AE", "IL", "IT", "ES",
])

/** 2.0 for developed markets, 1.0 for developing/emerging. */
export function getCountryPricingTier(countryCode: string): number {
  return DEVELOPED_COUNTRY_CODES.has(countryCode.toUpperCase()) ? 2.0 : 1.0
}

const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  IN: "INR",
  KE: "KES",
  GB: "GBP",
}

/** Units of local currency per 1 USD (offline fallback when API unavailable). */
const FALLBACK_USD_TO_LOCAL: Record<string, number> = {
  USD: 1,
  INR: 85,
  GBP: 0.80,
  KES: 130,
}

function roundForCurrency(amount: number, currency: string): number {
  const c = currency.toUpperCase()
  if (c === "INR" || c === "KES") return Math.round(amount)
  return Number(amount.toFixed(2))
}

export function convertUsdToLocal(
  usdAmount: number,
  currency: string,
  usdToLocalRate?: number,
  /** Optional — pass the country code to apply 2x tier for developed markets. */
  countryCode?: string,
): number {
  if (usdAmount <= 0) return 0
  const c = currency.toUpperCase()
  const tier = countryCode ? getCountryPricingTier(countryCode) : 1.0
  if (c === "USD") return roundForCurrency(usdAmount * tier, c)
  const rate = usdToLocalRate ?? FALLBACK_USD_TO_LOCAL[c] ?? 1
  const withMarkup = usdAmount * tier * rate * (1 + FX_MARKUP_PERCENT / 100)
  return roundForCurrency(withMarkup, c)
}

export function currencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? CANONICAL_CURRENCY
}

export interface CountryPlan {
  countryCode: CountryCode | string
  userType: "CONSUMER" | "LAW_FIRM"
  planId: string
  currency: string
  amount: number
  aiCredits: number
  features: Record<string, boolean | number | string>
  label?: string
  description?: string
}

const DEFAULT_SUBSCRIPTION_MARGIN_PERCENT = 40
const DEFAULT_CREDIT_USD_VALUE = 0.01
const DEFAULT_INR_TO_USD = 85

function computeCreditsFromLocalPrice(
  localAmount: number,
  currency: string,
  marginPercent = DEFAULT_SUBSCRIPTION_MARGIN_PERCENT,
): number {
  if (localAmount <= 0) return 0
  const rate =
    currency.toUpperCase() === "INR"
      ? 1 / DEFAULT_INR_TO_USD
      : currency.toUpperCase() === "USD"
        ? 1
        : 1
  const paymentUsd = localAmount * rate
  const aiBudgetUsd = paymentUsd * (1 - marginPercent / 100)
  return Math.max(1, Math.floor(aiBudgetUsd / DEFAULT_CREDIT_USD_VALUE))
}

/** Fixed INR list prices for India — mirrors legal_backend pricing.config.ts IN seeds. */
export const INDIA_NATIVE_PLANS: CountryPlan[] = [
  {
    countryCode: "IN",
    userType: "LAW_FIRM",
    planId: "firm_starter",
    currency: "INR",
    amount: 1400,
    aiCredits: computeCreditsFromLocalPrice(1400, "INR"),
    label: "Starter",
    description: "Per seat · Client portal and core firm OS",
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: "IN",
    userType: "LAW_FIRM",
    planId: "firm_professional",
    currency: "INR",
    amount: 6000,
    aiCredits: computeCreditsFromLocalPrice(6000, "INR"),
    label: "Professional",
    description: "Per seat · Copilot, advanced reporting, deep analysis",
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: "IN",
    userType: "LAW_FIRM",
    planId: "firm_pro_plus",
    currency: "INR",
    amount: 30000,
    aiCredits: computeCreditsFromLocalPrice(30000, "INR"),
    label: "Pro Plus",
    description: "Per seat · Higher AI credit allowance and Pro Plus tier",
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
  {
    countryCode: "IN",
    userType: "LAW_FIRM",
    planId: "firm_enterprise",
    currency: "INR",
    amount: 0,
    aiCredits: 50000,
    label: "Enterprise",
    description: "SSO, data residency, SCIM, and dedicated support",
    features: {
      seats: 999,
      copilot: true,
      portal: true,
      trust: true,
      enterprise: true,
      contactSales: true,
      perSeat: true,
    },
  },
  {
    countryCode: "IN",
    userType: "CONSUMER",
    planId: "consumer_free",
    currency: "INR",
    amount: 0,
    aiCredits: 100,
    label: "Free",
    features: { issueChecker: true },
  },
  {
    countryCode: "IN",
    userType: "CONSUMER",
    planId: "consumer_plus",
    currency: "INR",
    amount: 1000,
    aiCredits: computeCreditsFromLocalPrice(1000, "INR"),
    label: "Plus",
    features: { issueChecker: true, lawyerReview: true },
  },
]
/** Source of truth for marketing/UI — mirrors legal_backend DEVELOPING_USD_BASE_PLANS.
 *  Base amounts are the DEVELOPING-market prices ($25/$100/$500).
 *  getPlansForCountry() applies getCountryPricingTier() (2× for developed markets)
 *  so US/GB/CA/… automatically show $50/$200/$1000.
 *  India (IN) uses INDIA_NATIVE_PLANS instead.
 */
export const COUNTRY_PLANS: CountryPlan[] = [
  {
    countryCode: CANONICAL_PRICING_COUNTRY,
    userType: "LAW_FIRM",
    planId: "firm_starter",
    currency: CANONICAL_CURRENCY,
    amount: 25,            // developing base → developed: $50
    aiCredits: 1500,       // developing: $25×60 → developed: 2500
    label: "Starter",
    description: "Per seat · Client portal and core firm OS",
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: CANONICAL_PRICING_COUNTRY,
    userType: "LAW_FIRM",
    planId: "firm_professional",
    currency: CANONICAL_CURRENCY,
    amount: 100,           // developing base → developed: $200
    aiCredits: 6000,       // developing: $100×60 → developed: 10000
    label: "Professional",
    description: "Per seat · Copilot, advanced reporting, deep analysis",
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: CANONICAL_PRICING_COUNTRY,
    userType: "LAW_FIRM",
    planId: "firm_pro_plus",
    currency: CANONICAL_CURRENCY,
    amount: 500,           // developing base → developed: $1000
    aiCredits: 30000,      // developing: $500×60 → developed: 50000
    label: "Pro Plus",
    description: "Per seat · Higher AI credit allowance and Pro Plus tier",
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
  {
    countryCode: CANONICAL_PRICING_COUNTRY,
    userType: "LAW_FIRM",
    planId: "firm_enterprise",
    currency: CANONICAL_CURRENCY,
    amount: 0,
    aiCredits: 50000,
    label: "Enterprise",
    description: "SSO, data residency, SCIM, and dedicated support",
    features: {
      seats: 999,
      copilot: true,
      portal: true,
      trust: true,
      enterprise: true,
      contactSales: true,
      perSeat: true,
    },
  },
  {
    countryCode: CANONICAL_PRICING_COUNTRY,
    userType: "CONSUMER",
    planId: "consumer_free",
    currency: CANONICAL_CURRENCY,
    amount: 0,
    aiCredits: 100,
    label: "Free",
    features: { issueChecker: true },
  },
  {
    countryCode: CANONICAL_PRICING_COUNTRY,
    userType: "CONSUMER",
    planId: "consumer_plus",
    currency: CANONICAL_CURRENCY,
    amount: 15,
    aiCredits: 750,        // $15×50% (developed) → 750 credits
    label: "Plus",
    features: { issueChecker: true, lawyerReview: true },
  },
]

export function getUsdPlans(userType?: "CONSUMER" | "LAW_FIRM"): CountryPlan[] {
  return COUNTRY_PLANS.filter(
    (p) => p.currency === CANONICAL_CURRENCY && (!userType || p.userType === userType),
  )
}

/** USD base plans converted to the country's currency (FX + 1.5% markup + tier). */
export function getPlansForCountry(
  countryCode: string,
  userType: "CONSUMER" | "LAW_FIRM",
): CountryPlan[] {
  const normalized = countryCode.toUpperCase()

  if (normalized === "IN") {
    return INDIA_NATIVE_PLANS.filter((p) => p.userType === userType)
  }

  const currency = currencyForCountry(normalized)
  const tier = getCountryPricingTier(normalized) // 2.0 developed, 1.0 developing

  return getUsdPlans(userType).map((plan) => {
    const scaledAmount = convertUsdToLocal(plan.amount, currency, undefined, normalized)

    // Scale AI credits by market tier for firm plans.
    // Developing: credits = price × 60; Developed (2×price): credits = price×2×50 = price×100
    // Ratio: developed/developing = 100/60 = 5/3.
    const isConsumer = plan.userType === "CONSUMER"
    const scaledCredits =
      !isConsumer && tier > 1
        ? Math.round(plan.aiCredits * (5 / 3))
        : plan.aiCredits

    return {
      ...plan,
      countryCode: normalized,
      currency,
      amount: scaledAmount,
      aiCredits: scaledCredits,
    }
  })
}

const LAWYER_REVIEW_FEE_USD = 20

export function getLawyerReviewFee(countryCode?: string): {
  amount: number
  currency: string
  label: string
} {
  const normalized = (countryCode ?? CANONICAL_PRICING_COUNTRY).toUpperCase()
  const currency = currencyForCountry(normalized)
  const amount = convertUsdToLocal(LAWYER_REVIEW_FEE_USD, currency, undefined, normalized)
  return {
    amount,
    currency,
    label: formatPlanPrice(amount, currency),
  }
}

export function formatPlanPrice(amount: number, currency: string = CANONICAL_CURRENCY): string {
  if (amount <= 0) return "Free"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
