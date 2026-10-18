"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api/client"
import { Sparkles, Search, FileText, BookOpen, Clock, Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TextSelection {
  quote: string
  startOffset: number
  endOffset: number
  page: number
  rect: DOMRect
}

interface AiToolbarProps {
  selection: TextSelection | null
  workspaceId: string
  documentId: string
  matterId?: string
  onHighlight: (selection: TextSelection, color: string) => void
  onAddNote: (selection: TextSelection, text: string) => void
  onAddToCanvas: (annotationId: string) => void
  onClose: () => void
  tenantId?: string
}

type ActionId = "highlight" | "rewrite" | "research" | "compare" | "review" | "timeline"

const COLORS = [
  { value: "#FDE68A", label: "Yellow" },
  { value: "#BBF7D0", label: "Green" },
  { value: "#BAE6FD", label: "Blue" },
  { value: "#FECACA", label: "Red" },
]

/**
 * Floating AI toolbar that appears above a text selection in the PDF pane.
 * Wires to existing /ai/inline-edit, /ai/research, /firm-memory/clause-compare, and /ai/document-review endpoints.
 */
export function AiSelectionToolbar({
  selection,
  workspaceId,
  documentId,
  matterId,
  onHighlight,
  onAddNote,
  onAddToCanvas,
  onClose,
  tenantId,
}: AiToolbarProps) {
  const [activeAction, setActiveAction] = useState<ActionId | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ text: string; label: string } | null>(null)
  const [customInstruction, setCustomInstruction] = useState("")
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value)

  const reset = useCallback(() => {
    setActiveAction(null)
    setResult(null)
    setCustomInstruction("")
  }, [])

  const handleHighlight = useCallback(() => {
    if (!selection) return
    onHighlight(selection, selectedColor)
    onClose()
  }, [selection, selectedColor, onHighlight, onClose])

  const runRewrite = useCallback(async () => {
    if (!selection) return
    setLoading(true)
    try {
      const data = await apiFetch<{ proposed: string }>("/ai/inline-edit", {
        method: "POST",
        body: JSON.stringify({
          selectedText: selection.quote,
          instruction: customInstruction || "Strengthen and improve legal precision",
          documentId,
          workspaceId,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          matterId,
        }),
      })
      setResult({ text: data.proposed, label: "Proposed rewrite" })
    } finally {
      setLoading(false)
    }
  }, [selection, customInstruction, documentId, workspaceId, matterId])

  const runResearch = useCallback(async () => {
    if (!selection) return
    setLoading(true)
    try {
      const data = await apiFetch<{ memo?: string; summary?: string }>("/ai/research", {
        method: "POST",
        body: JSON.stringify({
          query: selection.quote,
          priorContext: selection.quote,
          matterId,
          mode: "quick",
          jurisdiction: undefined,
        }),
      })
      setResult({ text: data.memo ?? data.summary ?? "Research complete.", label: "Research result" })
    } finally {
      setLoading(false)
    }
  }, [selection, matterId])

  const runCompare = useCallback(async () => {
    if (!selection) return
    setLoading(true)
    try {
      const data = await apiFetch<{ comparison?: string; verdict?: string; firmPrecedents?: unknown[] }>(
        "/firm-memory/clause-compare",
        {
          method: "POST",
          body: JSON.stringify({ clauseText: selection.quote }),
        },
      )
      const text = data.verdict ?? JSON.stringify(data.comparison ?? data.firmPrecedents ?? "No comparison available.", null, 2)
      setResult({ text, label: "Firm precedent comparison" })
    } finally {
      setLoading(false)
    }
  }, [selection])

  const runReview = useCallback(async () => {
    if (!selection) return
    setLoading(true)
    try {
      const data = await apiFetch<{ keyClauses?: unknown[]; amendments?: unknown[]; risks?: string }>(
        "/ai/document-review",
        {
          method: "POST",
          body: JSON.stringify({ text: selection.quote }),
        },
      )
      const summary = data.risks ?? (data.amendments as { reason?: string }[])?.[0]?.reason ?? "Review complete."
      setResult({ text: summary, label: "Clause review" })
    } finally {
      setLoading(false)
    }
  }, [selection])

  const runTimeline = useCallback(async () => {
    if (!selection) return
    setLoading(true)
    try {
      const data = await apiFetch<{ proposed: string }>("/ai/inline-edit", {
        method: "POST",
        body: JSON.stringify({
          selectedText: selection.quote,
          instruction:
            "Extract all dates and events from this text as a JSON array of {date, text} objects. Return only valid JSON.",
        }),
      })
      setResult({ text: data.proposed, label: "Extracted timeline" })
    } finally {
      setLoading(false)
    }
  }, [selection])

  const acceptResult = useCallback(() => {
    if (!result || !selection) return
    onAddNote(selection, result.text)
    reset()
    onClose()
  }, [result, selection, onAddNote, reset, onClose])

  if (!selection) return null

  const actions: Array<{ id: ActionId; label: string; icon: React.ReactNode; run: () => void }> = [
    { id: "rewrite", label: "Rewrite", icon: <Sparkles className="h-3 w-3" />, run: runRewrite },
    { id: "research", label: "Research", icon: <Search className="h-3 w-3" />, run: runResearch },
    { id: "compare", label: "Compare", icon: <BookOpen className="h-3 w-3" />, run: runCompare },
    { id: "review", label: "Review", icon: <FileText className="h-3 w-3" />, run: runReview },
    { id: "timeline", label: "Timeline", icon: <Clock className="h-3 w-3" />, run: runTimeline },
  ]

  return (
    <div
      className={cn(
        "absolute z-30 bg-background border rounded-xl shadow-xl p-2 w-[min(calc(100vw-2rem),380px)] min-w-0",
        "animate-in fade-in-0 zoom-in-95 duration-100",
      )}
      style={{
        left: Math.max(
          16,
          Math.min(
            selection.rect.left,
            typeof window !== "undefined" ? window.innerWidth - Math.min(window.innerWidth - 32, 380) - 16 : 0,
          ),
        ),
        top: Math.max(8, selection.rect.top - 8),
        transform: "translateY(-100%)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Color picker + highlight button */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c.value}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-transform",
                selectedColor === c.value ? "border-foreground scale-110" : "border-transparent",
              )}
              style={{ background: c.value }}
              onClick={() => setSelectedColor(c.value)}
              title={c.label}
            />
          ))}
        </div>
        <Button size="sm" variant="secondary" className="h-6 text-xs px-2" onClick={handleHighlight}>
          Highlight
        </Button>
        <div className="flex-1" />
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quoted text preview */}
      <p className="text-xs italic text-muted-foreground mb-2 line-clamp-2 border-l-2 border-muted pl-2">
        &ldquo;{selection.quote.slice(0, 120)}{selection.quote.length > 120 ? "…" : ""}&rdquo;
      </p>

      {/* AI action buttons */}
      {!activeAction && !result && (
        <div className="flex flex-wrap gap-1">
          {actions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 gap-1"
              onClick={() => {
                setActiveAction(action.id)
                action.run()
              }}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Custom instruction for rewrite */}
      {activeAction === "rewrite" && !loading && !result && (
        <div className="space-y-1.5">
          <Textarea
            placeholder="Instruction (e.g. 'Strengthen this clause')"
            className="text-xs h-16 resize-none"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-xs px-2" onClick={runRewrite}>
              Run
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Running AI action...
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <Badge variant="outline" className="text-[10px]">{result.label}</Badge>
          <p className="text-xs leading-relaxed text-foreground/80 max-h-32 overflow-y-auto whitespace-pre-wrap">
            {result.text}
          </p>
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-xs px-2 gap-1" onClick={acceptResult}>
              <Check className="h-3 w-3" />
              Add to canvas
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={reset}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
