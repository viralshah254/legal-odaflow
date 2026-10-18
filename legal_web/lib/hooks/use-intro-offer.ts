"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useTourOptional } from "@/lib/contexts/tour-context"
import { getIntroOfferStatus } from "@/lib/api/intro-offer"
import {
  markIntroOfferShownToday,
  wasIntroOfferShownToday,
} from "@/lib/marketing/intro-offer-storage"

const SUPPRESSED_PATH_PREFIXES = ["/auth", "/onboarding"]

function isSuppressedPath(pathname: string | null): boolean {
  if (!pathname) return true
  return SUPPRESSED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function useIntroOfferPopup() {
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { activeTenantId } = useTenant()
  const tour = useTourOptional()
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  const { data: introOffer, isLoading: offerLoading } = useQuery({
    queryKey: ["intro-offer", user?.id, activeTenantId],
    queryFn: () => getIntroOfferStatus(activeTenantId ?? undefined),
    enabled: isAuthenticated && Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const isTutorialBlocking = useMemo(
    () =>
      tour != null &&
      (tour.isLoading || tour.showWelcomeDialog || tour.activeTourId != null),
    [tour],
  )

  const shouldConsiderShowing = useMemo(() => {
    if (authLoading || offerLoading) return false
    if (!isAuthenticated || !user?.id) return false
    if (isSuppressedPath(pathname)) return false
    if (!introOffer?.eligible) return false
    if (wasIntroOfferShownToday(user.id)) return false
    if (isTutorialBlocking) return false
    return true
  }, [
    authLoading,
    offerLoading,
    isAuthenticated,
    user?.id,
    pathname,
    introOffer?.eligible,
    isTutorialBlocking,
  ])

  useEffect(() => {
    if (!shouldConsiderShowing) {
      setReady(false)
      return
    }

    const timer = window.setTimeout(() => setReady(true), 2000)
    return () => window.clearTimeout(timer)
  }, [shouldConsiderShowing])

  useEffect(() => {
    if (ready && shouldConsiderShowing) {
      setOpen(true)
      if (user?.id) {
        markIntroOfferShownToday(user.id)
      }
    }
  }, [ready, shouldConsiderShowing, user?.id])

  useEffect(() => {
    if (isTutorialBlocking && open) {
      setOpen(false)
    }
  }, [isTutorialBlocking, open])

  const dismiss = () => {
    if (user?.id) {
      markIntroOfferShownToday(user.id)
    }
    setOpen(false)
  }

  const onOpenChange = (next: boolean) => {
    if (!next) {
      dismiss()
      return
    }
    setOpen(true)
  }

  return {
    open,
    onOpenChange,
    dismiss,
    introOffer: introOffer ?? null,
    isLoading: authLoading || offerLoading,
  }
}
