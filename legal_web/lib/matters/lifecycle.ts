export const MATTER_STATUSES = {
  OPEN: "OPEN",
  ON_HOLD: "ON_HOLD",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
} as const

export type MatterStatus = (typeof MATTER_STATUSES)[keyof typeof MATTER_STATUSES]

export const MATTER_STAGES = {
  INTAKE: "Intake",
  ACTIVE: "Active",
  DISCOVERY: "Discovery",
  NEGOTIATION: "Negotiation",
  CLOSING: "Closing",
  CLOSED: "Closed",
} as const

export type MatterStage = (typeof MATTER_STAGES)[keyof typeof MATTER_STAGES]

export const MATTER_STATUS_OPTIONS = Object.values(MATTER_STATUSES)
export const MATTER_STAGE_OPTIONS = Object.values(MATTER_STAGES)

export function normalizeMatterStatus(value: string): MatterStatus | string {
  const key = value.trim().replace(/[\s-]+/g, "_").toUpperCase()
  if (key === "ACTIVE" || key === "OPEN") return MATTER_STATUSES.OPEN
  if (key === "ON_HOLD" || key === "ONHOLD") return MATTER_STATUSES.ON_HOLD
  if (key === "CLOSED") return MATTER_STATUSES.CLOSED
  if (key === "ARCHIVED") return MATTER_STATUSES.ARCHIVED
  return value
}

export function normalizeMatterStage(value?: string | null): MatterStage | string | null {
  if (!value) return value ?? null
  const key = value.trim().replace(/[\s_-]+/g, "").toLowerCase()
  return MATTER_STAGE_OPTIONS.find(
    (stage) => stage.replace(/\s+/g, "").toLowerCase() === key,
  ) ?? value
}
