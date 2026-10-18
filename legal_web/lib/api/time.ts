import { apiFetch } from "./client"

export interface ApiTimeEntry {
  id: string
  tenantId: string
  userId: string
  matterId?: string | null
  date: string
  durationMinutes: number
  narrative: string
  billable: boolean
  status: string
  rateCentsPerHour?: number | null
  amountCents?: number | null
  createdAt: string
  updatedAt: string
}

export interface ApiTimerSession {
  id: string
  userId: string
  matterId: string
  startedAt: string
  pausedAt?: string | null
  accumulatedMinutes: number
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

/** Normalize API / storage payloads so the timer UI never receives partial sessions. */
export function normalizeTimerSession(raw: unknown): ApiTimerSession | null {
  if (raw == null || typeof raw !== "object") return null

  const obj = raw as Record<string, unknown>
  const matterId = asNonEmptyString(obj.matterId)
  const startedAt =
    asNonEmptyString(obj.startedAt) ?? asNonEmptyString(obj.started_at)
  const id = asNonEmptyString(obj.id) ?? (matterId ? `timer_${matterId}` : undefined)

  if (!id || !matterId || !startedAt) return null
  if (!Number.isFinite(Date.parse(startedAt))) return null

  const accumulatedRaw = obj.accumulatedMinutes ?? obj.accumulated_minutes ?? 0
  const accumulatedMinutes = Number(accumulatedRaw)

  return {
    id,
    userId: asNonEmptyString(obj.userId) ?? "",
    matterId,
    startedAt,
    pausedAt:
      asNonEmptyString(obj.pausedAt) ?? asNonEmptyString(obj.paused_at) ?? null,
    accumulatedMinutes: Number.isFinite(accumulatedMinutes) ? accumulatedMinutes : 0,
  }
}

const timerStorageKey = (tenantId: string) => `legal-active-timer-${tenantId}`

export function loadPersistedTimer(tenantId: string): ApiTimerSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(timerStorageKey(tenantId))
    return raw ? normalizeTimerSession(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function persistTimer(tenantId: string, session: ApiTimerSession): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(timerStorageKey(tenantId), JSON.stringify(session))
}

export function clearPersistedTimer(tenantId: string): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(timerStorageKey(tenantId))
}

export interface CreateTimeEntryRequest {
  matterId: string
  date: string
  durationMinutes: number
  narrative?: string
  billable?: boolean
}

export interface StartTimerRequest {
  matterId: string
}

export async function listTimeEntries(
  tenantId: string,
  matterId?: string,
): Promise<ApiTimeEntry[]> {
  const query = matterId ? `?matterId=${encodeURIComponent(matterId)}` : ""
  const entries = await apiFetch<
    Array<{
      id: string
      tenantId: string
      userId: string
      matterId?: string | null
      date: string
      minutes: number
      narrative?: string | null
      billable: boolean
      status: string
      rate?: string | number | null
      createdAt: string
      updatedAt?: string
    }>
  >(`/time${query}`, { tenantId })
  return entries.map((entry) => {
    const rate = entry.rate == null ? null : Number(entry.rate)
    const amountCents =
      rate != null ? Math.round((rate * entry.minutes) / 60 * 100) : null
    return {
      id: entry.id,
      tenantId: entry.tenantId,
      userId: entry.userId,
      matterId: entry.matterId,
      date: entry.date,
      durationMinutes: entry.minutes,
      narrative: entry.narrative ?? "",
      billable: entry.billable,
      status: entry.status,
      rateCentsPerHour: rate != null ? Math.round(rate * 100) : null,
      amountCents,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt ?? entry.createdAt,
    }
  })
}

export async function createTimeEntry(
  tenantId: string,
  data: CreateTimeEntryRequest,
): Promise<ApiTimeEntry> {
  const created = await apiFetch<{
    id: string
    tenantId: string
    userId: string
    matterId?: string | null
    date: string
    minutes: number
    narrative?: string | null
    billable: boolean
    status: string
    rate?: string | number | null
    createdAt: string
    updatedAt?: string
  }>("/time", {
    method: "POST",
    tenantId,
    body: {
      matterId: data.matterId,
      date: data.date,
      minutes: data.durationMinutes,
      narrative: data.narrative,
      billable: data.billable ?? true,
    },
  })
  const rate = created.rate == null ? null : Number(created.rate)
  const amountCents =
    rate != null ? Math.round((rate * created.minutes) / 60 * 100) : null
  return {
    id: created.id,
    tenantId: created.tenantId,
    userId: created.userId,
    matterId: created.matterId,
    date: created.date,
    durationMinutes: created.minutes,
    narrative: created.narrative ?? "",
    billable: created.billable,
    status: created.status,
    rateCentsPerHour: rate != null ? Math.round(rate * 100) : null,
    amountCents,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt ?? created.createdAt,
  }
}

export async function getActiveTimer(
  tenantId: string,
): Promise<ApiTimerSession | null> {
  const raw = await apiFetch<unknown>("/time/timer", { tenantId })
  return normalizeTimerSession(raw)
}

export async function startTimer(
  tenantId: string,
  data: StartTimerRequest,
): Promise<ApiTimerSession> {
  const raw = await apiFetch<unknown>("/time/timer/start", {
    method: "POST",
    tenantId,
    body: data,
  })
  const session = normalizeTimerSession(raw)
  if (!session) {
    throw new Error("Timer started but the server returned an invalid session")
  }
  return session
}

export async function stopTimer(
  tenantId: string,
): Promise<{ entry: ApiTimeEntry; timer: null }> {
  const result = await apiFetch<{ entry: RawTimeEntry; timer: null }>(
    "/time/timer/stop",
    {
      method: "POST",
      tenantId,
    },
  )
  clearPersistedTimer(tenantId)
  return {
    entry: mapTimeEntry(result.entry),
    timer: null,
  }
}

type RawTimeEntry = {
  id: string
  tenantId: string
  userId: string
  matterId?: string | null
  date: string
  minutes: number
  narrative?: string | null
  billable: boolean
  status: string
  rate?: string | number | null
  createdAt: string
  updatedAt?: string
}

function mapTimeEntry(entry: RawTimeEntry): ApiTimeEntry {
  const rate = entry.rate == null ? null : Number(entry.rate)
  const amountCents =
    rate != null ? Math.round((rate * entry.minutes) / 60 * 100) : null
  return {
    id: entry.id,
    tenantId: entry.tenantId,
    userId: entry.userId,
    matterId: entry.matterId,
    date: entry.date,
    durationMinutes: entry.minutes,
    narrative: entry.narrative ?? "",
    billable: entry.billable,
    status: entry.status,
    rateCentsPerHour: rate != null ? Math.round(rate * 100) : null,
    amountCents,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt ?? entry.createdAt,
  }
}

export async function submitTimeEntry(
  tenantId: string,
  entryId: string,
): Promise<ApiTimeEntry> {
  const submitted = await apiFetch<RawTimeEntry>(`/time/${entryId}/submit`, {
    method: "POST",
    tenantId,
  })
  return mapTimeEntry(submitted)
}

export async function rejectTimeEntry(
  tenantId: string,
  entryId: string,
  note?: string,
): Promise<ApiTimeEntry> {
  const rejected = await apiFetch<RawTimeEntry>(`/time/${entryId}/reject`, {
    method: "POST",
    tenantId,
    body: { note },
  })
  return mapTimeEntry(rejected)
}

export async function approveTimeEntry(
  tenantId: string,
  entryId: string,
): Promise<ApiTimeEntry> {
  const approved = await apiFetch<RawTimeEntry>(`/time/${entryId}/approve`, {
    method: "POST",
    tenantId,
  })
  return mapTimeEntry(approved)
}

export interface SuggestedTimeEntry {
  id: string
  matterId?: string | null
  source: string
  minutes: number
  narrative?: string | null
  status: string
  createdAt: string
}

export async function listSuggestedTime(
  tenantId: string,
): Promise<SuggestedTimeEntry[]> {
  return apiFetch<SuggestedTimeEntry[]>("/time/suggestions", { tenantId })
}

export async function approveSuggestedTime(
  tenantId: string,
  suggestionId: string,
): Promise<ApiTimeEntry> {
  const result = await apiFetch<{ entry: RawTimeEntry }>(
    `/time/suggestions/${suggestionId}/approve`,
    { method: "POST", tenantId },
  )
  return mapTimeEntry(result.entry)
}

export async function dismissSuggestedTime(
  tenantId: string,
  suggestionId: string,
): Promise<void> {
  await apiFetch(`/time/suggestions/${suggestionId}/dismiss`, {
    method: "PATCH",
    tenantId,
  })
}

export interface UpdateTimeEntryRequest {
  matterId?: string
  date?: string
  durationMinutes?: number
  narrative?: string
  billable?: boolean
  rateCentsPerHour?: number | null
}

export async function updateTimeEntry(
  tenantId: string,
  entryId: string,
  data: UpdateTimeEntryRequest,
): Promise<ApiTimeEntry> {
  const body: Record<string, unknown> = {}
  if (data.matterId !== undefined) body.matterId = data.matterId
  if (data.date !== undefined) body.date = data.date
  if (data.durationMinutes !== undefined) body.minutes = data.durationMinutes
  if (data.narrative !== undefined) body.narrative = data.narrative
  if (data.billable !== undefined) body.billable = data.billable
  if (data.rateCentsPerHour !== undefined)
    body.rate = data.rateCentsPerHour != null ? data.rateCentsPerHour / 100 : null

  const updated = await apiFetch<RawTimeEntry>(`/time/${entryId}`, {
    method: "PATCH",
    tenantId,
    body,
  })
  return mapTimeEntry(updated)
}

export async function deleteTimeEntry(
  tenantId: string,
  entryId: string,
): Promise<void> {
  await apiFetch(`/time/${entryId}`, {
    method: "DELETE",
    tenantId,
  })
}
