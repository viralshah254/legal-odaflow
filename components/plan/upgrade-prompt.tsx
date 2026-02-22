"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, Sparkles, ArrowRight } from "lucide-react"
import { PlanTier, PLAN_FEATURE_LABELS } from "@/lib/types/plan-features"
import { getCurrentSubscription } from "@/lib/mock/subscription"
import { usePricing } from "@/lib/contexts/pricing-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface UpgradePromptProps {
  feature: string
  description?: string
  requiredPlan?: PlanTier
  className?: string
}

/** Full upgrade content shown inside the modal (shared logic). */
function UpgradeDialogContent({
  feature,
  description,
  requiredPlan,
  onUpgrade,
}: {
  feature: string
  description?: string
  requiredPlan: PlanTier
  onUpgrade: () => void
}) {
  const subscription = getCurrentSubscription()
  const { pricing } = usePricing()
  if (!subscription) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">View plans and upgrade from Billing.</p>
        <Button className="w-full" onClick={onUpgrade}>
          Go to Billing
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  const professionalPrice = pricing.pricePerUser * 1.5
  const currentPrice = pricing.pricePerUser
  const upgradePrice = professionalPrice - currentPrice

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
          <div>
            <p className="text-sm font-medium">Current Plan</p>
            <p className="text-xs text-muted-foreground">Starter</p>
          </div>
          <Badge variant="outline">Starter</Badge>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary">
          <div>
            <p className="text-sm font-medium">Professional Plan</p>
            <p className="text-xs text-muted-foreground">
              {subscription.currencySymbol}
              {professionalPrice.toFixed(2)}/seat/month
            </p>
          </div>
          <Badge className="bg-primary">Professional</Badge>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Additional Cost</span>
          <span className="text-lg font-bold text-primary">
            +{subscription.currencySymbol}
            {(upgradePrice * subscription.userCount).toFixed(2)}/month
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Upgrade from {subscription.currencySymbol}
          {currentPrice.toFixed(2)} to {subscription.currencySymbol}
          {professionalPrice.toFixed(2)} per seat
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Professional includes:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {PLAN_FEATURE_LABELS.PROFESSIONAL.filter((l) => !l.startsWith("Everything")).map((label) => (
            <li key={label} className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <Button className="w-full" onClick={onUpgrade}>
        Upgrade to Professional
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

export function UpgradePrompt({
  feature,
  description,
  requiredPlan = "PROFESSIONAL",
  className,
}: UpgradePromptProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const subscription = getCurrentSubscription()

  // Enterprise always has access; never show prompt.
  if (subscription?.plan === "ENTERPRISE") {
    return null
  }
  // No subscription (SSR) or has required plan: show placeholder for SSR/hydration consistency.
  const isLocked = !subscription || (subscription.plan === "STARTER" && requiredPlan === "PROFESSIONAL")
  if (!isLocked) {
    return null
  }

  const handleUpgrade = () => {
    setOpen(false)
    router.push("/app/settings/billing?upgrade=professional")
  }

  return (
    <>
      {/* Compact placeholder: preserves layout, no impact on main UI. Click opens modal. */}
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <CardContent className="flex flex-row items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{feature}</p>
              <p className="text-xs text-muted-foreground">
                Available on Professional
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(true)
            }}
          >
            Upgrade
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <DialogTitle>Upgrade to Professional</DialogTitle>
            </div>
            <DialogDescription>
              {feature} is available in the Professional plan
            </DialogDescription>
          </DialogHeader>
          <UpgradeDialogContent
            feature={feature}
            description={description}
            requiredPlan={requiredPlan}
            onUpgrade={handleUpgrade}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
