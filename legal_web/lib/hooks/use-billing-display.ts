"use client"

import { useMemo } from "react"
import { useCurrency } from "@/lib/contexts/currency-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { usePricing } from "@/lib/contexts/pricing-context"
import {
  getPricingForCountry,
  getProfessionalPricePerUser,
} from "@/lib/types/pricing"
import { billingPlanToTier } from "@/lib/utils/plan-from-tenant"
import {
  convertUsdToLocalAmount,
  formatMoneyAmount,
} from "@/lib/utils/currency-fx"

/**
 * Subscription billing amounts in the tenant's billing currency (not raw USD).
 */
export function useBillingDisplay() {
  const { currency, currencyCode } = useCurrency()
  const { activeTenant } = useTenant()
  const { pricing: geoPricing } = usePricing()

  const tenant = activeTenant?.tenant
  const plan = billingPlanToTier(tenant?.billingPlan)
  const tenantCountry = (tenant?.primaryCountry ?? geoPricing.countryCode).toUpperCase()
  const countryPricing = getPricingForCountry(tenantCountry)

  const usdPerUser = useMemo(() => {
    if (plan === "PROFESSIONAL") {
      return getProfessionalPricePerUser(countryPricing)
    }
    if (plan === "STARTER" || plan === "SOLO") {
      return countryPricing.pricePerUser
    }
    return getProfessionalPricePerUser(countryPricing)
  }, [plan, countryPricing])

  const pricePerUser = useMemo(
    () => convertUsdToLocalAmount(usdPerUser, currencyCode),
    [usdPerUser, currencyCode],
  )

  const formatAmount = (amount: number) =>
    formatMoneyAmount(amount, currencyCode, currency.symbol)

  return {
    currencySymbol: currency.symbol,
    currencyCode,
    pricePerUser,
    usdPerUser,
    formatAmount,
    plan,
  }
}
