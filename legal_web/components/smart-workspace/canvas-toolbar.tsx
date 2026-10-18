"use client"

import { useEffect, useRef } from "react"
import { MousePointer2, Pen, ArrowUpRight, StickyNote, Eraser } from "lucide-react"
import { cn } from "@/lib/utils"

export type CanvasMode = "select" | "draw" | "arrow" | "note" | "erase"

const INK_COLORS = [
  { value: "#FF3B5C", label: "Red" },
  { value: "#F97316", label: "Orange" },
  { value: "#38BDF8", label: "Blue" },
  { value: "#A78BFA", label: "Purple" },
  { value: "#34D399", label: "Green" },
  { value: "#F8FAFC", label: "White" },
]

const MODES: { id: CanvasMode; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: "select", icon: <MousePointer2 className="h-3.5 w-3.5" />, label: "Select", shortcut: "V" },
  { id: "draw",   icon: <Pen className="h-3.5 w-3.5" />,           label: "Pen",    shortcut: "P" },
  { id: "arrow",  icon: <ArrowUpRight className="h-3.5 w-3.5" />,  label: "Arrow",  shortcut: "A" },
  { id: "note",   icon: <StickyNote className="h-3.5 w-3.5" />,    label: "Note",   shortcut: "N" },
  { id: "erase",  icon: <Eraser className="h-3.5 w-3.5" />,        label: "Erase",  shortcut: "E" },
]

interface CanvasToolbarProps {
  mode: CanvasMode
  inkColor: string
  onModeChange: (mode: CanvasMode) => void
  onInkColorChange: (color: string) => void
}

export function CanvasToolbar({ mode, inkColor, onModeChange, onInkColorChange }: CanvasToolbarProps) {
  const activeIdx = MODES.findIndex((m) => m.id === mode)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Slide indicator to active button
  useEffect(() => {
    const btn = btnRefs.current[activeIdx]
    const indicator = indicatorRef.current
    if (!btn || !indicator) return
    const parent = btn.offsetParent as HTMLElement
    if (!parent) return
    indicator.style.left = `${btn.offsetLeft}px`
    indicator.style.width = `${btn.offsetWidth}px`
  }, [activeIdx])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.target as Element)?.tagName === "TEXTAREA") return
      if ((e.target as Element)?.tagName === "INPUT") return
      const found = MODES.find((m) => m.shortcut.toLowerCase() === e.key.toLowerCase())
      if (found) onModeChange(found.id)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onModeChange])

  return (
    <div
      className="ws-toolbar-pill ws-toolbar-slide-in absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-2xl px-1.5 py-1.5 flex flex-col gap-1.5 select-none"
      style={{ pointerEvents: "all" }}
    >
      {/* Mode buttons */}
      <div className="relative flex items-center gap-0.5">
        {/* Sliding active indicator */}
        <div
          ref={indicatorRef}
          className="absolute h-full rounded-xl bg-white/10 border border-white/15 transition-all duration-200 ease-out pointer-events-none"
          style={{ left: 0, width: 0 }}
        />

        {MODES.map((m, i) => (
          <button
            key={m.id}
            ref={(el) => { btnRefs.current[i] = el }}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors duration-150",
              mode === m.id
                ? "text-white"
                : "text-white/40 hover:text-white/70",
            )}
            onClick={() => onModeChange(m.id)}
            title={`${m.label} (${m.shortcut})`}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
            <span className="hidden group-hover:inline absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-white/30 bg-black/40 px-1 rounded">
              {m.shortcut}
            </span>
          </button>
        ))}
      </div>

      {/* Color picker row — only shown in draw/arrow mode */}
      {(mode === "draw" || mode === "arrow") && (
        <div className="flex items-center justify-center gap-1.5 px-1 pb-0.5">
          {INK_COLORS.map((c) => (
            <button
              key={c.value}
              className={cn(
                "h-4 w-4 rounded-full transition-transform duration-150 hover:scale-125",
                inkColor === c.value && "ring-2 ring-white/60 scale-125",
              )}
              style={{ background: c.value }}
              title={c.label}
              onClick={() => onInkColorChange(c.value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
