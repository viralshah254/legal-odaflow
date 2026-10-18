import { apiFetch } from "./client"
import type { CountryCode } from "./types"

export interface UserPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  taskReminders: boolean
  billingAlerts: boolean
  trustApprovalAlerts: boolean
  primaryPracticeArea?: string | null
  preferredLocale?: string
  templatesLibraryProvisionedAt?: string | null
}

export interface BillingProfile {
  primaryCountry: string
  primaryCurrency: string
  currencySymbol: string
  tenantId?: string
  tenantName?: string
  canManageBilling: boolean
}

export interface EffectiveLegalLocation {
  countryCode: string
  jurisdiction: string | null
  displayName: string
  source: "request" | "matter" | "profile" | "tenant" | "geo" | "default"
  assumed: boolean
  tier: "deep" | "best_effort"
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  countryCode: string | null
  jurisdiction: string | null
  legalLocation?: EffectiveLegalLocation
  countryName: string
  currency: string
  currencySymbol: string
  userType: string
  preferences: UserPreferences | null
  billing: BillingProfile
}

export async function getMyProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/users/me")
}

export async function updateMyProfile(data: {
  name?: string
  phone?: string
  countryCode?: CountryCode
  jurisdiction?: string
  preferences?: Partial<
    Pick<UserPreferences, "primaryPracticeArea" | "emailNotifications" | "pushNotifications" | "taskReminders" | "billingAlerts" | "trustApprovalAlerts">
  >
}): Promise<UserProfile> {
  return apiFetch<UserProfile>("/users/me", { method: "PATCH", body: data })
}

export async function getMyPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences")
}

export async function updateMyPreferences(
  data: Partial<UserPreferences>,
): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences", {
    method: "PATCH",
    body: data,
  })
}
