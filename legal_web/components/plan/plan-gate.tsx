"use client"

import { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { PlanTier } from "@/lib/types/plan-features"
import { hasPlanAccess, resolvePlanTierForFeatures } from "@/lib/utils/plan-from-tenant"
import { UpgradePrompt } from "./upgrade-prompt"

interface PlanGateProps {
  children: ReactNode
  requiredPlan?: PlanTier
  feature?: string
  description?: string
  fallback?: ReactNode
}

export function PlanGate({
  children,
  requiredPlan = "PROFESSIONAL",
  feature,
  description,
  fallback,
}: PlanGateProps) {
  const { activeTenant, isLoading } = useTenant()
  const currentPlan = resolvePlanTierForFeatures(activeTenant?.tenant.billingPlan)

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!currentPlan) {
    return (
      <UpgradePrompt
        feature={feature || "This feature"}
        description={description}
        requiredPlan={requiredPlan}
      />
    )
  }

  if (hasPlanAccess(currentPlan, requiredPlan)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <UpgradePrompt
      feature={feature || "This feature"}
      description={description}
      requiredPlan={requiredPlan}
    />
  )
}
