import { apiFetch } from "./client"

export type TrainingConsentStatus = "GRANTED" | "DENIED" | "WITHDRAWN"

export interface TrainingConsentRecord {
  id?: string
  scope: string
  consentStatus: TrainingConsentStatus
  consentTextVersion: string
  jurisdictionCountryCode: string
  canUseForPromptImprove: boolean
  canUseForEvaluation: boolean
  canUseForFineTuning: boolean
  requiresAnonymization: boolean
  grantedAt?: string | null
  withdrawnAt?: string | null
  updatedAt?: string
}

export interface UpdateTrainingConsentRequest {
  consentStatus?: TrainingConsentStatus
  canUseForPromptImprove?: boolean
  canUseForEvaluation?: boolean
  canUseForFineTuning?: boolean
  jurisdictionCountryCode?: string
}

const DEFAULT_DENIED: Omit<TrainingConsentRecord, "scope"> = {
  consentStatus: "DENIED",
  consentTextVersion: "1.0",
  jurisdictionCountryCode: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? "IN",
  canUseForPromptImprove: false,
  canUseForEvaluation: false,
  canUseForFineTuning: false,
  requiresAnonymization: true,
}

function mapConsent(row: TrainingConsentRecord): TrainingConsentRecord {
  return {
    id: row.id,
    scope: row.scope,
    consentStatus: row.consentStatus,
    consentTextVersion: row.consentTextVersion,
    jurisdictionCountryCode: row.jurisdictionCountryCode,
    canUseForPromptImprove: row.canUseForPromptImprove,
    canUseForEvaluation: row.canUseForEvaluation,
    canUseForFineTuning: row.canUseForFineTuning,
    requiresAnonymization: row.requiresAnonymization,
    grantedAt: row.grantedAt,
    withdrawnAt: row.withdrawnAt,
    updatedAt: row.updatedAt,
  }
}

export async function getFirmTrainingConsent(
  tenantId: string,
): Promise<TrainingConsentRecord> {
  try {
    const row = await apiFetch<TrainingConsentRecord>("/training-consent/me/current", {
      tenantId,
    })
    return mapConsent(row)
  } catch {
    return { scope: "TENANT_DOCUMENTS", ...DEFAULT_DENIED }
  }
}

export async function updateFirmTrainingConsent(
  tenantId: string,
  data: UpdateTrainingConsentRequest,
): Promise<TrainingConsentRecord> {
  const granted = data.consentStatus === "GRANTED"
  const row = await apiFetch<TrainingConsentRecord>("/training-consent/me/current", {
    method: "PATCH",
    tenantId,
    body: {
      ...data,
      canUseForPromptImprove: granted ? (data.canUseForPromptImprove ?? false) : false,
      canUseForEvaluation: granted ? (data.canUseForEvaluation ?? false) : false,
      canUseForFineTuning: granted ? (data.canUseForFineTuning ?? false) : false,
    },
  })
  return mapConsent(row)
}

export async function withdrawFirmTrainingConsent(tenantId: string, consentId: string) {
  return apiFetch(`/training-consent/${consentId}/withdraw`, {
    method: "POST",
    tenantId,
  })
}

export async function getConsumerTrainingConsent(): Promise<TrainingConsentRecord> {
  try {
    const row = await apiFetch<TrainingConsentRecord>("/training-consent/me/current")
    return mapConsent(row)
  } catch {
    return { scope: "USER_DOCUMENTS", ...DEFAULT_DENIED }
  }
}

export async function updateConsumerTrainingConsent(
  data: UpdateTrainingConsentRequest,
): Promise<TrainingConsentRecord> {
  const granted = data.consentStatus === "GRANTED"
  const row = await apiFetch<TrainingConsentRecord>("/training-consent/me/current", {
    method: "PATCH",
    body: {
      ...data,
      canUseForPromptImprove: granted ? (data.canUseForPromptImprove ?? false) : false,
      canUseForEvaluation: granted ? (data.canUseForEvaluation ?? false) : false,
      canUseForFineTuning: granted ? (data.canUseForFineTuning ?? false) : false,
    },
  })
  return mapConsent(row)
}

export async function withdrawConsumerTrainingConsent(consentId: string) {
  return apiFetch(`/training-consent/${consentId}/withdraw`, { method: "POST" })
}
