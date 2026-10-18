"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { resolvePlanTierForFeatures } from "@/lib/utils/plan-from-tenant"
import { getCurrentBilling } from "@/lib/api/billing"

/**
 * Returns whether the current user has an active paid subscription.
 *
 * - Law firm users: checks if the active tenant has a non-null billing plan tier.
 * - Consumer users: calls /billing/current and checks subscriptionStatus is ACTIVE or TRIALING.
 */
export function useIsSubscribed(): { isSubscribed: boolean; isLoading: boolean } {
  const { user, isLoading: authLoading } = useAuth()
  const { activeTenant, isLoading: tenantLoading } = useTenant()

  const isConsumer = user?.userType === "CONSUMER"

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ["billing-current-sub-check"],
    queryFn: () => getCurrentBilling(),
    enabled: isConsumer && !!user,
    staleTime: 5 * 60 * 1000,
  })

  if (isConsumer) {
    const status = billing?.subscriptionStatus
    return {
      isSubscribed: status === "ACTIVE" || status === "TRIALING",
      isLoading: authLoading || billingLoading,
    }
  }

  const tier = resolvePlanTierForFeatures(activeTenant?.tenant?.billingPlan)
  return {
    isSubscribed: tier !== null,
    isLoading: authLoading || tenantLoading,
  }
}
