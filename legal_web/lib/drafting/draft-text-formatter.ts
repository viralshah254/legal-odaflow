/**
 * Shared utilities for rendering court-document draft text.
 * Used by SmartDraftRenderer (React preview) and document-export-template (PDF/Word).
 */

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "blank"; label: string }

/** Any bracketed span — candidate blank or citation ID. */
const BRACKET_PATTERN = /\[[^\]]+\]/g

/**
 * Internal verified-source / registry IDs must never become fill inputs.
 * Matches curated__, SOURCE_1, STATUTE_…, CASE_…, RULE_…, AUTHORITY TO BE ADDED.
 */
const NON_BLANK_INNER =
  /^(?:curated__[\w]+|SOURCE_\w+|STATUTE_\w+|CASE_\w+|RULE_\w+|AUTHORITY TO BE ADDED(?:\s*[—–-].*)?)$/i

/** True when bracket inner text is an intentional fillable placeholder. */
export function isFillableBlankLabel(inner: string): boolean {
  const label = inner.trim()
  if (!label) return true
  if (NON_BLANK_INNER.test(label)) return false
  return true
}

/**
 * AI drafts often wrap cause-title lines in markdown bold, e.g.
 * `**IN THE COURT OF [BLANK: designation of Court]**`. Bold is matched before
 * brackets in the inline parser, so those fields never become fill inputs.
 */
export function normalizeBlankMarkers(line: string): string {
  let out = line
  for (let i = 0; i < 4; i++) {
    const next = out
      // Entire bold span contains a blank — drop emphasis, keep blanks.
      .replace(/\*\*([^*]*\[[^\]]+\][^*]*)\*\*/g, "$1")
      .replace(/\*([^*]*\[[^\]]+\][^*]*)\*/g, "$1")
      // Bold wraps only the bracket token.
      .replace(/\*\*(\[[^\]]+\])\*\*/g, "$1")
      .replace(/(?<!\*)\*(\[[^\]]+\])\*(?!\*)/g, "$1")
    if (next === out) break
    out = next
  }
  return out
}

/** Normalize an entire draft so blank placeholders are detectable in fill mode. */
export function normalizeDraftForBlanks(draft: string): string {
  return draft
    .split("\n")
    .map((line) => normalizeBlankMarkers(line))
    .join("\n")
}

/** Extract blank labels in document order (shared by renderer + auto-fill). */
export function extractBlankLabelsFromDraft(draft: string): string[] {
  const normalized = normalizeDraftForBlanks(draft)
  const labels: string[] = []
  let match: RegExpExecArray | null
  const pattern = new RegExp(BRACKET_PATTERN.source, "g")
  while ((match = pattern.exec(normalized)) !== null) {
    const inner = match[0].slice(1, -1).trim()
    if (!isFillableBlankLabel(inner)) continue
    labels.push(inner || "BLANK")
  }
  return labels
}

export function countBlanksInDraft(draft: string): number {
  return extractBlankLabelsFromDraft(draft).length
}

/** Normalize draft text and allocate blank value slots for fill mode. */
export function initDraftFillState(rawDraft: string): { draft: string; blanks: string[] } {
  const draft = normalizeDraftForBlanks(rawDraft)
  return { draft, blanks: new Array(countBlanksInDraft(draft)).fill("") }
}

/** Parse a line of draft text into inline tokens (blanks, bold, italic, plain text). */
export function parseInlineTokens(line: string): InlineToken[] {
  const normalized = normalizeBlankMarkers(line)
  const tokens: InlineToken[] = []
  // Brackets first — must win over **bold** that wraps cause-title placeholders.
  const pattern = /(\[[^\]]+\])|\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: normalized.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      const label = match[1].slice(1, -1).trim() || "BLANK"
      if (isFillableBlankLabel(label)) {
        tokens.push({ type: "blank", label })
      } else {
        // Citation / registry IDs render as plain text (assembly should already resolve them).
        tokens.push({ type: "text", value: match[1] })
      }
    } else if (match[2] !== undefined) {
      tokens.push({ type: "bold", value: match[2] })
    } else if (match[3] !== undefined) {
      tokens.push({ type: "italic", value: match[3] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < normalized.length) {
    tokens.push({ type: "text", value: normalized.slice(lastIndex) })
  }
  return tokens
}

/** Parse a line's heading level from leading `#` markers. Returns null if not a heading. */
export function parseHeading(line: string): { level: 1 | 2 | 3 | 4; text: string } | null {
  const m = /^(#{1,4})\s+(.+)$/.exec(line)
  if (!m) return null
  return { level: m[1].length as 1 | 2 | 3 | 4, text: m[2] }
}

/**
 * Convert markdown draft text to HTML for PDF/Word export.
 * Shared between document-export-template and any server-side renderer.
 */
export function markdownToHtml(content: string): string {
  return content
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[-*•] (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
}
