/**
 * Copilot types — sessions, messages, tool calls, action proposals, artifacts, audit.
 * Aligns with Smart AI Copilot spec (Legal by OdaFlow).
 */

export type CopilotTabId = "ask" | "work" | "drafts" | "insights" | "history"

export type MessageRole = "user" | "assistant" | "system"

export type ToolName =
  | "summarizeMatter"
  | "summarizeClient"
  | "draftEmail"
  | "proposeTasks"
  | "createTasks"
  | "createCalendarEvent"
  | "draftDocument"

export interface CopilotSession {
  id: string
  userId: string
  userRole: string
  tenantId: string
  createdAt: Date
  updatedAt: Date
  context: CopilotContextSnapshot
  messageIds: string[]
}

export interface CopilotContextSnapshot {
  selectedClientId?: string
  selectedMatterId?: string
  selectedTaskId?: string
  selectedInvoiceId?: string
  timeRange?: { from: Date; to: Date }
  locale?: string
}

export interface CopilotMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  createdAt: Date
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  actionProposals?: ActionProposal[]
  citations?: Citation[]
}

export interface ToolCall {
  id: string
  toolName: ToolName
  args: Record<string, unknown>
  status: "pending" | "success" | "error"
  result?: unknown
  error?: string
}

export interface ToolResult {
  toolCallId: string
  success: boolean
  data?: unknown
  error?: string
}

export interface ActionProposal {
  id: string
  label: string
  description: string
  toolName: ToolName
  payload: Record<string, unknown>
  affectedRecords: { type: string; id: string; label: string }[]
  reasoning?: string
  requiresApproval: boolean
  status: "proposed" | "approved" | "rejected" | "executed" | "failed"
  approvedBy?: string
  approvedAt?: Date
  auditId?: string
}

export interface Citation {
  type: "matter" | "client" | "task" | "invoice" | "document"
  id: string
  label: string
  path: string
}

export interface CopilotArtifact {
  id: string
  sessionId: string
  type: "draft" | "checklist" | "email"
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
  editable: boolean
}

export interface CopilotAuditEntry {
  id: string
  timestamp: Date
  userId: string
  userRole: string
  action: "proposed" | "approved" | "rejected" | "executed" | "failed"
  toolName: ToolName
  payload: Record<string, unknown>
  result?: unknown
  error?: string
  actionProposalId?: string
}

export type CopilotPermission =
  | "canUseCopilotChat"
  | "canUseCopilotDrafts"
  | "canUseCopilotActions"
  | "canApproveCopilotActions"
  | "canUseCopilotFinanceActions"
  | "canUseCopilotClientData"
  | "canUseCopilotMatterData"
  | "canUseCopilotDocumentSearch"
  | "canUseCopilotAdminSettings"
