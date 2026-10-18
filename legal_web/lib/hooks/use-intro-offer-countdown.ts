"use client"

import { useEffect, useState } from "react"
import {
  computeIntroOfferCountdown,
  type IntroOfferCountdown,
} from "@/lib/pricing/intro-offer-countdown"

const EMPTY: IntroOfferCountdown = { days: 0, hours: 0, minutes: 0, expired: true }

/** Ticks every minute; updates immediately on mount and when expiry changes. */
export function useIntroOfferCountdown(expiresAt: string | null | undefined): IntroOfferCountdown {
  const [countdown, setCountdown] = useState<IntroOfferCountdown>(() =>
    expiresAt ? computeIntroOfferCountdown(expiresAt) : EMPTY,
  )

  useEffect(() => {
    if (!expiresAt) {
      setCountdown(EMPTY)
      return
    }

    const tick = () => setCountdown(computeIntroOfferCountdown(expiresAt))
    tick()
    const timer = window.setInterval(tick, 60_000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  return countdown
}
