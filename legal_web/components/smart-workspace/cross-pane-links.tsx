"use client"

import { useEffect, useRef, useState, useCallback, RefObject } from "react"
import type { WorkspaceLink, DocumentAnnotation } from "@/lib/api/smart-workspace"

interface LinkPath {
  id: string
  sx: number
  sy: number
  tx: number
  ty: number
  color: string
  gradId: string
}

interface CrossPaneLinksOverlayProps {
  workspaceRef: RefObject<HTMLDivElement | null>
  links: WorkspaceLink[]
  annotations: DocumentAnnotation[]
}

/**
 * Full-workspace SVG overlay that draws animated gradient bezier curves
 * from PDF highlight anchor dots to canvas node cards.
 *
 * Rendered absolutely on top of the 3-pane layout (pointer-events: none).
 * Uses ResizeObserver to keep paths in sync with DOM layout shifts.
 */
export function CrossPaneLinksOverlay({ workspaceRef, links, annotations }: CrossPaneLinksOverlayProps) {
  const [paths, setPaths] = useState<LinkPath[]>([])
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 })
  const frameRef = useRef<number | undefined>(undefined)

  const recompute = useCallback(() => {
    const container = workspaceRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    setSvgSize({ w: containerRect.width, h: containerRect.height })

    const newPaths: LinkPath[] = []

    for (const link of links) {
      if (link.sourceType !== "annotation") continue
      const ann = annotations.find((a) => a.id === link.sourceId)
      if (!ann) continue

      const dotEl = container.querySelector<SVGCircleElement | HTMLElement>(
        `[data-annotation-dot="${link.sourceId}"]`,
      )
      const nodeEl = container.querySelector<HTMLElement>(
        `[data-canvas-node="${link.targetId}"]`,
      )
      if (!dotEl || !nodeEl) continue

      const dotRect = dotEl.getBoundingClientRect()
      const nodeRect = nodeEl.getBoundingClientRect()

      const sx = dotRect.right - containerRect.left
      const sy = dotRect.top + dotRect.height / 2 - containerRect.top
      const tx = nodeRect.left - containerRect.left
      const ty = nodeRect.top + nodeRect.height / 3 - containerRect.top

      newPaths.push({
        id: link.id,
        sx,
        sy,
        tx,
        ty,
        color: ann.color,
        gradId: `lg-${link.id.replace(/-/g, "")}`,
      })
    }

    setPaths(newPaths)
  }, [workspaceRef, links, annotations])

  const scheduleRecompute = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(recompute)
  }, [recompute])

  useEffect(() => {
    scheduleRecompute()
  }, [links, annotations, scheduleRecompute])

  useEffect(() => {
    const container = workspaceRef.current
    if (!container) return

    const ro = new ResizeObserver(scheduleRecompute)
    ro.observe(container)

    // Also re-measure on scroll (PDF pane scrolls)
    const scrollHandlers: (() => void)[] = []
    const scrollables = container.querySelectorAll<HTMLElement>("[data-scroll-pane]")
    scrollables.forEach((el) => {
      const handler = () => scheduleRecompute()
      el.addEventListener("scroll", handler, { passive: true })
      scrollHandlers.push(() => el.removeEventListener("scroll", handler))
    })

    return () => {
      ro.disconnect()
      scrollHandlers.forEach((fn) => fn())
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [workspaceRef, scheduleRecompute])

  if (paths.length === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={svgSize.w}
      height={svgSize.h}
      style={{ zIndex: 20, overflow: "visible" }}
    >
      <defs>
        {paths.map((p) => (
          <linearGradient
            key={p.gradId}
            id={p.gradId}
            gradientUnits="userSpaceOnUse"
            x1={p.sx}
            y1={p.sy}
            x2={p.tx}
            y2={p.ty}
          >
            <stop offset="0%" stopColor={p.color} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.7" />
          </linearGradient>
        ))}
        <filter id="cp-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map((p) => {
        const cpx1 = p.sx + 120
        const cpy1 = p.sy
        const cpx2 = p.tx - 120
        const cpy2 = p.ty
        const d = `M ${p.sx} ${p.sy} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p.tx} ${p.ty}`

        return (
          <g key={p.id}>
            {/* Glow shadow */}
            <path
              d={d}
              fill="none"
              stroke={p.color}
              strokeWidth={8}
              strokeOpacity={0.15}
              filter="url(#cp-glow)"
            />
            {/* Flowing dashed line */}
            <path
              d={d}
              fill="none"
              stroke={`url(#${p.gradId})`}
              strokeWidth={2}
              strokeDasharray="8 4"
              className="ws-link-flow"
            />
            {/* Anchor dot at highlight end */}
            <circle
              cx={p.sx}
              cy={p.sy}
              r={5}
              fill={p.color}
              className="ws-anchor-dot"
            />
            {/* Pulse ring */}
            <circle
              cx={p.sx}
              cy={p.sy}
              r={5}
              fill="none"
              stroke={p.color}
              strokeWidth={1.5}
              strokeOpacity={0.5}
              className="ws-pulse-ring"
            />
            {/* Arrowhead at target end */}
            <circle
              cx={p.tx}
              cy={p.ty}
              r={3}
              fill="#06b6d4"
              fillOpacity={0.7}
            />
          </g>
        )
      })}
    </svg>
  )
}
