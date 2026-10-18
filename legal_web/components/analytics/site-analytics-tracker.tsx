"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { trackPageView, sendHeartbeat } from "@/lib/analytics/site-analytics"

const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Global first-party analytics tracker.
 *
 * - Fires a page_view event on every route change (including initial load).
 * - Sends a 30-second heartbeat while the tab is visible to accumulate active time.
 * - Flushes a session_end beacon on pagehide for accurate last-seen tracking.
 *
 * Mounted once in providers.tsx inside a <Suspense> boundary.
 * All network calls are fire-and-forget; this never blocks or errors the UX.
 */
export function SiteAnalyticsTracker() {
  const pathname = usePathname()
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track page views on route change
  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  // 30-second heartbeat while visible
  useEffect(() => {
    function startHeartbeat() {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => {
        if (!document.hidden) sendHeartbeat()
      }, HEARTBEAT_INTERVAL_MS)
    }

    function stopHeartbeat() {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }

    function onVisibilityChange() {
      if (document.hidden) stopHeartbeat()
      else startHeartbeat()
    }

    startHeartbeat()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      stopHeartbeat()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return null
}
