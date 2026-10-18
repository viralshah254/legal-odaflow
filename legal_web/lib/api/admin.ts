import { apiFetch, authorizedFetch, getApiBaseUrl } from "./client"

export interface AdminStats {
  totalUsers: number
  totalTenants: number
  totalConsumerCases: number
  totalMatters: number
  totalInvoices: number
  totalPayments: number
  totalAiUsageLogs: number
  recentAuditLogs: Array<{
    id: string
    action: string
    entityType: string
    createdAt: string
  }>
}

export interface AdminPresence {
  onlineCount: number
  byCountry: Record<string, number>
  byUserType: Record<string, number>
  users: Array<{
    userId: string
    email: string
    name: string | null
    userType: string
    countryCode: string | null
    isOnline: boolean
    connectedAt: string | null
    sessionSeconds: number
  }>
}

export interface AdminCostByEntity {
  entityId: string
  entityName: string
  entityType: "tenant" | "consumer"
  totalCostUsd: number
  totalCreditsCharged: number
  totalRequests: number
  topTaskType: string | null
  breakdown: Array<{ taskType: string; cost: number; requests: number }>
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  phone: string | null
  userType: string
  countryCode: string | null
  jurisdiction: string | null
  isActive: boolean
  authMethod: string
  invitationStatus: string | null
  invitedAt: string | null
  invitationAcceptedAt: string | null
  firstLoginAt: string | null
  createdAt: string
  consumerProfile?: {
    countryCode: string
    stateOrCounty: string | null
    subscriptionStatus: string
    preferredLanguage: string
    aiCreditsRemaining?: number
  } | null
  lawyerProfile?: {
    countryCode: string
    verified: boolean
    verificationStatus: string
    barNumber: string | null
    practiceAreas: string[]
    acceptsLeads: boolean
  } | null
  tenantUsers?: Array<{
    tenantId: string
    role: string
    status: string
    tenant?: {
      id: string
      name: string
      primaryCountry: string
      billingPlan: string | null
      aiCreditsRemaining?: number
      subscription?: {
        planId: string
        status: string
        currentPeriodEnd: string | null
        cancelAtPeriodEnd: boolean
        billingCycle: "monthly" | "annual" | null
        currency: string
      } | null
    }
  }>
  referral?: {
    code: string
    status: string
    referrerEmail: string
    referrerName: string | null
  } | null
}

export interface AdminTenantSubscription {
  planId: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  billingCycle: "monthly" | "annual" | null
  planCreditsTotal: number | null
  percentUsed: number | null
  currency: string
}

export interface AdminTenant {
  id: string
  name: string
  primaryCountry: string
  defaultCurrency: string
  billingPlan: string | null
  isActive: boolean
  aiCreditsRemaining?: number
  subscription?: AdminTenantSubscription | null
  _count?: { tenantUsers: number; matters: number; clients: number }
}

export interface AdminSubscription {
  id: string
  entityType: "firm" | "consumer"
  entityName: string
  entityId: string | null
  userEmail: string | null
  planId: string
  billingPlan: string | null
  status: string
  billingCycle: "monthly" | "annual" | null
  creditsRemaining: number
  planCreditsTotal: number | null
  percentUsed: number | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  countryCode: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface AdminReferral {
  id: string
  referrerUserId: string
  refereeUserId: string
  referralCode: string
  status: string
  rejectionReason: string | null
  refereeDeviceFingerprintHash: string | null
  subscriptionId: string | null
  subscribedAt: string | null
  rewardedAt: string | null
  referrerRewardCredits: number | null
  refereeDiscountApplied: boolean
  createdAt: string
  referrer: { email: string; name: string | null; userType: string }
  referee: { email: string; name: string | null }
}

export interface AdminReferralStats {
  totals: {
    pending: number
    subscribed: number
    rewarded: number
    rejected: number
    totalCreditsAwarded: number
  }
  topReferrers: Array<{
    userId: string
    email: string
    name: string | null
    rewardedReferrals: number
    totalCredits: number
  }>
}

// ── Marketing analytics ────────────────────────────────────────────────────

export interface AdminMarketingSummary {
  visitorsToday: number
  pageViewsToday: number
  signupsToday: number
  signupsThisWeek: number
  issueCheckerStartsToday: number
  avgSessionSecondsToday: number
}

export interface AdminMarketingTimeseriesRow {
  day: string
  visitors: number
  pageViews: number
  signups: number
}

export interface AdminMarketingUtmRow {
  utmSource: string
  utmCampaign: string
  visitors: number
}

export interface AdminMarketingFunnelStep {
  step: string
  count: number
  conversionPct: number
}

export interface AdminMarketingReferrerRow {
  referrerHost: string
  visitors: number
}

export async function getAdminMarketingSummary(): Promise<AdminMarketingSummary> {
  return apiFetch<AdminMarketingSummary>("/analytics/site/admin/summary")
}

export async function getAdminMarketingTimeseries(
  days = 30,
): Promise<AdminMarketingTimeseriesRow[]> {
  return apiFetch<AdminMarketingTimeseriesRow[]>(
    `/analytics/site/admin/timeseries?days=${days}`,
  )
}

export async function getAdminMarketingUtm(
  days = 7,
): Promise<AdminMarketingUtmRow[]> {
  return apiFetch<AdminMarketingUtmRow[]>(`/analytics/site/admin/utm?days=${days}`)
}

export async function getAdminMarketingFunnel(
  days = 7,
): Promise<AdminMarketingFunnelStep[]> {
  return apiFetch<AdminMarketingFunnelStep[]>(
    `/analytics/site/admin/funnel?days=${days}`,
  )
}

export async function getAdminMarketingReferrers(
  days = 7,
): Promise<AdminMarketingReferrerRow[]> {
  return apiFetch<AdminMarketingReferrerRow[]>(
    `/analytics/site/admin/referrers?days=${days}`,
  )
}

export interface AdminSearchQueryRow {
  id: string
  facts: string
  issueType: string | null
  countryCode: string | null
  jurisdiction: string | null
  mode: string | null
  userId: string | null
  createdAt: string
}

export async function getAdminSearchQueries(
  params: {
    days?: number
    limit?: number
    offset?: number
    sortBy?: "createdAt" | "countryCode" | "issueType" | "mode"
    sortDir?: "asc" | "desc"
    countryCode?: string
    mode?: string
  } = {},
): Promise<{ rows: AdminSearchQueryRow[]; total: number }> {
  const q = new URLSearchParams()
  q.set("days", String(params.days ?? 30))
  q.set("limit", String(params.limit ?? 50))
  q.set("offset", String(params.offset ?? 0))
  if (params.sortBy) q.set("sortBy", params.sortBy)
  if (params.sortDir) q.set("sortDir", params.sortDir)
  if (params.countryCode) q.set("countryCode", params.countryCode)
  if (params.mode) q.set("mode", params.mode)
  return apiFetch<{ rows: AdminSearchQueryRow[]; total: number }>(
    `/analytics/site/admin/search-queries?${q.toString()}`,
  )
}

export interface AdminAuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  userId?: string | null
  createdAt: string
  user?: { email: string; name?: string | null } | null
}

export async function listAdminAuditLogs(params?: {
  action?: string
  entityType?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
  sortBy?: "createdAt" | "action" | "entityType"
  sortDir?: "asc" | "desc"
}): Promise<{ items: AdminAuditLogEntry[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams()
  if (params?.action) q.set("action", params.action)
  if (params?.entityType) q.set("entityType", params.entityType)
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  if (params?.sortBy) q.set("sortBy", params.sortBy)
  if (params?.sortDir) q.set("sortDir", params.sortDir)
  const qs = q.toString()
  return apiFetch(`/admin/audit/logs${qs ? `?${qs}` : ""}`)
}

export async function getAdminStats(): Promise<AdminStats> {
  const raw = await apiFetch<{
    totals: {
      users: number
      tenants: number
      matters: number
      consumerCases: number
      invoices: number
      payments: number
      aiUsageLogs: number
    }
    recentAuditLogs: AdminStats["recentAuditLogs"]
    generatedAt: string
  }>("/admin/stats")
  return {
    totalUsers: raw.totals.users,
    totalTenants: raw.totals.tenants,
    totalConsumerCases: raw.totals.consumerCases,
    totalMatters: raw.totals.matters,
    totalInvoices: raw.totals.invoices,
    totalPayments: raw.totals.payments,
    totalAiUsageLogs: raw.totals.aiUsageLogs,
    recentAuditLogs: raw.recentAuditLogs,
  }
}

export async function getAdminPresence(): Promise<AdminPresence> {
  return apiFetch<AdminPresence>("/admin/presence")
}

export async function getAdminCostsByEntity(params?: {
  from?: string
  to?: string
  limit?: number
  offset?: number
}): Promise<{ items: AdminCostByEntity[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiFetch(`/admin/ai/costs/by-tenant${qs ? `?${qs}` : ""}`)
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>("/admin/users")
}

export async function setAdminUserActive(
  userId: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean }> {
  return apiFetch(`/admin/users/${userId}/active`, {
    method: "PATCH",
    body: { isActive },
  })
}

export async function masterDeleteAdminUser(
  userId: string,
  confirmEmail: string,
): Promise<{ deleted: boolean; id: string; email: string; deletedAt: string }> {
  return apiFetch(`/admin/users/${userId}/master-delete`, {
    method: "POST",
    body: { confirmEmail },
  })
}

export async function listAdminTenants(): Promise<AdminTenant[]> {
  return apiFetch<AdminTenant[]>("/admin/tenants")
}

export async function listAdminSubscriptions(): Promise<AdminSubscription[]> {
  return apiFetch<AdminSubscription[]>("/admin/subscriptions")
}

export interface AdminMarketplaceLawyer {
  id: string
  userId: string
  tenantId: string | null
  countryCode: string
  barNumber: string | null
  verified: boolean
  verificationStatus: string
  acceptsLeads: boolean
  practiceAreas: unknown
  jurisdictions: unknown
  languages: unknown
  consultationFee: number | null
  currency: string
  bio: string | null
  yearsExperience: number | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    name: string | null
    isActive: boolean
    createdAt: string
  }
  tenant: {
    id: string
    name: string
    primaryCountry: string
  } | null
}

export async function listAdminMarketplaceLawyers(params?: {
  verified?: boolean
  countryCode?: string
  q?: string
}): Promise<AdminMarketplaceLawyer[]> {
  const q = new URLSearchParams()
  if (params?.verified === true) q.set("verified", "true")
  if (params?.verified === false) q.set("verified", "false")
  if (params?.countryCode) q.set("countryCode", params.countryCode)
  if (params?.q) q.set("q", params.q)
  const qs = q.toString()
  return apiFetch<AdminMarketplaceLawyer[]>(`/admin/marketplace-lawyers${qs ? `?${qs}` : ""}`)
}

export async function updateAdminMarketplaceLawyerVerification(
  profileId: string,
  data: { verified: boolean; verificationStatus?: string; acceptsLeads?: boolean },
): Promise<AdminMarketplaceLawyer> {
  return apiFetch<AdminMarketplaceLawyer>(`/admin/marketplace-lawyers/${profileId}/verification`, {
    method: "PATCH",
    body: data,
  })
}

export async function listAdminReferrals(params?: {
  status?: string
  referrerUserId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}): Promise<{ items: AdminReferral[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams()
  if (params?.status) q.set("status", params.status)
  if (params?.referrerUserId) q.set("referrerUserId", params.referrerUserId)
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiFetch(`/admin/referrals${qs ? `?${qs}` : ""}`)
}

export async function getAdminReferralStats(): Promise<AdminReferralStats> {
  return apiFetch<AdminReferralStats>("/admin/referrals/stats")
}

// ── Lawyer prospects (outreach directory) ─────────────────────────────────────

export interface LawyerProspect {
  id: string
  fullName: string
  firstName: string | null
  lastName: string | null
  organisation: string | null
  practiceAreas: string | null
  city: string | null
  state: string | null
  country: string | null
  phone: string | null
  alternatePhone: string | null
  whatsapp: string | null
  whatsappConfidence: string | null
  email: string | null
  emailConfidence: string | null
  website: string | null
  profileUrl: string | null
  barEnrollmentNumber: string | null
  barCouncilState: string | null
  lawyerVerified: boolean
  verifiedAt: string | null
  source: string
  outreachStatus: string
  isTest?: boolean
  scrapedAt: string | null
  createdAt: string
}

export interface LawyerProspectStats {
  total: number
  withEmail: number
  withPhone: number
  withWhatsappHigh: number
  withWhatsappVerified: number
  barAndWhatsappVerified: number
  emailCoveragePct: number
  phoneCoveragePct: number
  whatsappHighCoveragePct: number
  whatsappVerifiedCoveragePct: number
  barAndWhatsappVerifiedPct: number
  lastImportRun: {
    id: string
    batchLabel: string
    sourceSummary: string | null
    status: string
    rowCount: number
    insertedCount: number
    updatedCount: number
    progressJson?: GooglePlacesScrapeProgress | null
    startedAt: string
    finishedAt: string | null
  } | null
  byCountry: Array<{ country: string | null; count: number }>
  bySource: Array<{ source: string; count: number }>
}

export interface LawyerProspectImportResult {
  runId: string
  inserted: number
  updated: number
  skipped: number
  rowCount: number
}

export interface ProspectImportRun {
  id: string
  batchLabel: string
  sourceSummary: string | null
  status: string
  rowCount: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  errorMessage: string | null
  progressJson?: GooglePlacesScrapeProgress | null
  startedAt: string
  finishedAt: string | null
}

export interface GooglePlacesScrapeProgress {
  batchSize: number
  placeIds: string[]
  completedBatchIndexes: number[]
  discoveryCompletedAt?: string
  discoveryStep?: number
  discoveryStepTotal?: number
  discoveryStepLabel?: string
  lastProgressAt?: string
  cancelRequestedAt?: string
  scrapeMode?: "full" | "enrichment"
  apiVersion?: "new" | "legacy"
  prospectCache?: Record<string, { name: string; phone?: string | null; website?: string | null }>
}

export type GooglePlacesScrapeMode = "full" | "enrichment"

export interface GooglePlacesScrapeStartResult {
  runId: string
  status: string
  resumed?: boolean
}

export interface GooglePlacesLocationTree {
  code: string
  name: string
  states: Array<{
    name: string
    cities: string[]
  }>
}

export async function listLawyerProspects(params?: {
  country?: string
  state?: string
  city?: string
  source?: string
  hasEmail?: boolean
  hasPhone?: boolean
  hasWhatsapp?: boolean
  whatsappConfidence?: string
  lawyerVerified?: boolean
  outreachStatus?: string
  isTest?: boolean
  q?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
  limit?: number
  offset?: number
}): Promise<{ items: LawyerProspect[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams()
  if (params?.country) q.set("country", params.country)
  if (params?.state) q.set("state", params.state)
  if (params?.city) q.set("city", params.city)
  if (params?.source) q.set("source", params.source)
  if (params?.hasEmail === true) q.set("hasEmail", "true")
  if (params?.hasEmail === false) q.set("hasEmail", "false")
  if (params?.hasPhone === true) q.set("hasPhone", "true")
  if (params?.hasPhone === false) q.set("hasPhone", "false")
  if (params?.hasWhatsapp === true) q.set("hasWhatsapp", "true")
  if (params?.hasWhatsapp === false) q.set("hasWhatsapp", "false")
  if (params?.whatsappConfidence) q.set("whatsappConfidence", params.whatsappConfidence)
  if (params?.lawyerVerified === true) q.set("lawyerVerified", "true")
  if (params?.lawyerVerified === false) q.set("lawyerVerified", "false")
  if (params?.outreachStatus) q.set("outreachStatus", params.outreachStatus)
  if (params?.isTest === true) q.set("isTest", "true")
  if (params?.isTest === false) q.set("isTest", "false")
  if (params?.q) q.set("q", params.q)
  if (params?.sortBy) q.set("sortBy", params.sortBy)
  if (params?.sortDir) q.set("sortDir", params.sortDir)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiFetch(`/admin/lawyer-prospects${qs ? `?${qs}` : ""}`)
}

export async function getLawyerProspectStats(params?: {
  country?: string
  state?: string
  city?: string
  source?: string
  hasEmail?: boolean
  hasPhone?: boolean
  hasWhatsapp?: boolean
  whatsappConfidence?: string
  lawyerVerified?: boolean
  outreachStatus?: string
  q?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
}): Promise<LawyerProspectStats> {
  const q = new URLSearchParams()
  if (params?.country) q.set("country", params.country)
  if (params?.state) q.set("state", params.state)
  if (params?.city) q.set("city", params.city)
  if (params?.source) q.set("source", params.source)
  if (params?.hasEmail === true) q.set("hasEmail", "true")
  if (params?.hasEmail === false) q.set("hasEmail", "false")
  if (params?.hasPhone === true) q.set("hasPhone", "true")
  if (params?.hasPhone === false) q.set("hasPhone", "false")
  if (params?.hasWhatsapp === true) q.set("hasWhatsapp", "true")
  if (params?.hasWhatsapp === false) q.set("hasWhatsapp", "false")
  if (params?.whatsappConfidence) q.set("whatsappConfidence", params.whatsappConfidence)
  if (params?.lawyerVerified === true) q.set("lawyerVerified", "true")
  if (params?.lawyerVerified === false) q.set("lawyerVerified", "false")
  if (params?.outreachStatus) q.set("outreachStatus", params.outreachStatus)
  if (params?.q) q.set("q", params.q)
  if (params?.sortBy) q.set("sortBy", params.sortBy)
  if (params?.sortDir) q.set("sortDir", params.sortDir)
  const qs = q.toString()
  return apiFetch<LawyerProspectStats>(`/admin/lawyer-prospects/stats${qs ? `?${qs}` : ""}`)
}

export async function updateLawyerProspectOutreach(
  id: string,
  outreachStatus: string,
): Promise<LawyerProspect> {
  return apiFetch<LawyerProspect>(`/admin/lawyer-prospects/${id}`, {
    method: "PATCH",
    body: { outreachStatus },
  })
}

export interface CreateLawyerProspectRequest {
  fullName: string
  practiceType: "SOLO" | "FIRM"
  organisation?: string
  phone: string
  email: string
  state?: string
  city?: string
  countryCode?: string
}

export interface CreateLawyerProspectResponse {
  prospect: LawyerProspect
  action: "inserted" | "updated"
}

export async function createLawyerProspect(
  payload: CreateLawyerProspectRequest,
): Promise<CreateLawyerProspectResponse> {
  return apiFetch<CreateLawyerProspectResponse>("/admin/lawyer-prospects", {
    method: "POST",
    body: payload,
  })
}

export async function importLawyerProspects(
  file: File,
  batchLabel: string,
): Promise<LawyerProspectImportResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("batchLabel", batchLabel)
  return apiFetch<LawyerProspectImportResult>("/admin/lawyer-prospects/import", {
    method: "POST",
    body: form,
  })
}

export interface GooglePlacesApiTestResult {
  ok: boolean
  configured: boolean
  status: string
  error: string | null
  resultCount: number
  sampleName: string | null
  query?: string
  apiVersion?: "new" | "legacy"
  samplePhone?: string | null
  apiCalls?: number
}

export interface GooglePlacesApiCompareResult {
  city: string
  state: string
  query: string
  limit: number
  legacy: {
    searchCalls: number
    detailCalls: number
    totalCalls: number
    firmsSampled: number
    withPhoneInSample: number
    sampleSize?: number
    note?: string
  }
  newApi: {
    searchCalls: number
    detailCalls: number
    totalCalls: number
    firmsSampled: number
    withPhoneInSample: number
    error?: string
    note?: string
  }
  savingsPercent: number
  recommendation: string
}

export async function getGooglePlacesLocations(): Promise<GooglePlacesLocationTree[]> {
  return apiFetch<GooglePlacesLocationTree[]>("/admin/lawyer-prospects/google-places/locations")
}

export async function testGooglePlacesApi(params?: {
  city?: string
  state?: string
  country?: string
}): Promise<GooglePlacesApiTestResult> {
  const search = new URLSearchParams()
  if (params?.city) search.set("city", params.city)
  if (params?.state) search.set("state", params.state)
  if (params?.country) search.set("country", params.country)
  const qs = search.toString()
  return apiFetch<GooglePlacesApiTestResult>(
    `/admin/lawyer-prospects/google-places/test${qs ? `?${qs}` : ""}`,
  )
}

export async function compareGooglePlacesApi(params?: {
  city?: string
  state?: string
  country?: string
  limit?: number
}): Promise<GooglePlacesApiCompareResult> {
  const search = new URLSearchParams()
  if (params?.city) search.set("city", params.city)
  if (params?.state) search.set("state", params.state)
  if (params?.country) search.set("country", params.country)
  if (params?.limit) search.set("limit", String(params.limit))
  const qs = search.toString()
  return apiFetch<GooglePlacesApiCompareResult>(
    `/admin/lawyer-prospects/google-places/compare${qs ? `?${qs}` : ""}`,
  )
}

export async function startGooglePlacesScrape(input: {
  country: string
  state: string
  city: string
  mode?: GooglePlacesScrapeMode
}): Promise<GooglePlacesScrapeStartResult> {
  return apiFetch<GooglePlacesScrapeStartResult>(
    "/admin/lawyer-prospects/scrape/google-places",
    {
      method: "POST",
      body: {
        country: input.country,
        state: input.state,
        city: input.city,
        mode: input.mode ?? "full",
      },
    },
  )
}

export async function getProspectImportRun(runId: string): Promise<ProspectImportRun> {
  return apiFetch<ProspectImportRun>(`/admin/lawyer-prospects/import-runs/${runId}`)
}

export async function cancelProspectImportRun(runId: string): Promise<{ runId: string; status: string }> {
  return apiFetch<{ runId: string; status: string }>(
    `/admin/lawyer-prospects/import-runs/${runId}/cancel`,
    { method: "POST" },
  )
}

export async function exportLawyerProspectsCsv(params?: {
  country?: string
  state?: string
  city?: string
  source?: string
  hasEmail?: boolean
  hasPhone?: boolean
  hasWhatsapp?: boolean
  whatsappConfidence?: string
  lawyerVerified?: boolean
  outreachStatus?: string
  q?: string
}): Promise<Blob> {
  const q = new URLSearchParams()
  if (params?.country) q.set("country", params.country)
  if (params?.state) q.set("state", params.state)
  if (params?.city) q.set("city", params.city)
  if (params?.source) q.set("source", params.source)
  if (params?.hasEmail === true) q.set("hasEmail", "true")
  if (params?.hasPhone === true) q.set("hasPhone", "true")
  if (params?.hasWhatsapp === true) q.set("hasWhatsapp", "true")
  if (params?.whatsappConfidence) q.set("whatsappConfidence", params.whatsappConfidence)
  if (params?.lawyerVerified === true) q.set("lawyerVerified", "true")
  if (params?.outreachStatus) q.set("outreachStatus", params.outreachStatus)
  if (params?.q) q.set("q", params.q)
  const qs = q.toString()
  const path = `/admin/lawyer-prospects/export${qs ? `?${qs}` : ""}`
  const response = await authorizedFetch(path)
  if (!response.ok) {
    throw new Error("Export failed")
  }
  return response.blob()
}

export interface AdminReviewRequest {
  id: string
  userId: string
  consumerCaseId: string
  countryCode: string
  issueType: string
  status: string
  price: string
  currency: string
  createdAt: string
  completedAt: string | null
  jurisdiction: string | null
  consumerCase: {
    id: string
    title: string
    issueType: string
    countryCode: string
    status: string
  } | null
  user: { id: string; email: string; name: string | null } | null
}

export async function listAdminReviewRequests(params?: {
  status?: string
  countryCode?: string
}): Promise<AdminReviewRequest[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set("status", params.status)
  if (params?.countryCode) query.set("countryCode", params.countryCode)
  const qs = query.toString()
  return apiFetch<AdminReviewRequest[]>(`/admin/review-requests${qs ? `?${qs}` : ""}`)
}

// ── Unmatched Section Finder queries ──────────────────────────────────────────

export interface UnmatchedSection {
  id: string
  countryCode: string
  rawQuery: string
  normalizedQuery: string
  parsedActId: string | null
  parsedSection: string | null
  parsedActToken: string | null
  jurisdiction: string | null
  searchCount: number
  lastSearchedAt: string
  firstSearchedAt: string
  status: string
  fallbackTrail: { steps?: string[] } | null
  resolvedAt: string | null
  resolvedByUserId: string | null
  resolvedNote: string | null
  resolvedAuthorityId: string | null
  createdAt: string
  updatedAt: string
}

export interface UnmatchedSectionStats {
  open: number
  inProgress: number
  resolved7d: number
  ignored: number
  topBySearchCount: UnmatchedSection[]
}

export interface UnmatchedSectionIngestResult {
  ok: boolean
  actId: string
  section: string
  countryCode: string
  resolvedAuthorityId?: string
  sectionTitle: string | null
  sourceName: string | null
}

export async function listUnmatchedSections(params?: {
  status?: string
  countryCode?: string
  sort?: "searchCount" | "lastSearchedAt"
  limit?: number
  offset?: number
}): Promise<{ items: UnmatchedSection[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams()
  if (params?.status) q.set("status", params.status)
  if (params?.countryCode) q.set("countryCode", params.countryCode)
  if (params?.sort) q.set("sort", params.sort)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiFetch(`/admin/unmatched-sections${qs ? `?${qs}` : ""}`)
}

export async function getUnmatchedSectionStats(): Promise<UnmatchedSectionStats> {
  return apiFetch<UnmatchedSectionStats>("/admin/unmatched-sections/stats")
}

export async function updateUnmatchedSection(
  id: string,
  body: {
    status?: string
    resolvedNote?: string
    resolvedAuthorityId?: string
  },
): Promise<UnmatchedSection> {
  return apiFetch<UnmatchedSection>(`/admin/unmatched-sections/${id}`, {
    method: "PATCH",
    body,
  })
}

export async function triggerUnmatchedSectionIngest(
  id: string,
): Promise<UnmatchedSectionIngestResult> {
  return apiFetch<UnmatchedSectionIngestResult>(`/admin/unmatched-sections/${id}/trigger-ingest`, {
    method: "POST",
  })
}

// ── Research retrieval gaps ─────────────────────────────────────────────────

export type RetrievalGapType =
  | "stub_text"
  | "missing_regulation"
  | "off_point_blocked"
  | "no_case_law"
  | "checklist_unmet"
  | "citation_metadata"

export interface ResearchRetrievalGap {
  id: string
  countryCode: string
  legalDomain: string | null
  gapType: RetrievalGapType
  expectedAuthority: string
  queryFingerprint: string
  aiOutputId: string | null
  occurrenceCount: number
  status: string
  detail: Record<string, unknown> | null
  resolvedAuthorityId: string | null
  resolvedNote: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RetrievalGapStats {
  open: number
  inProgress: number
  resolved7d: number
  ignored: number
  byType: Array<{
    gapType: RetrievalGapType
    _count: { id: number }
    _sum: { occurrenceCount: number | null }
  }>
}

export interface RetrievalGapIngestResult {
  ok: boolean
  state: "queued" | "failed" | "manual_required"
  message: string
  agentJobId?: string
  actId?: string
  section?: string | null
}

export interface CorpusHealthRow {
  countryCode: string
  actId: string
  total: number
  headingOnly: number
  stubRatio: number
}

export async function listRetrievalGaps(params?: {
  status?: string
  countryCode?: string
  gapType?: RetrievalGapType
  legalDomain?: string
  limit?: number
  offset?: number
}): Promise<{ items: ResearchRetrievalGap[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams()
  if (params?.status) q.set("status", params.status)
  if (params?.countryCode) q.set("countryCode", params.countryCode)
  if (params?.gapType) q.set("gapType", params.gapType)
  if (params?.legalDomain) q.set("legalDomain", params.legalDomain)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiFetch(`/admin/retrieval-gaps${qs ? `?${qs}` : ""}`)
}

export function getRetrievalGapStats(): Promise<RetrievalGapStats> {
  return apiFetch("/admin/retrieval-gaps/stats")
}

export function updateRetrievalGap(
  id: string,
  body: { status?: string; resolvedAuthorityId?: string; resolvedNote?: string },
): Promise<ResearchRetrievalGap> {
  return apiFetch(`/admin/retrieval-gaps/${id}`, { method: "PATCH", body })
}

export function triggerRetrievalGapIngest(id: string): Promise<RetrievalGapIngestResult> {
  return apiFetch(`/admin/retrieval-gaps/${id}/trigger-ingest`, { method: "POST" })
}

export function getCorpusHealth(countryCode?: string): Promise<CorpusHealthRow[]> {
  const query = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : ""
  return apiFetch(`/admin/corpus-health${query}`)
}

// ── Demo requests (inbound sales) ───────────────────────────────────────────

export interface DemoRequest {
  id: string
  contactName: string
  email: string
  companyName: string
  phone: string | null
  jobTitle: string | null
  firmSize: string | null
  countryCode: string
  message: string | null
  source: string
  status: string
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface DemoRequestStats {
  total: number
  last7Days: number
  new: number
  contacted: number
  qualified: number
  closed: number
}

export async function listDemoRequests(params?: {
  status?: string
  q?: string
  limit?: number
  offset?: number
}): Promise<{ items: DemoRequest[]; total: number; limit: number; offset: number }> {
  const search = new URLSearchParams()
  if (params?.status) search.set("status", params.status)
  if (params?.q) search.set("q", params.q)
  if (params?.limit != null) search.set("limit", String(params.limit))
  if (params?.offset != null) search.set("offset", String(params.offset))
  const qs = search.toString()
  return apiFetch(`/admin/demo-requests${qs ? `?${qs}` : ""}`)
}

export async function getDemoRequestStats(): Promise<DemoRequestStats> {
  return apiFetch<DemoRequestStats>("/admin/demo-requests/stats")
}

export async function updateDemoRequest(
  id: string,
  body: { status: string; adminNotes?: string },
): Promise<DemoRequest> {
  return apiFetch<DemoRequest>(`/admin/demo-requests/${id}`, {
    method: "PATCH",
    body,
  })
}

// ── WhatsApp Campaigns ────────────────────────────────────────────────────────

export interface WhatsappCampaign {
  id: string
  name: string
  templateName: string
  templateParams: Record<string, unknown>
  status: string
  totalQueued: number
  totalSent: number
  totalDelivered: number
  totalRead: number
  totalFailed: number
  lastFailedError?: string | null
  createdAt: string
  updatedAt: string
}

export interface WhatsappDiagnostics {
  apiConfigured: boolean
  vars: Record<string, boolean>
  phoneNumberId: string | undefined
  missing: string[]
  hints: string[]
}

export interface WhatsappMessage {
  id: string
  campaignId: string
  prospectId: string
  to: string
  waMessageId: string | null
  status: string
  errorCode: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  createdAt: string
}

export interface CreateCampaignPayload {
  name: string
  templateName: string
  templateParams?: Record<string, unknown>
  audienceType?: "PROSPECT" | "USER"
  testOnly?: boolean
  testProspectIds?: string[]
  country?: string
  whatsappConfidence?: string
  cities?: string[]
  source?: string
  outreachStatus?: string
  userType?: string
  subscriptionActiveOnly?: boolean
  userCountryCode?: string
  limit?: number
}

export interface WhatsappTemplate {
  id: string
  name: string
  status: string
  language: string
  bodyText: string
  components: unknown[]
}

export interface WhatsappTemplateDiagnostics {
  reason: "not_configured" | "meta_api_error" | "no_approved_templates" | "all_filtered"
  message: string
  metaStatus?: number
  totalFromMeta?: number
}

export interface WhatsappTemplateListResult {
  templates: WhatsappTemplate[]
  diagnostics?: WhatsappTemplateDiagnostics
}

export async function getWhatsappDiagnostics(): Promise<WhatsappDiagnostics> {
  return apiFetch<WhatsappDiagnostics>("/admin/whatsapp-diagnostics")
}

export async function listWhatsappTemplates(): Promise<WhatsappTemplateListResult> {
  return apiFetch<WhatsappTemplateListResult>("/admin/whatsapp-templates")
}

export async function getCitiesForCountry(country: string): Promise<{ city: string; count: number }[]> {
  return apiFetch<{ city: string; count: number }[]>(`/admin/lawyer-prospects/cities?country=${encodeURIComponent(country)}`)
}

export async function listWhatsappCampaigns(): Promise<WhatsappCampaign[]> {
  return apiFetch<WhatsappCampaign[]>("/admin/whatsapp-campaigns")
}

export async function getWhatsappCampaign(id: string): Promise<WhatsappCampaign & { messages: WhatsappMessage[] }> {
  return apiFetch<WhatsappCampaign & { messages: WhatsappMessage[] }>(`/admin/whatsapp-campaigns/${id}`)
}

export async function getWhatsappCampaignStats(id: string): Promise<WhatsappCampaign & { statusBreakdown: Record<string, number> }> {
  return apiFetch<WhatsappCampaign & { statusBreakdown: Record<string, number> }>(`/admin/whatsapp-campaigns/${id}/stats`)
}

export async function createWhatsappCampaign(payload: CreateCampaignPayload): Promise<{ id: string; name: string; status: string; totalQueued: number }> {
  return apiFetch("/admin/whatsapp-campaigns", { method: "POST", body: payload })
}

export async function pauseWhatsappCampaign(id: string): Promise<WhatsappCampaign> {
  return apiFetch<WhatsappCampaign>(`/admin/whatsapp-campaigns/${id}`, {
    method: "PATCH",
    body: { action: "pause" },
  })
}

export async function resumeWhatsappCampaign(id: string): Promise<WhatsappCampaign> {
  return apiFetch<WhatsappCampaign>(`/admin/whatsapp-campaigns/${id}`, {
    method: "PATCH",
    body: { action: "resume" },
  })
}

export async function deleteWhatsappCampaign(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiFetch<{ deleted: boolean; id: string }>(`/admin/whatsapp-campaigns/${id}`, {
    method: "DELETE",
  })
}

// ── Admin identity & daily todos ───────────────────────────────────────────

export interface AdminMe {
  id: string
  email: string
  name: string | null
  userType: string
  adminProfile: string | null
  displayTitle: string
}

export interface AdminTodoItem {
  id: string
  templateId: string | null
  title: string
  description: string | null
  category: string
  completed: boolean
  completedAt: string | null
  sortOrder: number
  dueDate: string
}

export interface SuperAdminUser {
  id: string
  email: string
  name: string | null
  adminProfile: string | null
  isActive: boolean
  createdAt: string
  firstLoginAt: string | null
}

export async function getAdminMe(): Promise<AdminMe> {
  return apiFetch<AdminMe>("/admin/me")
}

export async function listSuperAdmins(): Promise<SuperAdminUser[]> {
  return apiFetch<SuperAdminUser[]>("/admin/super-admins")
}

export async function getAdminDailyTodos(date?: string): Promise<AdminTodoItem[]> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ""
  return apiFetch<AdminTodoItem[]>(`/admin/me/todos${qs}`)
}

export async function updateAdminTodo(
  id: string,
  payload: { completed: boolean },
): Promise<AdminTodoItem> {
  return apiFetch<AdminTodoItem>(`/admin/me/todos/${id}`, {
    method: "PATCH",
    body: payload,
  })
}

export async function createAdminTodo(payload: {
  title: string
  description?: string
  category?: string
}): Promise<AdminTodoItem> {
  return apiFetch<AdminTodoItem>("/admin/me/todos", {
    method: "POST",
    body: payload,
  })
}
