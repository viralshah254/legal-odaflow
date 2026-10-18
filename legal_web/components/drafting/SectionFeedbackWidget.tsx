"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown, X, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  submitSectionFeedback,
  EDIT_CATEGORIES,
  type DraftFeedbackPayload,
  type EditCategory,
} from "@/lib/api/draft-feedback"

interface SectionFeedbackWidgetProps {
  sectionType: string
  documentKind: string
  aiText: string
  /** Current edited text if the lawyer has amended the AI output */
  userText?: string
  jurisdiction?: string
  caseDetails?: string
  knownParties?: string[]
  courtDraftRecordId?: string
  draftSectionV3Id?: string
  draftJobSectionId?: string
  /** Called after user submits feedback */
  onSubmitted?: () => void
  className?: string
}

type WidgetState = "idle" | "thumbs_down_open" | "submitted"

/**
 * Compact thumbs-up / thumbs-down feedback widget for AI-generated sections.
 * Thumbs-down opens a category multi-select before submitting.
 * Feedback is fire-and-forget via the training pipeline API.
 */
export function SectionFeedbackWidget({
  sectionType,
  documentKind,
  aiText,
  userText,
  jurisdiction,
  caseDetails,
  knownParties,
  courtDraftRecordId,
  draftSectionV3Id,
  draftJobSectionId,
  onSubmitted,
  className,
}: SectionFeedbackWidgetProps) {
  const [state, setState] = useState<WidgetState>("idle")
  const [selectedCategories, setSelectedCategories] = useState<EditCategory[]>([])
  const [submitting, setSubmitting] = useState(false)

  const basePayload: Omit<DraftFeedbackPayload, "rating" | "editCategories"> = {
    sectionType,
    documentKind,
    aiText,
    userText: userText && userText !== aiText ? userText : undefined,
    jurisdiction,
    caseDetails,
    knownParties,
    courtDraftRecordId,
    draftSectionV3Id,
    draftJobSectionId,
  }

  async function handleThumbsUp() {
    setSubmitting(true)
    await submitSectionFeedback({ ...basePayload, rating: "accepted" })
    setSubmitting(false)
    setState("submitted")
    onSubmitted?.()
  }

  async function handleThumbsDownSubmit() {
    setSubmitting(true)
    await submitSectionFeedback({
      ...basePayload,
      rating: selectedCategories.length === 0 ? "minor_edit" : "major_edit",
      editCategories: selectedCategories,
    })
    setSubmitting(false)
    setState("submitted")
    onSubmitted?.()
  }

  function toggleCategory(id: EditCategory) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  if (state === "submitted") {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Thanks for the feedback
      </span>
    )
  }

  return (
    <div className={cn("flex items-start gap-1", className)}>
      {state === "idle" && (
        <>
          <span className="text-xs text-muted-foreground mr-1 self-center">Helpful?</span>
          <button
            type="button"
            aria-label="Mark section as helpful"
            disabled={submitting}
            onClick={handleThumbsUp}
            className="rounded p-1 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Mark section as not helpful"
            disabled={submitting}
            onClick={() => setState("thumbs_down_open")}
            className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {state === "thumbs_down_open" && (
        <div className="border rounded-lg p-3 bg-background shadow-sm space-y-3 w-64">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">What was wrong?</p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EDIT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border transition-colors",
                  selectedCategories.includes(cat.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:border-primary/50",
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleThumbsDownSubmit}
            className="w-full flex items-center justify-center gap-1.5 text-xs bg-primary text-primary-foreground rounded px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3 w-3" />
            {submitting ? "Sending…" : "Send feedback"}
          </button>
        </div>
      )}
    </div>
  )
}
