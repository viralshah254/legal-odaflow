/** @jsxRuntime automatic */
"use client"

import { ArrowRight, FileWarning, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  CitationReviewTask,
  ResearchVerificationTasks,
  UnsupportedPropositionTask,
} from "@/lib/api/verification"

interface ResearchVerificationActionsProps {
  tasks: ResearchVerificationTasks
  onResolveCitationTask?: (task: CitationReviewTask) => void
  onReviewUnsupportedProposition?: (task: UnsupportedPropositionTask) => void
}

function citationTaskLabel(task: CitationReviewTask): string {
  switch (task.supportState) {
    case "IDENTITY_ONLY":
      return "Identity matched; passage support not established"
    case "CHECKS_INCOMPLETE":
      return "Required checks incomplete"
    case "NOT_FOUND":
      return "Authority not found"
    case "PASSAGE_SUPPORTED":
      return "Passage supported"
  }
}

export function ResearchVerificationActions({
  tasks,
  onResolveCitationTask,
  onReviewUnsupportedProposition,
}: ResearchVerificationActionsProps) {
  const total = tasks.citationTasks.length + tasks.unsupportedPropositions.length
  if (total === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
        No citation repair tasks or unsupported propositions were reported.
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20" aria-label="Verification tasks">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <p className="font-semibold text-amber-950 dark:text-amber-100">{total} verification task{total === 1 ? "" : "s"}</p>
        <span className="flex items-center gap-1 text-amber-800 dark:text-amber-200">
          <Quote className="h-3.5 w-3.5" />
          {tasks.citationTasks.length} citation task{tasks.citationTasks.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1 text-amber-800 dark:text-amber-200">
          <FileWarning className="h-3.5 w-3.5" />
          {tasks.unsupportedPropositions.length} unsupported proposition{tasks.unsupportedPropositions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {tasks.citationTasks.map((task) => (
          <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-background/80 px-2.5 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{task.citation}</p>
              <p className="text-muted-foreground">{citationTaskLabel(task)}</p>
            </div>
            {onResolveCitationTask && (
              <Button type="button" size="sm" variant="outline" onClick={() => onResolveCitationTask(task)}>
                Resolve <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {tasks.unsupportedPropositions.map((task) => (
          <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-background/80 px-2.5 py-2 text-xs">
            <p className="min-w-0 flex-1 line-clamp-2">{task.proposition}</p>
            {onReviewUnsupportedProposition && (
              <Button type="button" size="sm" variant="outline" onClick={() => onReviewUnsupportedProposition(task)}>
                Review <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
