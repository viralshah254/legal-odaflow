const OAUTH_SIGNUP_PENDING_KEY = "umbrella_oauth_signup_pending"

export interface OAuthSignUpPending {
  accountType: "CONSUMER" | "LAWYER"
  countryCode: string
  jurisdiction?: string
  firmName?: string
  name?: string
  referralCode?: string
  deviceFingerprint?: string
  practiceType?: "SOLO" | "FIRM"
}

export function saveOAuthSignUpPending(data: OAuthSignUpPending): void {
  try {
    sessionStorage.setItem(OAUTH_SIGNUP_PENDING_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function readOAuthSignUpPending(): OAuthSignUpPending | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_SIGNUP_PENDING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as OAuthSignUpPending
  } catch {
    return null
  }
}

export function clearOAuthSignUpPending(): void {
  try {
    sessionStorage.removeItem(OAUTH_SIGNUP_PENDING_KEY)
  } catch {
    // ignore
  }
}
