"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Zap } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getCreditWallet } from "@/lib/api/credits"
import { isFirebaseConfigured, getFirebaseAuth } from "@/lib/firebase"
import { subscribeToCredits } from "@/lib/firestore/credits"

interface CreditUsageMeterProps {
  tenantId?: string
  compact?: boolean
  /** Optional live balance override from an external Firestore subscription (e.g. CreditBalanceWidget). */
  liveBalance?: number
  /** Where the compact meter links — consumer subscription vs firm plan usage. */
  planUsageHref?: string
}

export function CreditUsageMeter({
  tenantId,
  compact = false,
  liveBalance,
  planUsageHref = "/app/settings/plan-usage",
}: CreditUsageMeterProps) {
  // REST-polled base data
  const { data } = useQuery({
    queryKey: ["credit-wallet-meter", tenantId],
    queryFn: () => getCreditWallet(tenantId ?? undefined),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  // Live Firestore override for instant balance updates after AI usage / top-ups
  const [firestoreBalance, setFirestoreBalance] = useState<number | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured()) return

    const firebaseUser = getFirebaseAuth().currentUser
    if (!firebaseUser?.uid) return

    const unsub = subscribeToCredits(
      firebaseUser.uid,
      (balance) => setFirestoreBalance(balance),
    )
    unsubRef.current = unsub
    return () => {
      unsub()
      unsubRef.current = null
    }
  }, [])

  const wallet = data?.wallet
  if (!wallet) return null

  // Priority: external prop > internal Firestore subscription > REST value
  const balance = liveBalance ?? firestoreBalance ?? wallet.balance
  const percent = wallet.planCreditsMonthly > 0
    ? Math.min(100, Math.round(((wallet.planCreditsMonthly - (wallet.creditsUsedThisCycle ?? 0)) / wallet.planCreditsMonthly) * 100))
    : 0
  const isLow = wallet.percentUsed >= 80
  const isExhausted = wallet.percentUsed >= 100

  if (compact) {
    return (
      <Link
        href={planUsageHref}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          "hover:bg-muted/60",
          isExhausted
            ? "text-destructive"
            : isLow
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground hover:text-foreground",
        )}
        title={`${balance.toLocaleString()} credits remaining · ${wallet.percentUsed}% used`}
      >
        <Zap
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isExhausted ? "text-destructive" : isLow ? "text-amber-500" : "text-primary",
          )}
        />
        <span className="tabular-nums">{balance.toLocaleString()}</span>
        <span className="text-xs opacity-60">·</span>
        <span className="text-xs opacity-70">{wallet.percentUsed}%</span>
      </Link>
    )
  }

  // Full-size version (not used in topbar currently, available for future use)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Zap className="h-3.5 w-3.5 text-primary" />
          {balance.toLocaleString()} credits
        </span>
        <span className="text-xs text-muted-foreground">{wallet.percentUsed}% used</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isExhausted ? "bg-destructive" : isLow ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${Math.min(100, wallet.percentUsed)}%` }}
        />
      </div>
    </div>
  )
}
