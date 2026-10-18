const JUNK_TITLES = new Set(["na", "n/a", "n.a.", "tbd", "none", "untitled", "-", "—"])

const INTERNAL_LINE_PREFIXES = [
  "slaEscalated:",
  "leadScore:",
  "reviewRequestId:",
  "Rejected:",
]

function isJunkTitle(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  const normalized = value.trim().toLowerCase()
  return JUNK_TITLES.has(normalized)
}

function stripInlineInternalTokens(text: string): string {
  return text
    .replace(/\bslaEscalated:(true|false)\b/gi, "")
    .replace(/\bleadScore:\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function stripInternalLines(text: string): string {
  return stripInlineInternalTokens(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !INTERNAL_LINE_PREFIXES.some((prefix) => line.startsWith(prefix)))
      .filter((line) => line !== "slaEscalated:true")
      .join("\n")
      .trim(),
  )
}

/** Sanitize stored matter titles for display (strips intake metadata pollution). */
export function getMatterDisplayTitle(
  title: string | null | undefined,
  fallback = "Untitled matter",
): string {
  if (!title?.trim()) return fallback
  const cleaned = stripInlineInternalTokens(stripInternalLines(title.trim()))
  if (!cleaned || isJunkTitle(cleaned)) return fallback
  return cleaned
}

/** Parse firm-intake summary: Client: … — Ref: … — {title} — notes */
function parseFirmIntakeTitle(summary: string): string | null {
  const cleaned = stripInternalLines(summary)
  if (!cleaned) return null

  const parts = cleaned.split(" — ").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  if (parts[0]?.startsWith("Client:")) {
    if (parts.length >= 3 && !parts[2].startsWith("Ref:")) {
      const candidate = parts[2]
      return isJunkTitle(candidate) ? null : candidate
    }
    if (parts.length === 2 && !parts[1].startsWith("Ref:")) {
      const candidate = parts[1]
      return isJunkTitle(candidate) ? null : candidate
    }
    return null
  }

  const last = parts[parts.length - 1]
  if (last.includes(" — Completed consumer case")) {
    return null
  }
  return isJunkTitle(last) ? null : last
}

export function getLeadDisplayTitle(
  lead: { summary?: string | null; issueType: string },
  consumerCase?: { title?: string | null } | null,
): string {
  const fromCase = consumerCase?.title?.trim()
  if (fromCase && !isJunkTitle(fromCase)) {
    return stripInternalLines(fromCase)
  }

  if (lead.summary) {
    const fromSummary = parseFirmIntakeTitle(lead.summary)
    if (fromSummary) return fromSummary

    const stripped = stripInternalLines(lead.summary)
    if (stripped && !isJunkTitle(stripped)) return stripped
  }

  return `${lead.issueType} intake`
}

export function isLeadSlaBreached(lead: { slaEscalatedAt?: string | null }): boolean {
  return Boolean(lead.slaEscalatedAt)
}
