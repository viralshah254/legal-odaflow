"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CanvasNode, WorkspaceLink } from "@/lib/api/smart-workspace"
import { FileText, StickyNote, Clock, Sparkles, Link2, Bot, Trash2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CanvasToolbar, type CanvasMode } from "./canvas-toolbar"
import "./workspace.css"

interface InkPoint { x: number; y: number }

interface WorkspaceCanvasProps {
  canvasNodes: CanvasNode[]
  links: WorkspaceLink[]
  onNodeMove: (nodeId: string, x: number, y: number) => void
  onNodeDelete: (nodeId: string) => void
  onNodeContentChange: (nodeId: string, content: Record<string, unknown>) => void
  onAddNode?: (params: { type: string; positionX: number; positionY: number; content?: Record<string, unknown> }) => void
  onCreateLink?: (sourceNodeId: string, targetNodeId: string) => void
  className?: string
}

// ── Smooth quadratic bezier spline from freehand points ──────────────────

function toSmoothPath(pts: InkPoint[]): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    d += ` Q ${pts[i].x} ${pts[i].y}, ${mx} ${my}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function buildBezier(sx: number, sy: number, tx: number, ty: number): string {
  const cpx = (sx + tx) / 2
  return `M ${sx} ${sy} C ${cpx} ${sy}, ${cpx} ${ty}, ${tx} ${ty}`
}

// ── Card accent config ────────────────────────────────────────────────────

const CARD_CLASS: Record<string, string> = {
  note:            "ws-card-note",
  excerpt_card:    "ws-card-excerpt",
  timeline:        "ws-card-timeline",
  research_result: "ws-card-research",
  ink:             "ws-card-ink",
}

const NODE_ICONS: Record<string, React.ReactNode> = {
  note:            <StickyNote className="h-3 w-3" />,
  excerpt_card:    <FileText className="h-3 w-3" />,
  timeline:        <Clock className="h-3 w-3" />,
  research_result: <Sparkles className="h-3 w-3" />,
  image:           <FileText className="h-3 w-3" />,
}

const LABEL_COLOR: Record<string, string> = {
  note:            "#FCD34D",
  excerpt_card:    "#38BDF8",
  timeline:        "#34D399",
  research_result: "#A78BFA",
  image:           "#94A3B8",
}

export function WorkspaceCanvas({
  canvasNodes,
  links,
  onNodeMove,
  onNodeDelete,
  onNodeContentChange,
  onAddNode,
  onCreateLink,
  className,
}: WorkspaceCanvasProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const panRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef<{
    nodeId: string; startX: number; startY: number; origX: number; origY: number
  } | null>(null)
  const panningRef = useRef<{
    startX: number; startY: number; origPanX: number; origPanY: number
  } | null>(null)

  const [mode, setMode] = useState<CanvasMode>("select")
  const [inkColor, setInkColor] = useState("#FF3B5C")
  const [liveStroke, setLiveStroke] = useState<InkPoint[]>([])
  const isDrawingRef = useRef(false)

  // Arrow mode: two-click
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Track newly added nodes for pop-in animation
  const prevNodeIdsRef = useRef<Set<string>>(new Set())
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const current = new Set(canvasNodes.map((n) => n.id))
    const added: string[] = []
    current.forEach((id) => { if (!prevNodeIdsRef.current.has(id)) added.push(id) })
    prevNodeIdsRef.current = current
    if (added.length) {
      setNewNodeIds(new Set(added))
      const t = setTimeout(() => setNewNodeIds(new Set()), 500)
      return () => clearTimeout(t)
    }
  }, [canvasNodes])

  const getNodeById = useCallback((id: string) => canvasNodes.find((n) => n.id === id), [canvasNodes])

  function canvasPoint(e: React.PointerEvent): InkPoint {
    const rect = outerRef.current!.getBoundingClientRect()
    return {
      x: e.clientX - rect.left - panRef.current.x,
      y: e.clientY - rect.top - panRef.current.y,
    }
  }

  // ── Link paths (canvas-node ↔ canvas-node only) ─────────────────────────
  function buildPath(source: CanvasNode, target: CanvasNode): string {
    const sx = source.positionX + (source.width ?? 280) / 2 + panRef.current.x
    const sy = source.positionY + 40 + panRef.current.y
    const tx = target.positionX + (target.width ?? 280) / 2 + panRef.current.x
    const ty = target.positionY + panRef.current.y
    return buildBezier(sx, sy, tx, ty)
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  function handleNodePointerDown(e: React.PointerEvent, nodeId: string) {
    if (mode === "erase") {
      e.stopPropagation()
      handleEraseNode(nodeId)
      return
    }
    if (mode !== "select") return
    e.stopPropagation()
    const node = getNodeById(nodeId)
    if (!node) return
    draggingRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.positionX,
      origY: node.positionY,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const el = document.getElementById(`canvas-node-${nodeId}`)
    if (el) el.classList.add("ws-card-dragging")
  }

  function handleEraseNode(nodeId: string) {
    setDeletingIds((prev) => new Set([...prev, nodeId]))
    setTimeout(() => {
      onNodeDelete(nodeId)
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(nodeId); return s })
    }, 220)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (draggingRef.current) {
      const { nodeId, startX, startY, origX, origY } = draggingRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const nodeEl = document.getElementById(`canvas-node-${nodeId}`)
      if (nodeEl) {
        nodeEl.style.left = `${origX + dx}px`
        nodeEl.style.top = `${origY + dy}px`
      }
    } else if (panningRef.current) {
      const { startX, startY, origPanX, origPanY } = panningRef.current
      panRef.current = {
        x: origPanX + (e.clientX - startX),
        y: origPanY + (e.clientY - startY),
      }
      if (containerRef.current) {
        containerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`
      }
    } else if (isDrawingRef.current && mode === "draw") {
      const pt = canvasPoint(e)
      setLiveStroke((prev) => [...prev, pt])
    }

    // Track mouse for arrow ghost preview
    if (mode === "arrow" && arrowStart) {
      const rect = outerRef.current?.getBoundingClientRect()
      if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (draggingRef.current) {
      const { nodeId, startX, startY, origX, origY } = draggingRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      onNodeMove(nodeId, origX + dx, origY + dy)
      const el = document.getElementById(`canvas-node-${nodeId}`)
      if (el) el.classList.remove("ws-card-dragging")
      draggingRef.current = null
    }
    panningRef.current = null

    // Finish freehand stroke
    if (isDrawingRef.current && mode === "draw" && liveStroke.length > 1) {
      isDrawingRef.current = false
      const pts = [...liveStroke]
      setLiveStroke([])
      onAddNode?.({
        type: "ink",
        positionX: Math.min(...pts.map((p) => p.x)),
        positionY: Math.min(...pts.map((p) => p.y)),
        content: {
          strokes: [{ points: pts.map((p) => [p.x, p.y]), color: inkColor, width: 2.5 }],
        },
      })
    }
  }

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if ((e.target as Element).closest("[data-canvas-node]")) return

    if (mode === "draw") {
      isDrawingRef.current = true
      setLiveStroke([canvasPoint(e)])
      return
    }

    if (mode === "arrow") {
      const rect = outerRef.current?.getBoundingClientRect()
      if (!rect) return
      if (!arrowStart) {
        setArrowStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      } else {
        // Complete arrow
        const tx = e.clientX - rect.left
        const ty = e.clientY - rect.top
        onAddNode?.({
          type: "ink",
          positionX: Math.min(arrowStart.x, tx),
          positionY: Math.min(arrowStart.y, ty),
          content: {
            arrow: true,
            from: [arrowStart.x - panRef.current.x, arrowStart.y - panRef.current.y],
            to: [tx - panRef.current.x, ty - panRef.current.y],
            color: inkColor,
          },
        })
        setArrowStart(null)
      }
      return
    }

    if (mode === "select" || mode === "erase") {
      panningRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: panRef.current.x,
        origPanY: panRef.current.y,
      }
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (mode !== "select") return
    if ((e.target as Element).closest("[data-canvas-node]")) return
    const rect = outerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left - panRef.current.x
    const y = e.clientY - rect.top - panRef.current.y
    onAddNode?.({ type: "note", positionX: x, positionY: y, content: { text: "" } })
  }

  const cursorClass =
    mode === "draw" ? "cursor-crosshair" :
    mode === "arrow" ? "cursor-crosshair" :
    mode === "erase" ? "cursor-cell" :
    "cursor-grab active:cursor-grabbing"

  return (
    <div
      ref={outerRef}
      className={cn("relative overflow-hidden ws-canvas-bg select-none", cursorClass, className)}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* ── Floating toolbar pill ─────────────────────────────────────────── */}
      <CanvasToolbar
        mode={mode}
        inkColor={inkColor}
        onModeChange={setMode}
        onInkColorChange={setInkColor}
      />

      {/* ── Canvas-to-canvas link SVG ─────────────────────────────────────── */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <defs>
          <linearGradient id="c2c-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="c2c-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="c2c-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="url(#c2c-grad)" />
          </marker>
        </defs>

        {links.map((link) => {
          const source = link.sourceType === "canvas_node" ? getNodeById(link.sourceId) : null
          const target = link.targetType === "canvas_node" ? getNodeById(link.targetId) : null
          if (!source || !target) return null
          return (
            <g key={link.id}>
              <path
                d={buildPath(source, target)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth={5}
                strokeOpacity={0.08}
                filter="url(#c2c-glow)"
              />
              <path
                d={buildPath(source, target)}
                fill="none"
                stroke="url(#c2c-grad)"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                className="ws-link-flow"
                markerEnd="url(#c2c-arrow)"
              />
            </g>
          )
        })}

        {/* Live ink stroke */}
        {liveStroke.length > 1 && (
          <path
            d={toSmoothPath(liveStroke.map((p) => ({ x: p.x + panRef.current.x, y: p.y + panRef.current.y })))}
            fill="none"
            stroke={inkColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ws-ink-live"
            style={{ filter: `drop-shadow(0 0 5px ${inkColor})` }}
          />
        )}

        {/* Arrow mode: pulsing start dot + ghost bezier */}
        {mode === "arrow" && arrowStart && (
          <>
            <circle
              cx={arrowStart.x}
              cy={arrowStart.y}
              r={6}
              fill={inkColor}
              className="ws-anchor-dot"
            />
            <circle
              cx={arrowStart.x}
              cy={arrowStart.y}
              r={6}
              fill="none"
              stroke={inkColor}
              strokeWidth={1.5}
              className="ws-pulse-ring"
            />
            <path
              d={buildBezier(arrowStart.x, arrowStart.y, mousePos.x, mousePos.y)}
              fill="none"
              stroke={inkColor}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              strokeOpacity={0.5}
            />
          </>
        )}
      </svg>

      {/* ── Node cards layer ──────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ transform: `translate(${panRef.current.x}px, ${panRef.current.y}px)`, zIndex: 1 }}
      >
        {canvasNodes.map((node) =>
          node.type === "ink" ? (
            <InkNode
              key={node.id}
              node={node}
              isNew={newNodeIds.has(node.id)}
              isDeleting={deletingIds.has(node.id)}
              eraseMode={mode === "erase"}
              onDelete={() => handleEraseNode(node.id)}
            />
          ) : (
            <CanvasNodeCard
              key={node.id}
              node={node}
              isNew={newNodeIds.has(node.id)}
              isDeleting={deletingIds.has(node.id)}
              eraseMode={mode === "erase"}
              onPointerDown={(e) => handleNodePointerDown(e, node.id)}
              onDelete={() => handleEraseNode(node.id)}
              onContentChange={(content) => onNodeContentChange(node.id, content)}
            />
          ),
        )}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {canvasNodes.length === 0 && (
        <EmptyCanvasState />
      )}
    </div>
  )
}

// ── Ink node (raw SVG on canvas) ──────────────────────────────────────────

function InkNode({
  node, isNew, isDeleting, eraseMode, onDelete,
}: {
  node: CanvasNode
  isNew: boolean
  isDeleting: boolean
  eraseMode: boolean
  onDelete: () => void
}) {
  const content = (node.content ?? {}) as {
    strokes?: Array<{ points: [number, number][]; color: string; width: number }>
    arrow?: boolean
    from?: [number, number]
    to?: [number, number]
    color?: string
  }

  let svgContent: React.ReactNode = null
  let svgW = 100; let svgH = 60; let ox = 0; let oy = 0

  if (content.arrow && content.from && content.to) {
    const [fx, fy] = content.from
    const [tx, ty] = content.to
    ox = Math.min(fx, tx); oy = Math.min(fy, ty)
    svgW = Math.max(Math.abs(tx - fx) + 20, 60)
    svgH = Math.max(Math.abs(ty - fy) + 20, 40)
    const d = buildBezier(fx - ox, fy - oy, tx - ox, ty - oy)
    svgContent = (
      <>
        <defs>
          <marker id={`arr-${node.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={content.color ?? "#FF3B5C"} />
          </marker>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={content.color ?? "#FF3B5C"}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="ws-arrow-draw-in"
          markerEnd={`url(#arr-${node.id})`}
          style={{ filter: `drop-shadow(0 0 3px ${content.color ?? "#FF3B5C"})` }}
        />
      </>
    )
  } else if (content.strokes?.length) {
    const allPts = content.strokes.flatMap((s) => s.points)
    if (allPts.length) {
      const xs = allPts.map(([x]) => x)
      const ys = allPts.map(([, y]) => y)
      ox = Math.min(...xs) - 8; oy = Math.min(...ys) - 8
      svgW = Math.max(...xs) - ox + 16; svgH = Math.max(...ys) - oy + 16
    }
    svgContent = content.strokes.map((s, i) => {
      const pts = s.points.map(([x, y]) => ({ x: x - ox, y: y - oy }))
      return (
        <path
          key={i}
          d={toSmoothPath(pts)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 2px ${s.color})` }}
        />
      )
    })
  }

  return (
    <div
      id={`canvas-node-${node.id}`}
      data-canvas-node={node.id}
      className={cn(
        "absolute group",
        isNew && "ws-node-pop-in",
        isDeleting && "opacity-0 scale-0 transition-all duration-200",
        eraseMode && "cursor-cell hover:opacity-70",
      )}
      style={{ left: node.positionX, top: node.positionY, zIndex: 1 }}
      onClick={eraseMode ? onDelete : undefined}
    >
      <svg width={svgW} height={svgH} overflow="visible">
        {svgContent}
      </svg>
      {/* Delete on hover */}
      {!eraseMode && (
        <button
          className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500/80 text-white text-[8px] items-center justify-center hidden group-hover:flex"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Regular canvas node card ───────────────────────────────────────────────

interface CanvasNodeCardProps {
  node: CanvasNode
  isNew: boolean
  isDeleting: boolean
  eraseMode: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onDelete: () => void
  onContentChange: (content: Record<string, unknown>) => void
}

function CanvasNodeCard({
  node, isNew, isDeleting, eraseMode, onPointerDown, onDelete, onContentChange,
}: CanvasNodeCardProps) {
  const accentClass = CARD_CLASS[node.type] ?? CARD_CLASS.note
  const accentColor = LABEL_COLOR[node.type] ?? "#94A3B8"

  const handleTextChange = useCallback(
    (text: string) => onContentChange({ ...(node.content ?? {}), text }),
    [node.content, onContentChange],
  )

  return (
    <div
      id={`canvas-node-${node.id}`}
      data-canvas-node={node.id}
      className={cn(
        "absolute rounded-xl ws-card-glass",
        accentClass,
        "transition-[box-shadow,transform] duration-200",
        isNew && "ws-node-pop-in",
        isDeleting && "opacity-0 scale-0 transition-all duration-200",
        eraseMode ? "cursor-cell hover:opacity-70" : "cursor-move",
      )}
      style={{
        left: node.positionX,
        top: node.positionY,
        width: node.width ?? 280,
        minHeight: node.height ?? undefined,
        zIndex: 1,
      }}
      onPointerDown={eraseMode ? undefined : onPointerDown}
      onClick={eraseMode ? onDelete : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: accentColor }}>
          {NODE_ICONS[node.type]}
          <span className="capitalize tracking-wide">{node.type.replace(/_/g, " ")}</span>
        </div>
        {/* Hover action bar */}
        <div className="ws-card-actions flex items-center gap-0.5">
          <button
            className="p-0.5 rounded text-white/30 hover:text-sky-400 hover:bg-white/5 transition-colors"
            title="Link to another card"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Link2 className="h-2.5 w-2.5" />
          </button>
          <button
            className="p-0.5 rounded text-white/30 hover:text-purple-400 hover:bg-white/5 transition-colors"
            title="AI action"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Bot className="h-2.5 w-2.5" />
          </button>
          <button
            className="p-0.5 rounded text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
            title="Delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {node.type === "excerpt_card" ? (
          <ExcerptCardBody node={node} content={node.content ?? {}} />
        ) : node.type === "timeline" ? (
          <TimelineCardBody content={node.content ?? {}} />
        ) : node.type === "research_result" ? (
          <ResearchCardBody content={node.content ?? {}} />
        ) : (
          <NoteCardBody content={node.content ?? {}} onChange={handleTextChange} isNew={isNew} />
        )}
      </div>

      {/* Resize handle — bottom-right */}
      <div
        className="ws-resize-handle absolute bottom-0.5 right-0.5 w-3 h-3 cursor-se-resize"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
        }}
      />
    </div>
  )
}

// ── Card bodies ──────────────────────────────────────────────────────────

function ExcerptCardBody({ node, content }: { node: CanvasNode; content: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <blockquote className="text-[11px] italic leading-relaxed border-l-2 border-sky-400/60 pl-2 text-white/70">
        &ldquo;{String(content.quote ?? "")}&rdquo;
      </blockquote>
      {Boolean(content.page || content.source) && (
        <div className="flex items-center gap-1">
          <span
            className="ws-source-pill text-[9px] text-white/40 px-1.5 py-0.5 rounded-full flex items-center gap-1"
          >
            <FileText className="h-2 w-2" />
            {content.source
              ? String(content.source)
              : content.page
                ? `Page ${String(content.page)}`
                : ""}
          </span>
          <button className="text-[9px] text-sky-400/60 hover:text-sky-400 flex items-center gap-0.5 transition-colors">
            <ChevronRight className="h-2 w-2" />
            View
          </button>
        </div>
      )}
    </div>
  )
}

function NoteCardBody({
  content, onChange, isNew,
}: {
  content: Record<string, unknown>
  onChange: (text: string) => void
  isNew: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (isNew) ref.current?.focus()
  }, [isNew])

  return (
    <textarea
      ref={ref}
      className="w-full text-[11px] leading-relaxed bg-transparent resize-none outline-none min-h-[60px] text-white/80 placeholder:text-white/20"
      defaultValue={String(content.text ?? "")}
      placeholder="Type a note..."
      onBlur={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}

function TimelineCardBody({ content }: { content: Record<string, unknown> }) {
  const events = (content.events as Array<{ date: string; text: string }>) ?? []
  return (
    <div className="space-y-1.5">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-2 text-[10px]">
          <span className="text-emerald-400/70 shrink-0 font-mono tabular-nums">{ev.date}</span>
          <span className="text-white/60">{ev.text}</span>
        </div>
      ))}
      {events.length === 0 && (
        <p className="text-[10px] text-white/30">No timeline events extracted yet.</p>
      )}
    </div>
  )
}

function ResearchCardBody({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {Boolean(content.title) && (
        <p className="text-[11px] font-medium text-purple-300/80">{String(content.title)}</p>
      )}
      {Boolean(content.summary) && (
        <p className="text-[10px] leading-relaxed text-white/60">{String(content.summary)}</p>
      )}
      {Boolean(content.citation) && (
        <p className="text-[9px] text-white/30 font-mono">{String(content.citation)}</p>
      )}
    </div>
  )
}

// ── Empty state: animated ghost canvas ────────────────────────────────────

function EmptyCanvasState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-80 h-56">
        {/* Ghost card 1 */}
        <div
          className="ws-ghost-float-1 absolute ws-card-glass rounded-xl ws-ghost-fade"
          style={{ left: 0, top: 24, width: 150, height: 80 }}
        >
          <div className="h-full p-3 space-y-1.5">
            <div className="h-2 rounded-full bg-amber-400/20 w-2/3" />
            <div className="h-1.5 rounded-full bg-white/8 w-full" />
            <div className="h-1.5 rounded-full bg-white/8 w-5/6" />
            <div className="h-1.5 rounded-full bg-white/8 w-3/4" />
          </div>
        </div>
        {/* Ghost bezier arrow */}
        <svg className="absolute inset-0 w-full h-full ws-ghost-fade" overflow="visible">
          <path
            d="M 150 64 C 190 64, 180 90, 200 90"
            fill="none"
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <circle cx={150} cy={64} r={4} fill="#6366f1" fillOpacity={0.5} />
        </svg>
        {/* Ghost card 2 */}
        <div
          className="ws-ghost-float-2 absolute ws-card-glass rounded-xl ws-ghost-fade"
          style={{ right: 0, top: 48, width: 130, height: 72 }}
        >
          <div className="h-full p-3 space-y-1.5">
            <div className="h-2 rounded-full bg-sky-400/20 w-1/2" />
            <div className="h-1.5 rounded-full bg-white/8 w-full" />
            <div className="h-1.5 rounded-full bg-white/8 w-4/5" />
          </div>
        </div>
        {/* Ghost card 3 */}
        <div
          className="ws-ghost-float-3 absolute ws-card-glass rounded-xl ws-ghost-fade"
          style={{ left: 40, bottom: 0, width: 170, height: 60 }}
        >
          <div className="h-full p-3 space-y-1.5">
            <div className="h-2 rounded-full bg-purple-400/20 w-3/4" />
            <div className="h-1.5 rounded-full bg-white/8 w-full" />
          </div>
        </div>

        {/* Hint text */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
          <p className="text-[11px] text-white/30 font-medium">
            Select text in the PDF → it lands here as a card
          </p>
          <p className="text-[10px] text-white/20 mt-0.5">
            Double-click anywhere to add a note
          </p>
        </div>
      </div>
    </div>
  )
}
