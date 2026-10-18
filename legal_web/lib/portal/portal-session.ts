import { usesCookieSession } from "@/lib/auth/session-config"
import {
  clearMemoryPortalSession,
  getMemoryPortalClientId,
  getMemoryPortalToken,
  setMemoryPortalSession,
} from "@/lib/auth/token-store"
import {
  LEGACY_PORTAL_CLIENT_KEY,
  LEGACY_PORTAL_TOKEN_KEY,
} from "@/lib/auth/session-config"

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null
  if (usesCookieSession()) return null
  return getMemoryPortalToken()
}

export async function setPortalSession(
  portalToken: string,
  clientId: string,
): Promise<void> {
  if (typeof window === "undefined") return

  if (usesCookieSession()) {
    await fetch("/api/auth/portal/session/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ portalToken, clientId }),
    })
    return
  }

  setMemoryPortalSession(portalToken, clientId)
}

export function getPortalClientId(): string | null {
  if (typeof window === "undefined") return null
  if (usesCookieSession()) return null
  return getMemoryPortalClientId()
}

export async function getPortalSessionInfo(): Promise<{ clientId: string } | null> {
  if (typeof window === "undefined") return null

  if (usesCookieSession()) {
    const response = await fetch("/api/auth/portal/session/", {
      credentials: "include",
    }).catch(() => null)
    if (!response?.ok) return null
    return (await response.json()) as { clientId: string }
  }

  const clientId = getMemoryPortalClientId()
  const token = getMemoryPortalToken()
  if (!clientId || !token) return null
  return { clientId }
}

export async function clearPortalSession(): Promise<void> {
  if (typeof window === "undefined") return

  localStorage.removeItem(LEGACY_PORTAL_TOKEN_KEY)
  localStorage.removeItem(LEGACY_PORTAL_CLIENT_KEY)

  if (usesCookieSession()) {
    await fetch("/api/auth/portal/session/", {
      method: "DELETE",
      credentials: "include",
    }).catch(() => undefined)
    return
  }

  clearMemoryPortalSession()
}

/** Remove legacy portal tokens from localStorage on bootstrap. */
export function clearLegacyPortalStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(LEGACY_PORTAL_TOKEN_KEY)
  localStorage.removeItem(LEGACY_PORTAL_CLIENT_KEY)
}
