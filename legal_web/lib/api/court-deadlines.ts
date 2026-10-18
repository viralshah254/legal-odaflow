import { apiFetch } from "./client"

export interface CourtDeadline {
  id: string
  tenantId: string
  matterId: string
  title: string
  deadlineType: string
  dueDate: string
  status: string
  ruleReference?: string | null
  notes?: string | null
}

export async function listCourtDeadlines(
  tenantId: string,
  matterId: string,
): Promise<CourtDeadline[]> {
  return apiFetch<CourtDeadline[]>(`/matters/${matterId}/court-deadlines`, { tenantId })
}
