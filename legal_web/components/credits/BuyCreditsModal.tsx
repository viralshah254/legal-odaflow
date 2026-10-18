"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import { Loader2, Sparkles, Zap, Star, Flame, DollarSign } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { startCreditTopupCheckout, type CreditPack } from "@/lib/api/credits"
import { trackCheckoutStarted } from "@/lib/analytics/posthog"
import { getCreditPackValueHint } from "@/lib/pricing/credit-pack-hints"
import { getFirestoreCreditPacks } from "@/lib/firestore/credits"
import { cn } from "@/lib/utils"

interface BuyCreditsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packs: CreditPack[]
  countryCode: string
  tenantId?: string
  /** If set, auto-start checkout for this packId when modal opens */
  autoSelectPack?: string
  /** Local currency code and approximate exchange rate for the custom amount hint */
  localCurrency?: string
  /** Approximate USD-to-local exchange rate (1 USD = X local). Falls back to 1 if not provided. */
  usdToLocalRate?: number
  /** Page path to return to after Stripe completes successfully */
  returnPath?: string
  /** Called when the user wants to switch to the subscription plan modal instead */
  onSwitchToSubscription?: () => void
}

const PACK_META: Record<string, { icon: React.ElementType; accent: string; badge?: string }> = {
  pack_10: { icon: Zap,   accent: "from-blue-500/10 to-blue-600/5 border-blue-500/30",  badge: undefined },
  pack_25: { icon: Star,  accent: "from-primary/15 to-primary/5 border-primary/50",     badge: "Popular" },
  pack_50: { icon: Flame, accent: "from-amber-500/10 to-orange-500/5 border-amber-500/30", badge: "Best value" },
}

const MIN_AMOUNT_USD = 5

function estimateCreditsForAmount(amountUsd: number, packs: CreditPack[]): number {
  // Use pack_10 USD base price as the reference rate
  const ref = packs.find((p) => p.packId === "pack_10") ?? packs[0]
  if (!ref) return 0
  const refUsd = ref.currency === "USD" ? ref.amount : (ref.usdPrice ?? 10)
  const rate = ref.credits / (refUsd || 10)
  return Math.round(amountUsd * rate)
}

export function BuyCreditsModal({
  open,
  onOpenChange,
  packs: apiPacks,
  countryCode,
  tenantId,
  autoSelectPack,
  localCurrency,
  usdToLocalRate = 1,
  returnPath,
  onSwitchToSubscription,
}: BuyCreditsModalProps) {
  const t = useTranslations("common")
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [packs, setPacks] = useState<CreditPack[]>(apiPacks)
  const [customAmount, setCustomAmount] = useState("")
  const [customCheckingOut, setCustomCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Try to hydrate packs from Firestore (richer metadata, no-deploy updates)
  useEffect(() => {
    if (!open) return
    getFirestoreCreditPacks().then((fsPacks) => {
      if (fsPacks && fsPacks.length > 0) {
        const merged = fsPacks.map((fp) => {
          const api = apiPacks.find((p) => p.packId === fp.packId)
          return api ? { ...fp, amount: api.amount, currency: api.currency, countryCode: api.countryCode } : fp
        })
        if (merged.length) setPacks(merged)
      }
    })
  }, [open, apiPacks])

  // Auto-checkout a specific pack when modal is opened with autoSelectPack
  useEffect(() => {
    if (open && autoSelectPack && packs.length > 0) {
      void handleCheckout(autoSelectPack)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoSelectPack])

  const handleCheckout = async (packId: string) => {
    setCheckingOut(packId)
    setCheckoutError(null)
    try {
      const pack = packs.find((p) => p.packId === packId)
      trackCheckoutStarted({
        checkoutType: "credit_topup",
        packId,
        amount: pack?.amount,
        currency: pack?.currency,
        tenantId,
      })
      const result = await startCreditTopupCheckout(
        { countryCode, packId, returnPath: returnPath || undefined },
        tenantId,
      )
      const url = result.checkoutUrl
      if (url && (url.startsWith("https://checkout.stripe.com") || url.startsWith("https://buy.stripe.com"))) {
        window.location.href = url
      } else {
        setCheckoutError("Payment could not be started. Please try again or contact support.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again."
      setCheckoutError(msg)
    } finally {
      setCheckingOut(null)
    }
  }

  const customAmountUsd = parseFloat(customAmount) || 0
  const customAmountValid = customAmountUsd >= MIN_AMOUNT_USD
  const customLocalAmount = localCurrency && usdToLocalRate !== 1
    ? (customAmountUsd * usdToLocalRate).toFixed(0)
    : null
  const estimatedCredits = customAmountValid ? estimateCreditsForAmount(customAmountUsd, packs) : 0

  const handleCustomCheckout = async () => {
    if (!customAmountValid) return
    setCustomCheckingOut(true)
    setCheckoutError(null)
    try {
      trackCheckoutStarted({
        checkoutType: "credit_topup",
        packId: "custom",
        amount: customAmountUsd,
        currency: "USD",
        tenantId,
      })
      const result = await startCreditTopupCheckout(
        { countryCode, customAmountUsd, returnPath: returnPath || undefined },
        tenantId,
      )
      const url = result.checkoutUrl
      if (url && (url.startsWith("https://checkout.stripe.com") || url.startsWith("https://buy.stripe.com"))) {
        window.location.href = url
      } else {
        setCheckoutError("Payment could not be started. Please try again or contact support.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again."
      setCheckoutError(msg)
    } finally {
      setCustomCheckingOut(false)
    }
  }

  const displayPacks = packs.length > 0 ? packs : apiPacks
  const anyLoading = checkingOut !== null || customCheckingOut

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-background px-6 pt-6 pb-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              Buy AI credits
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1.5 text-sm text-muted-foreground leading-snug">
            Credits power AI reports and issue checks. 60% of every purchase goes directly to AI compute.
          </p>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">1</span>
              Issue check
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">20</span>
              Full report
            </span>
          </div>
        </div>

        {/* Checkout error */}
        {checkoutError && (
          <div className="mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {checkoutError}
          </div>
        )}

        {/* Pack list */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {displayPacks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("no_credit_packs_available_for_your_region")}</p>
          ) : (
            displayPacks.map((pack) => {
              const meta = PACK_META[pack.packId] ?? { icon: Sparkles, accent: "from-muted/50 to-muted/20 border-border" }
              const Icon = meta.icon
              const valueHint = getCreditPackValueHint(pack.credits)
              const isLoading = checkingOut === pack.packId
              const isAnother = anyLoading && !isLoading

              return (
                <div
                  key={pack.packId}
                  className={cn(
                    "relative rounded-xl border bg-gradient-to-br p-4 transition-all",
                    meta.accent,
                    meta.badge === "Popular" && "shadow-sm shadow-primary/20",
                  )}
                >
                  {meta.badge && (
                    <Badge
                      className={cn(
                        "absolute -top-2.5 right-4 text-xs px-2 py-0",
                        meta.badge === "Best value"
                          ? "bg-amber-500 text-white hover:bg-amber-500"
                          : "bg-primary text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {meta.badge}
                    </Badge>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm border border-border/50">
                        <Icon className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight">{pack.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{valueHint}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold leading-none tabular-nums">
                        {pack.currency} {pack.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pack.credits} credits · one-time</p>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-3 h-9"
                    size="sm"
                    variant={meta.badge === "Popular" ? "default" : "outline"}
                    onClick={() => handleCheckout(pack.packId)}
                    disabled={isLoading || isAnother}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Redirecting to checkout…
                      </>
                    ) : (
                      `Buy ${pack.credits} credits`
                    )}
                  </Button>
                </div>
              )
            })
          )}

          {/* Custom amount */}
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Custom amount</p>
                <p className="text-xs text-muted-foreground">Enter any amount · minimum $5 USD</p>
              </div>
            </div>

            <div className="flex gap-2 items-start">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min={MIN_AMOUNT_USD}
                  step="1"
                  placeholder="12"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-7 h-9"
                />
              </div>
              <Button
                size="sm"
                className="h-9 shrink-0"
                onClick={handleCustomCheckout}
                disabled={!customAmountValid || anyLoading}
              >
                {customCheckingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Buy"
                )}
              </Button>
            </div>

            {/* Live hint */}
            {customAmountUsd > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {!customAmountValid && (
                  <p className="text-amber-600 dark:text-amber-400">Minimum amount is $5 USD</p>
                )}
                {customAmountValid && (
                  <>
                    <p>
                      ≈ {estimatedCredits.toLocaleString()} credits
                      {customLocalAmount && localCurrency ? (
                        <span className="ml-1 text-muted-foreground">
                          · charged as {localCurrency} {parseInt(customLocalAmount).toLocaleString()}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] opacity-70">Exact amount converted at checkout · one-time · credits never expire</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-3 flex items-center justify-between gap-4">
          {onSwitchToSubscription ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSwitchToSubscription()
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Want monthly credits? View plans →
            </button>
          ) : (
            <span />
          )}
          <p className="text-[11px] text-muted-foreground text-right">
            Secure · Stripe · Credits never expire
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
