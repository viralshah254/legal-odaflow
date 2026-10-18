"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

interface PageStructureOverlayProps {
  enabled: boolean
}

interface LandmarkItem {
  id: string
  label: string
  element: HTMLElement
}

const LANDMARK_SELECTORS = [
  "header",
  "nav",
  "main",
  "#main-content",
  "[role='main']",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "footer",
  "aside",
  "[role='complementary']",
  "[role='search']",
  "form[role='search']",
]

export function PageStructureOverlay({ enabled }: PageStructureOverlayProps) {
  const t = useTranslations("accessibility")
  const [landmarks, setLandmarks] = useState<LandmarkItem[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLandmarks([])
      setHighlightId(null)
      document.querySelectorAll(".a11y-landmark-highlight").forEach((el) => {
        el.classList.remove("a11y-landmark-highlight")
      })
      return
    }

    const found: LandmarkItem[] = []
    const seen = new Set<Element>()

    for (const selector of LANDMARK_SELECTORS) {
      document.querySelectorAll<HTMLElement>(selector).forEach((el, idx) => {
        if (seen.has(el) || el.closest(".a11y-widget-root")) return
        seen.add(el)
        const role = el.getAttribute("role") ?? el.tagName.toLowerCase()
        const ariaLabel = el.getAttribute("aria-label")
        found.push({
          id: `${selector}-${idx}`,
          label: ariaLabel ?? role,
          element: el,
        })
      })
    }

    setLandmarks(found)
  }, [enabled])

  useEffect(() => {
    document.querySelectorAll(".a11y-landmark-highlight").forEach((el) => {
      el.classList.remove("a11y-landmark-highlight")
    })
    if (!highlightId) return
    const item = landmarks.find((l) => l.id === highlightId)
    if (item) {
      item.element.classList.add("a11y-landmark-highlight")
      item.element.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [highlightId, landmarks])

  if (!mounted || !enabled || landmarks.length === 0) return null

  return createPortal(
    <div
      className="a11y-widget-root fixed top-20 right-4 z-[105] w-56 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-popover p-3 shadow-lg"
      role="navigation"
      aria-label={t("pageStructure")}
    >
      <p className="text-xs font-semibold text-foreground mb-2">{t("pageStructure")}</p>
      <ul className="space-y-1">
        {landmarks.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors",
                highlightId === item.id && "bg-accent font-medium",
              )}
              onClick={() =>
                setHighlightId((prev) => (prev === item.id ? null : item.id))
              }
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  )
}
