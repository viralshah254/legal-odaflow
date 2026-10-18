import { apiFetch } from "./client"
import type { CountryCode } from "./types"
import {
  CANONICAL_PRICING_COUNTRY,
  getPlansForCountry,
  formatPlanPrice as formatCountryPlanPrice,
  type CountryPlan,
} from "@/lib/pricing/country-pricing"
import { filterPublicPricingPlans } from "@/lib/pricing/plan-display"

export type PricingUserType = "CONSUMER" | "LAW_FIRM"

export interface PricingPlan {
  countryCode: CountryCode | string
  userType: PricingUserType | string
  planId: string
  currency: string
  amount: number
  aiCredits: number
  features: Record<string, boolean | number | string>
  label?: string
  description?: string
  checkoutEligible?: boolean
}

export interface PricingPlansResult {
  countryCode: string
  currency: string
  pricingCurrency?: string
  fxMarkupPercent?: number
  fxRate?: number
  fxSource?: "frankfurter" | "fallback"
  plans: PricingPlan[]
}

function normalizePlan(raw: PricingPlan & { amount?: number | string }): PricingPlan {
  return {
    ...raw,
    amount: typeof raw.amount === "string" ? parseFloat(raw.amount) : raw.amount,
  }
}

function countryPlanToPricingPlan(plan: CountryPlan): PricingPlan {
  return {
    countryCode: plan.countryCode,
    userType: plan.userType,
    planId: plan.planId,
    currency: plan.currency,
    amount: plan.amount,
    aiCredits: plan.aiCredits,
    features: plan.features,
    label: plan.label,
    description: plan.description,
  }
}

function localPricingFallback(params?: {
  countryCode?: string
  userType?: PricingUserType
}): PricingPlan[] {
  const country = (params?.countryCode ?? CANONICAL_PRICING_COUNTRY).toUpperCase()
  const userType = params?.userType ?? "CONSUMER"
  return getPlansForCountry(country, userType).map(countryPlanToPricingPlan)
}

export async function fetchPricingCatalog(params?: {
  countryCode?: string
  userType?: PricingUserType
}): Promise<PricingPlansResult> {
  const search = new URLSearchParams()
  if (params?.countryCode) search.set("country", params.countryCode)
  if (params?.userType) search.set("userType", params.userType)
  const query = search.toString() ? `?${search.toString()}` : ""
  const country = (params?.countryCode ?? CANONICAL_PRICING_COUNTRY).toUpperCase()

  try {
    const response = await apiFetch<
      PricingPlan[] | PricingPlansResult
    >(`/pricing/plans${query}`, { auth: false })

    if (Array.isArray(response)) {
      const plans = filterPublicPricingPlans(response.map(normalizePlan))
      return {
        countryCode: country,
        currency: plans[0]?.currency ?? "USD",
        plans: params?.userType
          ? plans.filter((p) => p.userType === params.userType)
          : plans,
      }
    }

    const plans = filterPublicPricingPlans((response.plans ?? []).map(normalizePlan))
    if (plans.length > 0) {
      const filtered = params?.userType
        ? plans.filter((p) => p.userType === params.userType)
        : plans
      return {
        countryCode: response.countryCode ?? country,
        currency: response.currency ?? filtered[0]?.currency ?? "USD",
        pricingCurrency: response.pricingCurrency,
        fxMarkupPercent: response.fxMarkupPercent,
        fxRate: response.fxRate,
        fxSource: response.fxSource,
        plans: filtered,
      }
    }
  } catch {
    // Backend down or unreachable — use USD base + local FX fallback
  }

  const fallbackPlans = filterPublicPricingPlans(localPricingFallback(params))
  return {
    countryCode: country,
    currency: fallbackPlans[0]?.currency ?? "USD",
    fxSource: "fallback",
    plans: fallbackPlans,
  }
}

export async function listPricingPlans(params?: {
  countryCode?: string
  userType?: PricingUserType
}): Promise<PricingPlan[]> {
  const catalog = await fetchPricingCatalog(params)
  return catalog.plans
}

/** Offline-safe plan lookup from country-pricing seed */
export function getLocalPricingPlans(params?: {
  countryCode?: string
  userType?: PricingUserType
}): PricingPlan[] {
  const country = (params?.countryCode ?? CANONICAL_PRICING_COUNTRY).toUpperCase()
  return filterPublicPricingPlans(
    getPlansForCountry(country, params?.userType ?? "CONSUMER").map(countryPlanToPricingPlan),
  )
}

export { CANONICAL_PRICING_COUNTRY }

export function formatPlanPrice(plan: PricingPlan): string {
  return formatCountryPlanPrice(plan.amount, plan.currency)
}
