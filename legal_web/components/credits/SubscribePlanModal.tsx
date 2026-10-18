"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Check, Crown, Loader2, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  formatPlanPrice,
  listPricingPlans,
  type PricingPlan,
} from "@/lib/api/pricing-plans"
import { startSubscriptionCheckout } from "@/lib/api/subscriptions"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { sortFirmPlans } from "@/lib/pricing/plan-display"
import { cn } from "@/lib/utils"

interface SubscribePlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  countryCode: string
  tenantId?: string
  /** Called when the user clicks "← Buy credits instead" */
  onSwitchToBuyCredits?: () => void
  /** Current page path forwarded to Stripe as the post-checkout return URL */
  returnPath?: string
}

const FEATURED_PLAN_ID = "firm_professional"

export function SubscribePlanModal({
  open,
  onOpenChange,
  countryCode,
  tenantId,
  onSwitchToBuyCredits,
  returnPath,
}: SubscribePlanModalProps) {
  const { getPlanDisplayLabel } = usePlanPricingI18n()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listPricingPlans({ countryCode, userType: "LAW_FIRM" })
      .then((rows) =>
        setPlans(
          sortFirmPlans(
            rows.filter((p) => p.amount > 0 && p.checkoutEligible !== false),
          ),
        ),
      )
      .finally(() => setLoading(false))
  }, [open, countryCode])

  const handleCheckout = async (plan: PricingPlan) => {
    setCheckingOut(plan.planId)
    try {
      const result = await startSubscriptionCheckout({
        planId: plan.planId,
        countryCode,
        userType: "LAW_FIRM",
        tenantId,
        returnPath,
      })
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } finally {
      setCheckingOut(null)
    }
  }

  const anyLoading = checkingOut !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-500/15 via-amber-400/5 to-background px-6 pt-6 pb-5 border-b">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Crown className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Upgrade your plan
            </DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get monthly AI credits, premium models, and firm-wide features.
              Cancel anytime.
            </p>
          </DialogHeader>
        </div>

        {/* Plan cards */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
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
                const featured = plan.planId === FEATURED_PLAN_ID
                const isLoading = checkingOut === plan.planId
                return (
                  <div
                    key={plan.planId}
                    className={cn(
                      "rounded-xl border bg-card p-4 space-y-3 transition-shadow",
                      featured
                        ? "border-primary/40 shadow-md shadow-primary/10 ring-1 ring-primary/20"
                        : "border-border/60",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">
                          {getPlanDisplayLabel(plan)}
                        </p>
                        {featured && (
                          <Badge className="text-[10px] px-1.5 py-0">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-bold text-foreground">
                          {formatPlanPrice(plan)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          /mo
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.aiCredits.toLocaleString()} AI credits/month
                        {Boolean(plan.features.perSeat) && " · per seat"}
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      size="sm"
                      variant={featured ? "default" : "outline"}
                      onClick={() => void handleCheckout(plan)}
                      disabled={anyLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-3.5 w-3.5" />
                          Subscribe — {formatPlanPrice(plan)}
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/20 px-6 py-3 flex items-center justify-between gap-4">
          {onSwitchToBuyCredits ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSwitchToBuyCredits()
              }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Buy credits instead
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 shrink-0" />
            Secure Stripe checkout · Cancel anytime
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
