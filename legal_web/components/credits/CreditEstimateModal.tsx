"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import { Loader2, Sparkles, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { estimateCreditTask, type CreditEstimateResponse } from "@/lib/api/credits"

interface CreditEstimateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskType: string
  taskLabel?: string
  tenantId?: string
  modelMode?: "AUTO" | "PREMIUM"
  premiumModelId?: string
  onConfirm: () => void
  onBuyCredits?: () => void
}

export function CreditEstimateModal({
  open,
  onOpenChange,
  taskType,
  taskLabel,
  tenantId,
  modelMode,
  premiumModelId,
  onConfirm,
  onBuyCredits,
}: CreditEstimateModalProps) {
  const t = useTranslations("common")
  const [estimate, setEstimate] = useState<CreditEstimateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setEstimate(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    estimateCreditTask({ taskType, modelMode, premiumModelId }, tenantId)
      .then(setEstimate)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to estimate credits"))
      .finally(() => setLoading(false))
  }, [open, taskType, tenantId, modelMode, premiumModelId])

  const handleConfirm = () => {
    onOpenChange(false)
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Credit estimate
          </DialogTitle>
          <DialogDescription>
            {taskLabel ?? taskType.replace(/_/g, " ").toLowerCase()} — review cost before running
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {estimate && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs mb-1">{t("estimated_cost")}</p>
                <p className="text-xl font-bold">{estimate.estimatedCredits} credits</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs mb-1">{t("your_balance")}</p>
                <p className="text-xl font-bold">{estimate.balance} credits</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t("model")}</span>
              <Badge variant="outline">{estimate.modelTier}</Badge>
              <span className="truncate">{estimate.modelName}</span>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("balance_after", { balance: estimate.balanceAfter })}
            </p>

            {!estimate.sufficient && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{t("insufficient_credits")}</p>
                  <p className="text-muted-foreground mt-1">
                    You need {estimate.estimatedCredits - estimate.balance} more credits to run this task.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!estimate?.sufficient && onBuyCredits ? (
            <Button onClick={onBuyCredits}>{t("buy_credits")}</Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={loading || !!error || (estimate != null && !estimate.sufficient)}
            >
              Run task ({estimate?.estimatedCredits ?? "…"} credits)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
