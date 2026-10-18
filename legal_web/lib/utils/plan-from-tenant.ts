import type { PlanTier } from "@/lib/types/plan-features"

const STARTER_ALIASES = new Set([
  "STARTER",
  "FIRM_STARTER",
  "TRIAL",
  "TRIAL_PENDING_PAYMENT",
])

const SOLO_ALIASES = new Set(["SOLO", "LAWYER_SOLO", "FIRM_SOLO"])

const PROFESSIONAL_ALIASES = new Set([
  "PROFESSIONAL",
  "PRO",
  "FIRM_PROFESSIONAL",
])

const PRO_PLUS_ALIASES = new Set(["PRO_PLUS", "FIRM_PRO_PLUS", "PROPLUS"])

const ENTERPRISE_ALIASES = new Set(["ENTERPRISE", "FIRM_ENTERPRISE"])

export function billingPlanToTier(
  billingPlan: string | null | undefined,
): PlanTier | null {
  if (!billingPlan) return null
  const upper = billingPlan.toUpperCase()

  if (STARTER_ALIASES.has(upper)) return "STARTER"
  if (SOLO_ALIASES.has(upper)) return "SOLO"
  if (PRO_PLUS_ALIASES.has(upper)) return "PRO_PLUS"
  if (PROFESSIONAL_ALIASES.has(upper)) return "PROFESSIONAL"
  if (ENTERPRISE_ALIASES.has(upper)) return "ENTERPRISE"

  return null
}

export function hasPlanAccess(
  currentPlan: PlanTier | null,
  requiredPlan: PlanTier,
): boolean {
  if (!currentPlan) return false

  const tierRank: Record<PlanTier, number> = {
    STARTER: 1,
    SOLO: 2,
    PROFESSIONAL: 3,
    PRO_PLUS: 4,
    ENTERPRISE: 5,
  }

  return tierRank[currentPlan] >= tierRank[requiredPlan]
}

export function planIncludesCopilot(billingPlan: string | null | undefined): boolean {
  const tier = resolvePlanTierForFeatures(billingPlan)
  if (!tier) return false
  return tier === "SOLO" || tier === "PROFESSIONAL" || tier === "PRO_PLUS" || tier === "ENTERPRISE"
}

/** Resolve billing plan tier; in dev, missing plan defaults to PROFESSIONAL for local testing. */
export function resolvePlanTierForFeatures(
  billingPlan: string | null | undefined,
): PlanTier | null {
  const tier = billingPlanToTier(billingPlan)
  if (tier) return tier
  if (process.env.NODE_ENV === "development") return "PROFESSIONAL"
  return null
}
