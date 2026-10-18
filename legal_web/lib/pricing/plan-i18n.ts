"use client"

import { useTranslations } from "next-intl"
import type { PricingPlan } from "@/lib/api/pricing-plans"
import type { PlanBenefitBullet } from "@/lib/pricing/plan-benefits"
import type { PlanChangeAction } from "@/lib/pricing/plan-display"

const PLAN_LABEL_KEYS: Record<string, string> = {
  lawyer_solo: "planSolo",
  firm_starter: "planStarter",
  firm_professional: "planProfessional",
  firm_pro_plus: "planProPlus",
  firm_enterprise: "planEnterprise",
  consumer_free: "planFree",
  consumer_plus: "planPlus",
}

const PLAN_TAGLINE_KEYS: Record<string, string> = {
  lawyer_solo: "taglineLawyerSolo",
  firm_starter: "taglineFirmStarter",
  firm_professional: "taglineFirmProfessional",
  firm_pro_plus: "taglineFirmProPlus",
  firm_enterprise: "taglineFirmEnterprise",
  consumer_free: "taglineFree",
  consumer_plus: "taglinePlus",
}

const TIER_LABEL_KEYS: Record<string, string> = {
  STARTER: "planStarter",
  SOLO: "planSolo",
  PROFESSIONAL: "planProfessional",
  PRO_PLUS: "planProPlus",
  ENTERPRISE: "planEnterprise",
  FREE: "planFree",
  PLUS: "planPlus",
}

const WALLET_SEGMENT_KEYS: Record<string, string> = {
  consumer: "planFreePlan",
  consumer_free: "planFreePlan",
  consumer_plus: "planPlusPlan",
  firm_starter: "planStarterPlan",
  firm_professional: "planProfessionalPlan",
  firm_pro_plus: "planProPlusPlan",
  firm_enterprise: "planEnterprisePlan",
  lawyer_solo: "planSoloPlan",
  starter: "planStarterPlan",
  professional: "planProfessionalPlan",
  pro_plus: "planProPlusPlan",
  solo: "planSoloPlan",
  enterprise: "planEnterprisePlan",
  free: "planFreePlan",
  plus: "planPlusPlan",
}

export function usePlanPricingI18n() {
  const tBenefits = useTranslations("consumer.planBenefits")
  const tConsumer = useTranslations("consumer")
  const tPricing = useTranslations("marketing.pricingPage")

  function creditsLine(n: number, perSeat = false): string {
    return perSeat
      ? tBenefits("creditsPerSeatMonthShort", { count: n })
      : tBenefits("creditsPerMonthShort", { count: n })
  }

  function getPlanDisplayLabel(plan: PricingPlan): string {
    if (plan.label) return plan.label
    const key = PLAN_LABEL_KEYS[plan.planId]
    if (key === "planProfessional") return tConsumer("planProfessional")
    return key ? tConsumer(key) : plan.planId.replace(/^firm_/, "").replace(/_/g, " ")
  }

  function getPlanDisplayDescription(plan: PricingPlan): string | undefined {
    if (plan.description) return plan.description
    const key = PLAN_TAGLINE_KEYS[plan.planId]
    return key ? tBenefits(key) : undefined
  }

  function getTierDisplayLabel(tier: string | null | undefined): string {
    if (!tier) return tConsumer("planFree")
    const key = TIER_LABEL_KEYS[tier]
    if (key === "planProfessional") return tConsumer("planProfessional")
    return key ? tConsumer(key) : tier
  }

  function formatEnterprisePrice(): string {
    return tPricing("contactUs")
  }

  function formatWalletSegmentLabel(segment: string | null | undefined): string {
    if (!segment) return tConsumer("planFreePlan")
    const normalized = segment.toLowerCase().replace(/[-\s]/g, "_")
    const key = WALLET_SEGMENT_KEYS[normalized]
    return key ? tConsumer(key) : segment.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function getPlanActionLabel(
    action: PlanChangeAction,
    options?: { usePortal?: boolean; isFreeTier?: boolean },
  ): string {
    if (action === "current") {
      if (options?.isFreeTier) return tPricing("currentPlan")
      return options?.usePortal ? tPricing("manageInStripe") : tPricing("managePlan")
    }
    if (action === "contact_sales") return tPricing("contactSales")
    if (action === "subscribe") return tConsumer("getStarted")
    if (action === "upgrade") return tPricing("upgrade")
    if (action === "downgrade") return tPricing("downgrade")
    return tPricing("switchPlan")
  }

  function getPlanBenefitBullets(plan: PricingPlan): PlanBenefitBullet[] {
    const n = plan.aiCredits
    const f = plan.features ?? {}

    switch (plan.planId) {
      case "consumer_free":
        return [
          { text: creditsLine(n), included: true },
          { text: tBenefits("issueCheckerPreviews"), included: true },
          { text: tBenefits("saveTrackCases"), included: true },
          { text: tBenefits("uploadDocuments"), included: Boolean(f.documentUpload) },
          { text: tBenefits("fullAiLegalReports"), included: false },
          { text: tBenefits("lawyerReviewUpgrades"), included: false },
          { text: tBenefits("clientPortalAccess"), included: false },
        ]
      case "consumer_plus":
        return [
          { text: creditsLine(n), included: true },
          { text: tBenefits("fullAiLegalReports"), included: true },
          { text: tBenefits("lawyerReviewUpgrades"), included: Boolean(f.lawyerReview) },
          { text: tBenefits("documentUploadAnalysis"), included: Boolean(f.documentUpload) },
          { text: tBenefits("clientPortalAccess"), included: true },
          { text: tBenefits("issueCheckerIncluded"), included: Boolean(f.issueChecker) },
        ]
      case "lawyer_solo":
        return [
          { text: tBenefits("oneSeatCopilot"), included: true },
          { text: creditsLine(n), included: true },
          { text: tBenefits("matterWorkspaceIntake"), included: true },
          { text: tBenefits("meetingTranscripts"), included: true },
          { text: tBenefits("soloBundleNoUnusedSeats"), included: true },
        ]
      case "firm_starter":
        return [
          { text: tBenefits("perSeatPricing"), included: true },
          { text: creditsLine(n, true), included: true },
          { text: tBenefits("clientPortal"), included: Boolean(f.portal) },
          { text: tBenefits("coreFirmOs"), included: true },
          { text: tBenefits("emailSupport"), included: true },
        ]
      case "firm_professional":
        return [
          { text: tBenefits("everythingInStarter"), included: true },
          { text: creditsLine(n, true), included: true },
          { text: tBenefits("aiCopilotAssistant"), included: Boolean(f.copilot) },
          { text: tBenefits("deepCaseAnalysis"), included: true },
          { text: tBenefits("advancedReporting"), included: true },
          { text: tBenefits("prioritySupport"), included: true },
        ]
      case "firm_pro_plus":
        return [
          { text: tBenefits("everythingInProfessional"), included: true },
          { text: creditsLine(n, true), included: true },
          { text: tBenefits("higherDeepAnalysisQuotas"), included: true },
          { text: tBenefits("customIntegrations"), included: Boolean(f.proPlus) },
        ]
      case "firm_enterprise":
        return [
          { text: creditsLine(n), included: true },
          { text: tBenefits("ssoDataResidency"), included: true },
          { text: tBenefits("dedicatedSupportSla"), included: Boolean(f.enterprise) },
          { text: tBenefits("customIntegrations"), included: true },
          { text: tBenefits("contactSalesForPricing"), included: true },
        ]
      default:
        return [
          { text: creditsLine(n), included: true },
          { text: tBenefits("corePlatformAccess"), included: true },
        ]
    }
  }

  return {
    getPlanDisplayLabel,
    getPlanDisplayDescription,
    getTierDisplayLabel,
    formatEnterprisePrice,
    formatWalletSegmentLabel,
    getPlanActionLabel,
    getPlanBenefitBullets,
  }
}

export type PlanPricingI18n = ReturnType<typeof usePlanPricingI18n>
