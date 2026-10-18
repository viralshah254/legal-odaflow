const OAUTH_DISPLAY_NAME_KEY = "umbrella_oauth_display_name"

export function persistOAuthDisplayName(name: string | null | undefined): void {
  if (!name?.trim()) return
  try {
    sessionStorage.setItem(OAUTH_DISPLAY_NAME_KEY, name.trim())
  } catch {
    // ignore
  }
}

export function readOAuthDisplayName(): string | null {
  try {
    return sessionStorage.getItem(OAUTH_DISPLAY_NAME_KEY)
  } catch {
    return null
  }
}

export function clearOAuthDisplayName(): void {
  try {
    sessionStorage.removeItem(OAUTH_DISPLAY_NAME_KEY)
  } catch {
    // ignore
  }
}
