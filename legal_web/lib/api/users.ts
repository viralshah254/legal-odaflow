import { apiFetch } from "./client"

export type SpecialtyLevel = "Junior" | "Senior" | "Partner" | "Consultant"

export type CreditUsageStatus =
  | "ACTIVE"
  | "NEAR_LIMIT"
  | "USER_LIMIT_REACHED"
  | "TENANT_BALANCE_EXHAUSTED"
  | "AI_BLOCKED"

export interface UserCreditUsage {
  userId: string
  used: number
  limit: number | null
  remaining: number | null
  isUnlimited: boolean
  cycleStart: string
  cycleEnd: string
  tenantCreditsRemaining: number
  status: CreditUsageStatus
}

export interface TeamCreditUsageSummary {
  cycleStart: string
  cycleEnd: string
  tenantCreditsRemaining: number
  users: {
    userId: string
    used: number
    limit: number | null
    remaining: number | null
    status: CreditUsageStatus
  }[]
}

export interface ApiTenantUser {
  id: string
  tenantId: string
  userId: string
  role: string
  status: string
  practiceAreas?: string[] | null
  specialtyLevel?: Record<string, SpecialtyLevel> | null
  displayTitle?: string | null
  seatPlan?: string | null
  seatPlanUpdatedAt?: string | null
  monthlyCreditLimit?: number | null
  isBillableSeat?: boolean
  billingStatus?: string | null
  invitationUrl?: string | null
  invitationExpiresAt?: string | null
  user: {
    id: string
    email: string
    name: string | null
    phone?: string | null
    isActive?: boolean
    mustChangePassword?: boolean
    invitationStatus?: string | null
  }
}

export interface CreateTenantUserInput {
  email: string
  name: string
  role: string
  /** Omit to use invitation flow (preferred). Include for temp-password fallback. */
  password?: string
  mustChangePassword?: boolean
  /** null = unlimited; 0 = block AI; >0 = monthly cap */
  monthlyCreditLimit?: number | null
  isBillableSeat?: boolean
  practiceAreas?: string[]
  specialtyLevel?: Record<string, SpecialtyLevel>
  displayTitle?: string
  seatPlan?: string
}

export type SeatPlan = "STARTER" | "PROFESSIONAL" | "PRO_PLUS"
export type BillingStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXEMPT"

export interface UpdateUserSeatPlanInput {
  planId: SeatPlan
  countryCode?: string
}

export interface UpdateUserSeatPlanResult {
  seatPlan: string
  proRataAmount: number
  currency: string
}

export interface UpdateTenantUserInput {
  role?: string
  status?: string
  name?: string
  phone?: string
  practiceAreas?: string[]
  specialtyLevel?: Record<string, SpecialtyLevel>
  displayTitle?: string
  /** null removes the cap (unlimited); 0 blocks AI; >0 sets monthly cap */
  monthlyCreditLimit?: number | null
  resetCreditCycle?: boolean
  isBillableSeat?: boolean
  billingStatus?: BillingStatus
}

export async function listTenantUsers(tenantId: string): Promise<ApiTenantUser[]> {
  return apiFetch<ApiTenantUser[]>(`/tenants/${tenantId}/users`, { tenantId })
}

export async function createTenantUser(
  tenantId: string,
  body: CreateTenantUserInput,
): Promise<ApiTenantUser & { invitationUrl?: string; invitationExpiresAt?: string }> {
  return apiFetch(`/tenants/${tenantId}/users`, {
    method: "POST",
    body,
    tenantId,
  })
}

export async function updateTenantUser(
  tenantId: string,
  userId: string,
  body: UpdateTenantUserInput,
): Promise<ApiTenantUser> {
  return apiFetch<ApiTenantUser>(`/tenants/${tenantId}/users/${userId}`, {
    method: "PATCH",
    body,
    tenantId,
  })
}

export async function updateUserSeatPlan(
  tenantId: string,
  userId: string,
  input: UpdateUserSeatPlanInput,
): Promise<UpdateUserSeatPlanResult> {
  return apiFetch<UpdateUserSeatPlanResult>(`/tenants/${tenantId}/users/${userId}/plan`, {
    method: "PATCH",
    body: input,
    tenantId,
  })
}

export async function getUserCreditUsage(
  tenantId: string,
  userId: string,
): Promise<UserCreditUsage> {
  return apiFetch<UserCreditUsage>(`/tenants/${tenantId}/users/${userId}/credits`, { tenantId })
}

export async function getTeamCreditUsage(tenantId: string): Promise<TeamCreditUsageSummary> {
  return apiFetch<TeamCreditUsageSummary>(`/tenants/${tenantId}/users/credit-usage`, { tenantId })
}

export async function acceptInvitation(
  token: string,
  password: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/tenants/invitations/accept", {
    method: "POST",
    body: { token, password },
  })
}

export interface TutorialProgressEntry {
  completedAt?: string
  dismissedPanel?: boolean
  skipped?: boolean
}

export type TutorialProgressMap = Record<string, TutorialProgressEntry>

export interface UserPreferences {
  id: string
  userId: string
  emailNotifications: boolean
  pushNotifications: boolean
  taskReminders: boolean
  billingAlerts: boolean
  trustApprovalAlerts: boolean
  primaryPracticeArea?: string | null
  preferredLocale: string
  tutorialProgress?: TutorialProgressMap | null
  createdAt: string
  updatedAt: string
}

export async function getUserPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences")
}

export async function updateUserPreferences(
  patch: Partial<Pick<UserPreferences, "tutorialProgress">>,
): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences", {
    method: "PATCH",
    body: patch,
  })
}

export async function patchTutorialProgress(
  tourId: string,
  entry: TutorialProgressEntry,
): Promise<UserPreferences> {
  return updateUserPreferences({
    tutorialProgress: { [tourId]: entry },
  })
}
