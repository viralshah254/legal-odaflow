import { getLead, listLeads } from "@/lib/api/marketplace"
import { isRetryableIntakeSaveError } from "@/lib/api/cloudflare-challenge"

const PENDING_KEY = "odaflow_pending_firm_intake"
const RECENT_LEAD_MS = 10 * 60 * 1000

export interface PendingFirmIntake {
  leadId?: string
  consumerCaseId?: string
  title: string
}

export function loadPendingFirmIntake(): PendingFirmIntake | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(PENDING_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingFirmIntake
  } catch {
    return null
  }
}

export function savePendingFirmIntake(pending: PendingFirmIntake): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
}

export function clearPendingFirmIntake(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PENDING_KEY)
}

export async function findExistingFirmIntakeLead(input: {
  leadId?: string
  title?: string
}): Promise<string | undefined> {
  if (input.leadId) {
    try {
      const detail = await getLead(input.leadId)
      return detail.lead.id
    } catch {
      // Stale id — fall through to a recent title match.
    }
  }

  const title = input.title?.trim().toLowerCase()
  if (!title) return undefined

  try {
    const leads = await listLeads()
    const cutoff = Date.now() - RECENT_LEAD_MS
    const match = leads.find((lead) => {
      if (new Date(lead.createdAt).getTime() < cutoff) return false
      return (lead.summary ?? "").toLowerCase().includes(title)
    })
    return match?.id
  } catch {
    return undefined
  }
}

export async function withIntakeSaveRetry<T>(
  run: () => Promise<T>,
  options?: {
    delayMs?: number
    recover?: () => Promise<T | undefined>
  },
): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (!isRetryableIntakeSaveError(err)) throw err
    if (options?.recover) {
      const recovered = await options.recover()
      if (recovered !== undefined) return recovered
    }
    await new Promise((resolve) => setTimeout(resolve, options?.delayMs ?? 1500))
    return run()
  }
}
