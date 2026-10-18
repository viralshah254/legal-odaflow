import { apiFetch } from "./client"

export interface ConflictCheck {
  id: string
  tenantId: string
  clientId?: string | null
  matterId?: string | null
  leadId?: string | null
  status: string
  parties?: unknown
  result?: { matches?: unknown[]; summary?: string }
  checkedBy?: string | null
  createdAt: string
}

export async function listConflictChecks(
  tenantId: string,
  status?: string,
): Promise<ConflictCheck[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch<ConflictCheck[]>(`/conflicts${params}`, { tenantId })
}

export async function createConflictCheck(
  tenantId: string,
  body: {
    clientId?: string
    matterId?: string
    leadId?: string
    parties?: Array<{ name?: string; email?: string }>
  },
): Promise<ConflictCheck> {
  return apiFetch<ConflictCheck>(`/conflicts`, {
    method: "POST",
    tenantId,
    body,
  })
}
