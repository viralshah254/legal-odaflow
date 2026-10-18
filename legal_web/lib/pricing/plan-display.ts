import type { PlanTier } from "@/lib/types/plan-features"
import { billingPlanToTier } from "@/lib/utils/plan-from-tenant"
import type { PricingPlan } from "@/lib/api/pricing-plans"

export const FIRM_PLAN_ORDER = [
  "firm_solo_entry",
  "firm_starter",
  "firm_professional",
  "firm_pro_plus",
  "firm_enterprise",
] as const

/** Retired from public pricing UI and new checkouts; existing subscribers may remain. */
export const RETIRED_PRICING_PLAN_IDS = new Set(["lawyer_solo"])

export function isRetiredPricingPlan(planId: string): boolean {
  return RETIRED_PRICING_PLAN_IDS.has(planId)
}

export function filterPublicPricingPlans(plans: PricingPlan[]): PricingPlan[] {
  return plans.filter((plan) => !isRetiredPricingPlan(plan.planId))
}

const PLAN_ID_TO_TIER: Record<string, PlanTier> = {
  firm_solo_entry: "SOLO",
  lawyer_solo: "SOLO",
  firm_starter: "STARTER",
  firm_professional: "PROFESSIONAL",
  firm_pro_plus: "PRO_PLUS",
  firm_enterprise: "ENTERPRISE",
  consumer_free: "STARTER",
  consumer_plus: "PROFESSIONAL",
}

const PLAN_LABELS: Record<string, { label: string; description?: string }> = {
  firm_solo_entry: {
    label: "Solo Entry",
    description: "One lawyer · Copilot, matters, and AI credits — India entry plan",
  },
  lawyer_solo: {
    label: "Solo",
    description: "One lawyer — Copilot, matters, and monthly AI credits",
  },
  firm_starter: {
    label: "Starter",
    description: "Per seat · Client portal and core firm OS",
  },
  firm_professional: {
    label: "Professional",
    description: "Per seat · Copilot, advanced reporting, deep analysis",
  },
  firm_pro_plus: {
    label: "Pro Plus",
    description: "Per seat · Higher AI credit allowance",
  },
  firm_enterprise: {
    label: "Enterprise",
    description: "SSO, data residency, SCIM, and dedicated support",
  },
  consumer_free: {
    label: "Free",
    description: "Issue checker and limited AI previews",
  },
  consumer_plus: {
    label: "Plus",
    description: "Full reports and lawyer review options",
  },
}

const TIER_LABELS: Record<PlanTier, string> = {
  STARTER: "Starter",
  SOLO: "Solo",
  PROFESSIONAL: "Professional",
  PRO_PLUS: "Pro Plus",
  ENTERPRISE: "Enterprise",
}

export function planIdToTier(planId: string): PlanTier | null {
  return PLAN_ID_TO_TIER[planId] ?? null
}

export function getPlanDisplayLabel(plan: PricingPlan): string {
  return plan.label ?? PLAN_LABELS[plan.planId]?.label ?? plan.planId.replace(/^firm_/, "").replace(/_/g, " ")
}

export function getPlanDisplayDescription(plan: PricingPlan): string | undefined {
  return plan.description ?? PLAN_LABELS[plan.planId]?.description
}

export function isContactSalesPlan(plan: PricingPlan): boolean {
  return Boolean(plan.features.contactSales || plan.features.enterprise)
}

export function hasPaidSubscription(current?: {
  hasStripeSubscription?: boolean
}): boolean {
  return current?.hasStripeSubscription === true
}

function isFreeTierPlan(plan: PricingPlan): boolean {
  return plan.planId === "consumer_free" || plan.amount === 0
}

function planSortIndex(planId: string): number {
  const idx = FIRM_PLAN_ORDER.indexOf(planId as (typeof FIRM_PLAN_ORDER)[number])
  return idx === -1 ? 999 : idx
}

export function sortFirmPlans(plans: PricingPlan[]): PricingPlan[] {
  return [...plans].sort((a, b) => planSortIndex(a.planId) - planSortIndex(b.planId))
}

export function isCurrentPlan(
  plan: PricingPlan,
  current?: {
    planId?: string | null
    planTier?: string | null
    billingPlan?: string | null
    hasStripeSubscription?: boolean
  },
): boolean {
  if (!current) return false

  // Free catalog plans match any user without a paid Stripe subscription.
  if (isFreeTierPlan(plan)) {
    return !hasPaidSubscription(current)
  }

  // Paid plans require an active Stripe subscription to be "current".
  if (!hasPaidSubscription(current)) {
    return false
  }

  if (current.planId && current.planId === plan.planId) return true
  const tier = current.planTier
    ? (current.planTier as PlanTier)
    : billingPlanToTier(current.billingPlan)
  if (!tier || tier === ("FREE" as PlanTier)) return false
  return planIdToTier(plan.planId) === tier
}

export function getTierDisplayLabel(tier: string | null | undefined): string {
  if (!tier) return "Free"
  if (tier === "FREE" || tier === "PLUS") {
    return tier === "PLUS" ? "Plus" : "Free"
  }
  return TIER_LABELS[tier as PlanTier] ?? tier
}

export function formatEnterprisePrice(): string {
  return "Contact us"
}

/**
 * Converts raw wallet `userSegment` values (e.g. "CONSUMER", "consumer_plus",
 * "FIRM_PROFESSIONAL", "firm_starter") into a human-readable plan label.
 */
export function formatWalletSegmentLabel(segment: string | null | undefined): string {
  if (!segment) return "Free Plan"
  const s = segment.toLowerCase().replace(/[-\s]/g, "_")
  const MAP: Record<string, string> = {
    consumer: "Free Plan",
    consumer_free: "Free Plan",
    consumer_plus: "Plus Plan",
    firm_solo_entry: "Solo Entry Plan",
    firm_starter: "Starter Plan",
    firm_professional: "Professional Plan",
    firm_pro_plus: "Pro Plus Plan",
    firm_enterprise: "Enterprise Plan",
    lawyer_solo: "Solo Plan",
    starter: "Starter Plan",
    professional: "Professional Plan",
    pro_plus: "Pro Plus Plan",
    solo: "Solo Plan",
    enterprise: "Enterprise Plan",
    free: "Free Plan",
    plus: "Plus Plan",
  }
  return MAP[s] ?? segment.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const TIER_RANK: Record<PlanTier, number> = {
  STARTER: 1,
  SOLO: 2,
  PROFESSIONAL: 3,
  PRO_PLUS: 4,
  ENTERPRISE: 5,
}

export type PlanChangeAction =
  | "current"
  | "upgrade"
  | "downgrade"
  | "subscribe"
  | "contact_sales"
  | "switch"

export function getPlanChangeAction(
  plan: PricingPlan,
  current?: {
    planId?: string | null
    planTier?: string | null
    billingPlan?: string | null
    hasStripeSubscription?: boolean
    isAuthenticated?: boolean
  },
): PlanChangeAction {
  if (isContactSalesPlan(plan)) {
    return "contact_sales"
  }
  if (isCurrentPlan(plan, current)) {
    return "current"
  }
  if (!current?.isAuthenticated) {
    return "subscribe"
  }

  if (!hasPaidSubscription(current)) {
    if (!current?.isAuthenticated) return "subscribe"
    return "upgrade"
  }

  const currentTier = current.planTier
    ? (current.planTier as PlanTier)
    : billingPlanToTier(current.billingPlan)
  const targetTier = planIdToTier(plan.planId)

  if (!currentTier || !targetTier) {
    return "subscribe"
  }

  const currentRank = TIER_RANK[currentTier] ?? 0
  const targetRank = TIER_RANK[targetTier] ?? 0

  if (targetRank > currentRank) {
    return "upgrade"
  }
  if (targetRank < currentRank) {
    return "downgrade"
  }
  return "switch"
}

export function getPlanActionLabel(
  action: PlanChangeAction,
  options?: { usePortal?: boolean },
): string {
  if (action === "current") {
    return options?.usePortal ? "Manage in Stripe" : "Manage plan"
  }
  if (action === "contact_sales") {
    return "Contact sales"
  }
  if (action === "subscribe") {
    return "Get started"
  }
  if (action === "upgrade") {
    return "Upgrade"
  }
  if (action === "downgrade") {
    return "Downgrade"
  }
  return "Switch plan"
}
