"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, CheckCircle, ExternalLink, Loader2, RefreshCw, Sparkles, Zap, Star, Flame, ArrowRight } from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { CreditBalanceWidget } from "@/components/consumer/credit-balance-widget"
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal"
import { PlanCheckoutButton } from "@/components/pricing/plan-checkout-button"
import {
  formatPlanPrice,
  listPricingPlans,
  type PricingPlan,
} from "@/lib/api/pricing-plans"
import { getCreditWallet, type CreditWallet } from "@/lib/api/credits"
import { startCreditTopupCheckout } from "@/lib/api/credits"
import { getCurrentBilling, openBillingPortal, type CurrentBilling } from "@/lib/api/billing"
import { getIntroOfferStatus, type IntroOfferStatus } from "@/lib/api/intro-offer"
import { applyIntroDiscount } from "@/lib/pricing/intro-offer"
import { isCurrentPlan } from "@/lib/pricing/plan-display"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { trackCheckoutStarted } from "@/lib/analytics/posthog"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { cn } from "@/lib/utils"

type CreditPackRow = {
  packId: string
  credits: number
  label: string
  amount: number
  currency: string
  description?: string
}

const PACK_ICONS: Record<string, React.ElementType> = {
  pack_10: Zap,
  pack_25: Star,
  pack_50: Flame,
}

const PACK_ACCENTS: Record<string, string> = {
  pack_10: "border-blue-500/30 bg-blue-500/5",
  pack_25: "border-primary/50 bg-primary/5 shadow-sm shadow-primary/20",
  pack_50: "border-amber-500/30 bg-amber-500/5",
}

function redirectToCheckout(url: string) {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
    throw new Error("Payment setup issue — please contact support if this persists.")
  }
  window.location.href = url
}

function formatRenewalDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function ConsumerSubscriptionPage() {
  const t = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const { getPlanDisplayLabel, getPlanDisplayDescription } = usePlanPricingI18n()
  const { user, isAuthenticated } = useAuth()
  const { countryCode: detectedCountry } = useDetectedCountry()
  const countryCode = user?.countryCode ?? detectedCountry

  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [creditPacks, setCreditPacks] = useState<CreditPackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false)
  const [autoSelectPack, setAutoSelectPack] = useState<string | undefined>()
  const [currentBilling, setCurrentBilling] = useState<CurrentBilling | null>(null)
  const [wallet, setWallet] = useState<CreditWallet | null>(null)
  const [introOffer, setIntroOffer] = useState<IntroOfferStatus | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      listPricingPlans({ countryCode, userType: "CONSUMER" }),
      isAuthenticated ? getCreditWallet() : Promise.resolve(null),
      isAuthenticated ? getCurrentBilling().catch(() => null) : Promise.resolve(null),
      isAuthenticated ? getIntroOfferStatus().catch(() => null) : Promise.resolve(null),
    ])
      .then(([planRows, credits, billing, refStatus]) => {
        setPlans(planRows)
        if (credits?.packs) setCreditPacks(credits.packs)
        if (credits?.wallet) setWallet(credits.wallet)
        if (billing) setCurrentBilling(billing)
        setIntroOffer(refStatus)
      })
      .finally(() => setLoading(false))
  }, [countryCode, isAuthenticated])

  const billingContext = useMemo((): CurrentBilling | null => {
    if (currentBilling) return currentBilling
    if (!wallet?.hasActiveSubscription) return null
    const segment = wallet.userSegment?.toLowerCase() ?? ""
    return {
      userType: "CONSUMER",
      billingPlan: wallet.billingPlan ?? "ACTIVE",
      planTier: segment.includes("plus") ? "PLUS" : "FREE",
      planId: segment.includes("plus") ? "consumer_plus" : "consumer_free",
      subscriptionStatus: "ACTIVE",
      countryCode: wallet.countryCode,
      hasStripeSubscription: true,
      canManageInPortal: true,
      providerSubscriptionId: null,
    }
  }, [currentBilling, wallet])

  const hasActiveSubscription =
    billingContext?.hasStripeSubscription === true ||
    billingContext?.subscriptionStatus === "ACTIVE" ||
    wallet?.hasActiveSubscription === true

  const renewalDate = formatRenewalDate(
    billingContext?.currentPeriodEnd ?? wallet?.cycleEndAt ?? null,
  )

  const handleManageBilling = async () => {
    setCheckoutError(null)
    setPortalLoading(true)
    try {
      const { url } = await openBillingPortal()
      window.location.href = url
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCheckoutError(msg || "Could not open billing portal")
    } finally {
      setPortalLoading(false)
    }
  }

  const handlePackCheckout = async (packId: string, pack: CreditPackRow) => {
    if (!isAuthenticated) {
      window.location.href = `/auth?redirect=/consumer/subscription`
      return
    }
    setCheckoutError(null)
    setCheckingOut(packId)
    try {
      trackCheckoutStarted({ checkoutType: "credit_topup", packId, amount: pack.amount, currency: pack.currency })
      const result = await startCreditTopupCheckout({ countryCode, packId })
      if (result.checkoutUrl) redirectToCheckout(result.checkoutUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Payment provider error") || msg.includes("Payment configuration error")) {
        setCheckoutError("Payment setup issue — please contact support if this persists.")
      } else {
        setCheckoutError(msg || "Checkout failed. Please try again.")
      }
    } finally {
      setCheckingOut(null)
    }
  }

  const openBuyModal = (packId?: string) => {
    setAutoSelectPack(packId)
    setBuyCreditsOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl w-full">
        {/* Page hero */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("credits_subscription")}</h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            {t("ai_credits_model_mode_and_top-up_settings")}
            {" · "}
            Priced for <span className="font-medium text-foreground">{countryCode}</span>.
          </p>
        </div>

        {/* Credit balance card */}
        {isAuthenticated && (
          <div className="mb-8">
            <CreditBalanceWidget />
          </div>
        )}

        {hasActiveSubscription && isAuthenticated && (
          <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-primary border-primary/50 gap-1">
                    <RefreshCw className="h-3 w-3" />
                    {t("auto_renewing")}
                  </Badge>
                  {renewalDate && (
                    <span className="text-xs text-muted-foreground">{t("renewsOn", { date: renewalDate })}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{t("subscription_auto_renew_hint")}</p>
              </div>
              {billingContext?.canManageInPortal && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleManageBilling()} disabled={portalLoading}>
                    {portalLoading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {t("manage_plan")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleManageBilling()}
                    disabled={portalLoading}
                  >
                    {t("cancel_subscription")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Credit packs ───────────────────────────────────────────── */}
            {creditPacks.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-xl font-semibold">{t("top_up_ai_credits")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">One-time purchase · credits never expire</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openBuyModal()}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {tCommon("buy_credits")}
                  </Button>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  {creditPacks.map((pack) => {
                    const Icon = PACK_ICONS[pack.packId] ?? Sparkles
                    const accent = PACK_ACCENTS[pack.packId] ?? "border-border bg-card"
                    const isPopular = pack.packId === "pack_25"
                    const isBestValue = pack.packId === "pack_50"
                    const isLoading = checkingOut === pack.packId

                    return (
                      <div
                        key={pack.packId}
                        className={cn("relative rounded-xl border p-5 transition-all hover:shadow-md", accent)}
                      >
                        {isPopular && (
                          <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-xs px-2 py-0">
                            Popular
                          </Badge>
                        )}
                        {isBestValue && (
                          <Badge className="absolute -top-2.5 right-4 bg-amber-500 text-white text-xs px-2 py-0">
                            Best value
                          </Badge>
                        )}

                        <div className="flex items-start gap-3 mb-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{pack.label}</p>
                            <p className="text-xs text-muted-foreground">{pack.credits} credits</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-2xl font-bold tabular-nums leading-none">
                            {pack.currency} {pack.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              One-time
                            </span>
                            Credits never expire
                          </p>
                        </div>

                        <Button
                          className="w-full h-8 text-sm"
                          size="sm"
                          variant={isPopular ? "default" : "outline"}
                          disabled={isLoading || (checkingOut !== null && !isLoading)}
                          onClick={() => handlePackCheckout(pack.packId, pack)}
                        >
                          {isLoading ? (
                            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Redirecting…</>
                          ) : (
                            <><ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Buy now</>
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Error ──────────────────────────────────────────────────── */}
            {checkoutError && (
              <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {checkoutError}
              </div>
            )}

            {/* ── Subscription plans ─────────────────────────────────────── */}
            <section>
              <div className="mb-5">
                <h2 className="text-xl font-semibold">{t("subscription_plans")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Billed monthly · AI credits refresh each billing cycle</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6" data-tour="consumer-plans">
                {plans.map((plan) => {
                  const isCurrentPlanCard = isCurrentPlan(plan, billingContext ?? undefined)
                  const isFree = plan.amount === 0
                  const isPlus = plan.planId.includes("plus")
                  const isPaidCurrent = isCurrentPlanCard && !isFree && hasActiveSubscription

                  return (
                    <Card
                      key={plan.planId}
                      className={cn(
                        "relative overflow-hidden transition-all",
                        isPlus && !isCurrentPlanCard && "border-primary/50 shadow-md shadow-primary/10",
                        isCurrentPlanCard && "ring-2 ring-primary/60",
                      )}
                    >
                      {isPlus && !isCurrentPlanCard && (
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                      )}

                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                              {getPlanDisplayLabel(plan)}
                            </p>
                            {introOffer?.eligible && plan.amount > 0 && !hasActiveSubscription ? (
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg text-muted-foreground line-through">{formatPlanPrice(plan)}</span>
                                <h3 className="text-2xl font-bold text-primary">{formatPlanPrice({ ...plan, amount: applyIntroDiscount(plan.amount, true) })}</h3>
                                <span className="text-sm text-muted-foreground font-normal">/month</span>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1">
                                <h3 className="text-2xl font-bold">{formatPlanPrice(plan)}</h3>
                                {plan.amount > 0 && (
                                  <span className="text-sm text-muted-foreground font-normal">/month</span>
                                )}
                              </div>
                            )}
                            {introOffer?.eligible && plan.amount > 0 && !hasActiveSubscription && (
                              <p className="text-xs font-medium text-primary/90 mt-0.5">
                                {tCommon("intro_offer_first_month_badge", {
                                  percent: introOffer.discountPercent,
                                })}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                              {plan.aiCredits} AI credits · {plan.currency}
                              {plan.amount > 0 && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                    {isPaidCurrent ? t("auto_renewing") : "Refreshes monthly"}
                                  </span>
                                </>
                              )}
                            </p>
                            {isPaidCurrent && renewalDate && (
                              <p className="text-xs text-muted-foreground mt-1">{t("renewsOn", { date: renewalDate })}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1">
                            {isCurrentPlanCard && (
                              <Badge variant="outline" className="text-primary border-primary/50 flex items-center gap-1 text-xs">
                                <CheckCircle className="h-3 w-3" /> {tCommon("current_plan_2")}
                              </Badge>
                            )}
                            {isPaidCurrent && (
                              <Badge className="text-xs gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {t("auto_renewing")}
                              </Badge>
                            )}
                            {isPlus && !isCurrentPlanCard && (
                              <Badge className="text-xs">{tCommon("popular")}</Badge>
                            )}
                          </div>
                        </div>
                        {(plan.description ?? getPlanDisplayDescription(plan)) && (
                          <p className="text-sm text-muted-foreground mt-2">{plan.description ?? getPlanDisplayDescription(plan)}</p>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-4 pt-0">
                        <ul className="space-y-2 text-sm">
                          {Object.entries(plan.features).map(([key, value]) => (
                            <li key={key} className="flex items-center gap-2">
                              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                                <Check className="h-2.5 w-2.5 text-primary" />
                              </div>
                              <span className="text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                </span>
                                :{" "}
                                {typeof value === "boolean" ? (value ? tCommon("yes") : tCommon("no")) : String(value)}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {isPaidCurrent ? (
                          <div className="space-y-2">
                            <Button variant="outline" className="w-full" disabled>
                              <CheckCircle className="mr-2 h-4 w-4" /> {t("your_current_plan")}
                            </Button>
                            {billingContext?.canManageInPortal && (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  className="w-full sm:flex-1"
                                  onClick={() => void handleManageBilling()}
                                  disabled={portalLoading}
                                >
                                  {portalLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                  )}
                                  {t("manage_plan")}
                                </Button>
                                <Button
                                  variant="outline"
                                  className="w-full sm:flex-1"
                                  onClick={() => void handleManageBilling()}
                                  disabled={portalLoading}
                                >
                                  {t("cancel_subscription")}
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : isCurrentPlanCard && isFree ? (
                          <Button variant="outline" className="w-full" disabled>
                            <CheckCircle className="mr-2 h-4 w-4" /> {t("your_current_plan")}
                          </Button>
                        ) : isFree ? (
                          <Button asChild variant="outline" className="w-full">
                            <Link href="/legal-issue-checker">{t("start_free")}</Link>
                          </Button>
                        ) : (
                          <PlanCheckoutButton
                            plan={plan}
                            countryCode={countryCode}
                            isAuthenticated={isAuthenticated}
                            current={
                              billingContext
                                ? {
                                    planId: billingContext.planId,
                                    planTier: billingContext.planTier,
                                    billingPlan: billingContext.billingPlan,
                                    canManageInPortal: billingContext.canManageInPortal,
                                    hasStripeSubscription: billingContext.hasStripeSubscription,
                                  }
                                : undefined
                            }
                            variant={isPlus ? "default" : "outline"}
                            manageHref="/consumer/subscription"
                            signUpHref="/auth?redirect=/consumer/subscription"
                          />
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          </>
        )}

        <div className="mt-10">
          <LegalDisclaimer variant="compact" />
        </div>
      </div>

      <BuyCreditsModal
        open={buyCreditsOpen}
        onOpenChange={setBuyCreditsOpen}
        autoSelectPack={autoSelectPack}
        packs={creditPacks.map((p) => ({
          ...p,
          description: p.description ?? `${p.credits} AI credits`,
          countryCode,
        }))}
        countryCode={countryCode}
      />
    </div>
  )
}
