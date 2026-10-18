"use client"
import { useState } from "react"
import { format } from "date-fns"
import { Zap, Loader2, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { boostPlan } from "@/lib/api/credits"

interface BoostPlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planLabel: string
  planCredits: number
  planMonthlyPrice: number
  planCurrency: string
  cycleStartAt: string | null
  cycleEndAt: string | null
  tenantId?: string
  onSuccess?: () => void
}

export function BoostPlanModal({
  open,
  onOpenChange,
  planLabel,
  planCredits,
  planMonthlyPrice,
  planCurrency,
  cycleStartAt,
  cycleEndAt,
  tenantId,
  onSuccess,
}: BoostPlanModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cycleEndFormatted = cycleEndAt ? format(new Date(cycleEndAt), "MMM d, yyyy") : null

  const daysRemaining = cycleEndAt
    ? Math.max(1, Math.round((new Date(cycleEndAt).getTime() - Date.now()) / 86_400_000))
    : 15
  const totalCycleDays = cycleStartAt && cycleEndAt
    ? Math.max(1, Math.round((new Date(cycleEndAt).getTime() - new Date(cycleStartAt).getTime()) / 86_400_000))
    : 30
  const proRatedPrice = planMonthlyPrice > 0
    ? Number(((planMonthlyPrice * daysRemaining) / totalCycleDays).toFixed(2))
    : null

  const handleBoost = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await boostPlan(tenantId)
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        onSuccess?.()
        onOpenChange(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-background px-6 pt-6 pb-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              Double your credits
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="mt-1.5 text-sm leading-snug">
            Add {planCredits.toLocaleString()} more credits to your {planLabel} plan for the rest of this billing cycle.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* What you get */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Credits added
              </span>
              <span className="font-semibold">+{planCredits.toLocaleString()}</span>
            </div>
            {cycleEndFormatted && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expires</span>
                <span className="font-medium">{cycleEndFormatted}</span>
              </div>
            )}
            {proRatedPrice != null && proRatedPrice > 0 && (
              <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                <span className="text-muted-foreground">
                  Pro-rated price
                  <span className="ml-1 text-xs">({daysRemaining} days left)</span>
                </span>
                <span className="font-bold text-base">
                  {planCurrency} {proRatedPrice.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            One-time charge · Secure checkout · Credits never expire within the cycle
          </p>

          {error && (
            <p className="text-xs text-destructive text-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleBoost}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to checkout…
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Boost — {planCurrency} {proRatedPrice?.toLocaleString() ?? "…"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
