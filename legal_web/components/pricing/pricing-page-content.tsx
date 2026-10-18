"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CheckCircle, Lock, Loader2, Sparkles } from "lucide-react"
import { PlanCheckoutButton } from "@/components/pricing/plan-checkout-button"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getCurrentBilling, type CurrentBilling } from "@/lib/api/billing"
import {
  fetchPricingCatalog,
  type PricingPlan,
  type PricingPlansResult,
} from "@/lib/api/pricing-plans"
import {
  CANONICAL_CURRENCY,
} from "@/lib/pricing/country-pricing"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import {
  isContactSalesPlan,
  isCurrentPlan,
  sortFirmPlans,
} from "@/lib/pricing/plan-display"
import { billingPlanToTier } from "@/lib/utils/plan-from-tenant"
import {
  detectCountry,
  persistCountrySelection,
  type DetectedCountry,
} from "@/lib/geo/detect-country"
import { getIntroOfferStatus, type IntroOfferStatus } from "@/lib/api/intro-offer"
import { IntroOfferBanner } from "@/components/marketing/intro-offer-banner"
import { IntroOfferPrice } from "@/components/pricing/intro-offer-price"

interface PricingPageContentProps {
  initialCountryCode: string
  explicitCountry?: string | null
  firmCatalog: PricingPlansResult
  consumerCatalog: PricingPlansResult
  skipGeoGate?: boolean
  ssrDetectionSource?: string
}

function PlanCard({
  plan,
  current,
  periodLabel,
  manageHref,
  countryCode,
  isAuthenticated,
  tenantId,
  featured = false,
  introOffer,
  compact = false,
}: {
  plan: PricingPlan
  current?: CurrentBilling | null
  periodLabel: string
  manageHref: string
  countryCode: string
  isAuthenticated: boolean
  tenantId?: string | null
  featured?: boolean
  introOffer?: IntroOfferStatus | null
  compact?: boolean
}) {
  const t = useTranslations("marketing.pricingPage")
  const tCommon = useTranslations("common")
  const {
    getPlanDisplayLabel,
    getPlanDisplayDescription,
    getPlanBenefitBullets,
    formatEnterprisePrice,
  } = usePlanPricingI18n()
  const isCurrent = isCurrentPlan(plan, current ?? undefined)
  const contactSales = isContactSalesPlan(plan)
  const label = getPlanDisplayLabel(plan)
  const description = getPlanDisplayDescription(plan)
  const benefitBullets = getPlanBenefitBullets(plan)
  const visibleBullets = compact
    ? benefitBullets.filter((b) => b.included).slice(0, 4)
    : benefitBullets
  const buttonVariant = featured && !isCurrent ? "default" : "outline"

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-card transition-all duration-200
        ${compact ? "p-4 gap-3" : "rounded-2xl p-6 gap-6"}
        ${featured
          ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30"
          : isCurrent
            ? "border-primary/40 ring-1 ring-primary/20"
            : "border-border/60 hover:border-primary/20"
        }`}
    >
      {featured && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
            <Sparkles className="h-3 w-3" />
            {t("mostPopular")}
          </span>
        </div>
      )}

      <div className={compact ? "space-y-0.5" : "space-y-1"}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={compact ? "font-semibold text-base" : "font-semibold text-lg"}>{label}</h3>
          {isCurrent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t("currentPlan")}</Badge>
          )}
        </div>
        {!compact && description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}
      </div>

      <div>
        {contactSales ? (
          <p className={compact ? "text-xl font-bold" : "text-3xl font-extrabold tracking-tight"}>{formatEnterprisePrice()}</p>
        ) : (
          <IntroOfferPrice
            amount={plan.amount}
            currency={plan.currency}
            introOffer={introOffer}
            periodLabel={plan.amount > 0 ? periodLabel : undefined}
            size={compact ? "sm" : "lg"}
            showBadge={!compact}
          />
        )}
        {compact && introOffer?.eligible && plan.amount > 0 && !contactSales && (
          <p className="mt-0.5 text-[10px] font-medium text-primary/90 line-clamp-1">
            {tCommon("intro_offer_first_month_badge", {
              percent: introOffer.discountPercent ?? 40,
            })}
          </p>
        )}
      </div>

      <ul className={`flex-1 ${compact ? "space-y-1" : "space-y-2.5"}`}>
        {visibleBullets.map((bullet) => (
          <li key={bullet.text} className={`flex items-start gap-2 ${compact ? "text-xs" : "text-sm gap-2.5"}`}>
            <CheckCircle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${featured ? "text-primary" : "text-primary/80"}`} />
            <span>{bullet.text}</span>
          </li>
        ))}
        {!compact && benefitBullets.filter((b) => !b.included).map((bullet) => (
          <li key={bullet.text} className="flex items-start gap-2.5 text-sm text-muted-foreground/60">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 opacity-30" />
            <span>{bullet.text}</span>
          </li>
        ))}
      </ul>

      <PlanCheckoutButton
        plan={plan}
        countryCode={countryCode}
        isAuthenticated={isAuthenticated}
        tenantId={tenantId}
        current={
          current
            ? {
                planId: current.planId,
                planTier: current.planTier,
                billingPlan: current.billingPlan,
                canManageInPortal: current.canManageInPortal,
                hasStripeSubscription: current.hasStripeSubscription,
              }
            : undefined
        }
        variant={buttonVariant}
        manageHref={manageHref}
      />
    </div>
  )
}

const CONFIDENT_SSR_SOURCES = new Set(["query", "vercel-ip-country", "cf-ipcountry", "ip", "ipapi"])

type PricingAudience = "lawyers" | "consumers"

export function PricingPageContent({
  initialCountryCode,
  explicitCountry,
  firmCatalog: initialFirm,
  consumerCatalog: initialConsumer,
  skipGeoGate = false,
  ssrDetectionSource,
}: PricingPageContentProps) {
  const t = useTranslations("marketing.pricingPage")
  const tCommon = useTranslations("common")
  const { getTierDisplayLabel } = usePlanPricingI18n()
  const { isAuthenticated, user } = useAuth()
  const { setCountryCode: syncCountryContext } = useDetectedCountry()
  const { activeTenant, activeTenantId } = useTenant()

  const defaultAudience: PricingAudience =
    user?.userType === "CONSUMER" ? "consumers" : "lawyers"
  const [audience, setAudience] = useState<PricingAudience>(defaultAudience)

  useEffect(() => {
    if (user?.userType === "CONSUMER") setAudience("consumers")
    else if (user?.userType === "LAWYER") setAudience("lawyers")
  }, [user?.userType])

  const [countryCode, setCountryCode] = useState(initialCountryCode)
  const [firmCatalog, setFirmCatalog] = useState(initialFirm)
  const [consumerCatalog, setConsumerCatalog] = useState(initialConsumer)
  const [geoPending, setGeoPending] = useState(!skipGeoGate)
  const [catalogLoading, setCatalogLoading] = useState(
    !skipGeoGate && !(initialCountryCode && initialFirm.plans.length > 0),
  )
  const [detection, setDetection] = useState<DetectedCountry | null>(
    skipGeoGate && initialCountryCode
      ? { countryCode: initialCountryCode, source: "stored", isDeveloped: false, creditTierPct: 50 }
      : null,
  )

  const loadCatalogs = useCallback(async (code: string) => {
    setCatalogLoading(true)
    try {
      const [firm, consumer] = await Promise.all([
        fetchPricingCatalog({ countryCode: code, userType: "LAW_FIRM" }),
        fetchPricingCatalog({ countryCode: code, userType: "CONSUMER" }),
      ])
      setFirmCatalog(firm)
      setConsumerCatalog(consumer)
      setCountryCode(code)
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skipGeoGate) return
    let cancelled = false

    const ssrReady =
      Boolean(initialCountryCode) &&
      initialFirm.plans.length > 0 &&
      Boolean(ssrDetectionSource) &&
      CONFIDENT_SSR_SOURCES.has(ssrDetectionSource!)

    if (ssrReady) {
      setGeoPending(false)
      setCatalogLoading(false)
      setDetection({ countryCode: initialCountryCode, source: "ip", isDeveloped: false, creditTierPct: 50 })
      syncCountryContext(initialCountryCode as Parameters<typeof syncCountryContext>[0])
    }

    ;(async () => {
      const detected = await detectCountry()
      setGeoPending(false)
      setDetection(detected)
      if (cancelled) return
      syncCountryContext(detected.countryCode as Parameters<typeof syncCountryContext>[0])
      persistCountrySelection(detected.countryCode)
      const code = detected.countryCode.toUpperCase()
      if (ssrReady && code === initialCountryCode.toUpperCase()) return
      await loadCatalogs(code)
    })()

    return () => { cancelled = true }
  }, [skipGeoGate, initialCountryCode, initialFirm.plans.length, ssrDetectionSource, loadCatalogs, syncCountryContext])

  const pricingReady = skipGeoGate
    ? firmCatalog.plans.length > 0
    : !geoPending && !catalogLoading && firmCatalog.plans.length > 0

  const locating = !skipGeoGate && (geoPending || catalogLoading)

  const { data: currentBilling } = useQuery({
    queryKey: ["billing-current", activeTenantId, user?.id],
    queryFn: () => getCurrentBilling(activeTenantId ?? undefined),
    enabled: isAuthenticated,
    retry: 1,
  })

  const { data: introOffer } = useQuery({
    queryKey: ["intro-offer", user?.id, activeTenantId],
    queryFn: () => getIntroOfferStatus(activeTenantId ?? undefined),
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const currentFromTenant = useMemo((): CurrentBilling | null => {
    if (currentBilling) return currentBilling
    if (!isAuthenticated || !activeTenant?.tenant) return null
    const billingPlan = activeTenant.tenant.billingPlan
    return {
      userType: "LAW_FIRM",
      billingPlan,
      planTier: "FREE",
      planId: "",
      subscriptionStatus: null,
      countryCode: activeTenant.tenant.primaryCountry ?? countryCode,
      hasStripeSubscription: false,
      canManageInPortal: false,
      providerSubscriptionId: null,
    }
  }, [currentBilling, isAuthenticated, activeTenant, countryCode])

  const displayCurrency = firmCatalog.currency ?? CANONICAL_CURRENCY

  const firmPlans = useMemo(() => {
    const sorted = sortFirmPlans(firmCatalog.plans)
    return {
      grid: sorted.filter((p) => p.planId !== "firm_enterprise"),
      enterprise: sorted.find((p) => p.planId === "firm_enterprise"),
    }
  }, [firmCatalog.plans])

  const currentTierLabel = currentFromTenant
    ? currentFromTenant.subscriptionStatus === "ACTIVE" ||
      currentFromTenant.hasStripeSubscription ||
      (currentFromTenant.billingPlan &&
        currentFromTenant.billingPlan !== "FREE" &&
        currentFromTenant.billingPlan !== "TRIAL_PENDING_PAYMENT")
      ? getTierDisplayLabel(
          typeof currentFromTenant.planTier === "string" && currentFromTenant.planTier !== "FREE"
            ? currentFromTenant.planTier
            : billingPlanToTier(currentFromTenant.billingPlan),
        )
      : t("freePlan")
    : null

  const manageHref = user?.userType === "LAWYER" ? "/app/settings/plan-usage" : "/consumer/settings"

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />

      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-[#f5f8ff] via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[320px] w-[320px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2.5">
              <h1 className="text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">{t("title")}</h1>
              <p className="max-w-xl text-slate-600">
                {t.rich("subtitle", { strong: (chunks) => <strong className="text-slate-900">{chunks}</strong> })}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isAuthenticated && currentTierLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs">
                    <span className="text-slate-500">{t("yourPlan")}</span>
                    <strong className="text-blue-700">{currentTierLabel}</strong>
                  </span>
                )}
                {isAuthenticated && introOffer?.eligible && (
                  <IntroOfferBanner introOffer={introOffer} compact />
                )}
              </div>
            </div>

            {pricingReady && (
              <div
                className="inline-flex shrink-0 self-start rounded-full border border-slate-200 bg-white p-1 shadow-sm"
                role="tablist"
                aria-label="Pricing audience"
              >
                {(["lawyers", "consumers"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={audience === key}
                    onClick={() => setAudience(key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      audience === key
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {key === "lawyers" ? t("audienceLawyers") : t("audienceConsumers")}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-12 pt-6">

        {/* Loading state */}
        {locating && (
          <div
            className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-900">
              {geoPending ? tCommon("loading") : t("loadingPlans")}
            </p>
          </div>
        )}

        {pricingReady && (
          <>
            {audience === "lawyers" && (
              <section className="space-y-4">
                <p className="text-sm text-slate-500">
                  {t("firmPlansSubtitle")} · {t("perSeatMonth").replace(/^\//, "")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                  {firmPlans.grid.map((plan) => (
                    <PlanCard
                      key={plan.planId}
                      plan={plan}
                      current={currentFromTenant}
                      periodLabel={t("perSeatMonth")}
                      manageHref={manageHref}
                      countryCode={countryCode}
                      isAuthenticated={isAuthenticated}
                      tenantId={activeTenantId}
                      featured={plan.planId === "firm_professional"}
                      introOffer={introOffer}
                      compact
                    />
                  ))}
                </div>
                {firmPlans.enterprise && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{t("enterprisePrompt")}</span>
                      <span className="ml-2 text-slate-500">{t("enterpriseFeatures")}</span>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-full">
                      <Link href="/app/settings/sso">
                        {t("enterpriseSettings")}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                )}
              </section>
            )}

            {audience === "consumers" && (
              <section className="space-y-4">
                <p className="text-sm text-slate-500">{t("consumerDescription")}</p>
                <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                  {consumerCatalog.plans.map((plan) => (
                    <PlanCard
                      key={plan.planId}
                      plan={plan}
                      current={isAuthenticated ? currentFromTenant : null}
                      periodLabel={t("perMonth")}
                      manageHref="/consumer/settings"
                      countryCode={countryCode}
                      isAuthenticated={isAuthenticated}
                      tenantId={activeTenantId}
                      featured={plan.planId === "consumer_plus"}
                      introOffer={introOffer}
                      compact
                    />
                  ))}
                </div>
              </section>
            )}

            <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
              {t("creditsFootnote")}{" "}
              {t.rich("deepAnalysisNote", { strong: (chunks) => <strong className="text-slate-900">{chunks}</strong> })}
            </p>
          </>
        )}
      </main>

      <CinematicFooter />
    </div>
  )
}
