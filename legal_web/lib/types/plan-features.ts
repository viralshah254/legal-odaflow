export type PlanTier = "STARTER" | "SOLO" | "PROFESSIONAL" | "PRO_PLUS" | "ENTERPRISE"

export interface PlanFeatures {
  copilot: boolean
  meetingTranscripts: boolean
  advancedReporting: boolean
  clientPortal: boolean
  apiAccess: boolean
  customIntegrations: boolean
  dedicatedSupport: boolean
  slaGuarantee: boolean
  onPremiseOption: boolean
  deepCaseAnalysis: boolean
  maxUsers: number | "unlimited"
  maxMatters: number | "unlimited"
  storageGB: number | "unlimited"
  supportLevel: "email" | "priority" | "dedicated"
  similarCasesPerMonth: number
  opponentAnglesPerMonth: number
  strategyMemoPerMonth: number
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  STARTER: {
    copilot: false,
    meetingTranscripts: false,
    advancedReporting: false,
    clientPortal: true,
    apiAccess: false,
    customIntegrations: false,
    dedicatedSupport: false,
    slaGuarantee: false,
    onPremiseOption: false,
    deepCaseAnalysis: false,
    maxUsers: 50,
    maxMatters: "unlimited",
    storageGB: 10,
    supportLevel: "email",
    similarCasesPerMonth: 0,
    opponentAnglesPerMonth: 0,
    strategyMemoPerMonth: 0,
  },
  SOLO: {
    copilot: true,
    meetingTranscripts: true,
    advancedReporting: false,
    clientPortal: false,
    apiAccess: false,
    customIntegrations: false,
    dedicatedSupport: false,
    slaGuarantee: false,
    onPremiseOption: false,
    deepCaseAnalysis: false,
    maxUsers: 1,
    maxMatters: "unlimited",
    storageGB: 25,
    supportLevel: "email",
    similarCasesPerMonth: 0,
    opponentAnglesPerMonth: 0,
    strategyMemoPerMonth: 0,
  },
  PROFESSIONAL: {
    copilot: true,
    meetingTranscripts: true,
    advancedReporting: true,
    clientPortal: true,
    apiAccess: true,
    customIntegrations: false,
    dedicatedSupport: false,
    slaGuarantee: false,
    onPremiseOption: false,
    deepCaseAnalysis: true,
    maxUsers: 200,
    maxMatters: "unlimited",
    storageGB: 100,
    supportLevel: "priority",
    similarCasesPerMonth: 5,
    opponentAnglesPerMonth: 5,
    strategyMemoPerMonth: 3,
  },
  PRO_PLUS: {
    copilot: true,
    meetingTranscripts: true,
    advancedReporting: true,
    clientPortal: true,
    apiAccess: true,
    customIntegrations: true,
    dedicatedSupport: false,
    slaGuarantee: false,
    onPremiseOption: false,
    deepCaseAnalysis: true,
    maxUsers: 200,
    maxMatters: "unlimited",
    storageGB: 250,
    supportLevel: "priority",
    similarCasesPerMonth: 15,
    opponentAnglesPerMonth: 15,
    strategyMemoPerMonth: 10,
  },
  ENTERPRISE: {
    copilot: true,
    meetingTranscripts: true,
    advancedReporting: true,
    clientPortal: true,
    apiAccess: true,
    customIntegrations: true,
    dedicatedSupport: true,
    slaGuarantee: true,
    onPremiseOption: true,
    deepCaseAnalysis: true,
    maxUsers: "unlimited",
    maxMatters: "unlimited",
    storageGB: "unlimited",
    supportLevel: "dedicated",
    similarCasesPerMonth: 20,
    opponentAnglesPerMonth: 20,
    strategyMemoPerMonth: 10,
  },
}

export const PLAN_FEATURE_LABELS: Record<PlanTier, string[]> = {
  STARTER: [
    "Unlimited clients & matters",
    "Tasks, calendar & matters",
    "Basic reporting",
    "Email support",
  ],
  SOLO: [
    "1 seat · Copilot included",
    "Matter workspace & intake",
    "Meeting transcripts",
    "120 AI credits / month",
  ],
  PROFESSIONAL: [
    "Everything in Starter",
    "Copilot (AI assistant)",
    "Meeting transcripts & recording",
    "Advanced reporting",
    "Client portal",
    "Deep case analysis",
    "API access",
    "Priority support",
  ],
  PRO_PLUS: [
    "Everything in Professional",
    "750 AI credits / month (~1.5× Pro)",
    "Lower AI markup (20% net margin)",
    "Higher deep analysis quotas",
    "Custom integrations",
  ],
  ENTERPRISE: [
    "Everything in Pro Plus",
    "Dedicated support",
    "SLA guarantee",
    "On-premise option",
  ],
}

export function hasFeature(plan: PlanTier, feature: keyof PlanFeatures): boolean {
  return PLAN_FEATURES[plan][feature] === true
}

export function getFeatureLimit(plan: PlanTier, feature: keyof PlanFeatures): number | "unlimited" {
  const value = PLAN_FEATURES[plan][feature]
  if (typeof value === "number" || value === "unlimited") {
    return value
  }
  return "unlimited"
}
