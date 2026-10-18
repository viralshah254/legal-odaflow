/** Normalize a pathname for canonical URLs (matches `trailingSlash: true` in next.config). */
export function toCanonicalPath(path: string): string {
  if (!path || path === "/") return "/"
  const withLeading = path.startsWith("/") ? path : `/${path}`
  if (/\.[a-z0-9]+$/i.test(withLeading)) return withLeading
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
}

/** Build an absolute canonical URL from a site origin and path. */
export function toCanonicalUrl(siteUrl: string, path: string): string {
  const normalizedPath = toCanonicalPath(path)
  return new URL(normalizedPath, siteUrl.replace(/\/$/, "")).toString()
}
