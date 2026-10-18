import { apiFetch } from "./client"

export interface ApiCalendarEvent {
  id: string
  tenantId: string
  title: string
  description?: string | null
  startAt: string
  endAt: string
  matterId?: string | null
  taskId?: string | null
  userId?: string | null
  clientId?: string | null
  location?: string | null
  type: string
  createdAt: string
}

export interface CreateCalendarEventRequest {
  title: string
  description?: string
  startAt: string
  endAt: string
  matterId?: string
  clientId?: string
  location?: string
  type?: string
}

export interface UpdateCalendarEventRequest {
  title?: string
  description?: string
  startAt?: string
  endAt?: string
  location?: string
  type?: string
}

export async function listCalendarEvents(
  tenantId: string,
  from?: string,
  to?: string,
): Promise<ApiCalendarEvent[]> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const query = params.toString() ? `?${params.toString()}` : ""
  // Backend controller is at GET /calendar (alias also accepts /calendar/events)
  return apiFetch<ApiCalendarEvent[]>(`/calendar${query}`, { tenantId })
}

export async function getCalendarEvent(
  tenantId: string,
  eventId: string,
): Promise<ApiCalendarEvent> {
  return apiFetch<ApiCalendarEvent>(`/calendar/${eventId}`, { tenantId })
}

export async function createCalendarEvent(
  tenantId: string,
  data: CreateCalendarEventRequest,
): Promise<ApiCalendarEvent> {
  return apiFetch<ApiCalendarEvent>("/calendar", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateCalendarEvent(
  tenantId: string,
  eventId: string,
  data: UpdateCalendarEventRequest,
): Promise<ApiCalendarEvent> {
  return apiFetch<ApiCalendarEvent>(`/calendar/${eventId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}
