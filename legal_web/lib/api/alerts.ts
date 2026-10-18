import { apiFetch } from "./client"
import type { Alert } from "@/lib/types/alerts"

export type { Alert, AlertSeverity, AlertType } from "@/lib/types/alerts"

type AlertAction = {
  id: string
  action: string
  createdAt: string
}

type ApiAlert = Partial<Alert> & {
  id: string
  title: string
  message?: string | null
  status?: string | null
  severity?: string | null
  actions?: AlertAction[]
}

function normalizeSeverity(severity?: string | null): Alert["severity"] {
  const normalized = (severity ?? "").trim().toUpperCase()
  if (normalized === "CRITICAL") return "Critical"
  if (normalized === "HIGH") return "High"
  return "Normal"
}

function normalizeType(type?: string): Alert["type"] {
  switch (type) {
    case "DEADLINE":
    case "TASK":
    case "KYC_MISSING":
    case "KYC_EXPIRED":
    case "ASSISTANCE_REQUEST":
    case "TRANSFER":
      return type
    default:
      return "OTHER"
  }
}

function isAcknowledgedStatus(status?: string | null): boolean {
  const normalized = (status ?? "").trim().toUpperCase()
  return (
    normalized === "ACKNOWLEDGED" ||
    normalized === "COMPLETED" ||
    normalized === "SKIPPED"
  )
}

function toWebAlert(alert: ApiAlert): Alert {
  return {
    id: alert.id,
    title: alert.title,
    description: alert.description ?? alert.message ?? undefined,
    severity: normalizeSeverity(alert.severity),
    type: normalizeType(alert.type),
    assignedToId: alert.assignedToId,
    assignedToName: alert.assignedToName,
    matterId: alert.matterId,
    matterTitle: alert.matterTitle,
    taskId: alert.taskId,
    taskTitle: alert.taskTitle,
    clientId: alert.clientId,
    clientName: alert.clientName,
    assistanceRequestId: alert.assistanceRequestId,
    dueAt: alert.dueAt,
    createdAt: alert.createdAt ?? new Date().toISOString(),
    acknowledged: alert.acknowledged ?? isAcknowledgedStatus(alert.status),
  }
}

export async function listAlerts(
  tenantId: string,
  params?: { severity?: string; assignedToId?: string },
): Promise<Alert[]> {
  const search = new URLSearchParams()
  if (params?.severity) search.set("severity", params.severity)
  if (params?.assignedToId) search.set("assignedToId", params.assignedToId)
  const query = search.toString() ? `?${search.toString()}` : ""
  const alerts = await apiFetch<ApiAlert[]>(`/alerts${query}`, { tenantId })
  return alerts.map(toWebAlert)
}

export async function listUrgentAlerts(tenantId: string): Promise<Alert[]> {
  const alerts = await apiFetch<ApiAlert[]>(`/alerts/urgent`, { tenantId })
  return alerts.map(toWebAlert)
}

export async function completeAlert(
  tenantId: string,
  alertId: string,
): Promise<Alert> {
  const alert = await apiFetch<ApiAlert>(`/alerts/${alertId}/complete`, {
    method: "POST",
    tenantId,
  })
  return toWebAlert(alert)
}

export async function skipAlert(
  tenantId: string,
  alertId: string,
): Promise<Alert> {
  const alert = await apiFetch<ApiAlert>(`/alerts/${alertId}/skip`, {
    method: "POST",
    tenantId,
  })
  return toWebAlert(alert)
}

export async function acknowledgeAlert(
  tenantId: string,
  alertId: string,
): Promise<Alert> {
  const alert = await apiFetch<ApiAlert>(`/alerts/${alertId}/acknowledge`, {
    method: "POST",
    tenantId,
  })
  return toWebAlert(alert)
}
