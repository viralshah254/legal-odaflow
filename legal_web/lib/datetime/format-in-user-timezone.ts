/**
 * Format API timestamps in the signed-in user's browser timezone (IANA).
 * Do not use firm country timezone for UI clocks.
 */

/** IANA timezone from the browser, e.g. Asia/Kolkata */
export function getUserTimeZone(): string {
  if (typeof Intl === "undefined") return "UTC"
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function getUserLocale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language
  }
  return "en-US"
}

/**
 * Normalize API ISO strings. Naive timestamps (no offset) are treated as UTC.
 */
export function parseApiDate(iso: string): Date {
  const trimmed = iso.trim()
  if (!trimmed) return new Date(NaN)
  const hasOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)
  const normalized = hasOffset ? trimmed : `${trimmed}Z`
  return new Date(normalized)
}

export function formatInUserTimeZone(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = iso instanceof Date ? iso : parseApiDate(iso)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat(getUserLocale(), {
    timeZone: getUserTimeZone(),
    ...options,
  }).format(date)
}

/** Notification row: "Jun 1, 9:03 AM" */
export function formatUserDateTimeShort(iso: string | Date): string {
  return formatInUserTimeZone(iso, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Analysis run footer: "Jun 1, 2026, 9:03 AM" */
export function formatUserDateTimeLong(iso: string | Date): string {
  return formatInUserTimeZone(iso, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Date only */
export function formatUserDate(iso: string | Date): string {
  return formatInUserTimeZone(iso, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
