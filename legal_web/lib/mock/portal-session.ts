const PORTAL_CLIENT_KEY = "odaflow_portal_client_id"

export function getPortalClientId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PORTAL_CLIENT_KEY)
}

export function setPortalClientId(clientId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PORTAL_CLIENT_KEY, clientId)
}

export function clearPortalSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(PORTAL_CLIENT_KEY)
}
