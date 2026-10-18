"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowRight,
  Coins,
  Crown,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { CreditPack } from "@/lib/api/credits"


export type CreditGateFeature =
  | "drafting"
  | "documentDraft"
  | "research"
  | "intake"
  | "documentReview"
  | "sectionFinder"

interface InsufficientCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: CreditGateFeature
  balance?: number | null
  loadingBalance?: boolean
  onTopUp: () => void
  /** Opens an inline subscription modal. When provided, router.push is not used. */
  onSubscribe?: () => void
  /** Fallback href for subscribe if onSubscribe is not provided. */
  subscribeHref?: string
  /** Credits this specific action requires — shown as deficit context. */
  requiredCredits?: number
  /** Available packs — used to surface the cheapest pack covering the shortfall. */
  packs?: CreditPack[]
}

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  feature,
  balance,
  loadingBalance,
  onTopUp,
  onSubscribe,
  subscribeHref = "/app/settings/plan-usage",
  requiredCredits,
  packs = [],
}: InsufficientCreditsDialogProps) {
  const t = useTranslations("credits.gate")
  const router = useRouter()

  const shortfall =
    requiredCredits != null && balance != null
      ? Math.max(0, requiredCredits - balance)
      : null

  // Cheapest pack whose credits cover the shortfall
  const recommendedPack =
    shortfall != null && shortfall > 0 && packs.length > 0
      ? packs
          .filter((p) => p.credits >= shortfall)
          .sort((a, b) => a.credits - b.credits)[0] ?? null
      : null

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 border-0 shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 px-6 pt-7 pb-8 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <DialogHeader className="relative space-y-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <Coins className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              {t("title")}
            </DialogTitle>
            <p className="text-sm leading-relaxed text-white/85">
              {t(`features.${feature}`)}
            </p>
          </DialogHeader>

          {/* Balance / deficit row */}
          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              {loadingBalance ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("loadingBalance")}
                </span>
              ) : balance != null ? (
                t("creditsRemaining", { count: balance })
              ) : (
                t("balanceUnknown")
              )}
            </span>
            {requiredCredits != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium ring-1 ring-white/30">
                <Zap className="h-3 w-3" />
                {requiredCredits} credits needed
              </span>
            )}
          </div>

          {/* Shortfall callout */}
          {shortfall != null && shortfall > 0 && (
            <p className="relative mt-3 text-xs text-white/80">
              You are short by <span className="font-semibold text-white">{shortfall} credits</span>. Top up below to continue.
            </p>
          )}
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("subtitle")}</p>

          {/* Recommended pack chip — shown when we can suggest a minimum buy */}
          {recommendedPack && (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-950/30">
              <Zap className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs text-indigo-800 dark:text-indigo-300">
                <span className="font-semibold">{recommendedPack.label}</span> —{" "}
                {recommendedPack.credits} credits ({recommendedPack.currency}{" "}
                {recommendedPack.amount.toLocaleString()}) covers this action.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onTopUp()
            }}
            className={cn(
              "group w-full rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-4 text-left transition-all",
              "hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm",
              "dark:border-indigo-800 dark:bg-indigo-950/40 dark:hover:border-indigo-700",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t("topUpTitle")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("topUpDescription")}</p>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-indigo-500 transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="mt-3">
              <span className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm">
                {t("topUpCta")}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              if (onSubscribe) {
                onSubscribe()
              } else {
                router.push(subscribeHref)
              }
            }}
            className={cn(
              "group flex w-full items-start justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-all",
              "hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm",
              "dark:hover:border-amber-800 dark:hover:bg-amber-950/20",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t("subscribeTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("subscribeDescription")}</p>
              </div>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-amber-600 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="border-t bg-muted/20 px-6 py-3">
          <p className="text-center text-[11px] text-muted-foreground">{t("footer")}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
