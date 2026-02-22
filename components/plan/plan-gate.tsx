"use client"

import { ReactNode } from "react"
import { getCurrentSubscription } from "@/lib/mock/subscription"
import { PlanTier, PLAN_FEATURES, hasFeature } from "@/lib/types/plan-features"
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
  fallback 
}: PlanGateProps) {
  const subscription = getCurrentSubscription()

  // If no subscription (e.g. SSR or no localStorage yet), show upgrade placeholder
  // so server and client render the same and hydration doesn't fail.
  if (!subscription) {
    return (
      <UpgradePrompt
        feature={feature || "This feature"}
        description={description}
        requiredPlan={requiredPlan}
      />
    )
  }

  // Check if user has required plan
  const hasAccess = subscription.plan === "ENTERPRISE" || 
    (requiredPlan === "PROFESSIONAL" && subscription.plan === "PROFESSIONAL") ||
    (requiredPlan === "STARTER" && (subscription.plan === "STARTER" || subscription.plan === "PROFESSIONAL" || subscription.plan === "ENTERPRISE"))

  if (hasAccess) {
    return <>{children}</>
  }

  // Show upgrade prompt or fallback
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




