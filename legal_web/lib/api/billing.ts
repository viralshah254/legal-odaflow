import { apiFetch, authorizedFetch } from "./client"

// ─── SaaS Account Billing ──────────────────────────────────────────────────────

export interface CurrentBilling {
  userType: "LAW_FIRM" | "CONSUMER"
  billingPlan: string | null
  planTier: string
  planId: string
  subscriptionStatus: string | null
  countryCode: string
  currency?: string
  hasStripeSubscription: boolean
  canManageInPortal: boolean
  stripeCustomerId?: string | null
  providerSubscriptionId: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
}

export async function getCurrentBilling(tenantId?: string): Promise<CurrentBilling> {
  return apiFetch<CurrentBilling>("/billing/current", { tenantId })
}

export async function openBillingPortal(tenantId?: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/billing/portal", {
    method: "POST",
    tenantId,
  })
}

// ─── Practice / Legal Billing ──────────────────────────────────────────────────
// These are law-firm client invoicing functions (separate from SaaS subscription billing).
// Re-export types from the canonical types.ts to avoid duplication.
export type { ApiInvoice } from "./types"

export async function listInvoices(tenantId: string, status?: string): Promise<import("./types").ApiInvoice[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch<import("./types").ApiInvoice[]>(`/billing/invoices${params}`, { tenantId })
}

export async function getInvoice(invoiceId: string, tenantId: string): Promise<import("./types").ApiInvoice> {
  return apiFetch<import("./types").ApiInvoice>(`/billing/invoices/${invoiceId}`, { tenantId })
}

export async function createInvoice(
  tenantId: string,
  body: Record<string, unknown>,
): Promise<import("./types").ApiInvoice> {
  return apiFetch<import("./types").ApiInvoice>("/billing/invoices", { method: "POST", body, tenantId })
}

// ─── Pre-bill ────────────────────────────────────────────────────────────────

export interface PreBillLine {
  id: string
  matterId: string | null
  matterTitle: string
  userId: string
  date: string
  minutes: number
  hours: number
  narrative: string | null
  billable: boolean
  rate: number
  amount: number
  status: string
}

export interface PreBillSummary {
  entryCount: number
  billableHours: number
  totalAmount: number
  pendingApproval: number
}

export interface PreBillReview {
  matterId: string | null
  summary: PreBillSummary
  lines: PreBillLine[]
}

export interface PreBillLineAdjustment {
  id: string
  timeEntryId: string
  adjustedMinutes?: number | null
  writeDownPercent?: number | string | null
  notes?: string | null
}

export interface PreBillSession {
  id: string
  tenantId: string
  matterId?: string | null
  status: string
  writeDownPercent?: number | string | null
  notes?: string | null
  createdBy?: string
  adjustments?: PreBillLineAdjustment[]
  createdAt: string
  updatedAt: string
}

export interface SavePreBillSessionInput {
  writeDownPercent?: number
  notes?: string
  adjustments?: Array<{
    timeEntryId: string
    adjustedMinutes?: number
    writeDownPercent?: number
    notes?: string
  }>
}

export async function getPreBillReview(
  tenantId: string,
  matterId?: string,
): Promise<PreBillReview> {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : ""
  return apiFetch<PreBillReview>(`/billing/pre-bill${params}`, { tenantId })
}

export async function createPreBillSession(
  tenantId: string,
  body: { matterId?: string; notes?: string },
): Promise<PreBillSession> {
  return apiFetch<PreBillSession>("/billing/pre-bill/sessions", { method: "POST", body, tenantId })
}

export async function savePreBillSession(
  tenantId: string,
  sessionId: string,
  body: SavePreBillSessionInput,
): Promise<PreBillSession> {
  return apiFetch<PreBillSession>(`/billing/pre-bill/sessions/${sessionId}`, {
    method: "PATCH",
    body,
    tenantId,
  })
}

export async function downloadLedesExport(
  tenantId: string,
  matterId?: string,
  sessionId?: string,
): Promise<string> {
  const params = new URLSearchParams()
  if (matterId) params.set("matterId", matterId)
  if (sessionId) params.set("sessionId", sessionId)
  const qs = params.toString()
  const path = `/billing/pre-bill/ledes${qs ? `?${qs}` : ""}`
  const res = await authorizedFetch(path, { tenantId })
  if (!res.ok) throw new Error("Failed to download LEDES export")
  return res.text()
}

// ─── Statements ──────────────────────────────────────────────────────────────

export async function downloadStatementPdf(
  tenantId: string,
  params: { clientId?: string; from?: string; to?: string },
): Promise<Blob> {
  const query = new URLSearchParams()
  if (params.clientId) query.set("clientId", params.clientId)
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)
  const qs = query.toString()
  const url = `/billing/statements/pdf${qs ? `?${qs}` : ""}`
  const res = await authorizedFetch(url, { tenantId })
  if (!res.ok) throw new Error("Failed to download statement PDF")
  return res.blob()
}

// ─── Trust Accounts ──────────────────────────────────────────────────────────
// Re-export canonical types from types.ts
export type { ApiTrustAccount } from "./types"

export interface TrustReconciliation {
  id: string
  trustAccountId: string
  reconciledAt: string
  balance: number
  notes?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  openingBalance?: number | null
  closingBalance?: number | null
  status?: string | null
  createdAt?: string
}

export async function listTrustAccounts(tenantId: string): Promise<import("./types").ApiTrustAccount[]> {
  return apiFetch<import("./types").ApiTrustAccount[]>("/billing/trust/accounts", { tenantId })
}

export async function createTrustAccount(
  tenantId: string,
  body: { clientId?: string; matterId?: string; accountName?: string; name?: string; currency: string },
): Promise<import("./types").ApiTrustAccount> {
  return apiFetch<import("./types").ApiTrustAccount>("/billing/trust/accounts", { method: "POST", body, tenantId })
}

export async function addTrustEntry(
  tenantId: string,
  accountId: string,
  body: { amount: number; description?: string; type: string; matterId?: string },
): Promise<import("./types").ApiTrustAccount> {
  return apiFetch<import("./types").ApiTrustAccount>(`/billing/trust/accounts/${accountId}/entries`, {
    method: "POST",
    body,
    tenantId,
  })
}

export async function approveTrustEntry(
  tenantId: string,
  entryId: string,
): Promise<void> {
  return apiFetch<void>(`/billing/trust/entries/${entryId}/approve`, {
    method: "PATCH",
    tenantId,
  })
}

export async function rejectTrustEntry(
  tenantId: string,
  entryId: string,
): Promise<void> {
  return apiFetch<void>(`/billing/trust/entries/${entryId}/reject`, {
    method: "PATCH",
    tenantId,
  })
}

export async function listTrustReconciliations(
  accountId: string,
  tenantId: string,
): Promise<TrustReconciliation[]> {
  return apiFetch<TrustReconciliation[]>(
    `/billing/trust/reconciliation?accountId=${encodeURIComponent(accountId)}`,
    { tenantId },
  )
}

export async function createTrustReconciliation(
  accountId: string,
  tenantId: string,
  body: { balance?: number; notes?: string; periodStart?: string; periodEnd?: string },
): Promise<TrustReconciliation> {
  return apiFetch<TrustReconciliation>("/billing/trust/reconciliation", {
    method: "POST",
    body: { accountId, periodStart: body.periodStart, periodEnd: body.periodEnd },
    tenantId,
  })
}

// ─── Time Approvals ───────────────────────────────────────────────────────────

export interface TimeApprovalEntry {
  id: string
  userId: string
  matterId?: string | null
  matter?: { title?: string | null } | null
  narrative?: string | null
  description?: string
  hours?: number
  minutes?: number
  rate?: number
  total?: number
  date: string
  status: string
  approvedAt?: string | null
  approvedBy?: string | null
}

export async function getTimeApprovals(tenantId: string): Promise<TimeApprovalEntry[]> {
  return apiFetch<TimeApprovalEntry[]>("/billing/time-approvals", { tenantId })
}
