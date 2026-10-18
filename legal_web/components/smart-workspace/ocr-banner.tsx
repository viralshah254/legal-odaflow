"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api/client"
import { Scan, Loader2, CheckCircle2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface OcrBannerProps {
  documentId: string
  fileName: string
  mimeType?: string
  extractedText?: string | null
  className?: string
}

/**
 * Mirrors LiquidText's "This seems to be a scanned document" banner.
 * Shown when a PDF/image has no extractedText. Triggers OCR via the documents API
 * and polls until text is available.
 */
export function OcrBanner({ documentId, fileName, mimeType, extractedText, className }: OcrBannerProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "dismissed">("idle")
  const [pollCount, setPollCount] = useState(0)

  const isScanned =
    !extractedText?.trim() &&
    (mimeType?.includes("pdf") || mimeType?.includes("image") || /\.(pdf|png|jpg|jpeg|tiff|tif)$/i.test(fileName))

  const triggerOcr = useCallback(async () => {
    setStatus("running")
    try {
      await apiFetch(`/documents/${documentId}/trigger-ocr`, { method: "POST" })
    } catch {
      // endpoint may not exist; start polling anyway
    }
    setPollCount(0)
  }, [documentId])

  // Poll for extractedText
  useEffect(() => {
    if (status !== "running") return

    const interval = setInterval(async () => {
      try {
        const doc = await apiFetch<{ extractedText?: string }>(`/documents/${documentId}`)
        if (doc.extractedText?.trim()) {
          setStatus("done")
          clearInterval(interval)
        } else {
          setPollCount((c) => {
            if (c > 30) {
              // Give up after ~2.5 min
              clearInterval(interval)
              setStatus("dismissed")
            }
            return c + 1
          })
        }
      } catch {
        clearInterval(interval)
        setStatus("dismissed")
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [status, documentId])

  if (!isScanned || status === "dismissed") return null

  if (status === "done") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300",
          className,
        )}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>OCR complete — document text is now searchable and annotatable.</span>
      </div>
    )
  }

  if (status === "running") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg text-sm text-sky-700 dark:text-sky-300",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>Running OCR on scanned document…</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg",
        className,
      )}
    >
      <Scan className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          This seems to be a scanned document
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
          Run OCR to enable text selection and AI analysis on {fileName}.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={triggerOcr}>
          Run OCR
        </Button>
        <button
          className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
          onClick={() => setStatus("dismissed")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
