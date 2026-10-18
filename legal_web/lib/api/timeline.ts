import { apiFetch } from "./client"

export interface ApiTimelineEvent {
  id: string
  tenantId: string
  matterId: string
  eventType: string
  title: string
  description?: string | null
  userId?: string | null
  userName?: string | null
  metadata?: {
    userId?: string
    userName?: string
    fromStage?: string
    toStage?: string
    fromStatus?: string
    toStatus?: string
    noteId?: string
    [key: string]: unknown
  } | null
  occurredAt: string
  createdAt: string
}

export async function listTimelineEvents(
  tenantId: string,
  matterId: string,
): Promise<ApiTimelineEvent[]> {
  return apiFetch<ApiTimelineEvent[]>(`/matters/${matterId}/timeline`, {
    tenantId,
  })
}

export async function createTimelineEvent(
  tenantId: string,
  matterId: string,
  body: { eventType: string; title: string; description?: string },
): Promise<ApiTimelineEvent> {
  return apiFetch<ApiTimelineEvent>(`/matters/${matterId}/timeline`, {
    method: "POST",
    tenantId,
    body,
  })
}

export async function addTimelineEvent(
  tenantId: string,
  event: {
    matterId: string
    type: string
    title: string
    description?: string
    metadata?: Record<string, unknown>
  },
): Promise<ApiTimelineEvent> {
  return apiFetch<ApiTimelineEvent>(`/matters/${event.matterId}/timeline`, {
    method: "POST",
    tenantId,
    body: {
      eventType: event.type,
      title: event.title,
      description: event.description,
      metadata: event.metadata,
    },
  })
}
