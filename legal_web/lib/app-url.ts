/** Canonical public web origin for Umbrella (marketing + app). */
export const DEFAULT_APP_URL = "https://umbrella.okaylegal.ai"

/** Resolve the public app origin for links, metadata, and referrals. */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    const allowLocalhost =
      process.env.ALLOW_LOCALHOST_APP_URL === "true" &&
      process.env.NODE_ENV !== "production"
    if (
      !allowLocalhost &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)
    ) {
      return DEFAULT_APP_URL
    }
    return configured.replace(/\/$/, "")
  }
  if (process.env.NODE_ENV === "production") {
    return DEFAULT_APP_URL
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "")
  }
  return "http://localhost:3000"
}

/** Public referral URL — lands on the marketing homepage so invitees see the product first. */
export function buildReferralShareUrl(code: string): string {
  const base = getAppUrl()
  const params = new URLSearchParams({ ref: code.toUpperCase() })
  return `${base}/?${params.toString()}`
}
