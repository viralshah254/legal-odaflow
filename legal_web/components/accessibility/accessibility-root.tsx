"use client"

import { useEffect } from "react"
import { useAccessibilityStore } from "@/lib/accessibility/accessibility-store"
import { AccessibilityApplier } from "./accessibility-applier"
import { AccessibilityWidget } from "./accessibility-widget"
import { PageStructureOverlay } from "./page-structure-overlay"
import { DictionaryPopup } from "./dictionary-popup"

/** Site-wide accessibility widget root: applier, UI, overlays, Alt+A shortcut. */
export function AccessibilityRoot() {
  const settings = useAccessibilityStore((s) => s.settings)
  const widgetHidden = useAccessibilityStore((s) => s.widgetHidden)
  const togglePanel = useAccessibilityStore((s) => s.togglePanel)
  const setWidgetHidden = useAccessibilityStore((s) => s.setWidgetHidden)
  const setPanelOpen = useAccessibilityStore((s) => s.setPanelOpen)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== "a") return
      if (e.ctrlKey || e.metaKey || e.shiftKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return
      }

      e.preventDefault()
      if (widgetHidden) {
        setWidgetHidden(false)
        setPanelOpen(true)
        return
      }
      togglePanel()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [widgetHidden, togglePanel, setWidgetHidden, setPanelOpen])

  return (
    <>
      <AccessibilityApplier />
      <AccessibilityWidget />
      <PageStructureOverlay enabled={settings.pageStructure} />
      <DictionaryPopup enabled={settings.dictionary} />
    </>
  )
}
