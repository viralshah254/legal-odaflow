"use client"
import { useEffect, useRef } from "react"
import { initWebPush, isWebPushSupported, clearWebPushToken } from "@/lib/firebase-messaging"
import { registerDeviceToken } from "@/lib/api/notifications"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"

/**
 * Requests FCM web-push permission and registers the token with the backend
 * once the user is authenticated.  Call this hook inside any layout that
 * renders after login (e.g. the lawyer-OS app shell).
 *
 * Safe to render in SSR — all browser APIs are guarded behind `useEffect`.
 */
export function usePushNotifications() {
  const { user } = useAuth()
  const { activeTenantId } = useTenant()
  const registered = useRef(false)

  useEffect(() => {
    if (!user || registered.current) return
    if (!isWebPushSupported()) return

    let cancelled = false

    void (async () => {
      const token = await initWebPush()
      if (!token || cancelled) return

      try {
        await registerDeviceToken(token, activeTenantId ?? undefined)
        registered.current = true
      } catch {
        // Best-effort — will retry on next mount.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, activeTenantId])

  // Clear the cached token on logout so next sign-in fetches a fresh one.
  useEffect(() => {
    if (!user) {
      clearWebPushToken()
      registered.current = false
    }
  }, [user])
}
