"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, Sparkles, ArrowRight } from "lucide-react"
import { PlanTier, PLAN_FEATURE_LABELS } from "@/lib/types/plan-features"
import { useTenant } from "@/lib/contexts/tenant-context"
import { usePricing } from "@/lib/contexts/pricing-context"
import { billingPlanToTier, hasPlanAccess } from "@/lib/utils/plan-from-tenant"
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

function formatPlanLabel(plan: PlanTier): string {
  return plan
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}

function UpgradeDialogContent({
  feature,
  description,
  requiredPlan,
  onUpgrade,
  currentPlan,
}: {
  feature: string
  description?: string
  requiredPlan: PlanTier
  onUpgrade: () => void
  currentPlan: PlanTier | null
}) {
  const t = useTranslations("common")
  const { pricing, getProfessionalPricePerUser } = usePricing()

  if (!currentPlan) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("view_plans_and_upgrade_from_billing")}</p>
        <Button className="w-full" onClick={onUpgrade}>
          Go to Billing
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  const planLabel = formatPlanLabel(currentPlan)

  const professionalPrice = getProfessionalPricePerUser()
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
            <p className="text-sm font-medium">{t("current_plan")}</p>
            <p className="text-xs text-muted-foreground">{planLabel}</p>
          </div>
          <Badge variant="outline">{planLabel}</Badge>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary">
          <div>
            <p className="text-sm font-medium">{t("professional_plan")}</p>
            <p className="text-xs text-muted-foreground">
              {pricing.currencySymbol}
              {professionalPrice.toFixed(2)}/seat/month
            </p>
          </div>
          <Badge className="bg-primary">{t("professional")}</Badge>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t("additional_cost")}</span>
          <span className="text-lg font-bold text-primary">
            +{pricing.currencySymbol}
            {upgradePrice.toFixed(2)}/seat/month
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Upgrade from {pricing.currencySymbol}
          {currentPrice.toFixed(2)} to {pricing.currencySymbol}
          {professionalPrice.toFixed(2)} per seat
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("professional_includes")}</p>
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
  const t = useTranslations("common")
  const router = useRouter()
  const { activeTenant } = useTenant()
  const [open, setOpen] = useState(false)
  const currentPlan = billingPlanToTier(activeTenant?.tenant.billingPlan)

  if (currentPlan === "ENTERPRISE") {
    return null
  }

  const isLocked = !currentPlan || !hasPlanAccess(currentPlan, requiredPlan)
  if (!isLocked) {
    return null
  }

  const handleUpgrade = () => {
    setOpen(false)
    router.push("/app/settings/plan-usage?upgrade=professional")
  }

  return (
    <>
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30",
          className,
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
                {currentPlan
                  ? t("upgrade_to_unlock_on_professional")
                  : t("available_on_professional")}
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
              <DialogTitle>{t("upgrade_to_professional")}</DialogTitle>
            </div>
            <DialogDescription>
              {currentPlan
                ? t("upgrade_existing_plan_description", {
                    plan: formatPlanLabel(currentPlan),
                    feature,
                  })
                : t("feature_requires_professional", { feature })}
            </DialogDescription>
          </DialogHeader>
          <UpgradeDialogContent
            feature={feature}
            description={description}
            requiredPlan={requiredPlan}
            onUpgrade={handleUpgrade}
            currentPlan={currentPlan}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
