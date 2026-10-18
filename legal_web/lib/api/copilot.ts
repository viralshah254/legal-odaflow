import { apiFetch } from "./client"
import type { CopilotContextSnapshot } from "@/lib/types/copilot"
import type { ActionProposal, Citation, ToolName } from "@/lib/types/copilot"

export interface DocumentTemplate {
  id: string
  tenantId: string
  name: string
  category?: string | null
  practiceArea?: string | null
  description?: string | null
  contentMarkdown?: string | null
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  createdAt: string
  updatedAt: string
}

export async function listDocumentTemplates(tenantId: string): Promise<DocumentTemplate[]> {
  return apiFetch<DocumentTemplate[]>("/templates", { tenantId })
}

export interface CopilotChatRequest {
  message: string
  sessionId?: string
  context?: Record<string, unknown>
  modelMode?: "AUTO" | "PREMIUM"
  premiumModelId?: string
  /** Explicit knowledge sources for this turn (e.g. statutes, case_law, firm_vault). */
  knowledgeSources?: string[]
}

/** Map UI context snapshot to the backend `context` object (tenant-scoped). */
export function buildCopilotContextPayload(
  snapshot: CopilotContextSnapshot,
  tenantId?: string,
): Record<string, unknown> {
  return {
    tenantId,
    pagePath: snapshot.pagePath,
    page: snapshot.page,
    draftQuery: snapshot.draftQuery,
    intent: snapshot.intent,
    countryCode: snapshot.countryCode,
    jurisdiction: snapshot.jurisdiction,
    selectedMatterId: snapshot.selectedMatterId,
    selectedClientId: snapshot.selectedClientId,
    selectedTaskId: snapshot.selectedTaskId,
    selectedInvoiceId: snapshot.selectedInvoiceId,
    matterId: snapshot.selectedMatterId,
    clientId: snapshot.selectedClientId,
    taskId: snapshot.selectedTaskId,
    invoiceId: snapshot.selectedInvoiceId,
  }
}

export interface CopilotChatMessage {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
  citations?: Citation[]
  actionProposals?: ActionProposal[]
}

export interface CopilotChatResponse {
  sessionId: string
  message: CopilotChatMessage
  actionProposals?: ActionProposal[]
  asyncJobs?: Array<{ toolName: string; jobId: string }>
  modelMode?: "AUTO" | "PREMIUM"
  modelName?: string
  premiumFallback?: boolean
  creditsCharged?: number
}

export interface CopilotAuditEntryApi {
  id: string
  /** Present after API normalization; raw Prisma rows use `createdAt`. */
  timestamp: string
  createdAt?: string
  userId: string
  userRole: string
  action: "proposed" | "approved" | "rejected" | "executed" | "failed" | string
  toolName: ToolName | string | null
  payload: Record<string, unknown>
  result?: unknown
  error?: string | null
  actionProposalId?: string
}

type CopilotAuditLogRaw = Omit<CopilotAuditEntryApi, "timestamp" | "userRole" | "payload"> & {
  timestamp?: string
  createdAt?: string
  userRole?: string | null
  payload?: Record<string, unknown> | null
}

function normalizeCopilotAuditEntry(row: CopilotAuditLogRaw): CopilotAuditEntryApi {
  const payload = isRecord(row.payload) ? row.payload : {}
  return {
    id: row.id,
    timestamp: row.timestamp ?? row.createdAt ?? new Date(0).toISOString(),
    userId: row.userId,
    userRole: row.userRole ?? "",
    action: row.action,
    toolName: row.toolName ?? "unknown",
    payload,
    result: row.result,
    error: row.error ?? undefined,
    actionProposalId: row.actionProposalId,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function sendCopilotMessage(
  tenantId: string,
  data: CopilotChatRequest,
): Promise<CopilotChatResponse> {
  return apiFetch<CopilotChatResponse>("/ai/copilot/chat", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function getCopilotAuditLog(
  tenantId: string,
  limit = 100,
): Promise<CopilotAuditEntryApi[]> {
  const rows = await apiFetch<CopilotAuditLogRaw[] | unknown>(
    `/ai/copilot/audit?limit=${limit}`,
    { tenantId },
  )
  if (!Array.isArray(rows)) return []
  return rows.map(normalizeCopilotAuditEntry)
}

export interface CopilotSessionApi {
  id: string
  tenantId: string
  userId: string
  userRole?: string | null
  context?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  messages?: CopilotChatMessage[]
}

export async function listCopilotSessions(
  tenantId: string,
): Promise<CopilotSessionApi[]> {
  return apiFetch<CopilotSessionApi[]>("/ai/copilot/sessions", { tenantId })
}

export async function deleteCopilotSession(
  tenantId: string,
  sessionId: string,
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch<{ deleted: boolean; id: string }>(
    `/ai/copilot/sessions/${sessionId}`,
    { method: "DELETE", tenantId },
  )
}

export async function createCopilotSession(
  tenantId: string,
  context?: Record<string, unknown>,
  deliverableType?: string,
): Promise<CopilotSessionApi> {
  return apiFetch<CopilotSessionApi>("/ai/copilot/sessions", {
    method: "POST",
    tenantId,
    body: { context, deliverableType },
  })
}

export async function getCopilotSessionMessages(
  tenantId: string,
  sessionId: string,
): Promise<CopilotChatMessage[]> {
  return apiFetch<CopilotChatMessage[]>(
    `/ai/copilot/sessions/${sessionId}/messages`,
    { tenantId },
  )
}

export async function approveCopilotAction(
  tenantId: string,
  proposalId: string,
  data: {
    sessionId: string
    toolName: ToolName
    payload: Record<string, unknown>
    jobId?: string
  },
): Promise<ActionProposal> {
  return apiFetch<ActionProposal>(`/ai/copilot/actions/${proposalId}/approve`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function rejectCopilotAction(
  tenantId: string,
  proposalId: string,
  data: {
    sessionId: string
    toolName: ToolName
    payload: Record<string, unknown>
  },
): Promise<ActionProposal> {
  return apiFetch<ActionProposal>(`/ai/copilot/actions/${proposalId}/reject`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export interface MorningBriefDeadline {
  taskId: string
  title: string
  dueDate: string
  matterId: string | null
  matterTitle: string | null
}

export interface MorningBrief {
  generatedAt: string
  matterDeadlines: MorningBriefDeadline[]
  pendingApprovals: number
  leadCount: number
}

/** @deprecated Use MorningBrief — kept as alias for any external imports */
export type ProactiveBrief = MorningBrief

export async function getProactiveBrief(
  tenantId: string,
): Promise<MorningBrief> {
  return apiFetch<MorningBrief>("/ai/proactive/brief", { tenantId })
}
