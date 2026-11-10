"use client"

/** Compatibility boundary for existing workflows; premium routing is automatic. */
export function AiModelPicker(_props: {
  onChange?: (mode: "AUTO" | "PREMIUM", premiumModelId: string) => void
  className?: string
  compact?: boolean
  stageRouting?: boolean
}) { return null }
