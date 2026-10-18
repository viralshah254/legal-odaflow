import { apiFetch } from "./client"

/** Raw API shape from GET /analytics/reports/firm */
export interface FirmReportsApiResponse {
  matterPipeline: {
    byStageAndStatus: Array<{ stage: string; status: string; count: number }>
    total: number
  }
  invoiceAging: Record<
    string,
    { count: number; totalAmount: number; currencyTotals: Record<string, number> }
  >
  trustBalances: {
    accounts: Array<{ id: string; name: string; balance: number; currency: string }>
    totalBalance: number
    pendingApprovalCount: number
  }
  overdueTasksByOwner: Array<{
    assigneeId: string | null
    assignee: { id: string; name: string | null; email: string } | null
    count: number
    tasks: Array<{ id: string; title: string; dueDate: string | null; priority: string }>
  }>
  outcomeAnalysesPendingReview: number
  practiceAreaBreakdown?: Array<{
    practiceArea: string
    open: number
    closed: number
    avgCycleDays: number | null
  }>
}

/** Normalized shape for UI consumption */
export interface FirmReports {
  matterPipeline: Array<{ stage: string | null; status: string; count: number }>
  matterPipelineTotal: number
  invoiceAging: {
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days90plus: number
  }
  trustSummary: {
    totalBalance: number
    accountCount: number
    pendingApprovals: number
  }
  overdueTasksByOwner: Array<{ ownerId: string; ownerName: string; count: number }>
  outcomeAnalysesPendingReview: number
  practiceAreaBreakdown: Array<{
    practiceArea: string
    open: number
    closed: number
    avgCycleDays: number | null
  }>
}

function normalizeFirmReport(raw: FirmReportsApiResponse): FirmReports {
  const aging = raw.invoiceAging ?? {}
  return {
    matterPipeline: raw.matterPipeline?.byStageAndStatus ?? [],
    matterPipelineTotal: raw.matterPipeline?.total ?? 0,
    invoiceAging: {
      current: aging.current?.count ?? 0,
      days1to30: aging.days1to30?.count ?? 0,
      days31to60: aging.days31to60?.count ?? 0,
      days61to90: aging.days61to90?.count ?? 0,
      days90plus: aging.over90?.count ?? 0,
    },
    trustSummary: {
      totalBalance: raw.trustBalances?.totalBalance ?? 0,
      accountCount: raw.trustBalances?.accounts?.length ?? 0,
      pendingApprovals: raw.trustBalances?.pendingApprovalCount ?? 0,
    },
    overdueTasksByOwner: (raw.overdueTasksByOwner ?? []).map((row) => ({
      ownerId: row.assigneeId ?? "unassigned",
      ownerName:
        row.assignee?.name ??
        row.assignee?.email ??
        (row.assigneeId ? row.assigneeId : "Unassigned"),
      count: row.count,
    })),
    outcomeAnalysesPendingReview: raw.outcomeAnalysesPendingReview ?? 0,
    practiceAreaBreakdown: raw.practiceAreaBreakdown ?? [],
  }
}

export interface WorkQueueSection<T> {
  count: number
  items: T[]
}

export interface WorkQueueIntakeItem {
  id: string
  title: string
  practiceArea: string | null
  matterType: string | null
  stage: string | null
  client: { id: string; name: string }
  createdAt: string
}

export interface WorkQueueKycItem {
  clientId: string
  clientName: string
  clientType: string
  pendingCount: number
  documents: Array<{
    id: string
    documentType: string
    status: string
    fileName: string | null
    createdAt: string
  }>
}

export interface WorkQueueBillingItem {
  id: string
  invoiceNumber: string
  amount: number
  currency: string
  dueDate: string | null
  status: string
  clientId: string | null
  daysOverdue: number | null
}

export interface WorkQueueTrustItem {
  id: string
  type: string
  amount: number
  description: string | null
  status: string
  createdAt: string
  account: { id: string; name: string; currency: string }
  matterId: string | null
}

export interface WorkQueueOverdueTaskItem {
  id: string
  title: string
  priority: string
  dueDate: string | null
  status: string
  matter: { id: string; title: string } | null
  assignee: { id: string; name: string | null; email: string | null } | null
}

export interface WorkQueues {
  intake: WorkQueueSection<WorkQueueIntakeItem>
  kyc: WorkQueueSection<WorkQueueKycItem>
  billing: WorkQueueSection<WorkQueueBillingItem>
  trustApproval: WorkQueueSection<WorkQueueTrustItem>
  overdueCriticalTasks: WorkQueueSection<WorkQueueOverdueTaskItem>
}

export async function getFirmReports(tenantId: string): Promise<FirmReports> {
  const raw = await apiFetch<FirmReportsApiResponse>("/analytics/reports/firm", { tenantId })
  return normalizeFirmReport(raw)
}

export async function getWorkQueues(tenantId: string): Promise<WorkQueues> {
  return apiFetch<WorkQueues>("/analytics/queues/work", { tenantId })
}
