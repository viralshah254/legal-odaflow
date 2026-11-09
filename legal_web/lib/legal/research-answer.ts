const FOLLOW_UP_SENTINEL = "FOLLOW_UP_QUESTIONS_JSON:"

/**
 * Strip machine-readable artifacts from legal research markdown before display.
 * Defense-in-depth when backend sentinel/JSON parsing fails.
 */
export function sanitizeResearchAnswer(markdown: string): string {
  if (!markdown?.trim()) return markdown ?? ""

  let text = markdown

  // Remove FOLLOW_UP_QUESTIONS_JSON sentinel (single- or multi-line array)
  const sentinelIdx = text.lastIndexOf(FOLLOW_UP_SENTINEL)
  if (sentinelIdx !== -1) {
    text = text.slice(0, sentinelIdx).trimEnd()
  }

  // Remove fenced JSON blocks
  text = text.replace(/```json\s*[\s\S]*?```/gi, "").trim()

  // Remove bare JSON blobs that look like structured research drafts
  const directAnswerMatch = text.match(/\{[\s\S]*"directAnswer"\s*:\s*\{[\s\S]*?\}[\s\S]*?\}/)
  if (directAnswerMatch) {
    try {
      const parsed = JSON.parse(directAnswerMatch[0]) as {
        directAnswer?: { text?: string }
      }
      if (parsed?.directAnswer?.text && typeof parsed.directAnswer.text === "string") {
        text = text.replace(directAnswerMatch[0], parsed.directAnswer.text).trim()
      } else {
        text = text.replace(directAnswerMatch[0], "").trim()
      }
    } catch {
      text = text.replace(directAnswerMatch[0], "").trim()
    }
  }

  // Preserve verification findings and inline caveats in every answer surface.

  return text.replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * Extract follow-up questions from raw markdown when backend did not parse them.
 */
export function extractFollowUpQuestionsFromMarkdown(markdown: string): string[] {
  const sentinelIdx = markdown.lastIndexOf(FOLLOW_UP_SENTINEL)
  if (sentinelIdx === -1) return []

  const jsonPart = markdown.slice(sentinelIdx + FOLLOW_UP_SENTINEL.length).trim()
  const arrayMatch = jsonPart.match(/\[[\s\S]*?\]/)
  if (!arrayMatch) return []

  try {
    const parsed = JSON.parse(arrayMatch[0]) as unknown
    if (Array.isArray(parsed) && parsed.every((q) => typeof q === "string")) {
      return parsed.filter((q) => q.length > 0).slice(0, 4)
    }
  } catch {
    // ignore
  }
  return []
}

/** Link numeric inline citations to the matching source row without touching existing links. */
export function linkResearchCitations(markdown: string, citationCount: number): string {
  return markdown.replace(/\[(\d+)\](?!\()/g, (token, rawIndex: string) => {
    const index = Number(rawIndex)
    return index > 0 && index <= citationCount ? `[${index}](#source-${index})` : token
  })
}
