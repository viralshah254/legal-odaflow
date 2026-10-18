"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, Clock, Loader2, Sparkles } from "lucide-react"
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
import { useTenant } from "@/lib/contexts/tenant-context"
import type { IntroOfferStatus } from "@/lib/api/intro-offer"
import {
  formatPlanPrice,
  listPricingPlans,
  type PricingPlan,
} from "@/lib/api/pricing-plans"
import { applyIntroDiscount } from "@/lib/pricing/intro-offer"
import { startSubscriptionCheckout } from "@/lib/api/subscriptions"
import { getDeviceId } from "@/lib/device/device-id"
import { registerDeviceFingerprint } from "@/lib/api/referrals"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { useIntroOfferCountdown } from "@/lib/hooks/use-intro-offer-countdown"
import { sortFirmPlans } from "@/lib/pricing/plan-display"
import { cn } from "@/lib/utils"

interface IntroOfferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  introOffer: IntroOfferStatus | null
}

export function IntroOfferDialog({
  open,
  onOpenChange,
  introOffer,
}: IntroOfferDialogProps) {
  const t = useTranslations("common")
  const { user, isAuthenticated } = useAuth()
  const { countryCode: detectedCountry } = useDetectedCountry()
  const { activeTenantId } = useTenant()
  const { getPlanDisplayLabel } = usePlanPricingI18n()
  const countryCode = user?.countryCode ?? detectedCountry

  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const countdown = useIntroOfferCountdown(introOffer?.expiresAt)

  const userType =
    introOffer?.userType ??
    (user?.userType === "LAWYER" ? "LAW_FIRM" : "CONSUMER")
  const plansHref =
    userType === "LAW_FIRM" ? "/pricing" : "/consumer/subscription"
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return
    const normalizedPath = pathname.replace(/\/$/, "") || "/"
    const normalizedPlans = plansHref.replace(/\/$/, "") || "/"
    if (
      normalizedPath === normalizedPlans ||
      normalizedPath.startsWith(`${normalizedPlans}/`)
    ) {
      onOpenChange(false)
    }
  }, [open, pathname, plansHref, onOpenChange])

  useEffect(() => {
    if (!open || !introOffer?.eligible) return
    setLoading(true)
    listPricingPlans({ countryCode, userType })
      .then((rows) =>
        setPlans(
          sortFirmPlans(
            rows.filter(
              (plan) => plan.amount > 0 && plan.checkoutEligible !== false,
            ),
          ),
        ),
      )
      .finally(() => setLoading(false))
  }, [open, countryCode, userType, introOffer?.eligible])

  const featuredPlanId = useMemo(
    () =>
      userType === "LAW_FIRM"
        ? "firm_professional"
        : "consumer_plus",
    [userType],
  )

  const handleCheckout = async (plan: PricingPlan) => {
    if (!isAuthenticated) return
    setCheckingOut(plan.planId)
    try {
      const deviceId = getDeviceId()
      if (deviceId) {
        await registerDeviceFingerprint(deviceId, "checkout").catch(
          () => undefined,
        )
      }
      const result = await startSubscriptionCheckout({
        planId: plan.planId,
        countryCode,
        userType,
        tenantId: activeTenantId ?? undefined,
        deviceFingerprint: deviceId ?? undefined,
      })
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } finally {
      setCheckingOut(null)
    }
  }

  const discountPercent = introOffer?.discountPercent ?? 40

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <div className="rounded-t-lg bg-gradient-to-br from-primary/15 via-primary/5 to-background px-6 pt-6 pb-4 border-b">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                <Sparkles className="h-5 w-5 text-primary" />
              </span>
              <Badge variant="secondary" className="text-xs font-semibold">
                {t("intro_offer_badge", { percent: discountPercent })}
              </Badge>
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {t("intro_offer_title", { percent: discountPercent })}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("intro_offer_subtitle", { percent: discountPercent })}
            </p>
            {introOffer?.expiresAt && (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Clock className="h-4 w-4 shrink-0" />
                {t("intro_offer_countdown", {
                  days: countdown.days,
                  hours: countdown.hours,
                  minutes: countdown.minutes,
                })}
              </p>
            )}
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                plans.length <= 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {plans.map((plan) => {
                const discounted = applyIntroDiscount(plan.amount, true)
                const featured = plan.planId === featuredPlanId
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
                        <p className="font-semibold">{getPlanDisplayLabel(plan)}</p>
                        {featured && (
                          <Badge className="text-[10px] px-1.5 py-0">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPlanPrice(plan)}
                        </span>
                        <span className="text-xl font-bold text-primary">
                          {formatPlanPrice({ ...plan, amount: discounted })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          /month
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.aiCredits.toLocaleString()} AI credits/month
                        {Boolean(plan.features.perSeat) && " · per seat"}
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      size="sm"
                      variant={featured ? "default" : "outline"}
                      onClick={() => void handleCheckout(plan)}
                      disabled={checkingOut === plan.planId}
                    >
                      {checkingOut === plan.planId ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("intro_offer_processing")}
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {t("intro_offer_cta", {
                            price: formatPlanPrice({ ...plan, amount: discounted }),
                          })}
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("intro_offer_remind_tomorrow")}
            </Button>
            <Button variant="outline" asChild>
              <Link href={plansHref} onClick={() => onOpenChange(false)}>
                {t("intro_offer_view_all_plans")}
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
