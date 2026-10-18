/** Time entry approval workflow */
export type TimeEntryStatus = "draft" | "submitted" | "approved" | "rejected"

export interface TimeEntry {
  id: string
  userId: string
  userName: string
  matterId: string
  matterTitle: string
  clientId: string
  clientName: string
  /** Date of work (YYYY-MM-DD or Date) */
  date: Date
  /** Duration in minutes */
  durationMinutes: number
  narrative: string
  billable: boolean
  status: TimeEntryStatus
  /** Hourly rate applied (from rate table or matter default) */
  rateCentsPerHour?: number
  /** Calculated amount in cents (duration * rate) when billable */
  amountCents?: number
  submittedAt?: Date
  approvedAt?: Date
  approvedByUserId?: string
  approvedByName?: string
  rejectedAt?: Date
  rejectedByUserId?: string
  rejectedReason?: string
  createdAt: Date
  updatedAt: Date
}

/** Active timer session (one per user in UI; can be persisted for refresh) */
export interface TimerSession {
  id: string
  userId: string
  userName: string
  matterId: string
  matterTitle: string
  clientId: string
  clientName: string
  narrative: string
  billable: boolean
  startedAt: Date
  /** Accumulated running time (ms) from completed segments before current run */
  accumulatedRunMs: number
  /** When pause started, if currently paused */
  pausedAt: Date | null
}

/** Rate table stub: default and optional per-matter rates */
export interface RateTableEntry {
  id: string
  /** If set, rate applies to this matter; otherwise default firm rate */
  matterId: string | null
  matterTitle?: string
  centsPerHour: number
  currency: string
  effectiveFrom: Date
  effectiveTo?: Date
  createdAt: Date
}

export interface RateTable {
  defaultCentsPerHour: number
  currency: string
  entries: RateTableEntry[]
}
