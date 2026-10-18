"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api/client"
import {
  Sparkles,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineAiEditResult {
  original: string
  proposed: string
  instruction: string
}

interface InlineAiBubbleProps {
  /** The editor's root element ref — used to detect selection. */
  editorRef: React.RefObject<HTMLElement | null>
  tenantId?: string
  /** Called with the proposed text when user accepts. */
  onAccept: (original: string, proposed: string) => void
  className?: string
}

const PRESET_INSTRUCTIONS = [
  "Make it more concise",
  "Improve legal precision",
  "Simplify for client",
  "Add indemnity clause",
  "Strengthen this clause",
]

/**
 * Floating AI bubble that appears when text is selected inside the editor.
 * Shows a prompt input + preset chips; on submit sends selection + instruction
 * to the backend and shows a diff with accept / reject controls.
 */
export function InlineAiBubble({
  editorRef,
  tenantId,
  onAccept,
  className,
}: InlineAiBubbleProps) {
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [instruction, setInstruction] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<InlineAiEditResult | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      // Don't immediately hide — user may be clicking into the bubble
      return
    }
    const range = selection.getRangeAt(0)
    const text = selection.toString().trim()
    if (!text || !editorRef.current?.contains(range.commonAncestorContainer)) {
      setBubble(null)
      setSelectedText("")
      return
    }

    const rect = range.getBoundingClientRect()
    const editorRect = editorRef.current.getBoundingClientRect()
    setBubble({
      top: rect.top - editorRect.top - 8,
      left: Math.max(0, rect.left - editorRect.left),
    })
    setSelectedText(text)
    setResult(null)
    setInstruction("")
  }, [editorRef])

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [handleSelectionChange])

  const dismiss = () => {
    setBubble(null)
    setSelectedText("")
    setResult(null)
    setInstruction("")
    setShowPresets(false)
  }

  const runEdit = async (inst?: string) => {
    const finalInstruction = (inst ?? instruction).trim()
    if (!finalInstruction || !selectedText) return
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch<{ proposed: string }>(
        "/ai/inline-edit",
        {
          method: "POST",
          tenantId,
          body: {
            selectedText,
            instruction: finalInstruction,
          },
        },
      )
      setResult({
        original: selectedText,
        proposed: res.proposed,
        instruction: finalInstruction,
      })
    } catch {
      // Silently collapse — keep bubble open for retry
    } finally {
      setLoading(false)
    }
  }

  const accept = () => {
    if (!result) return
    onAccept(result.original, result.proposed)
    dismiss()
  }

  if (!bubble) return null

  return (
    <div
      ref={bubbleRef}
      style={{ top: bubble.top, left: bubble.left }}
      className={cn(
        "absolute z-50 w-80 rounded-xl border bg-popover shadow-lg shadow-black/10 p-3 space-y-2.5",
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center">
          <Wand2 className="h-3 w-3 text-primary" />
        </div>
        <span className="text-xs font-semibold text-primary">Ask Umbrella</span>
        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
          {selectedText.length} chars
        </Badge>
        <button
          type="button"
          onClick={dismiss}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {!result ? (
        <>
          {/* Instruction input */}
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void runEdit()
              }
            }}
            placeholder="Describe how to edit this text…"
            rows={2}
            className="text-xs resize-none"
            autoFocus
          />

          {/* Preset chips */}
          <div className="space-y-1.5">
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowPresets((s) => !s)}
            >
              {showPresets ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Quick edits
            </button>
            {showPresets && (
              <div className="flex flex-wrap gap-1">
                {PRESET_INSTRUCTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setInstruction(p)
                      void runEdit(p)
                    }}
                    className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            disabled={!instruction.trim() || loading}
            onClick={() => void runEdit()}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? "Generating…" : "Suggest edit"}
          </Button>
        </>
      ) : (
        <>
          {/* Diff view */}
          <div className="space-y-2">
            <div className="rounded-md bg-red-500/5 border border-red-200/50 p-2">
              <p className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1">Original</p>
              <p className="text-xs text-muted-foreground line-clamp-3">{result.original}</p>
            </div>
            <div className="rounded-md bg-green-500/5 border border-green-200/50 p-2">
              <p className="text-[10px] font-medium text-green-600 dark:text-green-400 mb-1">Proposed</p>
              <p className="text-xs">{result.proposed}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={accept}
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => setResult(null)}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
