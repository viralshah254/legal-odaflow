import type { PricingPlan } from "@/lib/api/pricing-plans"

export interface PlanBenefitBullet {
  text: string
  included: boolean
}

function creditsLine(n: number, perSeat = false): string {
  return perSeat
    ? `${n} AI credits / seat / month`
    : `${n} AI credits / month`
}

export function getPlanBenefitBullets(plan: PricingPlan): PlanBenefitBullet[] {
  const n = plan.aiCredits
  const f = plan.features ?? {}

  switch (plan.planId) {
    case "consumer_free":
      return [
        { text: creditsLine(n), included: true },
        { text: "Issue Checker previews", included: true },
        { text: "Save & track your cases", included: true },
        { text: "Upload documents", included: Boolean(f.documentUpload) },
        { text: "Full AI legal reports", included: false },
        { text: "Lawyer review upgrades", included: false },
        { text: "Client portal access", included: false },
      ]
    case "consumer_plus":
      return [
        { text: creditsLine(n), included: true },
        { text: "Full AI legal reports", included: true },
        { text: "Lawyer review upgrades", included: Boolean(f.lawyerReview) },
        { text: "Document upload & analysis", included: Boolean(f.documentUpload) },
        { text: "Client portal access", included: true },
        { text: "Issue Checker included", included: Boolean(f.issueChecker) },
      ]
    case "lawyer_solo":
      return [
        { text: "1 seat · AI Copilot included", included: true },
        { text: creditsLine(n), included: true },
        { text: "Matter workspace & intake", included: true },
        { text: "Meeting transcripts", included: true },
        { text: "Solo bundle — no unused seats", included: true },
      ]
    case "firm_starter":
      return [
        { text: "Per seat pricing", included: true },
        { text: creditsLine(n, true), included: true },
        { text: "Client portal", included: Boolean(f.portal) },
        { text: "Core firm OS — matters, tasks, calendar", included: true },
        { text: "Email support", included: true },
      ]
    case "firm_professional":
      return [
        { text: "Everything in Starter", included: true },
        { text: creditsLine(n, true), included: true },
        { text: "AI Copilot assistant", included: Boolean(f.copilot) },
        { text: "Deep case analysis", included: true },
        { text: "Advanced reporting", included: true },
        { text: "Priority support", included: true },
      ]
    case "firm_pro_plus":
      return [
        { text: "Everything in Professional", included: true },
        { text: creditsLine(n, true), included: true },
        { text: "Higher deep analysis quotas", included: true },
        { text: "Custom integrations", included: Boolean(f.proPlus) },
      ]
    case "firm_enterprise":
      return [
        { text: creditsLine(n), included: true },
        { text: "SSO & data residency", included: true },
        { text: "Dedicated support & SLA", included: Boolean(f.enterprise) },
        { text: "Custom integrations", included: true },
        { text: "Contact sales for pricing", included: true },
      ]
    default:
      return [
        { text: creditsLine(n), included: true },
        { text: "Core platform access", included: true },
      ]
  }
}
