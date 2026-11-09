"use client"

import { useState } from "react"
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
import { cn } from "@/lib/utils"
import { CheckCircle2, Loader2, ArrowUp, ArrowDown, Minus, Zap, Bot, Sparkles } from "lucide-react"
import { updateUserSeatPlan, type SeatPlan } from "@/lib/api/users"

export const SEAT_PLANS: Array<{
  id: SeatPlan
  label: string
  monthlyUsd: number
  credits: number
  color: string
  highlight: boolean
  features: string[]
  icon: React.ReactNode
}> = [
  {
    id: "STARTER",
    label: "Starter",
    monthlyUsd: 25,
    credits: 1500,
    color: "border-gray-200 dark:border-gray-700",
    highlight: false,
    icon: <Zap className="h-4 w-4" />,
    features: ["1,500 AI credits / month", "Client portal", "Core firm OS", "Email support"],
  },
  {
    id: "PROFESSIONAL",
    label: "Professional",
    monthlyUsd: 100,
    credits: 6000,
    color: "border-indigo-500",
    highlight: true,
    icon: <Bot className="h-4 w-4" />,
    features: ["6,000 AI credits / month", "AI Copilot assistant", "Deep case analysis", "Advanced reporting", "Priority support"],
  },
  {
    id: "PRO_PLUS",
    label: "Pro Plus",
    monthlyUsd: 500,
    credits: 30000,
    color: "border-violet-500",
    highlight: false,
    icon: <Sparkles className="h-4 w-4" />,
    features: ["30,000 AI credits / month", "Higher deep analysis quotas", "Custom integrations", "Everything in Professional"],
  },
]

const PLAN_RANK: Record<SeatPlan, number> = { STARTER: 1, PROFESSIONAL: 2, PRO_PLUS: 3 }

function planChangeType(current: SeatPlan, next: SeatPlan): "upgrade" | "downgrade" | "same" {
  const c = PLAN_RANK[current] ?? 1
  const n = PLAN_RANK[next] ?? 1
  if (c === n) return "same"
  return n > c ? "upgrade" : "downgrade"
}

interface ChangeSeatPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  userId: string
  userName: string
  currentPlan: SeatPlan
  countryCode?: string
  onSuccess: (newPlan: SeatPlan, proRataAmount: number) => void
}

export function ChangeSeatPlanDialog({
  open,
  onOpenChange,
  tenantId,
  userId,
  userName,
  currentPlan,
  countryCode,
  onSuccess,
}: ChangeSeatPlanDialogProps) {
  const [selected, setSelected] = useState<SeatPlan>(currentPlan)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeType = planChangeType(currentPlan, selected)
  const selectedPlan = SEAT_PLANS.find((p) => p.id === selected)!

  // Pro-rata estimate: days remaining in month × daily rate
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - now.getDate()
  const proRataUsd = parseFloat(((selectedPlan.monthlyUsd / daysInMonth) * daysRemaining).toFixed(2))

  const handleConfirm = async () => {
    if (selected === currentPlan) { onOpenChange(false); return }
    setLoading(true)
    setError(null)
    try {
      const result = await updateUserSeatPlan(tenantId, userId, { planId: selected, countryCode })
      onSuccess(selected, result.proRataAmount)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update plan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Change Plan for {userName}</DialogTitle>
          <DialogDescription>
            Choose a seat plan. Upgrades take effect immediately with pro-rated billing. Downgrades apply at the next billing cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          {SEAT_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan
            const isSelected = plan.id === selected
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={cn(
                  "relative rounded-xl border-2 p-4 text-left transition-all",
                  plan.color,
                  isSelected
                    ? plan.id === "PROFESSIONAL"
                      ? "bg-indigo-50 dark:bg-indigo-950/40"
                      : plan.id === "PRO_PLUS"
                        ? "bg-violet-50 dark:bg-violet-950/40"
                        : "bg-gray-50 dark:bg-gray-800"
                    : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60",
                )}
              >
                {isSelected && (
                  <CheckCircle2 className={cn(
                    "absolute top-2 right-2 h-4 w-4",
                    plan.id === "PROFESSIONAL" ? "text-indigo-600" : plan.id === "PRO_PLUS" ? "text-violet-600" : "text-gray-500"
                  )} />
                )}
                <div className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold mb-2",
                  plan.id === "PROFESSIONAL"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    : plan.id === "PRO_PLUS"
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                )}>
                  {plan.icon}
                  {plan.label}
                </div>
                <div className="font-bold text-gray-900 dark:text-white text-sm">
                  ${plan.monthlyUsd}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {plan.credits.toLocaleString()} credits
                </div>
                {isCurrent && (
                  <Badge variant="secondary" className="mt-2 text-[10px]">Current</Badge>
                )}
              </button>
            )
          })}
        </div>

        {selected !== currentPlan && (
          <div className={cn(
            "rounded-lg px-4 py-3 text-sm border",
            changeType === "upgrade"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
          )}>
            <div className="flex items-center gap-2 font-medium mb-1">
              {changeType === "upgrade" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {changeType === "upgrade" ? "Upgrading" : "Downgrading"} {userName}&apos;s seat
            </div>
            {changeType === "upgrade" ? (
              <p>
                Pro-rated charge for the remaining <strong>{daysRemaining} days</strong> this month:{" "}
                <strong>${proRataUsd}</strong>. Full price of <strong>${selectedPlan.monthlyUsd}/mo</strong> applies next cycle.
              </p>
            ) : (
              <p>
                Downgrade takes effect at the <strong>next billing cycle</strong>. {userName} keeps {SEAT_PLANS.find(p=>p.id===currentPlan)?.label} features until then.
              </p>
            )}
          </div>
        )}

        {selected === currentPlan && (
          <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-muted-foreground">
            <Minus className="h-4 w-4" /> This is already {userName}&apos;s current plan.
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || selected === currentPlan}
            className={cn(
              selected === "PRO_PLUS" && "bg-violet-600 hover:bg-violet-700",
              selected === "PROFESSIONAL" && "bg-indigo-600 hover:bg-indigo-700",
            )}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>
            ) : (
              `Confirm ${changeType === "upgrade" ? "Upgrade" : changeType === "downgrade" ? "Downgrade" : "Change"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
