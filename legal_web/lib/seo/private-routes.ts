const NOINDEX_PREFIXES = [
  "/app/",
  "/consumer/",
  "/admin/",
  "/auth/",
  "/portal/",
  "/api/",
  "/pay/",
  "/subscription/",
  "/onboarding/",
  "/superadmin/",
  "/book/",
] as const

const NOINDEX_EXACT = new Set([
  "/app",
  "/consumer",
  "/admin",
  "/auth",
  "/portal",
  "/onboarding",
  "/superadmin",
])

/** Paths that must not appear in search results (authenticated, transactional, or redirect-only). */
export function isNoIndexPath(pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname

  if (NOINDEX_EXACT.has(normalized)) return true

  return NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
