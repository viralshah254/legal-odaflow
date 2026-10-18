"use client"

import { useEffect, useState } from "react"
import { Crown, Loader2, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatPlanPrice, listPricingPlans, type PricingPlan } from "@/lib/api/pricing-plans"
import { openBillingPortal } from "@/lib/api/billing"
import { startSubscriptionCheckout } from "@/lib/api/subscriptions"
import {
  getPlanChangeAction,
  isContactSalesPlan,
  sortFirmPlans,
} from "@/lib/pricing/plan-display"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { applyIntroDiscount } from "@/lib/pricing/intro-offer"
import type { IntroOfferStatus } from "@/lib/api/intro-offer"

interface ChangePlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  countryCode: string
  tenantId?: string
  /** True when the user has an active Stripe subscription — plan changes go through portal */
  hasActiveSubscription?: boolean
  /**
   * Current billing plan segment, e.g. "FIRM_PROFESSIONAL", "LAWYER_SOLO".
   * Used to determine upgrade / downgrade / current per plan card.
   */
  userSegment?: string
  /** Page path to return to after Stripe checkout completes */
  returnPath?: string
  /** Intro offer status — shows 40% off on monthly prices when eligible */
  introOffer?: IntroOfferStatus | null
}

const FEATURED_PLAN_ID = "firm_professional"

export function ChangePlanModal({
  open,
  onOpenChange,
  countryCode,
  tenantId,
  hasActiveSubscription,
  userSegment,
  returnPath,
  introOffer,
}: ChangePlanModalProps) {
  const { getPlanDisplayLabel } = usePlanPricingI18n()

  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPlansLoading(true)
    setError(null)
    listPricingPlans({ countryCode, userType: "LAW_FIRM" })
      .then((rows) =>
        setPlans(
          sortFirmPlans(
            rows.filter((p) => p.checkoutEligible !== false),
          ),
        ),
      )
      .catch(() => setError("Could not load plans. Please try again."))
      .finally(() => setPlansLoading(false))
  }, [open, countryCode])

  // current context used by getPlanChangeAction
  const currentCtx = {
    billingPlan: userSegment ?? null,
    hasStripeSubscription: hasActiveSubscription,
    isAuthenticated: true,
  }

  const introEligible = billingCycle === "monthly" && introOffer?.eligible === true

  /** Compute displayed per-month amount given billing cycle */
  function displayedAmount(plan: PricingPlan): number {
    if (billingCycle === "annual") return Math.round(plan.amount * 0.8)
    if (introEligible) return Math.round(applyIntroDiscount(plan.amount, true))
    return plan.amount
  }

  /** Format a price using the plan's currency */
  function fmtPrice(plan: PricingPlan, amount: number): string {
    return formatPlanPrice({ ...plan, amount })
  }

  async function handlePlanClick(plan: PricingPlan) {
    const action = getPlanChangeAction(plan, currentCtx)
    if (action === "current" || action === "contact_sales") return
    setError(null)

    // Subscribed users: always open Stripe billing portal (handles upgrades + downgrades + annual)
    if (hasActiveSubscription && tenantId) {
      setPortalLoading(true)
      try {
        const { url } = await openBillingPortal(tenantId)
        window.open(url, "_blank")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Could not open billing portal: ${msg}`)
      } finally {
        setPortalLoading(false)
      }
      return
    }

    // Free users: start Stripe Checkout (monthly or annual)
    setCheckoutLoadingId(plan.planId)
    try {
      const result = await startSubscriptionCheckout({
        planId: plan.planId,
        countryCode,
        userType: "LAW_FIRM",
        tenantId,
        billingCycle,
        returnPath,
      })
      const url = result.checkoutUrl
      if (url && (url.startsWith("https://checkout.stripe.com") || url.startsWith("https://buy.stripe.com"))) {
        window.location.href = url
      } else {
        setError("Payment could not be started. Please try again or contact support.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again."
      setError(msg)
    } finally {
      setCheckoutLoadingId(null)
    }
  }

  const anyLoading = portalLoading || checkoutLoadingId !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 pt-6 pb-5 border-b">
          <DialogHeader className="space-y-0 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Crown className="h-5 w-5" />
              </div>

              {/* Monthly / Annual toggle */}
              <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    billingCycle === "monthly"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Monthly
                  {introOffer?.eligible && (
                    <span className="rounded px-1 py-0.5 text-[10px] font-semibold leading-none bg-primary/10 text-primary">
                      −40%
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    billingCycle === "annual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Annual
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px] font-semibold leading-none",
                      billingCycle === "annual"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-green-100/60 text-green-700/70 dark:bg-green-900/20 dark:text-green-500",
                    )}
                  >
                    −20%
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {hasActiveSubscription ? "Change your plan" : "Choose a plan"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {billingCycle === "annual"
                  ? "Save 20% with annual billing — billed once per year."
                  : hasActiveSubscription
                    ? "Upgrade, downgrade, or switch plans anytime."
                    : introEligible
                      ? "40% off your first month — introductory offer."
                      : "Get monthly AI credits, premium models, and firm-wide features."}
              </p>
            </div>
          </DialogHeader>
        </div>

        {/* Plan grid */}
        <div className="px-6 py-5">
          {plansLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 && !error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No plans available for your region.
            </p>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                plans.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
              )}
            >
              {plans.map((plan) => {
                const action = getPlanChangeAction(plan, currentCtx)
                const isCurrent = action === "current"
                const isEnterprise = isContactSalesPlan(plan)
                const featured = plan.planId === FEATURED_PLAN_ID && !isCurrent
                const isCheckingOut = checkoutLoadingId === plan.planId
                const isPortalLoading = portalLoading && !isCurrent
                const amt = plan.amount > 0 ? displayedAmount(plan) : null

                const buttonLabel = isCurrent
                  ? "Current plan"
                  : action === "upgrade"
                    ? "Upgrade"
                    : action === "downgrade"
                      ? "Downgrade"
                      : action === "contact_sales"
                        ? "Contact sales"
                        : "Switch plan"

                return (
                  <div
                    key={plan.planId}
                    className={cn(
                      "rounded-xl border bg-card p-4 space-y-3 transition-all",
                      isCurrent
                        ? "border-primary/50 shadow-md ring-2 ring-primary/25"
                        : featured
                          ? "border-primary/30 shadow-sm ring-1 ring-primary/15"
                          : "border-border/60 hover:border-border",
                    )}
                  >
                    {/* Plan header */}
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-sm leading-tight">
                          {getPlanDisplayLabel(plan)}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {isCurrent && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-primary border-primary/30"
                            >
                              Current
                            </Badge>
                          )}
                          {!isCurrent && featured && (
                            <Badge className="text-[10px] px-1.5 py-0">Popular</Badge>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      {isEnterprise || plan.amount === 0 ? (
                        <p className="mt-1.5 text-lg font-bold">Contact us</p>
                      ) : (
                        <>
                          <div className="mt-1.5 flex items-baseline gap-1 flex-wrap">
                            <span className="text-lg font-bold">
                              {amt !== null ? fmtPrice(plan, amt) : "Free"}
                            </span>
                            <span className="text-xs text-muted-foreground">/mo</span>
                            {billingCycle === "annual" && (
                              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium ml-0.5">
                                save 20%
                              </span>
                            )}
                            {introEligible && amt !== null && (
                              <>
                                <span className="text-xs text-muted-foreground line-through ml-0.5">
                                  {fmtPrice(plan, plan.amount)}
                                </span>
                                <span className="text-[10px] font-semibold text-primary ml-0.5">
                                  40% off
                                </span>
                              </>
                            )}
                          </div>
                          {billingCycle === "annual" && amt !== null && (
                            <p className="text-[10px] text-muted-foreground">
                              {fmtPrice(plan, amt * 12)} billed annually
                            </p>
                          )}
                        </>
                      )}

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.aiCredits.toLocaleString()} AI credits/month
                        {Boolean(plan.features?.perSeat) && " · per seat"}
                      </p>
                    </div>

                    {/* CTA */}
                    {isEnterprise ? (
                      <Button className="w-full" size="sm" variant="outline" asChild>
                        <a href="/app/settings/sso">{buttonLabel}</a>
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="sm"
                        variant={isCurrent ? "secondary" : featured ? "default" : "outline"}
                        disabled={isCurrent || anyLoading}
                        onClick={() => void handlePlanClick(plan)}
                      >
                        {isCheckingOut || isPortalLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            {hasActiveSubscription ? "Opening portal…" : "Redirecting…"}
                          </>
                        ) : (
                          buttonLabel
                        )}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-destructive text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/20 px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-[11px] text-muted-foreground">
            {hasActiveSubscription
              ? "Changes applied via Stripe · pro-rated charges may apply."
              : "Cancel anytime · no long-term commitment."}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            <Sparkles className="h-3 w-3" />
            Secured by Stripe
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
