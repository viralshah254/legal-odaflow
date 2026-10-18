import { apiFetch } from "./client"

export interface InboxMessage {
  id: string
  threadId: string
  direction: string
  body: string
  senderId?: string | null
  createdAt: string
}

export interface InboxThread {
  id: string
  tenantId: string
  clientId?: string | null
  matterId?: string | null
  channel: string
  subject?: string | null
  lastMessageAt?: string | null
  createdAt: string
  updatedAt: string
  messages?: InboxMessage[]
}

export async function listInboxThreads(
  tenantId: string,
  filters?: { matterId?: string; clientId?: string },
): Promise<InboxThread[]> {
  const params = new URLSearchParams()
  if (filters?.matterId) params.set("matterId", filters.matterId)
  if (filters?.clientId) params.set("clientId", filters.clientId)
  const query = params.toString() ? `?${params.toString()}` : ""
  return apiFetch<InboxThread[]>(`/inbox/threads${query}`, { tenantId })
}

export async function getThread(
  tenantId: string,
  threadId: string,
): Promise<InboxThread | null> {
  return apiFetch<InboxThread | null>(`/inbox/threads/${threadId}`, { tenantId })
}

export async function postMessage(
  tenantId: string,
  threadId: string,
  data: { direction: string; body: string; senderId?: string },
): Promise<InboxMessage> {
  return apiFetch<InboxMessage>(`/inbox/threads/${threadId}/messages`, {
    method: "POST",
    tenantId,
    body: data,
  })
}
