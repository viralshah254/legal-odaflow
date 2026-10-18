/**
 * Truncate text for summary previews without cutting mid-word.
 * Prefers sentence boundaries, then word boundaries.
 */
export function truncateAtSentence(text: string, maxLen: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed

  const slice = trimmed.slice(0, maxLen)
  const lastSentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! '),
  )
  if (lastSentence > maxLen * 0.5) {
    return slice.slice(0, lastSentence + 1).trim()
  }

  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > maxLen * 0.5) {
    return slice.slice(0, lastSpace).trim() + '…'
  }

  return slice.trim() + '…'
}
