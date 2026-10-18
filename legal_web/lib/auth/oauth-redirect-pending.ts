import type { SocialAuthProvider } from "@/components/auth/social-auth-buttons"

const OAUTH_REDIRECT_PENDING_KEY = "umbrella_oauth_redirect_pending"

function isSocialAuthProvider(value: string): value is SocialAuthProvider {
  return value === "google" || value === "apple"
}

export function saveOAuthRedirectPending(provider: SocialAuthProvider): void {
  try {
    sessionStorage.setItem(OAUTH_REDIRECT_PENDING_KEY, provider)
  } catch {
    // ignore
  }
}

export function readOAuthRedirectPending(): SocialAuthProvider | null {
  try {
    const value = sessionStorage.getItem(OAUTH_REDIRECT_PENDING_KEY)
    if (!value || !isSocialAuthProvider(value)) return null
    return value
  } catch {
    return null
  }
}

export function clearOAuthRedirectPending(): void {
  try {
    sessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY)
  } catch {
    // ignore
  }
}
