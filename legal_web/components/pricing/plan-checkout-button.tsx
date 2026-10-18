"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { openBillingPortal } from "@/lib/api/billing"
import { startSubscriptionCheckout } from "@/lib/api/subscriptions"
import type { PricingPlan } from "@/lib/api/pricing-plans"
import { getPlanChangeAction } from "@/lib/pricing/plan-display"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { getDeviceId } from "@/lib/device/device-id"
import { registerDeviceFingerprint } from "@/lib/api/referrals"

const REF_STORAGE_KEY = "umbrella_ref_code"
const REF_STORAGE_EXPIRY_KEY = "umbrella_ref_code_expiry"

function getStoredRefCode(): string | null {
  try {
    const stored = localStorage.getItem(REF_STORAGE_KEY)
    const expiry = localStorage.getItem(REF_STORAGE_EXPIRY_KEY)
    if (stored && expiry && Date.now() < Number(expiry)) return stored
  } catch {
    // localStorage unavailable
  }
  return null
}

interface PlanCheckoutButtonProps {
  plan: PricingPlan
  countryCode: string
  isAuthenticated: boolean
  tenantId?: string | null
  current?: {
    planId?: string | null
    planTier?: string | null
    billingPlan?: string | null
    canManageInPortal?: boolean
    hasStripeSubscription?: boolean
  }
  variant?: "default" | "outline"
  signUpHref?: string
  contactSalesHref?: string
  manageHref?: string
}

export function PlanCheckoutButton({
  plan,
  countryCode,
  isAuthenticated,
  tenantId,
  current,
  variant = "outline",
  signUpHref = "/auth",
  contactSalesHref = "/app/settings/sso",
  manageHref = "/app/settings/plan-usage",
}: PlanCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getPlanActionLabel } = usePlanPricingI18n()

  // Append stored referral code to sign-up links so attribution carries through pricing clicks
  const resolvedSignUpHref = useMemo(() => {
    try {
      const ref = getStoredRefCode()
      if (!ref) return signUpHref
      const url = new URL(signUpHref, "https://placeholder.invalid")
      url.searchParams.set("ref", ref)
      return url.pathname + (url.search || "")
    } catch {
      return signUpHref
    }
  }, [signUpHref])

  const action = getPlanChangeAction(plan, {
    ...current,
    isAuthenticated,
  })

  const usePortal =
    isAuthenticated &&
    Boolean(current?.canManageInPortal) &&
    action !== "current" &&
    action !== "subscribe" &&
    action !== "contact_sales"

  const isFreeCurrentPlan =
    action === "current" &&
    !current?.canManageInPortal &&
    (plan.amount === 0 || plan.planId === "consumer_free")

  const label = getPlanActionLabel(action, {
    usePortal: action === "current" ? current?.canManageInPortal : usePortal,
    isFreeTier: isFreeCurrentPlan,
  })

  async function handleClick() {
    setError(null)

    if (action === "contact_sales") {
      return
    }

    if (!isAuthenticated) {
      return
    }

    if (action === "current") {
      if (current?.canManageInPortal) {
        setLoading(true)
        try {
          const { url } = await openBillingPortal(tenantId ?? undefined)
          window.location.href = url
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not open billing portal")
        } finally {
          setLoading(false)
        }
      }
      return
    }

    if (usePortal) {
      setLoading(true)
      try {
        const { url } = await openBillingPortal(tenantId ?? undefined)
        window.location.href = url
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open billing portal")
      } finally {
        setLoading(false)
      }
      return
    }

    if (!tenantId && plan.userType === "LAW_FIRM") {
      setError("Select a firm workspace before subscribing.")
      return
    }

    setLoading(true)
    try {
      // Register device fingerprint for all user types so referral fraud checks work
      const deviceId = getDeviceId()
      if (deviceId) {
        await registerDeviceFingerprint(deviceId, "checkout").catch(() => undefined)
      }

      let result: Awaited<ReturnType<typeof startSubscriptionCheckout>>
      try {
        result = await startSubscriptionCheckout({
          planId: plan.planId,
          countryCode,
          userType: plan.userType as "LAW_FIRM" | "CONSUMER",
          tenantId: tenantId ?? undefined,
          deviceFingerprint: deviceId ?? undefined,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (deviceId && msg.includes("deviceFingerprint")) {
          result = await startSubscriptionCheckout({
            planId: plan.planId,
            countryCode,
            userType: plan.userType as "LAW_FIRM" | "CONSUMER",
            tenantId: tenantId ?? undefined,
          })
        } else {
          throw err
        }
      }
      if (result.checkoutUrl) {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(result.checkoutUrl)) {
          setError("Payment setup issue — please contact support if this persists.")
          return
        }
        window.location.href = result.checkoutUrl
      } else {
        setError("Checkout URL was not returned. Please try again or contact support.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Payment configuration error") || msg.includes("Payment provider error") || msg.includes("STRIPE_SECRET_KEY")) {
        setError("Payment setup issue — please contact support if this persists.")
      } else if (msg.includes("already on this plan") || msg.includes("already have an active")) {
        setError(msg)
      } else if (msg.includes("Pricing plan not found") || msg.includes("No pricing plan")) {
        setError("This plan is not available in your region. Please contact support.")
      } else if (msg.includes("Enterprise") || msg.includes("contact sales")) {
        setError("This plan requires a sales conversation — please contact us.")
      } else {
        // Show the raw backend message when it's descriptive enough; fall back to generic
        const isDescriptive = msg.length > 10 && msg.length < 200 && !msg.includes("fetch")
        setError(isDescriptive ? msg : "Checkout failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (action === "contact_sales") {
    return (
      <Button asChild variant={variant} className="w-full">
        <Link href={contactSalesHref}>{label}</Link>
      </Button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Button asChild variant={variant} className="w-full">
        <Link href={resolvedSignUpHref}>{label}</Link>
      </Button>
    )
  }

  if (action === "current" && !current?.canManageInPortal) {
    if (plan.amount === 0 || plan.planId === "consumer_free") {
      return (
        <Button variant="outline" className="w-full" disabled>
          {label}
        </Button>
      )
    }
    return (
      <Button asChild variant="outline" className="w-full">
        <Link href={manageHref}>{label}</Link>
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        className="w-full"
        disabled={loading}
        onClick={() => void handleClick()}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
