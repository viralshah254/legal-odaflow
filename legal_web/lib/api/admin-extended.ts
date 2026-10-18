import { apiFetch } from "./client"

export interface TrainingDataset {
  id: string
  name: string
  datasetType: string
  countryCode: string | null
  status: string
  description: string | null
  itemCount: number
  createdAt: string
  updatedAt?: string
}

export interface TrainingDatasetItem {
  id: string
  datasetId: string
  inputText: string
  outputText: string | null
  approvalStatus: "PENDING" | "APPROVED" | "REVOKED"
  createdAt: string
}

export interface AiCreditRate {
  id: string
  taskType: string
  userSegment: string
  baseCredits: number
  markupMultiplier: number
  enabled: boolean
  updatedAt: string
}

export interface AiModelCostConfig {
  id: string
  modelName: string
  provider: string
  modelTier: string
  inputCostPer1M: number
  outputCostPer1M: number
  currency: string
  isActive: boolean
  updatedAt: string
}

export interface AiProfitabilityRow {
  groupBy?: string
  key?: string
  taskType?: string
  countryCode: string | null
  userSegment: string | null
  totalCreditsCharged: number
  totalCreditValueUsd: number
  totalActualCostUsd: number
  platformMarginUsd: number
  grossMarginPercent: number
  requestCount: number
}

export interface AdminAiFilters {
  from?: string
  to?: string
  tenantId?: string
  userId?: string
  taskType?: string
  modelName?: string
  limit?: number
  offset?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface CreditLedgerEntry {
  id: string
  taskType: string
  credits: number
  costUsd: number | null
  modelName: string | null
  inputTokens: number | null
  outputTokens: number | null
  providerCostUsd: number | null
  userId: string | null
  tenantId: string | null
  userName: string | null
  tenantName: string | null
  entityName: string | null
  entityType: "tenant" | "consumer" | null
  createdAt: string
}

export interface AiCostsSummaryV2 {
  usageLogRequests: number
  usageLogCostUsd: number
  usageLogCredits: number
  usageLogTokens: number
  ledgerDebits: number
  ledgerCreditsCharged: number
  ledgerProviderCostUsd: number
  totalCreditValueUsd: number
  totalPlatformMarginUsd: number
  combinedProviderCostUsd: number
  avgCostPerRequest: number
  avgCreditsPerDebit: number
}

export interface AiCostByModelRow {
  modelName: string
  modelProvider: string | null
  usageLogRequests: number
  ledgerDebits: number
  totalRequests: number
  costUsd: number
  creditsCharged: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgCostPer1MTokens: number
}

export interface AiUsageLogRow {
  id: string
  taskType: string
  mode: string | null
  modelName: string | null
  modelProvider: string | null
  costUsd: number
  inputTokens: number | null
  outputTokens: number | null
  chargedCredits: number | null
  creditValueUsd: number | null
  status: string
  createdAt: string
  tenantId: string | null
  userId: string | null
  userName: string | null
  tenantName: string | null
  entityName: string | null
}

export interface ProviderBillingSnapshot {
  id: string
  provider: string
  periodDate: string
  reportedUsd: number
  computedUsd: number
  varianceUsd: number
  variancePercent: number | null
  createdAt: string
}

function buildAiQuery(params?: AdminAiFilters): string {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.tenantId) q.set("tenantId", params.tenantId)
  if (params?.userId) q.set("userId", params.userId)
  if (params?.taskType) q.set("taskType", params.taskType)
  if (params?.modelName) q.set("modelName", params.modelName)
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  const qs = q.toString()
  return qs ? `?${qs}` : ""
}

// ── Training datasets ────────────────────────────────────────────────────────

export async function listAdminTrainingDatasets(): Promise<TrainingDataset[]> {
  return apiFetch<TrainingDataset[]>("/admin/training-datasets")
}

export async function createAdminTrainingDataset(body: {
  name: string
  datasetType: string
  countryCode?: string
  description?: string
}): Promise<TrainingDataset> {
  return apiFetch<TrainingDataset>("/admin/training-datasets", {
    method: "POST",
    body,
  })
}

export async function updateAdminTrainingDatasetStatus(
  id: string,
  status: string,
): Promise<TrainingDataset> {
  return apiFetch<TrainingDataset>(`/admin/training-datasets/${id}`, {
    method: "PATCH",
    body: { status },
  })
}

export async function listAdminTrainingDatasetItems(
  datasetId: string,
): Promise<TrainingDatasetItem[]> {
  return apiFetch<TrainingDatasetItem[]>(`/admin/training-datasets/${datasetId}/items`)
}

export async function approveTrainingDatasetItem(
  datasetId: string,
  itemId: string,
): Promise<TrainingDatasetItem> {
  return apiFetch<TrainingDatasetItem>(`/admin/training-datasets/${datasetId}/items/${itemId}`, {
    method: "PATCH",
    body: { approvalStatus: "APPROVED" },
  })
}

export async function revokeTrainingDatasetItem(
  datasetId: string,
  itemId: string,
): Promise<TrainingDatasetItem> {
  return apiFetch<TrainingDatasetItem>(`/admin/training-datasets/${datasetId}/items/${itemId}`, {
    method: "PATCH",
    body: { approvalStatus: "REVOKED" },
  })
}

// ── Credit rates ─────────────────────────────────────────────────────────────

export async function listAdminCreditRates(): Promise<AiCreditRate[]> {
  return apiFetch<AiCreditRate[]>("/admin/credit-rates")
}

export async function updateAdminCreditRate(
  id: string,
  data: Partial<Pick<AiCreditRate, "baseCredits" | "markupMultiplier" | "enabled">>,
): Promise<AiCreditRate> {
  return apiFetch<AiCreditRate>(`/admin/credit-rates/${id}`, {
    method: "PATCH",
    body: data,
  })
}

// ── AI model costs ────────────────────────────────────────────────────────────

export async function listAdminAiModelCosts(): Promise<AiModelCostConfig[]> {
  return apiFetch<AiModelCostConfig[]>("/admin/ai-model-costs")
}

export async function updateAdminAiModelCost(
  id: string,
  data: Partial<Pick<AiModelCostConfig, "inputCostPer1M" | "outputCostPer1M" | "isActive">>,
): Promise<AiModelCostConfig> {
  return apiFetch<AiModelCostConfig>(`/admin/ai-model-costs/${id}`, {
    method: "PATCH",
    body: data,
  })
}

// ── AI profitability ──────────────────────────────────────────────────────────

export async function getAdminAiProfitability(params?: AdminAiFilters & {
  groupBy?: "taskType" | "modelName" | "tenantId"
}): Promise<AiProfitabilityRow[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.tenantId) q.set("tenantId", params.tenantId)
  if (params?.userId) q.set("userId", params.userId)
  if (params?.taskType) q.set("taskType", params.taskType)
  if (params?.modelName) q.set("modelName", params.modelName)
  if (params?.groupBy) q.set("groupBy", params.groupBy)
  const qs = q.toString()
  return apiFetch<AiProfitabilityRow[]>(`/admin/ai/profitability${qs ? `?${qs}` : ""}`)
}

export async function listCreditLedger(
  params?: AdminAiFilters,
): Promise<Paginated<CreditLedgerEntry>> {
  return apiFetch(`/admin/ai/credit-ledger${buildAiQuery(params)}`)
}

export async function getAiCostsSummaryV2(params?: {
  from?: string
  to?: string
}): Promise<AiCostsSummaryV2> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const qs = q.toString()
  return apiFetch(`/admin/ai/costs/summary-v2${qs ? `?${qs}` : ""}`)
}

export async function listAiUsageLogs(
  params?: AdminAiFilters,
): Promise<Paginated<AiUsageLogRow>> {
  return apiFetch(`/admin/ai/logs${buildAiQuery(params)}`)
}

export async function getCostsByModel(params?: {
  from?: string
  to?: string
}): Promise<AiCostByModelRow[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const qs = q.toString()
  return apiFetch(`/admin/ai/costs/by-model${qs ? `?${qs}` : ""}`)
}

export async function syncAiModelCostsFromRegistry(): Promise<{ synced: number; models: string[] }> {
  return apiFetch("/admin/ai-model-costs/sync-from-registry", { method: "POST" })
}

export async function listProviderBillingSnapshots(
  limit = 30,
): Promise<ProviderBillingSnapshot[]> {
  return apiFetch(`/admin/ai/provider-billing?limit=${limit}`)
}

export async function reconcileProviderBilling(date?: string): Promise<unknown> {
  const q = date ? `?date=${encodeURIComponent(date)}` : ""
  return apiFetch(`/admin/ai/provider-billing/reconcile${q}`, { method: "POST" })
}

export function exportCreditLedgerCsv(items: CreditLedgerEntry[]): string {
  const header = "date,entity,entityType,taskType,model,credits,providerCostUsd,inputTokens,outputTokens\n"
  const rows = items.map((r) =>
    [
      r.createdAt,
      r.entityName ?? "",
      r.entityType ?? "",
      r.taskType,
      r.modelName ?? "",
      r.credits,
      r.providerCostUsd ?? r.costUsd ?? "",
      r.inputTokens ?? "",
      r.outputTokens ?? "",
    ].join(","),
  )
  return header + rows.join("\n")
}

// ── Platform Accounting ───────────────────────────────────────────────────────

export interface AccountingSummary {
  grossRevenue: number
  taxCollected: number
  fees: number
  netRevenue: number
  totalExpenses: number
  netMargin: number
  currency: string
}

export interface RevenueSourceBreakdown {
  source: string
  count: number
  grossAmount: number
  taxAmount: number
  feeAmount: number
  netAmount: number
}

export interface PlatformRevenueEntry {
  id: string
  source: string
  grossAmount: string
  taxAmount: string
  feeAmount: string
  netAmount: string
  currency: string
  countryCode: string | null
  planId: string | null
  tenantId: string | null
  userId: string | null
  paymentProvider: string
  providerRef: string
  description: string | null
  occurredAt: string
  createdAt: string
}

export interface PlatformExpense {
  id: string
  category: string
  vendor: string | null
  description: string
  amount: string
  currency: string
  taxAmount: string
  expenseDate: string
  isRecurring: boolean
  receiptUrl: string | null
  createdById: string | null
  snapshotRef: string | null
  createdAt: string
  updatedAt: string
}

export interface TaxEntry {
  countryCode: string | null
  transactions: number
  grossAmount: number
  taxCollected: number
}

export async function getAccountingSummary(params?: {
  from?: string
  to?: string
}): Promise<AccountingSummary> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const qs = q.toString()
  return apiFetch<AccountingSummary>(`/admin/accounting/summary${qs ? `?${qs}` : ""}`)
}

export async function getAccountingRevenueList(params?: {
  from?: string
  to?: string
  source?: string
  country?: string
  page?: number
  limit?: number
}): Promise<{ items: PlatformRevenueEntry[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.source) q.set("source", params.source)
  if (params?.country) q.set("country", params.country)
  if (params?.page) q.set("page", String(params.page))
  if (params?.limit) q.set("limit", String(params.limit))
  const qs = q.toString()
  return apiFetch(`/admin/accounting/revenue${qs ? `?${qs}` : ""}`)
}

export async function getRevenueSummary(params?: {
  from?: string
  to?: string
}): Promise<RevenueSourceBreakdown[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const qs = q.toString()
  return apiFetch(`/admin/accounting/revenue/summary${qs ? `?${qs}` : ""}`)
}

export async function getAccountingExpenses(params?: {
  from?: string
  to?: string
  category?: string
}): Promise<PlatformExpense[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.category) q.set("category", params.category)
  const qs = q.toString()
  return apiFetch(`/admin/accounting/expenses${qs ? `?${qs}` : ""}`)
}

export async function createAccountingExpense(data: {
  category: string
  vendor?: string
  description: string
  amount: number
  currency: string
  taxAmount?: number
  expenseDate: string
  isRecurring?: boolean
  receiptUrl?: string
}): Promise<PlatformExpense> {
  return apiFetch("/admin/accounting/expenses", { method: "POST", body: JSON.stringify(data) })
}

export async function updateAccountingExpense(
  id: string,
  data: Partial<{
    category: string
    vendor: string
    description: string
    amount: number
    currency: string
    taxAmount: number
    expenseDate: string
    isRecurring: boolean
    receiptUrl: string
  }>,
): Promise<PlatformExpense> {
  return apiFetch(`/admin/accounting/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteAccountingExpense(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/admin/accounting/expenses/${id}`, { method: "DELETE" })
}

export async function getAccountingTaxes(params?: {
  from?: string
  to?: string
  country?: string
}): Promise<TaxEntry[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.country) q.set("country", params.country)
  const qs = q.toString()
  return apiFetch(`/admin/accounting/taxes${qs ? `?${qs}` : ""}`)
}

// ── Entity cost breakdown ─────────────────────────────────────────────────────

export interface EntityTaskBreakdown {
  taskType: string
  requests: number
  totalCostUsd: number
  creditsCharged: number
  totalTokens: number
  models: { modelName: string | null; costUsd: number; requests: number }[]
}

export async function getEntityCostBreakdown(
  entityId: string,
  entityType: "tenant" | "consumer",
): Promise<EntityTaskBreakdown[]> {
  return apiFetch<EntityTaskBreakdown[]>(
    `/admin/ai/costs/entity-breakdown?entityId=${encodeURIComponent(entityId)}&entityType=${entityType}`,
  )
}

// ── User activity ─────────────────────────────────────────────────────────────

export type AdminActivityCategory =
  | "research"
  | "drafting"
  | "copilot"
  | "search"
  | "other"

export type AdminActivitySource =
  | "ai_output"
  | "copilot"
  | "issue_checker"
  | "court_draft"

export interface AdminUserActivityFilters {
  from?: string
  to?: string
  userId?: string
  tenantId?: string
  category?: AdminActivityCategory
  q?: string
  limit?: number
  offset?: number
}

export interface AdminUserActivityRow {
  id: string
  source: AdminActivitySource
  category: AdminActivityCategory
  userId: string | null
  userName: string | null
  userEmail: string | null
  tenantName: string | null
  taskType: string | null
  mode: string | null
  promptPreview: string
  createdAt: string
}

export interface AdminUserActivityDetail extends AdminUserActivityRow {
  prompt: string
  output: string | null
  copilotThread?: { role: string; content: string; createdAt: string }[]
  metadata?: {
    jurisdiction?: string | null
    matterId?: string | null
    status?: string | null
    citations?: unknown
    title?: string | null
    kind?: string | null
  }
}

function buildUserActivityQuery(params?: AdminUserActivityFilters): string {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.userId) q.set("userId", params.userId)
  if (params?.tenantId) q.set("tenantId", params.tenantId)
  if (params?.category) q.set("category", params.category)
  if (params?.q) q.set("q", params.q)
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  const qs = q.toString()
  return qs ? `?${qs}` : ""
}

export async function listAdminUserActivity(
  params?: AdminUserActivityFilters,
): Promise<Paginated<AdminUserActivityRow>> {
  return apiFetch(`/admin/user-activity${buildUserActivityQuery(params)}`)
}

export async function getAdminUserActivityDetail(
  activityId: string,
): Promise<AdminUserActivityDetail> {
  return apiFetch(
    `/admin/user-activity/${encodeURIComponent(activityId)}`,
  )
}
