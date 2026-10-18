import { apiFetch } from "./client"
import type { ApiInvoice } from "./types"

export interface FinanceDashboardSummary {
  collectionsThisMonth: number
  outstandingTotal: number
  overdueTotal: number
  invoiceAging: Array<{ bucket: string; count: number; amount: number }>
  originatorStats: Array<{
    userId: string
    userName: string
    role: string
    invoicedAmount: number
    collectedAmount: number
    invoiceCount: number
  }>
}

export interface ApiPayment {
  id: string
  invoiceId: string
  invoiceNumber?: string
  amount: number
  paidAt: string
  clientId?: string
  clientName?: string
  paymentMethod?: string
  reconciled?: boolean
}

export interface ApiExpense {
  id: string
  tenantId: string
  matterId?: string | null
  clientId?: string | null
  description: string
  amount: number
  category: string
  status: string
  date: Date
  matterTitle?: string
  clientName?: string
  createdByName?: string
  createdAt: string
  [key: string]: unknown
}

export interface ApiFixedCost {
  id: string
  name: string
  amount: number
  category?: string
  description?: string
  frequency: string
  active: boolean
  startDate: string
  endDate?: string
  [key: string]: unknown
}

export interface ApiClaim {
  id: string
  matterId?: string | null
  clientId?: string | null
  description: string
  amount: number
  status: string
  submittedById?: string
  createdAt: string
  [key: string]: unknown
}

export async function getFinanceDashboard(
  tenantId: string,
): Promise<FinanceDashboardSummary> {
  return apiFetch<FinanceDashboardSummary>(`/finance/dashboard`, { tenantId })
}

export async function listFinanceInvoices(
  tenantId: string,
  status?: string,
): Promise<ApiInvoice[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch<ApiInvoice[]>(`/finance/invoices${query}`, { tenantId })
}

export async function getOutstandingInvoices(
  tenantId: string,
): Promise<ApiInvoice[]> {
  return apiFetch<ApiInvoice[]>(`/finance/invoices/outstanding`, { tenantId })
}

export async function getOverdueInvoices(
  tenantId: string,
): Promise<ApiInvoice[]> {
  return apiFetch<ApiInvoice[]>(`/finance/invoices/overdue`, { tenantId })
}

export async function getInvoiceById(
  tenantId: string,
  invoiceId: string,
): Promise<ApiInvoice> {
  return apiFetch<ApiInvoice>(`/finance/invoices/${invoiceId}`, { tenantId })
}

export async function createInvoice(
  tenantId: string,
  data: Record<string, unknown>,
): Promise<ApiInvoice> {
  return apiFetch<ApiInvoice>("/finance/invoices", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function recordPayment(
  tenantId: string,
  invoiceId: string,
  data: { amount: number; paymentMethod?: string },
): Promise<ApiPayment> {
  return apiFetch<ApiPayment>(`/finance/invoices/${invoiceId}/payments`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listPayments(tenantId: string): Promise<ApiPayment[]> {
  return apiFetch<ApiPayment[]>(`/finance/payments`, { tenantId })
}

export async function listExpenses(
  tenantId: string,
  params?: { matterId?: string; clientId?: string },
): Promise<ApiExpense[]> {
  const search = new URLSearchParams()
  if (params?.matterId) search.set("matterId", params.matterId)
  if (params?.clientId) search.set("clientId", params.clientId)
  const query = search.toString() ? `?${search.toString()}` : ""
  return apiFetch<ApiExpense[]>(`/finance/expenses${query}`, { tenantId })
}

export async function createExpense(
  tenantId: string,
  data: Partial<ApiExpense>,
): Promise<ApiExpense> {
  return apiFetch<ApiExpense>("/finance/expenses", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listFixedCosts(
  tenantId: string,
): Promise<ApiFixedCost[]> {
  return apiFetch<ApiFixedCost[]>(`/finance/fixed-costs`, { tenantId })
}

export async function createFixedCost(
  tenantId: string,
  data: Partial<ApiFixedCost>,
): Promise<ApiFixedCost> {
  return apiFetch<ApiFixedCost>("/finance/fixed-costs", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateFixedCost(
  tenantId: string,
  id: string,
  data: Partial<ApiFixedCost>,
): Promise<ApiFixedCost> {
  return apiFetch<ApiFixedCost>(`/finance/fixed-costs/${id}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteFixedCost(
  tenantId: string,
  id: string,
): Promise<void> {
  await apiFetch<void>(`/finance/fixed-costs/${id}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function listClaims(
  tenantId: string,
  status?: string,
): Promise<ApiClaim[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch<ApiClaim[]>(`/finance/claims${query}`, { tenantId })
}

export async function createClaim(
  tenantId: string,
  data: Partial<ApiClaim>,
): Promise<ApiClaim> {
  return apiFetch<ApiClaim>("/finance/claims", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateClaim(
  tenantId: string,
  claimId: string,
  data: Partial<ApiClaim>,
): Promise<ApiClaim> {
  return apiFetch<ApiClaim>(`/finance/claims/${claimId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export interface ProfitAndLossReport {
  period: { from: string; to: string; label: string }
  revenue: { invoiced: number; collected: number; outstanding: number }
  expenses: { operating: number; fixed: number; claims: number; total: number }
  profit: { gross: number; net: number; margin: number }
}

export async function getProfitAndLoss(
  tenantId: string,
  from?: string,
  to?: string,
): Promise<ProfitAndLossReport> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const query = params.toString() ? `?${params.toString()}` : ""
  return apiFetch<ProfitAndLossReport>(`/finance/pl${query}`, { tenantId })
}

export async function setPaymentReconciled(
  tenantId: string,
  paymentId: string,
  reconciled: boolean,
): Promise<ApiPayment> {
  return apiFetch<ApiPayment>(`/finance/payments/${paymentId}`, {
    method: "PATCH",
    tenantId,
    body: { reconciled },
  })
}

export interface ClientStatement {
  clientId: string
  clientName: string
  clientEmail: string | null
  totalInvoiced: number
  totalPaid: number
  balanceDue: number
  invoices: ApiInvoice[]
}

export interface ClientStatementsResponse {
  period: { from: string; to: string }
  clients: ClientStatement[]
  summary: {
    clientCount: number
    invoiceCount: number
    totalBalanceDue: number
  }
}

export async function getClientStatements(
  tenantId: string,
  options?: { clientId?: string; from?: string; to?: string },
): Promise<ClientStatementsResponse> {
  const params = new URLSearchParams()
  if (options?.clientId) params.set("clientId", options.clientId)
  if (options?.from) params.set("from", options.from)
  if (options?.to) params.set("to", options.to)
  const query = params.toString() ? `?${params.toString()}` : ""
  return apiFetch<ClientStatementsResponse>(`/finance/statements${query}`, {
    tenantId,
  })
}
