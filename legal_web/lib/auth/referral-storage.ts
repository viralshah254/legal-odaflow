"use client"

const REF_STORAGE_KEY = "umbrella_ref_code"
const REF_STORAGE_EXPIRY_KEY = "umbrella_ref_code_expiry"
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Read referral code from URL or localStorage (survives OAuth redirects). */
export function resolveReferralCode(urlRef: string | null): string | null {
  if (urlRef) return urlRef.toUpperCase()
  try {
    const stored = localStorage.getItem(REF_STORAGE_KEY)
    const expiry = localStorage.getItem(REF_STORAGE_EXPIRY_KEY)
    if (stored && expiry && Date.now() < Number(expiry)) return stored
  } catch {
    // localStorage unavailable
  }
  return null
}

/** Persist ?ref= from URL so OAuth redirects keep attribution. */
export function persistReferralCode(refCode: string | null): void {
  if (!refCode) return
  try {
    localStorage.setItem(REF_STORAGE_KEY, refCode.toUpperCase())
    localStorage.setItem(REF_STORAGE_EXPIRY_KEY, String(Date.now() + REF_TTL_MS))
  } catch {
    // ignore
  }
}

export function clearPersistedReferralCode(): void {
  try {
    localStorage.removeItem(REF_STORAGE_KEY)
    localStorage.removeItem(REF_STORAGE_EXPIRY_KEY)
  } catch {
    // ignore
  }
}

/**
 * Append the stored referral code as ?ref= to any href.
 * Belt-and-suspenders for sign-in links built at render time (e.g. on the
 * landing page) so the code is visible in the URL even if localStorage is
 * unavailable in the target context.
 */
export function appendReferralToHref(href: string): string {
  const ref = resolveReferralCode(null)
  if (!ref) return href
  try {
    const url = new URL(href, "https://placeholder.invalid")
    url.searchParams.set("ref", ref)
    return url.pathname + (url.search || "")
  } catch {
    return href
  }
}
