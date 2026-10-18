"use client"
import { useTranslations } from "next-intl"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { getCreditWallet } from "@/lib/api/credits"
import { useAuth } from "@/lib/contexts/auth-context"
import { CreditUsageMeter } from "@/components/credits/CreditUsageMeter"
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal"
import { subscribeToCredits } from "@/lib/firestore/credits"
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase"
import { Loader2, Sparkles } from "lucide-react"

interface CreditBalanceWidgetProps {
  compact?: boolean
}

export function CreditBalanceWidget({ compact = false }: CreditBalanceWidgetProps) {
  const t = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const tSettings = useTranslations("settings")
  const { isAuthenticated, user } = useAuth()
  const [buyOpen, setBuyOpen] = useState(false)
  const [liveBalance, setLiveBalance] = useState<number | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const tenantId = user?.userType === "LAWYER" ? user.tenantId : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["credit-wallet", tenantId ?? "consumer"],
    queryFn: () => getCreditWallet(tenantId),
    enabled: isAuthenticated,
  })

  // REST wallet fetch seeds Firestore via backend Admin SDK; subscribe for live updates
  useEffect(() => {
    if (!isAuthenticated || !data?.wallet) return
    if (!isFirebaseConfigured()) return

    const fbUser = getFirebaseAuth().currentUser
    if (!fbUser) return

    // Subscribe to real-time balance
    unsubRef.current?.()
    unsubRef.current = subscribeToCredits(fbUser.uid, (balance) => {
      setLiveBalance(balance)
    })

    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [isAuthenticated, data?.wallet?.balance, data?.wallet?.userSegment])

  if (!isAuthenticated) return null

  if (isLoading) {
    return compact ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const wallet = data?.wallet
  const displayBalance = liveBalance ?? wallet?.balance ?? 0
  const planUsageHref = tenantId ? "/app/settings/plan-usage" : "/consumer/subscription"
  const isFreeConsumer =
    wallet?.userSegment === "CONSUMER_FREE" ||
    (wallet?.userSegment?.startsWith("CONSUMER") && !wallet?.hasActiveSubscription)
  const creditsUsed = wallet?.creditsUsedThisCycle ?? wallet?.usedCreditsThisCycle ?? 0
  const planCreditsMonthly = wallet?.planCreditsMonthly ?? 0
  const packageCreditsRemaining =
    wallet?.packageCreditsRemaining ??
    Math.max(0, Math.min(displayBalance, planCreditsMonthly - creditsUsed))

  if (compact) {
    return (
      <>
        <CreditUsageMeter
          compact
          tenantId={tenantId}
          liveBalance={liveBalance ?? undefined}
          planUsageHref={planUsageHref}
        />
        <BuyCreditsModal
          open={buyOpen}
          onOpenChange={setBuyOpen}
          packs={data?.packs ?? []}
          countryCode={data?.wallet.countryCode ?? "IN"}
        />
      </>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t("ai_credits")}
            </CardDescription>
            {liveBalance !== null && liveBalance !== data?.wallet.balance && (
              <span className="text-[10px] text-primary font-medium animate-pulse">Live</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CreditUsageMeter
            tenantId={tenantId}
            liveBalance={liveBalance ?? undefined}
            planUsageHref={planUsageHref}
          />
          <p className="text-sm text-muted-foreground">
            {isFreeConsumer
              ? tSettings("planUsageFreeCreditsRemaining", {
                  remaining: displayBalance.toLocaleString(),
                })
              : tSettings("planUsageCreditsRemaining", {
                  remaining: packageCreditsRemaining.toLocaleString(),
                })}
          </p>
          {planCreditsMonthly > 0 && (
            <p className="text-xs text-muted-foreground">
              {isFreeConsumer
                ? tSettings("planUsageFreeCreditsDescription", {
                    count: planCreditsMonthly.toLocaleString(),
                  })
                : `${creditsUsed.toLocaleString()} of ${planCreditsMonthly.toLocaleString()} credits used this cycle`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {data?.packs && data.packs.length > 0 && (
              <Button size="sm" onClick={() => setBuyOpen(true)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Buy credits
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href="/consumer/subscription">{tCommon("view_plans")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <BuyCreditsModal
        open={buyOpen}
        onOpenChange={setBuyOpen}
        packs={data?.packs ?? []}
        countryCode={data?.wallet.countryCode ?? "IN"}
      />
    </>
  )
}
