/** In-memory token store for direct-API / Electron mode. Uses localStorage so sessions survive refresh. */

const STORAGE_ACCESS_KEY = "legal_session_access"
const STORAGE_REFRESH_KEY = "legal_session_refresh"

let accessToken: string | null = null
let refreshToken: string | null = null
let portalToken: string | null = null
let portalClientId: string | null = null

function readPersistentStorage(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writePersistentStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // ignore — private mode / storage blocked
  }
}

export function getMemoryAccessToken(): string | null {
  if (accessToken) return accessToken
  accessToken = readPersistentStorage(STORAGE_ACCESS_KEY)
  return accessToken
}

export function getMemoryRefreshToken(): string | null {
  if (refreshToken) return refreshToken
  refreshToken = readPersistentStorage(STORAGE_REFRESH_KEY)
  return refreshToken
}

export function setMemoryTokens(nextAccess: string, nextRefresh: string): void {
  accessToken = nextAccess
  refreshToken = nextRefresh
  writePersistentStorage(STORAGE_ACCESS_KEY, nextAccess)
  writePersistentStorage(STORAGE_REFRESH_KEY, nextRefresh)
}

export function clearMemoryTokens(): void {
  accessToken = null
  refreshToken = null
  writePersistentStorage(STORAGE_ACCESS_KEY, null)
  writePersistentStorage(STORAGE_REFRESH_KEY, null)
}

export function getMemoryPortalToken(): string | null {
  return portalToken
}

export function getMemoryPortalClientId(): string | null {
  return portalClientId
}

export function setMemoryPortalSession(token: string, clientId: string): void {
  portalToken = token
  portalClientId = clientId
}

export function clearMemoryPortalSession(): void {
  portalToken = null
  portalClientId = null
}
