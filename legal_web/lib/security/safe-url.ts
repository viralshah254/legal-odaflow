const UNSAFE_SCHEME = /^(javascript|data|vbscript|file):/i

/** Allow http(s), same-origin relative paths, and in-page anchors. */
export function isSafeNavigableUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (UNSAFE_SCHEME.test(trimmed)) return false
  if (trimmed.startsWith("//")) return false
  if (trimmed.startsWith("/")) return true
  if (trimmed.startsWith("#")) return true

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

/** Image sources must be http(s) only — no data: URIs. */
export function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed || UNSAFE_SCHEME.test(trimmed)) return false
  if (trimmed.startsWith("//") || trimmed.startsWith("/")) return true

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}
