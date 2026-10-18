/**
 * Mock Copilot service: sessions, messages, tools, audit.
 * Persists to localStorage so state survives refresh.
 */

import type {
  Citation,
  CopilotSession,
  CopilotMessage,
  CopilotArtifact,
  CopilotAuditEntry,
  ActionProposal,
  CopilotContextSnapshot,
  ToolName,
} from "@/lib/types/copilot"
import { getMatterById, mockMatters } from "@/lib/mock/matters"
import { getClientById } from "@/lib/mock/clients"
import { getTasksByMatter } from "@/lib/mock/tasks"
import { createTask } from "@/lib/mock/tasks"
import { createEvent } from "@/lib/mock/calendar"
import type { Task } from "@/lib/mock/tasks"
import type { CalendarEvent } from "@/lib/mock/calendar"
import { mockUsers } from "@/lib/mock/users"
import { getTimelineEventsByMatter } from "@/lib/mock/timeline"
import { getKycChecklist } from "@/lib/mock/kyc"
import { getKycDocTypeLabel } from "@/lib/types/kyc"
import {
  getInvoicesByClient,
  getInvoicesByMatter,
  getOverdueInvoices,
  getOutstandingInvoices,
} from "@/lib/mock/finance"
import { format } from "date-fns"

function getUserName(userId: string): string {
  return mockUsers.find((u) => u.id === userId)?.name ?? "User"
}

const STORAGE_SESSIONS = "odaflow-copilot-sessions"
const STORAGE_MESSAGES = "odaflow-copilot-messages"
const STORAGE_ARTIFACTS = "odaflow-copilot-artifacts"
const STORAGE_AUDIT = "odaflow-copilot-audit"

function loadJson<T>(key: string, defaultVal: T): T {
  if (typeof window === "undefined") return defaultVal
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : defaultVal
  } catch {
    return defaultVal
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return new Date(value)
  }
  return value
}

let sessions: CopilotSession[] = []
let messages: CopilotMessage[] = []
let artifacts: CopilotArtifact[] = []
let auditLog: CopilotAuditEntry[] = []

function hydrate() {
  sessions = loadJson(STORAGE_SESSIONS, []).map((s: Record<string, unknown>) => ({
    ...s,
    createdAt: typeof s.createdAt === "string" ? new Date(s.createdAt) : (s.createdAt as Date),
    updatedAt: typeof s.updatedAt === "string" ? new Date(s.updatedAt) : (s.updatedAt as Date),
    context: s.context as CopilotContextSnapshot,
  })) as CopilotSession[]
  messages = loadJson(STORAGE_MESSAGES, []).map((m: Record<string, unknown>) => ({
    ...m,
    createdAt: typeof m.createdAt === "string" ? new Date(m.createdAt) : (m.createdAt as Date),
  })) as CopilotMessage[]
  artifacts = loadJson(STORAGE_ARTIFACTS, []).map((a: Record<string, unknown>) => ({
    ...a,
    createdAt: typeof a.createdAt === "string" ? new Date(a.createdAt) : (a.createdAt as Date),
    updatedAt: typeof a.updatedAt === "string" ? new Date(a.updatedAt) : (a.updatedAt as Date),
  })) as CopilotArtifact[]
  auditLog = loadJson(STORAGE_AUDIT, []).map((e: Record<string, unknown>) => ({
    ...e,
    timestamp: typeof e.timestamp === "string" ? new Date(e.timestamp) : (e.timestamp as Date),
  })) as CopilotAuditEntry[]
}

function persist() {
  saveJson(STORAGE_SESSIONS, sessions)
  saveJson(STORAGE_MESSAGES, messages)
  saveJson(STORAGE_ARTIFACTS, artifacts)
  saveJson(STORAGE_AUDIT, auditLog)
}

if (typeof window !== "undefined") {
  hydrate()
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// —— Sessions ——

export function createSession(
  userId: string,
  userRole: string,
  tenantId: string,
  context: CopilotContextSnapshot
): CopilotSession {
  const session: CopilotSession = {
    id: nextId("sess"),
    userId,
    userRole,
    tenantId,
    createdAt: new Date(),
    updatedAt: new Date(),
    context: { ...context },
    messageIds: [],
  }
  sessions.push(session)
  persist()
  return session
}

export function getSession(sessionId: string): CopilotSession | undefined {
  if (sessions.length === 0) hydrate()
  return sessions.find((s) => s.id === sessionId)
}

export function getOrCreateCurrentSession(
  userId: string,
  userRole: string,
  tenantId: string,
  context: CopilotContextSnapshot
): CopilotSession {
  if (sessions.length === 0) hydrate()
  const recent = sessions
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  if (recent) {
    recent.updatedAt = new Date()
    recent.context = { ...context }
    persist()
    return recent
  }
  return createSession(userId, userRole, tenantId, context)
}

// —— Messages ——

export function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  meta?: { toolCalls?: CopilotMessage["toolCalls"]; actionProposals?: ActionProposal[]; citations?: CopilotMessage["citations"] }
): CopilotMessage {
  const msg: CopilotMessage = {
    id: nextId("msg"),
    sessionId,
    role,
    content,
    createdAt: new Date(),
    ...meta,
  }
  messages.push(msg)
  const session = sessions.find((s) => s.id === sessionId)
  if (session) {
    session.messageIds = session.messageIds || []
    session.messageIds.push(msg.id)
    session.updatedAt = new Date()
  }
  persist()
  return msg
}

export function getMessagesForSession(sessionId: string): CopilotMessage[] {
  if (messages.length === 0) hydrate()
  return messages.filter((m) => m.sessionId === sessionId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

// —— Artifacts (drafts) ——

export function addArtifact(
  sessionId: string,
  type: "draft" | "checklist" | "email",
  title: string,
  content: string
): CopilotArtifact {
  const artifact: CopilotArtifact = {
    id: nextId("art"),
    sessionId,
    type,
    title,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    editable: true,
  }
  artifacts.push(artifact)
  persist()
  return artifact
}

export function updateArtifact(id: string, updates: Partial<Pick<CopilotArtifact, "title" | "content">>): void {
  const a = artifacts.find((x) => x.id === id)
  if (a) {
    if (updates.title !== undefined) a.title = updates.title
    if (updates.content !== undefined) a.content = updates.content
    a.updatedAt = new Date()
    persist()
  }
}

export function getArtifactsForSession(sessionId: string): CopilotArtifact[] {
  if (artifacts.length === 0) hydrate()
  return artifacts.filter((a) => a.sessionId === sessionId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getAllArtifacts(): CopilotArtifact[] {
  if (artifacts.length === 0) hydrate()
  return [...artifacts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// —— Audit ——

export function appendAudit(entry: Omit<CopilotAuditEntry, "id" | "timestamp">): CopilotAuditEntry {
  const full: CopilotAuditEntry = {
    ...entry,
    id: nextId("audit"),
    timestamp: new Date(),
  }
  auditLog.push(full)
  persist()
  return full
}

export function getAuditLog(limit = 100): CopilotAuditEntry[] {
  if (auditLog.length === 0) hydrate()
  return [...auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit)
}

// —— Smart tools (data-driven) ——

export function summarizeMatter(matterId: string): { summary: string; citations: Citation[] } {
  const matter = getMatterById(matterId)
  if (!matter) {
    return { summary: "Matter not found.", citations: [] }
  }
  const tasks = getTasksByMatter(matterId)
  const openTasks = tasks.filter((t) => t.status !== "Done")
  const overdueTasks = tasks.filter((t) => new Date(t.dueAt) < new Date() && t.status !== "Done")
  const timeline = getTimelineEventsByMatter(matterId).slice(0, 3)
  const invoices = getInvoicesByMatter(matterId)
  const outstandingInvoices = invoices.filter((inv) => inv.status === "Sent" || inv.status === "Overdue")

  const lines = [
    `**${matter.title}** (${matter.ref})`,
    `Stage: ${matter.stage} · Status: ${matter.status} · Risk: ${matter.risk}`,
    `Client: ${matter.clientName} · Owner: ${matter.ownerName}`,
    matter.nextDeadline ? `Next deadline: ${format(matter.nextDeadline, "PPP")}` : "No upcoming deadline.",
    "",
    "**Tasks:** " + (openTasks.length > 0 ? `${openTasks.length} open` : "None open") +
      (overdueTasks.length > 0 ? `, **${overdueTasks.length} overdue**` : "") + ".",
    timeline.length > 0
      ? "**Recent activity:** " + timeline.map((e) => e.title).join("; ")
      : "",
    outstandingInvoices.length > 0
      ? `**Outstanding invoices:** ${outstandingInvoices.length} (${outstandingInvoices.map((i) => i.invoiceNumber).join(", ")})`
      : "",
  ].filter(Boolean)

  return {
    summary: lines.join("\n\n"),
    citations: [
      { type: "matter", id: matter.id, label: matter.title, path: `/app/matters/${matter.id}` },
      { type: "client", id: matter.clientId, label: matter.clientName, path: `/app/clients/${matter.clientId}` },
    ],
  }
}

export function summarizeClient(clientId: string): { summary: string; citations: Citation[] } {
  const client = getClientById(clientId)
  if (!client) {
    return { summary: "Client not found.", citations: [] }
  }
  const matters = mockMatters.filter((m) => m.clientId === clientId)
  const kycChecklist = getKycChecklist(clientId)
  const missingKyc = kycChecklist?.documents.filter((d) => d.status === "MISSING").length ?? 0
  const invoices = getInvoicesByClient(clientId)
  const outstanding = invoices.filter((inv) => inv.status === "Sent" || inv.status === "Overdue")

  const lines = [
    `**${client.name}** (${client.type})`,
    `KYC: ${client.kycStatus}` + (missingKyc > 0 ? ` — ${missingKyc} document(s) missing` : ""),
    client.email ? `Email: ${client.email}` : "",
    client.phone ? `Phone: ${client.phone}` : "",
    client.country ? `Country: ${client.country}` : "",
    "",
    "**Matters:** " + (matters.length > 0 ? `${matters.length} matter(s): ${matters.map((m) => m.title).join("; ")}` : "None"),
    outstanding.length > 0
      ? `**Outstanding invoices:** ${outstanding.length} (${outstanding.map((i) => i.invoiceNumber).join(", ")})`
      : "",
  ].filter(Boolean)

  return {
    summary: lines.join("\n\n"),
    citations: [
      { type: "client", id: client.id, label: client.name, path: `/app/clients/${client.id}` },
    ],
  }
}

export interface MissingItem {
  type: "kyc_missing" | "kyc_expired" | "task_overdue" | "invoice_overdue"
  label: string
  detail?: string
  path?: string
}

export function getMissingItems(opts: { clientId?: string; matterId?: string }): {
  items: MissingItem[]
  summary: string
  citations: Citation[]
} {
  const items: MissingItem[] = []
  const citations: Citation[] = []

  if (opts.clientId) {
    const client = getClientById(opts.clientId)
    if (client) {
      citations.push({ type: "client", id: client.id, label: client.name, path: `/app/clients/${client.id}` })
      const checklist = getKycChecklist(opts.clientId)
      if (checklist) {
        checklist.documents.forEach((d) => {
          if (d.status === "MISSING") {
            items.push({
              type: "kyc_missing",
              label: getKycDocTypeLabel(d.docType),
              detail: "Not yet received",
              path: `/app/clients/${opts.clientId}`,
            })
          } else if (d.status === "EXPIRED" || (d.expiryDate && new Date(d.expiryDate) < new Date())) {
            items.push({
              type: "kyc_expired",
              label: getKycDocTypeLabel(d.docType),
              detail: d.expiryDate ? `Expired ${format(new Date(d.expiryDate), "PP")}` : "Expired",
              path: `/app/clients/${opts.clientId}`,
            })
          }
        })
      }
      const overdueInvs = getInvoicesByClient(opts.clientId).filter(
        (inv) => inv.status !== "Paid" && inv.status !== "Cancelled" && new Date(inv.dueDate) < new Date()
      )
      overdueInvs.forEach((inv) => {
        items.push({
          type: "invoice_overdue",
          label: `Invoice ${inv.invoiceNumber}`,
          detail: `Due ${format(inv.dueDate, "PP")} · ${inv.clientName}`,
          path: `/app/accounting/invoices`,
        })
      })
    }
  }

  if (opts.matterId) {
    const matter = getMatterById(opts.matterId)
    if (matter) {
      citations.push({ type: "matter", id: matter.id, label: matter.title, path: `/app/matters/${matter.id}` })
      const tasks = getTasksByMatter(opts.matterId).filter((t) => new Date(t.dueAt) < new Date() && t.status !== "Done")
      tasks.forEach((t) => {
        items.push({
          type: "task_overdue",
          label: t.title,
          detail: `Due ${format(new Date(t.dueAt), "PP")} · ${t.assignedToName}`,
          path: `/app/tasks`,
        })
      })
    }
  }

  const summary =
    items.length === 0
      ? "Nothing critical missing for the current context."
      : `**What's missing or needs attention:**\n\n` +
        items.map((i, idx) => `${idx + 1}. **${i.label}** (${i.type.replace("_", " ")})${i.detail ? ` — ${i.detail}` : ""}`).join("\n")

  return { items, summary, citations }
}

export function getMatterKickoff(matterId: string): {
  overview: string
  plan30: string[]
  plan60: string[]
  plan90: string[]
  suggestedTasks: { title: string; description?: string; dueDays: number; priority: "Low" | "Normal" | "High" | "Critical" }[]
  risks: string[]
  engagementOutline: string
  citations: Citation[]
} {
  const matter = getMatterById(matterId)
  if (!matter) {
    return {
      overview: "Matter not found.",
      plan30: [],
      plan60: [],
      plan90: [],
      suggestedTasks: [],
      risks: [],
      engagementOutline: "",
      citations: [],
    }
  }

  const tasks = getTasksByMatter(matterId)
  const openTasks = tasks.map((t) => t.title)
  const citations: Citation[] = [
    { type: "matter", id: matter.id, label: matter.title, path: `/app/matters/${matter.id}` },
    { type: "client", id: matter.clientId, label: matter.clientName, path: `/app/clients/${matter.clientId}` },
  ]

  const stagePlans: Record<string, { 30: string[]; 60: string[]; 90: string[] }> = {
    Intake: {
      30: ["Complete conflict check", "Send engagement letter", "Gather initial documents"],
      60: ["Open matter file", "Set up matter plan", "First client meeting"],
      90: ["Complete intake checklist", "Assign matter owner", "Kick off first phase"],
    },
    Active: {
      30: ["Review file and deadlines", "Draft initial strategy", "Client update"],
      60: ["Progress key milestones", "Document key decisions", "Internal review"],
      90: ["Complete current phase", "Plan next phase", "Billing and reporting"],
    },
    Discovery: {
      30: ["Discovery plan", "Document requests", "Schedule key dates"],
      60: ["Complete document review", "Draft disclosures", "Expert engagement if needed"],
      90: ["Close discovery", "Pre-trial prep", "Settlement assessment"],
    },
    Negotiation: {
      30: ["Position summary", "Draft settlement outline", "Client instructions"],
      60: ["Negotiation rounds", "Revised drafts", "Internal sign-off"],
      90: ["Settlement agreement", "Closing documents", "Matter closure"],
    },
    Closing: {
      30: ["Finalise documents", "Client execution", "Filing and registration"],
      60: ["Complete closing", "Post-closing matters", "File closure"],
      90: ["Archive file", "Lessons learned", "Client feedback"],
    },
    Closed: {
      30: ["Post-closing follow-up", "Archive", "Final billing"],
      60: [],
      90: [],
    },
  }

  const plan = stagePlans[matter.stage] ?? stagePlans.Active

  const suggestedTasks = [
    ...(openTasks.length < 3 ? [{ title: "Review file and update checklist", description: "Ensure all documents are in order.", dueDays: 3, priority: "High" as const }] : []),
    { title: "Draft client update letter", description: "Summarize progress and next steps.", dueDays: 5, priority: "Normal" as const },
    { title: "Schedule follow-up call", description: "Coordinate with client.", dueDays: 7, priority: "Normal" as const },
    { title: "Check deadlines and diarise", description: "Confirm no critical dates are missed.", dueDays: 1, priority: "Critical" as const },
  ].slice(0, 5)

  const risks: string[] = []
  if (matter.risk === "High" || matter.risk === "Critical") risks.push(`Matter flagged as ${matter.risk} risk — review required.`)
  const overdue = tasks.filter((t) => new Date(t.dueAt) < new Date() && t.status !== "Done")
  if (overdue.length > 0) risks.push(`${overdue.length} overdue task(s) on this matter.`)

  const engagementOutline = [
    `1. Parties: ${matter.clientName} (Client), [Firm name] (Legal).`,
    `2. Scope: Legal representation in respect of ${matter.title}.`,
    `3. Fees: [As per fee letter / hourly / fixed].`,
    `4. Responsibilities: Client to provide instructions and documents; Firm to advise and act.`,
    `5. Termination: Either party may terminate on notice.`,
  ].join("\n")

  return {
    overview: `${matter.title} (${matter.ref}) — ${matter.stage}, ${matter.status}. Client: ${matter.clientName}. Owner: ${matter.ownerName}.${matter.nextDeadline ? ` Next deadline: ${format(matter.nextDeadline, "PPP")}.` : ""}`,
    plan30: plan[30],
    plan60: plan[60],
    plan90: plan[90],
    suggestedTasks,
    risks: risks.length > 0 ? risks : ["No major risks identified. Review matter periodically."],
    engagementOutline,
    citations,
  }
}

export function draftEmail(context: { matterId?: string; clientId?: string; purpose?: string }): { subject: string; body: string } {
  const matter = context.matterId ? getMatterById(context.matterId) : null
  const client = context.clientId ? getClientById(context.clientId) : null
  const purpose = context.purpose || "general update"
  const subject = matter
    ? `Re: ${matter.title} – ${purpose}`
    : client
      ? `Re: ${client.name} – ${purpose}`
      : `Legal matter – ${purpose}`
  const body = [
    "Dear " + (client?.name ?? "Client") + ",",
    "",
    "Please find below an update regarding " + (purpose) + ".",
    matter ? `Matter: ${matter.title} (${matter.ref}).` : "",
    "",
    "If you have any questions, do not hesitate to contact us.",
    "",
    "Best regards,",
    "Legal Team",
  ].filter(Boolean).join("\n")
  return { subject, body }
}

export function proposeTasks(context: { matterId?: string; clientId?: string; count?: number }): {
  tasks: { title: string; description?: string; dueDays: number; priority: "Low" | "Normal" | "High" | "Critical" }[]
  citations: Citation[]
} {
  const matter = context.matterId ? getMatterById(context.matterId) : null
  const count = context.count ?? 5
  const existingTitles = matter ? getTasksByMatter(matter.id).filter((t) => t.status !== "Done").map((t) => t.title.toLowerCase()) : []
  const overdue = matter ? getTasksByMatter(matter.id).filter((t) => new Date(t.dueAt) < new Date() && t.status !== "Done") : []

  const stageSuggestions: Record<string, { title: string; description: string; dueDays: number; priority: "Low" | "Normal" | "High" | "Critical" }[]> = {
    Intake: [
      { title: "Complete conflict check", description: "Run conflict search and document result.", dueDays: 1, priority: "Critical" },
      { title: "Send engagement letter", description: "Draft and send engagement letter to client.", dueDays: 3, priority: "High" },
      { title: "Gather initial documents", description: "Request and organise key documents.", dueDays: 5, priority: "High" },
    ],
    Discovery: [
      { title: "Draft discovery plan", description: "Outline discovery scope and timeline.", dueDays: 2, priority: "High" },
      { title: "Prepare document requests", description: "Draft and issue document requests.", dueDays: 5, priority: "High" },
      { title: "Schedule key deadlines", description: "Diarise discovery cut-off and hearings.", dueDays: 1, priority: "Critical" },
    ],
    Negotiation: [
      { title: "Draft settlement outline", description: "Summary of positions and options.", dueDays: 3, priority: "High" },
      { title: "Client instructions on settlement", description: "Obtain client instructions.", dueDays: 5, priority: "High" },
      { title: "Internal sign-off", description: "Partner review before finalising.", dueDays: 7, priority: "Normal" },
    ],
    Closing: [
      { title: "Finalise closing documents", description: "Prepare execution copies.", dueDays: 2, priority: "High" },
      { title: "Client execution", description: "Arrange signing.", dueDays: 5, priority: "High" },
      { title: "File and close matter", description: "Complete filing and close file.", dueDays: 7, priority: "Normal" },
    ],
  }

  const stageTasks = matter ? (stageSuggestions[matter.stage] ?? stageSuggestions.Intake) : []
  const generic = [
    { title: "Review file and update checklist", description: "Ensure all documents are in order.", dueDays: 3, priority: "High" as const },
    { title: "Draft client update letter", description: "Summarize progress and next steps.", dueDays: 5, priority: "Normal" as const },
    { title: "Schedule follow-up call", description: "Coordinate with client.", dueDays: 7, priority: "Normal" as const },
    { title: "Check deadlines and diarise", description: "Confirm no critical dates are missed.", dueDays: 1, priority: "Critical" as const },
  ]

  const combined = [...stageTasks, ...generic]
  const tasks = combined
    .filter((t) => !existingTitles.some((existing) => t.title.toLowerCase().includes(existing) || existing.includes(t.title.toLowerCase())))
    .slice(0, count)

  const citations = matter
    ? [{ type: "matter" as const, id: matter.id, label: matter.title, path: `/app/matters/${matter.id}` }]
    : []

  return {
    tasks: tasks.length > 0 ? tasks : generic.slice(0, count),
    citations,
  }
}

export function createTasksViaCopilot(
  tasks: Array<{ title: string; description?: string; dueDays: number; priority: "Low" | "Normal" | "High" | "Critical"; matterId?: string; assignedToId: string }>,
  actorUserId: string
): { created: { id: string; title: string }[]; auditId: string } {
  const created: { id: string; title: string }[] = []
  const now = new Date()
  for (const t of tasks) {
    const dueAt = new Date(now)
    dueAt.setDate(dueAt.getDate() + t.dueDays)
    const taskData: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
      title: t.title,
      description: t.description,
      matterId: t.matterId,
      matterTitle: t.matterId ? getMatterById(t.matterId)?.title : undefined,
      assignedToId: t.assignedToId,
      assignedToName: getUserName(t.assignedToId),
      dueAt,
      priority: t.priority,
      status: "Todo",
      category: t.priority === "Critical" ? "CRITICAL" : "STANDARD",
    }
    const createdTask = createTask(taskData)
    created.push({ id: createdTask.id, title: createdTask.title })
  }
  const auditEntry = appendAudit({
    userId: actorUserId,
    userRole: "",
    action: "executed",
    toolName: "createTasks",
    payload: { tasks: tasks.length, titles: tasks.map((t) => t.title) },
    result: { created },
  })
  return { created, auditId: auditEntry.id }
}

export function createCalendarEventViaCopilot(
  event: { title: string; startAt: Date; endAt: Date; matterId?: string; attendeeIds: string[]; type?: CalendarEvent["type"] },
  actorUserId: string
): { eventId: string; auditId: string } {
  const attendeeNames = event.attendeeIds.map((id) => getUserName(id))
  const newEvent = createEvent({
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    matterId: event.matterId,
    matterTitle: event.matterId ? getMatterById(event.matterId)?.title : undefined,
    attendeeIds: event.attendeeIds,
    attendeeNames,
    type: event.type ?? "Meeting",
  })
  const auditEntry = appendAudit({
    userId: actorUserId,
    userRole: "",
    action: "executed",
    toolName: "createCalendarEvent",
    payload: { title: event.title, startAt: event.startAt, endAt: event.endAt },
    result: { eventId: newEvent.id },
  })
  return { eventId: newEvent.id, auditId: auditEntry.id }
}
