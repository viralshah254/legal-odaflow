import { apiFetch } from "./client"

export interface ApiNotification {
  id: string
  tenantId: string
  userId: string
  title: string
  body?: string | null
  type: string
  isRead: boolean
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  link?: string
  createdAt: string
}

function deriveNotificationLink(
  type: string,
  metadata?: Record<string, unknown> | null,
): string | undefined {
  if (typeof metadata?.link === "string") return metadata.link

  const leadId = typeof metadata?.leadId === "string" ? metadata.leadId : undefined
  const taskId = typeof metadata?.taskId === "string" ? metadata.taskId : undefined
  const matterId = typeof metadata?.matterId === "string" ? metadata.matterId : undefined
  const clientId = typeof metadata?.clientId === "string" ? metadata.clientId : undefined

  if (type === "LEAD_SLA_ESCALATION" && leadId) {
    return `/app/leads/${leadId}`
  }
  if ((type === "TASK_OVERDUE" || type === "TASK_DUE") && taskId) {
    return `/app/tasks?highlight=${taskId}`
  }
  if (matterId) {
    return `/app/matters/${matterId}`
  }
  if (clientId) {
    return `/app/clients/${clientId}`
  }
  if (type.startsWith("LEAD")) {
    return "/app/leads"
  }
  if (type.startsWith("TASK")) {
    return "/app/tasks"
  }
  if (type === "COPILOT_DRAFT_READY") {
    return "/app/matters"
  }
  return undefined
}

function mapNotification(row: ApiNotification): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.body ?? "",
    type: row.type,
    read: row.isRead,
    link: deriveNotificationLink(row.type, row.metadata),
    createdAt: row.createdAt,
  }
}

export async function listNotifications(
  tenantId: string,
): Promise<Notification[]> {
  const rows = await apiFetch<ApiNotification[]>(`/notifications`, { tenantId })
  return rows.map(mapNotification)
}

export async function markNotificationRead(
  tenantId: string,
  notificationId: string,
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      tenantId,
    },
  )
}

export async function markAllNotificationsRead(
  tenantId: string,
): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(`/notifications/read-all`, {
    method: "POST",
    tenantId,
  })
}

/**
 * Registers a device (web FCM) token with the backend so the server can
 * deliver push notifications to this browser tab.
 */
export async function registerDeviceToken(
  token: string,
  tenantId?: string,
): Promise<void> {
  await apiFetch<unknown>(`/notifications/devices/register`, {
    method: "POST",
    tenantId,
    body: { token, platform: "web" },
  })
}
