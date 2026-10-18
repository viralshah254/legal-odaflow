export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  "task.created": "A task is created",
  "matter.created": "A matter is opened",
  "document.uploaded": "A document is uploaded",
  "agent.completed": "An AI agent finishes a job",
  "invoice.overdue": "An invoice becomes overdue",
}

export const AUTOMATION_TRIGGER_OPTIONS = Object.entries(
  AUTOMATION_TRIGGER_LABELS,
).map(([value, label]) => ({ value, label }))

export const AGENT_JOB_TYPE_LABELS: Record<string, string> = {
  DRAFT_DOCUMENT: "Document draft",
  SUMMARIZE_MATTER: "Matter summary",
  LEGAL_RESEARCH_MEMO: "Legal research memo",
  SUGGEST_NEXT_STEPS: "Next steps suggestion",
  ANALYZE_DOCUMENT: "Document analysis",
  COLLECTIONS_BRIEF: "Collections brief",
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  send_notification: "Send in-app notification",
  create_task: "Create a task",
  enqueue_agent_job: "Run an AI agent",
}

export const NOTIFY_ROLE_LABELS: Record<string, string> = {
  FIRM_ADMIN: "Firm admin",
  FINANCE: "Finance team",
  PARTNER: "Partner",
}

/** Built-in agentic recipes that can be seeded */
export const BUILT_IN_AGENTIC_RECIPES = [
  {
    recipeKey: "matter_opened_summary_notify",
    name: "Matter opened → Run matter summary → Notify partner",
    trigger: "matter.created",
    conditions: { _recipeKey: "matter_opened_summary_notify" },
    actions: [
      { type: "enqueue_agent_job", toolName: "SUMMARIZE_MATTER", outputAction: "send_notification" },
    ],
  },
  {
    recipeKey: "document_uploaded_analyze_task",
    name: "Document uploaded → Analyze document → Create task",
    trigger: "document.uploaded",
    conditions: { _recipeKey: "document_uploaded_analyze_task" },
    actions: [
      { type: "enqueue_agent_job", toolName: "ANALYZE_DOCUMENT", outputAction: "create_task" },
    ],
  },
  {
    recipeKey: "invoice_overdue_collections_notify",
    name: "Invoice 30+ days overdue → Run collections brief → Notify finance",
    trigger: "invoice.overdue",
    conditions: { _recipeKey: "invoice_overdue_collections_notify", minAmount: 1 },
    actions: [
      { type: "enqueue_agent_job", toolName: "COLLECTIONS_BRIEF", outputAction: "send_notification" },
    ],
  },
]

export function extractRecipeKey(
  conditions: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!conditions || typeof conditions !== "object") return undefined
  const key = conditions._recipeKey
  return typeof key === "string" ? key : undefined
}

export function describeConditions(
  conditions: Record<string, unknown> | null | undefined,
): string[] {
  if (!conditions) return ["No extra conditions"]
  const lines: string[] = []

  if (conditions.hasAssignee) {
    lines.push("Only when the task has an assignee")
  }
  if (typeof conditions.jobType === "string") {
    lines.push(
      `Only for ${AGENT_JOB_TYPE_LABELS[conditions.jobType] ?? conditions.jobType} jobs`,
    )
  }
  if (typeof conditions.matterType === "string") {
    lines.push(`Only for ${conditions.matterType} matters`)
  }
  if (typeof conditions.minAmount === "number") {
    lines.push(`Only when amount is at least ${conditions.minAmount}`)
  }

  return lines.length > 0 ? lines : ["Runs for every matching event"]
}

export function describeAction(action: Record<string, unknown>): string {
  switch (action.type) {
    case "send_notification":
      return `Notify: "${action.title ?? "Notification"}"`
    case "create_task":
      return `Create task: "${action.title ?? "New task"}" (${action.priority ?? "MEDIUM"})`
    case "enqueue_agent_job":
      return `Run AI: ${action.toolName ?? "agent"}`
    default:
      return String(action.type ?? "Unknown action")
  }
}

export function describeRuleSummary(
  trigger: string,
  conditions: Record<string, unknown> | null | undefined,
  actions: Array<Record<string, unknown>> | null | undefined,
): string {
  const when = AUTOMATION_TRIGGER_LABELS[trigger] ?? trigger
  const actionCount = actions?.length ?? 0
  const conditionLines = describeConditions(conditions)
  return `${when} → ${actionCount} action${actionCount === 1 ? "" : "s"} (${conditionLines[0]?.toLowerCase() ?? "always"})`
}

export function formatRunStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Completed"
    case "FAILED":
      return "Failed"
    case "RUNNING":
      return "Running"
    case "QUEUED":
      return "Queued"
    default:
      return status
  }
}
