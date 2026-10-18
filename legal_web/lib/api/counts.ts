import { apiFetch } from "./client"

/** Aggregate "things that need doing" counts for the active tenant. */
export interface MeCounts {
  unreadNotifications: number
  openLeads: number
  tasksDueToday: number
  tasksOverdue: number
  queueDepth: number
  pendingApprovals: number
  kycGaps: number
  openAlerts: number
  unbilledTime: number
}

export const EMPTY_COUNTS: MeCounts = {
  unreadNotifications: 0,
  openLeads: 0,
  tasksDueToday: 0,
  tasksOverdue: 0,
  queueDepth: 0,
  pendingApprovals: 0,
  kycGaps: 0,
  openAlerts: 0,
  unbilledTime: 0,
}

/**
 * Fetch aggregate counts in a single request. Degrades gracefully to zeros if
 * the backend endpoint is unavailable, so nav badges never break the shell.
 */
export async function getMeCounts(tenantId: string): Promise<MeCounts> {
  try {
    const raw = await apiFetch<Partial<MeCounts>>(`/me/counts`, { tenantId })
    return { ...EMPTY_COUNTS, ...raw }
  } catch {
    return EMPTY_COUNTS
  }
}
