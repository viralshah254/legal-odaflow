"use client"

import { useEffect, useState } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"

const SOLO_KEY = "umbrella-solo-intent"

/** Persist whether the practitioner signed up as a solo (1-person practice). */
export function setSoloIntent(isSolo: boolean): void {
  try {
    localStorage.setItem(SOLO_KEY, isSolo ? "1" : "0")
  } catch {
    // ignore storage failures
  }
}

/**
 * True when the current user is a solo practitioner: they tagged solo intent at
 * sign-up and belong to a single tenant. Drives the solo-aware sidebar and
 * onboarding (hide Team, collapse Admin, skip template noise).
 */
export function useIsSolo(): boolean {
  const { tenants } = useTenant()
  const [intent, setIntent] = useState(false)

  useEffect(() => {
    try {
      setIntent(localStorage.getItem(SOLO_KEY) === "1")
    } catch {
      setIntent(false)
    }
  }, [])

  return intent && tenants.length <= 1
}
