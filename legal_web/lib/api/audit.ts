import { apiFetch } from "./client"

export interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  userId?: string | null
  tenantId?: string | null
  createdAt: string
  user?: { id: string; email: string; name?: string | null } | null
}

export interface AuditLogQuery {
  userId?: string
  action?: string
  entityType?: string
  entityId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface AuditLogResponse {
  items: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export async function listAuditLogs(
  tenantId: string,
  query: AuditLogQuery = {},
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams()
  if (query.userId) params.set("userId", query.userId)
  if (query.action) params.set("action", query.action)
  if (query.entityType) params.set("entityType", query.entityType)
  if (query.entityId) params.set("entityId", query.entityId)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  const qs = params.toString() ? `?${params.toString()}` : ""

  const result = await apiFetch<AuditLogResponse | AuditLogEntry[]>(
    `/audit/logs${qs}`,
    { tenantId },
  )

  return Array.isArray(result) ? result : result.items
}

export async function searchAuditLogs(
  tenantId: string,
  query: AuditLogQuery = {},
): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  if (query.userId) params.set("userId", query.userId)
  if (query.action) params.set("action", query.action)
  if (query.entityType) params.set("entityType", query.entityType)
  if (query.entityId) params.set("entityId", query.entityId)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  params.set("limit", String(query.limit ?? 50))
  if (query.offset != null) params.set("offset", String(query.offset))

  const result = await apiFetch<AuditLogResponse | AuditLogEntry[]>(
    `/audit/logs?${params.toString()}`,
    { tenantId },
  )

  if (Array.isArray(result)) {
    return {
      items: result,
      total: result.length,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    }
  }

  return result
}
