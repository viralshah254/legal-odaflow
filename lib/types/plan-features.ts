export type PlanTier = "STARTER" | "PROFESSIONAL" | "ENTERPRISE"

export interface PlanFeatures {
  // Feature flags (what we sell and gate)
  copilot: boolean
  meetingTranscripts: boolean // Meetings, recording, transcripts
  advancedReporting: boolean
  clientPortal: boolean
  apiAccess: boolean
  customIntegrations: boolean
  dedicatedSupport: boolean
  slaGuarantee: boolean
  onPremiseOption: boolean
  // Internal/limits (not shown as plan bullets)
  maxUsers: number | "unlimited"
  maxMatters: number | "unlimited"
  storageGB: number | "unlimited"
  supportLevel: "email" | "priority" | "dedicated"
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  STARTER: {
    copilot: false,
    meetingTranscripts: false,
    advancedReporting: false,
    clientPortal: false,
    apiAccess: false,
    customIntegrations: false,
    dedicatedSupport: false,
    slaGuarantee: false,
    onPremiseOption: false,
    maxUsers: 50,
    maxMatters: "unlimited",
    storageGB: 10,
    supportLevel: "email",
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
    maxUsers: 200,
    maxMatters: "unlimited",
    storageGB: 100,
    supportLevel: "priority",
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
    maxUsers: "unlimited",
    maxMatters: "unlimited",
    storageGB: "unlimited",
    supportLevel: "dedicated",
  },
}

/** Display-friendly feature labels for billing and upgrade prompts. One source of truth. */
export const PLAN_FEATURE_LABELS: Record<PlanTier, string[]> = {
  STARTER: [
    "Unlimited clients & matters",
    "Tasks, calendar & matters",
    "Basic reporting",
    "Email support",
  ],
  PROFESSIONAL: [
    "Everything in Starter",
    "Copilot (AI assistant)",
    "Meeting transcripts & recording",
    "Advanced reporting",
    "Client portal",
    "API access",
    "Priority support",
  ],
  ENTERPRISE: [
    "Everything in Professional",
    "Custom integrations",
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




