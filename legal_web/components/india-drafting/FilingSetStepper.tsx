"use client"

import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DraftSetItem, DraftSetState } from "@/lib/drafting/draft-navigation"

interface FilingSetStepperProps {
  draftSet: DraftSetState
  loading: boolean
  currentDraftReady: boolean
  onNavigateToIndex: (index: number) => void
  onPrevious: () => void
  onNext: () => void
}

export function FilingSetStepper({
  draftSet,
  loading,
  currentDraftReady,
  onNavigateToIndex,
  onPrevious,
  onNext,
}: FilingSetStepperProps) {
  const { items, currentIndex } = draftSet
  const canGoPrevious = currentIndex > 0 && !loading
  const canGoNext =
    !loading && currentDraftReady && currentIndex < items.length - 1

  const pillLabel = (item: DraftSetItem, index: number) => {
    if (item.status === "done") return "Ready"
    if (item.status === "needs_confirm") return "Confirm"
    if (item.status === "blocked") return "Blocked"
    if (item.status === "generating" || (index === currentIndex && loading)) return "Generating…"
    if (item.status === "error") return "Error"
    return "Not started"
  }

  return (
    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/30 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
          Filing set · {currentIndex + 1} of {items.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 h-8"
            disabled={!canGoPrevious}
            onClick={onPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1 h-8"
            disabled={!canGoNext}
            title={
              loading
                ? "Finish generating this document before continuing"
                : !currentDraftReady
                  ? "Generate the current document first"
                  : undefined
            }
            onClick={onNext}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => {
          const isCurrent = index === currentIndex
          const isDone = item.status === "done" && Boolean(item.draftId)
          const isBlocked = item.status === "blocked"
          const needsConfirm = item.status === "needs_confirm"
          const isGenerating = item.status === "generating" || (isCurrent && loading)
          const isForward = index > currentIndex
          const clickable =
            (isDone || isBlocked || needsConfirm) && Boolean(item.draftId) && !loading
          const disabled = loading && (isForward || (isCurrent && !isDone && !isBlocked && !needsConfirm))

          return (
            <button
              key={`${item.kind}-${index}`}
              type="button"
              disabled={!clickable || disabled}
              onClick={() => {
                if (clickable && !disabled) onNavigateToIndex(index)
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                isCurrent
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : isDone
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                    : isBlocked
                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                      : needsConfirm
                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                        : "border-indigo-200 bg-white/60 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300",
                !clickable && !isCurrent && "opacity-70 cursor-default",
                clickable && !disabled && "cursor-pointer",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {isDone ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : isGenerating ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <span className="h-3 w-3 shrink-0 rounded-full border border-current opacity-50" />
              )}
              <span className="truncate max-w-[140px]">{item.label}</span>
              <span className={cn("opacity-70 hidden sm:inline", isCurrent && "opacity-90")}>
                · {pillLabel(item, index)}
              </span>
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
          Finish generating this document before continuing to the next in the set.
        </p>
      )}
    </div>
  )
}
