"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import type { DocumentAnnotation } from "@/lib/api/smart-workspace"

interface TextSelection {
  quote: string
  startOffset: number
  endOffset: number
  page: number
  rect: DOMRect
}

interface PdfViewerProps {
  fileUrl: string
  documentId: string
  annotations: DocumentAnnotation[]
  onSelection?: (selection: TextSelection) => void
  onAnnotationClick?: (annotation: DocumentAnnotation) => void
  className?: string
}

/**
 * PDF viewer backed by pdfjs-dist.
 * Renders pages to <canvas> elements with a transparent SVG highlight overlay.
 * Text selection fires onSelection with offset + quote data for annotation creation.
 */
export function PdfViewer({
  fileUrl,
  documentId,
  annotations,
  onSelection,
  onAnnotationClick,
  className,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [renderedPages, setRenderedPages] = useState<number[]>([])
  // Map from page number to cumulative char offset
  const pageOffsets = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    if (!fileUrl) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setRenderedPages([])

    async function load() {
      try {
        const pdfjsLib = await import("pdfjs-dist")
        // Served from public/ (see scripts/copy-pdf-worker.js) — avoids bundling the worker in Next.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        const pdf = await pdfjsLib.getDocument(fileUrl).promise
        if (cancelled) return

        setTotalPages(pdf.numPages)

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ""

        let cumOffset = 0
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break

          const page = await pdf.getPage(pageNum)
          const scale = 1.5
          const viewport = page.getViewport({ scale })

          // Wrapper div per page
          const pageWrapper = document.createElement("div")
          pageWrapper.className = "relative mb-4 shadow-md"
          pageWrapper.dataset.page = String(pageNum)
          pageWrapper.style.width = `${viewport.width}px`

          // Canvas
          const canvas = document.createElement("canvas")
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = "block"
          const ctx = canvas.getContext("2d")!
          await page.render({ canvasContext: ctx, viewport, canvas }).promise

          // Text layer for selection
          const textLayerDiv = document.createElement("div")
          textLayerDiv.className = "absolute inset-0 select-text"
          textLayerDiv.style.width = `${viewport.width}px`
          textLayerDiv.style.height = `${viewport.height}px`

          const textContent = await page.getTextContent()
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
          })
          await textLayer.render()

          // Track page offset
          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join("")
          pageOffsets.current.set(pageNum, cumOffset)
          cumOffset += pageText.length

          // SVG highlight overlay for annotations
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
          svg.setAttribute("class", "absolute inset-0 pointer-events-none")
          svg.setAttribute("width", String(viewport.width))
          svg.setAttribute("height", String(viewport.height))
          svg.style.overflow = "visible"

          const pageAnnotations = annotations.filter((a) => a.documentId === documentId && a.anchor.page === pageNum)
          for (const ann of pageAnnotations) {
            if (ann.anchor.bbox) {
              const { x, y, width, height } = ann.anchor.bbox
              const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
              rect.setAttribute("data-annotation-id", ann.id)
              rect.setAttribute("x", String(x))
              rect.setAttribute("y", String(y))
              rect.setAttribute("width", String(width))
              rect.setAttribute("height", String(height))
              rect.setAttribute("fill", ann.color)
              rect.setAttribute("fill-opacity", "0.35")
              rect.setAttribute("rx", "2")
              rect.style.pointerEvents = "all"
              rect.style.cursor = "pointer"
              rect.style.transition = "filter 200ms ease, fill-opacity 200ms ease"
              rect.addEventListener("mouseenter", () => {
                rect.setAttribute("fill-opacity", "0.55")
                rect.style.filter = `drop-shadow(0 0 6px ${ann.color})`
              })
              rect.addEventListener("mouseleave", () => {
                rect.setAttribute("fill-opacity", "0.35")
                rect.style.filter = "none"
              })
              rect.addEventListener("click", () => onAnnotationClick?.(ann))
              svg.appendChild(rect)

              // Anchor dot at right edge for cross-pane links
              const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle")
              dot.setAttribute("data-annotation-dot", ann.id)
              dot.setAttribute("cx", String(x + width))
              dot.setAttribute("cy", String(y + height / 2))
              dot.setAttribute("r", "5")
              dot.setAttribute("fill", ann.color)
              dot.style.opacity = "0.8"
              dot.style.pointerEvents = "none"
              svg.appendChild(dot)
            }
          }

          pageWrapper.appendChild(canvas)
          pageWrapper.appendChild(textLayerDiv)
          pageWrapper.appendChild(svg)
          container.appendChild(pageWrapper)

          if (!cancelled) setRenderedPages((p) => [...p, pageNum])
        }
      } catch (err) {
        if (!cancelled) setError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [fileUrl, documentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render annotation overlays when annotations change without re-loading PDF
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const pageWrappers = container.querySelectorAll<HTMLDivElement>("[data-page]")
    pageWrappers.forEach((wrapper) => {
      const pageNum = Number(wrapper.dataset.page)
      const existingSvg = wrapper.querySelector("svg")
      if (!existingSvg) return

      // Clear and re-draw
      existingSvg.innerHTML = ""
      const pageAnnotations = annotations.filter(
        (a) => a.documentId === documentId && a.anchor.page === pageNum,
      )
      for (const ann of pageAnnotations) {
        if (ann.anchor.bbox) {
          const { x, y, width, height } = ann.anchor.bbox
          const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
          rect.setAttribute("data-annotation-id", ann.id)
          rect.setAttribute("x", String(x))
          rect.setAttribute("y", String(y))
          rect.setAttribute("width", String(width))
          rect.setAttribute("height", String(height))
          rect.setAttribute("fill", ann.color)
          rect.setAttribute("fill-opacity", "0.35")
          rect.setAttribute("rx", "2")
          rect.style.pointerEvents = "all"
          rect.style.cursor = "pointer"
          rect.style.transition = "filter 200ms ease, fill-opacity 200ms ease"
          rect.addEventListener("mouseenter", () => {
            rect.setAttribute("fill-opacity", "0.55")
            rect.style.filter = `drop-shadow(0 0 6px ${ann.color})`
          })
          rect.addEventListener("mouseleave", () => {
            rect.setAttribute("fill-opacity", "0.35")
            rect.style.filter = "none"
          })
          rect.addEventListener("click", () => onAnnotationClick?.(ann))
          existingSvg.appendChild(rect)

          // Anchor dot for cross-pane link overlay
          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle")
          dot.setAttribute("data-annotation-dot", ann.id)
          dot.setAttribute("cx", String(x + width))
          dot.setAttribute("cy", String(y + height / 2))
          dot.setAttribute("r", "5")
          dot.setAttribute("fill", ann.color)
          dot.style.opacity = "0.8"
          dot.style.pointerEvents = "none"
          existingSvg.appendChild(dot)
        }
      }
    })
  }, [annotations, documentId, onAnnotationClick])

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const quote = selection.toString().trim()
    if (!quote || !containerRef.current?.contains(range.commonAncestorContainer)) return

    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current!.getBoundingClientRect()

    // Find which page wrapper contains the selection
    let pageNum = 1
    let pageEl = range.commonAncestorContainer as Element | null
    while (pageEl && pageEl !== containerRef.current) {
      if ((pageEl as HTMLElement).dataset?.page) {
        pageNum = Number((pageEl as HTMLElement).dataset.page)
        break
      }
      pageEl = pageEl.parentElement
    }

    const baseOffset = pageOffsets.current.get(pageNum) ?? 0
    // Approximate offset within page via text content position
    const startOffset = baseOffset
    const endOffset = baseOffset + quote.length

    onSelection?.({
      quote,
      startOffset,
      endOffset,
      page: pageNum,
      rect: new DOMRect(rect.x - containerRect.x, rect.y - containerRect.y, rect.width, rect.height),
    })
  }, [onSelection])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive p-8">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm text-center">Failed to load PDF: {error}</p>
      </div>
    )
  }

  return (
    <div className={`relative overflow-auto ${className ?? ""}`} onMouseUp={handleMouseUp} data-scroll-pane="pdf">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {totalPages > 0 && renderedPages.length < totalPages && !loading && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Loading pages {renderedPages.length}/{totalPages}...
        </div>
      )}
      <div
        ref={containerRef}
        className="p-4 min-h-full"
        // pdfjs text layer CSS
        style={{ fontFamily: "sans-serif" }}
      />
    </div>
  )
}
