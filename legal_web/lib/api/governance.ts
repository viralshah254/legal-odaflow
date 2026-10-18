import { apiFetch } from "./client"
import type { UserRole } from "@/lib/types/roles"

// ── Role permissions ──────────────────────────────────────────────────────────

/** The flat boolean keys of RolePermissions that can be toggled per role. */
export type FlatRolePermissionKey =
  | "canViewAllMatters"
  | "canViewTeam"
  | "canViewFinance"
  | "canCreateMatter"
  | "canAssignTasks"
  | "canViewAllTasks"
  | "canViewAllCalendar"
  | "canManageSettings"
  | "canApproveTrust"

/** Server-side override map: role → flat permission overrides. */
export type TenantRolePermissionsMap = Partial<
  Record<UserRole, Partial<Record<FlatRolePermissionKey, boolean>>>
>

export async function getRolePermissions(tenantId: string): Promise<TenantRolePermissionsMap> {
  return apiFetch<TenantRolePermissionsMap>(
    `/tenants/${tenantId}/governance/role-permissions`,
  )
}

export async function updateRolePermissions(
  tenantId: string,
  map: TenantRolePermissionsMap,
): Promise<TenantRolePermissionsMap> {
  return apiFetch<TenantRolePermissionsMap>(
    `/tenants/${tenantId}/governance/role-permissions`,
    { method: "PUT", body: map },
  )
}

// ── Governance settings ───────────────────────────────────────────────────────

export interface AiPolicySettings {
  disclaimerRequired: boolean
  citationGuardrails: boolean
  trainingOptOut: boolean
  requireLawyerApproval: boolean
}

export type TransferSafeguard =
  | "NOT_APPLICABLE"
  | "ADEQUACY_DECISION"
  | "CONTRACTUAL_SAFEGUARDS"
  | "EXPLICIT_CONSENT"
  | "OTHER_DOCUMENTED_SAFEGUARD"
  | "UNASSESSED"

export interface PrivacyAssessment {
  sensitiveDataHandled: boolean | null
  crossBorderTransfers: boolean | null
  transferSafeguard: TransferSafeguard
  residencyConfirmed: boolean
  dpiaCompleted: boolean
  assessedAt?: string
  assessedBy?: string
}

export interface PrivacyAssessmentStatus {
  policyVersion: string
  countryCode: string
  status: "READY" | "BLOCKED"
  processingAllowed: boolean
  trainingAllowed: boolean
  integrationsAllowed: boolean
  blockers: string[]
  evaluatedAt: string
}

export interface GovernanceSettings {
  ethicalWallsEnabled: boolean
  dataRetentionDays: number
  aiTrainingOptOut: boolean
  requireMatterApprovalForSharing: boolean
  copilotPolicy?: string
  aiPolicy?: AiPolicySettings
  privacyAssessment: PrivacyAssessment
  privacyStatus?: PrivacyAssessmentStatus
  updatedAt?: string
}

export async function getGovernanceSettings(tenantId: string): Promise<GovernanceSettings> {
  return apiFetch<GovernanceSettings>(
    "/governance/settings",
    { tenantId },
  )
}

export async function updateGovernanceSettings(
  tenantId: string,
  update: Partial<GovernanceSettings>,
): Promise<GovernanceSettings> {
  return apiFetch<GovernanceSettings>(
    "/governance/settings",
    { method: "PATCH", tenantId, body: update },
  )
}

// ── Firm profile ──────────────────────────────────────────────────────────────

export interface DocumentBranding {
  showLogoOnExports: boolean
}

export interface FirmProfileData {
  id?: string
  tenantId?: string
  displayName?: string | null
  logoUrl?: string | null
  address?: string | null
  documentBranding?: DocumentBranding
}

export async function getFirmProfile(tenantId: string): Promise<FirmProfileData | null> {
  const data = await apiFetch<{ firmProfile?: FirmProfileData | null }>(
    `/tenants/${tenantId}/governance/policies`,
  )
  const profile = data.firmProfile ?? null
  if (!profile) return null
  const settings = (profile as unknown as { settings?: { documentBranding?: DocumentBranding } }).settings
  return {
    ...profile,
    documentBranding: settings?.documentBranding ?? { showLogoOnExports: false },
  }
}

export async function updateFirmProfile(
  tenantId: string,
  update: {
    displayName?: string
    logoUrl?: string | null
    address?: string
    documentBranding?: DocumentBranding
  },
): Promise<FirmProfileData> {
  const { documentBranding, ...rest } = update
  const data = await apiFetch<{ firmProfile?: FirmProfileData | null }>(
    `/tenants/${tenantId}/governance/policies`,
    {
      method: "PATCH",
      body: {
        firmProfile: {
          ...rest,
          ...(documentBranding !== undefined
            ? { settings: { documentBranding } }
            : {}),
        },
      },
    },
  )
  const profile = data.firmProfile ?? {}
  const settings = (profile as unknown as { settings?: { documentBranding?: DocumentBranding } }).settings
  return {
    ...(profile as FirmProfileData),
    documentBranding: settings?.documentBranding ?? { showLogoOnExports: false },
  }
}
