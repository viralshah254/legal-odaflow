"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { formatPlanPrice, listPricingPlans, type PricingPlan } from "@/lib/api/pricing-plans"
import { getIntroOfferStatus } from "@/lib/api/intro-offer"
import { applyIntroDiscount } from "@/lib/pricing/intro-offer"
import { startSubscriptionCheckout } from "@/lib/api/subscriptions"

interface ConsumerUpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional context shown below the heading */
  reason?: string
}

export function ConsumerUpgradeModal({ open, onOpenChange, reason }: ConsumerUpgradeModalProps) {
  const tCommon = useTranslations("common")
  const { user, isAuthenticated } = useAuth()
  const { countryCode: detectedCountry } = useDetectedCountry()
  const countryCode = user?.countryCode ?? detectedCountry

  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [introEligible, setIntroEligible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      listPricingPlans({ countryCode, userType: "CONSUMER" }),
      isAuthenticated ? getIntroOfferStatus().catch(() => null) : Promise.resolve(null),
    ])
      .then(([planRows, introOffer]) => {
        setPlans(planRows)
        setIntroEligible(introOffer?.eligible === true)
      })
      .finally(() => setLoading(false))
  }, [open, countryCode, isAuthenticated])

  const handleCheckout = async (plan: PricingPlan) => {
    if (!isAuthenticated) {
      window.location.href = `/auth?redirect=/consumer/subscription`
      return
    }
    setCheckingOut(plan.planId)
    try {
      const result = await startSubscriptionCheckout({
        planId: plan.planId,
        countryCode,
        userType: "CONSUMER",
      })
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } finally {
      setCheckingOut(null)
    }
  }

  const paidPlans = plans.filter((p) => p.amount > 0)
  const freePlan = plans.find((p) => p.amount === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            Unlock your full legal report
          </DialogTitle>
        </DialogHeader>

        {reason && (
          <p className="text-sm text-muted-foreground -mt-2 mb-2">{reason}</p>
        )}

        <p className="text-sm text-muted-foreground">
          Subscribe to generate complete, multi-section legal reports with case law citations,
          draft letters, and jurisdiction-specific analysis.
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {paidPlans.map((plan) => (
              <div
                key={plan.planId}
                className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{plan.label ?? plan.planId}</span>
                      <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {introEligible ? (
                        <>
                          <span className="text-base text-muted-foreground line-through mr-2">
                            {formatPlanPrice(plan)}
                          </span>
                          {formatPlanPrice({
                            ...plan,
                            amount: applyIntroDiscount(plan.amount, true),
                          })}
                        </>
                      ) : (
                        formatPlanPrice(plan)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{plan.aiCredits} AI credits/month</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-sm">
                  {Object.entries(plan.features)
                    .slice(0, 5)
                    .map(([key, value]) => (
                      <li key={key} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          {key.replace(/([A-Z])/g, " $1").trim()}:{" "}
                          {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                        </span>
                      </li>
                    ))}
                </ul>

                <Button
                  className="w-full"
                  onClick={() => void handleCheckout(plan)}
                  disabled={checkingOut === plan.planId}
                >
                  {checkingOut === plan.planId ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                    ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />{" "}
                      {introEligible
                        ? tCommon("intro_offer_cta", {
                            price: formatPlanPrice({
                              ...plan,
                              amount: applyIntroDiscount(plan.amount, true),
                            }),
                          })
                        : `Subscribe — ${formatPlanPrice(plan)}`}
                    </>
                  )}
                </Button>
              </div>
            ))}

            {freePlan && (
              <p className="text-center text-xs text-muted-foreground pt-1">
                Already on the free plan?{" "}
                <Link href="/consumer/subscription" className="underline hover:text-foreground">
                  View all plans
                </Link>
              </p>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Or{" "}
              <Link href="/consumer/subscription" className="underline hover:text-foreground">
                compare all plans
              </Link>{" "}
              · Cancel anytime
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
