"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { Accessibility, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAccessibilityStore } from "@/lib/accessibility/accessibility-store"
import { useDraggablePosition } from "@/lib/accessibility/use-draggable-position"
import {
  clampWidgetToViewport,
  getDefaultWidgetPosition,
  normalizeStoredPosition,
  shouldPanelOpenUpward,
} from "@/lib/accessibility/clamp-widget-bounds"
import { AccessibilityPanel } from "./accessibility-panel"

export function AccessibilityWidget() {
  const t = useTranslations("accessibility")
  const containerRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  const [panelOpensUp, setPanelOpensUp] = useState(true)
  const initializedRef = useRef(false)

  const panelOpen = useAccessibilityStore((s) => s.panelOpen)
  const widgetHidden = useAccessibilityStore((s) => s.widgetHidden)
  const position = useAccessibilityStore((s) => s.position)
  const settings = useAccessibilityStore((s) => s.settings)
  const setPanelOpen = useAccessibilityStore((s) => s.setPanelOpen)
  const togglePanel = useAccessibilityStore((s) => s.togglePanel)
  const setWidgetHidden = useAccessibilityStore((s) => s.setWidgetHidden)
  const setPosition = useAccessibilityStore((s) => s.setPosition)

  const { isDragging, getPositionStyle, dragHandleProps } = useDraggablePosition({
    position,
    onPositionChange: setPosition,
    elementRef: containerRef,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep the full widget (launcher + open panel) inside the viewport.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!mounted || !el || widgetHidden || isDragging) return

    let targetX = position.x
    let targetY = position.y

    if (!initializedRef.current) {
      initializedRef.current = true
      if (position.y < 0) {
        const normalized = normalizeStoredPosition(position, el)
        targetX = normalized.x
        targetY = normalized.y
      } else if (position.x === 24 && position.y === 24) {
        const defaults = getDefaultWidgetPosition(el)
        targetX = defaults.x
        targetY = defaults.y
      }
    }

    const clamped = clampWidgetToViewport(el, targetX, targetY)
    setPanelOpensUp(shouldPanelOpenUpward(clamped.y, el))

    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped)
    }
  }, [
    mounted,
    widgetHidden,
    panelOpen,
    settings.oversizedWidget,
    isDragging,
    position.x,
    position.y,
    setPosition,
  ])

  useEffect(() => {
    if (!mounted || widgetHidden) return

    const onResize = () => {
      const el = containerRef.current
      if (!el) return
      const clamped = clampWidgetToViewport(el, position.x, position.y)
      setPosition(clamped)
      setPanelOpensUp(shouldPanelOpenUpward(clamped.y, el))
    }

    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [mounted, widgetHidden, position.x, position.y, setPosition])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanelOpen(false)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [panelOpen, setPanelOpen])

  if (!mounted) return null

  if (widgetHidden) {
    return createPortal(
      <button
        type="button"
        className="a11y-widget-root fixed left-0 top-1/2 -translate-y-1/2 z-[110] rounded-r-md border border-l-0 border-border bg-primary px-1.5 py-3 text-primary-foreground shadow-lg text-xs font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ writingMode: "vertical-rl" }}
        onClick={() => {
          setWidgetHidden(false)
          initializedRef.current = false
        }}
        aria-label={t("showWidget")}
      >
        {t("widgetLabel")}
      </button>,
      document.body,
    )
  }

  const posStyle = getPositionStyle()

  return createPortal(
    <div
      ref={containerRef}
      className={cn(
        "a11y-widget-root fixed z-[110] flex items-start gap-2 max-w-[calc(100vw-24px)]",
        panelOpensUp ? "flex-col-reverse" : "flex-col",
        isDragging && "select-none",
      )}
      style={posStyle}
      data-a11y-oversized-widget={settings.oversizedWidget ? "true" : undefined}
    >
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="flex h-8 w-6 items-center justify-center rounded-l-full border border-r-0 border-border bg-muted text-muted-foreground hover:bg-accent cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("dragToMove")}
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <Button
          ref={launcherRef}
          size="lg"
          className="h-12 rounded-full rounded-l-none shadow-xl w-12 px-0 shrink-0"
          onClick={togglePanel}
          aria-label={t("openMenu")}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
        >
          <Accessibility className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      {panelOpen && (
        <AccessibilityPanel
          onClose={() => {
            setPanelOpen(false)
            launcherRef.current?.focus()
          }}
          onHideWidget={() => setWidgetHidden(true)}
        />
      )}
    </div>,
    document.body,
  )
}
