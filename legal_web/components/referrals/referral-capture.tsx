"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { persistReferralCode } from "@/lib/auth/referral-storage"
import { persistUtmParams } from "@/lib/analytics/utm-storage"

/**
 * Silently captures ?ref= and UTM params from any page URL on first mount.
 *
 * - UTM params (utm_source, utm_medium, utm_campaign, etc.) are stored in
 *   sessionStorage so they survive client-side navigation to /auth and
 *   /legal-issue-checker for attribution reporting.
 * - ?ref= referral codes are persisted in localStorage (30-day TTL) and
 *   stripped from the visible URL.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Always capture UTM params so they survive navigation
    persistUtmParams(new URLSearchParams(searchParams.toString()))

    const ref = searchParams.get("ref")
    if (!ref) return

    persistReferralCode(ref)

    // Remove ?ref= from the visible URL (keeps other params intact)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("ref")
    const newSearch = params.toString()
    router.replace(pathname + (newSearch ? `?${newSearch}` : ""), { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
