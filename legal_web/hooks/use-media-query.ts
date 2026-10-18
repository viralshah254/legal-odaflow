"use client"

import { useEffect, useState } from "react"

/**
 * Subscribe to a CSS media query. Returns `false` during SSR / before mount
 * to avoid hydration mismatches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const sync = () => setMatches(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener("change", sync)
    return () => mediaQuery.removeEventListener("change", sync)
  }, [query])

  return matches
}

/** Below `lg` (1024px) — matches the app's primary sidebar breakpoint. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)")
}

/** Below `md` (768px). */
export function useIsTablet(): boolean {
  return useMediaQuery("(max-width: 767px)")
}
