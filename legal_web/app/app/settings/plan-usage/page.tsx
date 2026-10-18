"use client"
import { useTranslations } from "next-intl"

import { Suspense, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react"
import Link from "next/link"
import { PlanUsagePanel } from "@/components/credits/PlanUsagePanel"
import { IntroOfferBanner } from "@/components/marketing/intro-offer-banner"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getCreditWallet } from "@/lib/api/credits"
import { getIntroOfferStatus } from "@/lib/api/intro-offer"

function isFreeLawyerWallet(wallet: { hasActiveSubscription?: boolean; planMonthlyPrice?: number; userSegment?: string }) {
  if (wallet.hasActiveSubscription === true) return false
  if (wallet.hasActiveSubscription === false) return true
  if ((wallet.planMonthlyPrice ?? 0) > 0) return false
  const segment = wallet.userSegment ?? ""
  return segment === "LAWYER_SOLO" || segment.startsWith("FIRM") || segment === "ENTERPRISE"
}

function PlanUsageContent() {
  const tSettings = useTranslations("settings")
  const { activeTenantId, refreshTenants } = useTenant()
  const { user, isAuthenticated } = useAuth()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const justSubscribed = searchParams.get("subscribed") === "1"

  useEffect(() => {
    if (!justSubscribed) return
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["plan-usage"] }),
      queryClient.invalidateQueries({ queryKey: ["credit-wallet"] }),
      queryClient.invalidateQueries({ queryKey: ["billing-current"] }),
      refreshTenants(),
    ])
  }, [justSubscribed, queryClient, refreshTenants])

  const { data, isLoading } = useQuery({
    queryKey: ["plan-usage", activeTenantId],
    queryFn: () => getCreditWallet(activeTenantId ?? undefined),
    staleTime: justSubscribed ? 0 : 60_000,
  })

  const { data: introOffer } = useQuery({
    queryKey: ["intro-offer", user?.id, activeTenantId],
    queryFn: () => getIntroOfferStatus(activeTenantId ?? undefined),
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Unable to load plan usage.
      </div>
    )
  }

  return (
    <>
      {justSubscribed && data?.wallet.hasActiveSubscription && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-50/50 px-4 py-3.5 dark:bg-green-950/20">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-900 dark:text-green-200">
            {tSettings("planUsageSubscribedBanner")}
          </p>
        </div>
      )}
      <PlanUsagePanel
        wallet={data.wallet}
        packs={data.packs}
        tenantId={activeTenantId ?? undefined}
        countryCode={data.wallet.countryCode ?? "US"}
        introOffer={introOffer}
      />
    </>
  )
}

export default function PlanUsagePage() {
  const tCommon = useTranslations("common")
  const tSettings = useTranslations("settings")
  const { activeTenantId } = useTenant()

  const { data } = useQuery({
    queryKey: ["plan-usage", activeTenantId],
    queryFn: () => getCreditWallet(activeTenantId ?? undefined),
    staleTime: 60_000,
  })

  const wallet = data?.wallet
  const subtitle = (() => {
    if (!wallet?.userSegment) {
      return "Credits consumed this billing cycle and AI model preferences"
    }
    if (wallet.userSegment.startsWith("CONSUMER")) {
      return "Your individual plan, credit balance and top-up options"
    }
    if (isFreeLawyerWallet(wallet)) {
      return tSettings("planUsageFreePageSubtitle")
    }
    return tSettings("planUsageActivePageSubtitle")
  })()

  return (
    <div className="px-4 py-8 md:px-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/app/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{tCommon("plan_usage")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <PlanUsageContent />
      </Suspense>
    </div>
  )
}
