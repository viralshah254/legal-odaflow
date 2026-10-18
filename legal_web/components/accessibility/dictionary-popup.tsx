"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

interface DictionaryPopupProps {
  enabled: boolean
}

interface PopupState {
  word: string
  definition: string | null
  loading: boolean
  error: string | null
  x: number
  y: number
}

async function lookupWord(word: string): Promise<string | null> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  )
  if (!res.ok) return null
  const data = (await res.json()) as Array<{
    meanings?: Array<{ definitions?: Array<{ definition?: string }> }>
  }>
  const def = data[0]?.meanings?.[0]?.definitions?.[0]?.definition
  return def ?? null
}

export function DictionaryPopup({ enabled }: DictionaryPopupProps) {
  const t = useTranslations("accessibility")
  const [mounted, setMounted] = useState(false)
  const [popup, setPopup] = useState<PopupState | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelection = useCallback(async () => {
    if (!enabled) return

    const selection = window.getSelection()
    const text = selection?.toString().trim().replace(/[^a-zA-Z'-]/g, "")
    if (!text || text.length < 2 || text.length > 40) {
      setPopup(null)
      return
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    if (!rect) return

    if (selection?.anchorNode && (selection.anchorNode as Node).parentElement?.closest(".a11y-widget-root")) {
      return
    }

    setPopup({
      word: text,
      definition: null,
      loading: true,
      error: null,
      x: rect.left,
      y: rect.bottom + 8,
    })

    try {
      const definition = await lookupWord(text.toLowerCase())
      setPopup((prev) =>
        prev?.word === text
          ? {
              ...prev,
              loading: false,
              definition,
              error: definition ? null : t("dictionaryNotFound"),
            }
          : prev,
      )
    } catch {
      setPopup((prev) =>
        prev?.word === text
          ? { ...prev, loading: false, error: t("dictionaryError") }
          : prev,
      )
    }
  }, [enabled, t])

  useEffect(() => {
    if (!enabled) {
      setPopup(null)
      return
    }

    const onMouseUp = () => {
      void handleSelection()
    }
    document.addEventListener("mouseup", onMouseUp)
    return () => document.removeEventListener("mouseup", onMouseUp)
  }, [enabled, handleSelection])

  if (!mounted || !popup) return null

  return createPortal(
    <div
      className="a11y-widget-root a11y-dictionary-popup"
      style={{
        left: Math.min(popup.x, window.innerWidth - 240),
        top: Math.min(popup.y, window.innerHeight - 120),
      }}
      role="status"
      aria-live="polite"
    >
      <p className="a11y-dictionary-word">{popup.word}</p>
      {popup.loading && (
        <p className="a11y-dictionary-def flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t("dictionaryLoading")}
        </p>
      )}
      {!popup.loading && popup.definition && (
        <p className="a11y-dictionary-def">{popup.definition}</p>
      )}
      {!popup.loading && popup.error && (
        <p className="a11y-dictionary-def">{popup.error}</p>
      )}
    </div>,
    document.body,
  )
}
