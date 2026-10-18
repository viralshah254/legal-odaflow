"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useIsTablet } from "@/hooks/use-media-query"

/**
 * Shows the mobile guest signup sheet on `/` for logged-out users on
 * viewports below `md` (768px), after a short delay.
 * Dismiss is session-only — reappears on the next visit until signed up.
 */
export function useMobileGuestSignupPopup() {
  const pathname = usePathname()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const isMobile = useIsTablet()
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  const shouldConsiderShowing = useMemo(() => {
    if (authLoading) return false
    if (isAuthenticated) return false
    if (!isMobile) return false
    if (pathname !== "/") return false
    return true
  }, [authLoading, isAuthenticated, isMobile, pathname])

  useEffect(() => {
    if (!shouldConsiderShowing) {
      setReady(false)
      setOpen(false)
      return
    }

    const timer = window.setTimeout(() => setReady(true), 2000)
    return () => window.clearTimeout(timer)
  }, [shouldConsiderShowing])

  useEffect(() => {
    if (ready && shouldConsiderShowing) {
      setOpen(true)
    }
  }, [ready, shouldConsiderShowing])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
  }

  return {
    open,
    onOpenChange,
  }
}
