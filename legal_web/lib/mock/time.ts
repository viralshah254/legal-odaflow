import type { TimeEntry, TimeEntryStatus, TimerSession, RateTable, RateTableEntry } from "@/lib/types/time"
import { getMatterById, mockMatters } from "@/lib/mock/matters"
import { mockUsers } from "@/lib/mock/users"

const STORAGE_KEY_ENTRIES = "odaflow_time_entries"
const STORAGE_KEY_TIMER = "odaflow_active_timer"
const STORAGE_KEY_RATES = "odaflow_rate_table"

function loadEntries(): TimeEntry[] {
  if (typeof window === "undefined") return [...mockTimeEntries]
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTRIES)
    if (!raw) return [...mockTimeEntries]
    const parsed = JSON.parse(raw) as TimeEntry[]
    return parsed.map((e) => ({
      ...e,
      date: new Date(e.date),
      submittedAt: e.submittedAt ? new Date(e.submittedAt) : undefined,
      approvedAt: e.approvedAt ? new Date(e.approvedAt) : undefined,
      rejectedAt: e.rejectedAt ? new Date(e.rejectedAt) : undefined,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    }))
  } catch {
    return [...mockTimeEntries]
  }
}

function saveEntries(entries: TimeEntry[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries))
}

const mockTimeEntries: TimeEntry[] = [
  {
    id: "te1",
    userId: "1",
    userName: "Sarah Johnson",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    clientId: "c1",
    clientName: "Acme Corporation",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    durationMinutes: 90,
    narrative: "Due diligence review - financials",
    billable: true,
    status: "approved",
    rateCentsPerHour: 35000,
    amountCents: 52500,
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    approvedByUserId: "6",
    approvedByName: "James Thompson",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "te2",
    userId: "2",
    userName: "Michael Chen",
    matterId: "m3",
    matterTitle: "TechStart Inc - Series B Funding",
    clientId: "c3",
    clientName: "TechStart Inc",
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    durationMinutes: 120,
    narrative: "Term sheet negotiation call",
    billable: true,
    status: "submitted",
    rateCentsPerHour: 30000,
    amountCents: 60000,
    submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    id: "te3",
    userId: "3",
    userName: "Emily Rodriguez",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    clientId: "c1",
    clientName: "Acme Corporation",
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    durationMinutes: 45,
    narrative: "Internal team sync - non-billable",
    billable: false,
    status: "approved",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "te4",
    userId: "1",
    userName: "Sarah Johnson",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    clientId: "c1",
    clientName: "Acme Corporation",
    date: new Date(),
    durationMinutes: 0,
    narrative: "",
    billable: true,
    status: "draft",
    rateCentsPerHour: 35000,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000),
  },
]

function defaultRateTable(): RateTable {
  return {
    defaultCentsPerHour: 30000, // $300/hr
    currency: "USD",
    entries: [
      {
        id: "rate-default",
        matterId: null,
        centsPerHour: 30000,
        currency: "USD",
        effectiveFrom: new Date(0),
        createdAt: new Date(0),
      },
      {
        id: "rate-m1",
        matterId: "m1",
        matterTitle: "Acme Corp - M&A Transaction",
        centsPerHour: 35000,
        currency: "USD",
        effectiveFrom: new Date(0),
        createdAt: new Date(0),
      },
    ],
  }
}

function loadRateTable(): RateTable {
  if (typeof window === "undefined") return defaultRateTable()
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATES)
    if (!raw) return defaultRateTable()
    const parsed = JSON.parse(raw) as RateTable
    return {
      ...parsed,
      entries: (parsed.entries || []).map((e) => ({
        ...e,
        effectiveFrom: new Date(e.effectiveFrom),
        effectiveTo: e.effectiveTo ? new Date(e.effectiveTo) : undefined,
        createdAt: new Date(e.createdAt),
      })),
    }
  } catch {
    return defaultRateTable()
  }
}

function saveRateTable(table: RateTable) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(table))
}

export function getRateTable(): RateTable {
  return loadRateTable()
}

export function getRateForMatter(matterId: string | null): number {
  const table = loadRateTable()
  if (matterId) {
    const entry = table.entries.find((e) => e.matterId === matterId)
    if (entry) return entry.centsPerHour
  }
  return table.defaultCentsPerHour
}

export function getActiveTimer(userId: string): TimerSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMER)
    if (!raw) return null
    const t = JSON.parse(raw) as TimerSession & { pausedDurationMs?: number }
    if (t.userId !== userId) return null
    const accumulatedRunMs = "accumulatedRunMs" in t && typeof t.accumulatedRunMs === "number"
      ? t.accumulatedRunMs
      : (t as { pausedDurationMs?: number }).pausedDurationMs ?? 0
    return {
      ...t,
      startedAt: new Date(t.startedAt),
      pausedAt: t.pausedAt ? new Date(t.pausedAt) : null,
      accumulatedRunMs,
    }
  } catch {
    return null
  }
}

export function setActiveTimer(session: TimerSession | null): void {
  if (typeof window === "undefined") return
  if (session) localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(session))
  else localStorage.removeItem(STORAGE_KEY_TIMER)
}

export function getTimeEntries(filters: {
  userId?: string
  matterId?: string
  clientId?: string
  status?: TimeEntryStatus
  dateFrom?: Date
  dateTo?: Date
}): TimeEntry[] {
  let list = loadEntries()
  if (filters.userId) list = list.filter((e) => e.userId === filters.userId)
  if (filters.matterId) list = list.filter((e) => e.matterId === filters.matterId)
  if (filters.clientId) list = list.filter((e) => e.clientId === filters.clientId)
  if (filters.status) list = list.filter((e) => e.status === filters.status)
  if (filters.dateFrom) list = list.filter((e) => new Date(e.date) >= filters.dateFrom!)
  if (filters.dateTo) {
    const to = new Date(filters.dateTo)
    to.setHours(23, 59, 59, 999)
    list = list.filter((e) => new Date(e.date) <= to)
  }
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getTimeEntryById(id: string): TimeEntry | null {
  return loadEntries().find((e) => e.id === id) ?? null
}

function nextEntryId(): string {
  const entries = loadEntries()
  const max = entries.reduce((acc, e) => {
    const n = parseInt(e.id.replace(/\D/g, ""), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `te-${max + 1}`
}

export function createTimeEntry(input: {
  userId: string
  userName: string
  matterId: string
  matterTitle: string
  clientId: string
  clientName: string
  date: Date
  durationMinutes: number
  narrative: string
  billable: boolean
}): TimeEntry {
  const rate = getRateForMatter(input.matterId)
  const amountCents = input.billable ? Math.round((input.durationMinutes / 60) * rate) : undefined
  const entry: TimeEntry = {
    id: nextEntryId(),
    userId: input.userId,
    userName: input.userName,
    matterId: input.matterId,
    matterTitle: input.matterTitle,
    clientId: input.clientId,
    clientName: input.clientName,
    date: new Date(input.date),
    durationMinutes: input.durationMinutes,
    narrative: input.narrative,
    billable: input.billable,
    status: "draft",
    rateCentsPerHour: input.billable ? rate : undefined,
    amountCents,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const entries = loadEntries()
  entries.push(entry)
  saveEntries(entries)
  return entry
}

export function updateTimeEntry(
  id: string,
  updates: Partial<Pick<TimeEntry, "date" | "durationMinutes" | "narrative" | "billable">>
): TimeEntry | null {
  const entries = loadEntries()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const entry = entries[idx]
  if (entry.status !== "draft") return null
  const next = { ...entry, ...updates, updatedAt: new Date() }
  if (updates.durationMinutes != null || updates.billable != null) {
    next.rateCentsPerHour = next.billable ? getRateForMatter(entry.matterId) : undefined
    next.amountCents = next.billable && next.rateCentsPerHour
      ? Math.round((next.durationMinutes / 60) * next.rateCentsPerHour)
      : undefined
  }
  entries[idx] = next
  saveEntries(entries)
  return next
}

export function submitTimeEntry(id: string): TimeEntry | null {
  const entries = loadEntries()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const entry = entries[idx]
  if (entry.status !== "draft") return null
  const next: TimeEntry = {
    ...entry,
    status: "submitted",
    submittedAt: new Date(),
    updatedAt: new Date(),
  }
  entries[idx] = next
  saveEntries(entries)
  return next
}

export function approveTimeEntry(id: string, approvedByUserId: string, approvedByName: string): TimeEntry | null {
  const entries = loadEntries()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const entry = entries[idx]
  if (entry.status !== "submitted") return null
  const next: TimeEntry = {
    ...entry,
    status: "approved",
    approvedAt: new Date(),
    approvedByUserId,
    approvedByName,
    updatedAt: new Date(),
  }
  entries[idx] = next
  saveEntries(entries)
  return next
}

export function rejectTimeEntry(
  id: string,
  rejectedByUserId: string,
  rejectedReason?: string
): TimeEntry | null {
  const entries = loadEntries()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const entry = entries[idx]
  if (entry.status !== "submitted") return null
  const next: TimeEntry = {
    ...entry,
    status: "rejected",
    rejectedAt: new Date(),
    rejectedByUserId,
    rejectedReason: rejectedReason ?? undefined,
    updatedAt: new Date(),
  }
  entries[idx] = next
  saveEntries(entries)
  return next
}

export function deleteTimeEntry(id: string): boolean {
  const entries = loadEntries()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return false
  const entry = entries[idx]
  if (entry.status !== "draft") return false
  entries.splice(idx, 1)
  saveEntries(entries)
  return true
}

export function startTimer(userId: string, matterId: string, narrative: string, billable: boolean): TimerSession {
  const matter = getMatterById(matterId)
  const user = mockUsers.find((u) => u.id === userId)
  const session: TimerSession = {
    id: `timer-${Date.now()}`,
    userId,
    userName: user?.name ?? "Unknown",
    matterId,
    matterTitle: matter?.title ?? "Unknown",
    clientId: matter?.clientId ?? "",
    clientName: matter?.clientName ?? "",
    narrative,
    billable,
    startedAt: new Date(),
    accumulatedRunMs: 0,
    pausedAt: null,
  }
  setActiveTimer(session)
  return session
}

export function pauseTimer(userId: string): TimerSession | null {
  const current = getActiveTimer(userId)
  if (!current || current.pausedAt) return null
  const pausedAt = new Date()
  const updated: TimerSession = {
    ...current,
    pausedAt,
    accumulatedRunMs:
      current.accumulatedRunMs + (pausedAt.getTime() - new Date(current.startedAt).getTime()),
  }
  setActiveTimer(updated)
  return updated
}

export function resumeTimer(userId: string): TimerSession | null {
  const current = getActiveTimer(userId)
  if (!current || !current.pausedAt) return null
  const updated: TimerSession = {
    ...current,
    startedAt: new Date(),
    pausedAt: null,
  }
  setActiveTimer(updated)
  return updated
}

/** Stop timer and create a time entry (draft) from it. Returns the new TimeEntry. */
export function stopTimerAndCreateEntry(userId: string): TimeEntry | null {
  const current = getActiveTimer(userId)
  if (!current) return null
  const now = new Date()
  const elapsedMs =
    current.pausedAt != null
      ? current.accumulatedRunMs +
        (new Date(current.pausedAt).getTime() - new Date(current.startedAt).getTime())
      : current.accumulatedRunMs + (now.getTime() - new Date(current.startedAt).getTime())
  const durationMinutes = Math.round(elapsedMs / 60000)
  if (durationMinutes <= 0) {
    setActiveTimer(null)
    return null
  }
  const entry = createTimeEntry({
    userId: current.userId,
    userName: current.userName,
    matterId: current.matterId,
    matterTitle: current.matterTitle,
    clientId: current.clientId,
    clientName: current.clientName,
    date: new Date(current.startedAt),
    durationMinutes,
    narrative: current.narrative || "Timer entry",
    billable: current.billable,
  })
  setActiveTimer(null)
  return entry
}

/** Get current elapsed seconds for a running timer (for display). */
export function getTimerElapsedSeconds(session: TimerSession): number {
  const runMs =
    session.pausedAt != null
      ? session.accumulatedRunMs +
        (new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime())
      : session.accumulatedRunMs + (Date.now() - new Date(session.startedAt).getTime())
  return Math.max(0, Math.floor(runMs / 1000))
}

export { mockMatters }
