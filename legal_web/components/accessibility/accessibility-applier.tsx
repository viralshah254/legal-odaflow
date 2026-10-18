"use client"

import { useEffect } from "react"
import { useAccessibilityStore } from "@/lib/accessibility/accessibility-store"
import {
  applyAccessibilitySettings,
  clearAllAccessibilitySettings,
} from "@/lib/accessibility/apply-settings"

/** Syncs accessibility store settings to html[data-a11y-*] attributes. */
export function AccessibilityApplier() {
  const settings = useAccessibilityStore((s) => s.settings)

  useEffect(() => {
    applyAccessibilitySettings(settings)
  }, [settings])

  useEffect(() => {
    return () => {
      clearAllAccessibilitySettings()
    }
  }, [])

  return null
}
