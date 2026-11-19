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
  DialogDescription,
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
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-h-[min(calc(100dvh-2rem),900px)] sm:max-w-4xl">
        <div className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-background px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3 pr-8">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </span>
              <Badge variant="secondary" className="whitespace-normal text-left text-xs font-semibold leading-relaxed">
                {t("intro_offer_badge", { percent: discountPercent })}
              </Badge>
            </div>
            <DialogTitle className="pr-6 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {t("intro_offer_title", { percent: discountPercent })}
            </DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("intro_offer_subtitle", { percent: discountPercent })}
            </DialogDescription>
            {introOffer?.expiresAt && (
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
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

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className={cn(
                "grid items-stretch gap-4",
                plans.length === 1
                  ? "grid-cols-1"
                  : plans.length === 2
                    ? "md:grid-cols-2"
                    : "md:grid-cols-3",
              )}
            >
              {plans.map((plan) => {
                const discounted = applyIntroDiscount(plan.amount, true)
                const featured = plan.planId === featuredPlanId
                return (
                  <div
                    key={plan.planId}
                    className={cn(
                      "flex min-w-0 flex-col rounded-xl border bg-card p-5 transition-shadow",
                      featured
                        ? "border-primary bg-primary/[0.03] shadow-sm ring-1 ring-primary/15"
                        : "border-border/60",
                    )}
                  >
                    <div>
                      <div className="flex min-h-12 flex-wrap content-start items-center gap-x-2 gap-y-1">
                        <p className="min-w-0 break-words text-base font-semibold leading-snug">{getPlanDisplayLabel(plan)}</p>
                        {featured && (
                          <Badge className="shrink-0 px-2 py-0.5 text-[10px]">
                            {t("popular")}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        <span className="block text-sm tabular-nums text-muted-foreground line-through">
                          {formatPlanPrice(plan)}
                        </span>
                        <span className="block break-words text-2xl font-semibold leading-tight tracking-tight tabular-nums text-primary">
                          {formatPlanPrice({ ...plan, amount: discounted })}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          /month
                        </span>
                      </div>
                      <p className="mb-5 mt-4 text-xs leading-relaxed text-muted-foreground">
                        {plan.aiCredits.toLocaleString()} AI credits/month
                        {Boolean(plan.features.perSeat) && " · per seat"}
                      </p>
                    </div>

                    <Button
                      className="mt-auto h-auto min-h-10 w-full whitespace-normal px-3 py-2.5 text-center leading-snug"
                      size="sm"
                      variant={featured ? "default" : "outline"}
                      onClick={() => void handleCheckout(plan)}
                      disabled={checkingOut !== null}
                    >
                      {checkingOut === plan.planId ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("intro_offer_processing")}
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {t("subscribe_now")}
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("intro_offer_remind_tomorrow")}
          </Button>
          <Button variant="outline" asChild>
            <Link href={plansHref} onClick={() => onOpenChange(false)}>
              {t("intro_offer_view_all_plans")}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
