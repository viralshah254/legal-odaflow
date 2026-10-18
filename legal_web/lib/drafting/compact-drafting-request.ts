export const DRAFT_INTENT_MAX_LENGTH = 12_000
export const DRAFT_INTENT_COMPACT_LENGTH = 11_000

/**
 * Produces a reviewable, bounded intake from a pasted long-form request.
 * It keeps the opening facts, likely document instructions, and the conclusion
 * rather than silently truncating the user's request.
 */
export function compactDraftingRequest(text: string): string {
  const normalized = text.trim()
  if (normalized.length <= DRAFT_INTENT_COMPACT_LENGTH) return normalized

  const lines = normalized.split(/\r?\n/).filter(Boolean)
  const requestLines = lines.filter((line) =>
    /(?:draft|prepare|document|form|relief|prayer|notice|petition|application)/i.test(line),
  )
  const preserved = [...new Set([
    ...lines.slice(0, 45),
    ...requestLines.slice(-25),
    ...lines.slice(-35),
  ])].join("\n")

  const available = DRAFT_INTENT_COMPACT_LENGTH - 240
  return [
    "The following is a condensed version of a longer drafting request. Preserve the requested documents, parties, dates, remedies, and forum where stated.",
    preserved.slice(0, available),
    "\n[Long source condensed for analysis. Upload the source document if a fact appears missing.]",
  ].join("\n")
}
