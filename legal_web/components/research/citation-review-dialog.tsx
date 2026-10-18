/** @jsxRuntime automatic */
"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import {
  getCitationReviews,
  submitCitationReviewDecision,
  type CitationReviewState,
  type ManualCitationReviewTask,
} from "@/lib/api/citation-reviews"
import type { CitationReviewTask } from "@/lib/api/verification"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AnalyticsEvents } from "@/lib/analytics/events"
import { trackResearchEvent } from "@/lib/analytics/research-events"
import {
  buildCitationReviewDecision,
  citationTaskFailureReasons,
  citationTaskProposition,
  EMPTY_CITATION_REVIEW_FORM,
  findManualCitationTask,
  validateCitationReviewForm,
  type CitationReviewFormValues,
} from "./citation-review-dialog.helpers"

interface CitationReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  outputId?: string
  tenantId?: string | null
  task: CitationReviewTask | null
  onSummaryChange?: (state: CitationReviewState) => void
}

export function CitationReviewTaskDetails({
  task,
  requestedTask,
}: {
  task: ManualCitationReviewTask
  requestedTask?: CitationReviewTask
}) {
  const proposition = citationTaskProposition(task)
  const reasons = citationTaskFailureReasons(task, requestedTask)
  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-3" aria-label="Citation task details">
      {proposition && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposition</p>
          <p className="mt-1 text-sm">{proposition}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citation</p>
        <p className="mt-1 text-sm font-medium">{task.citation}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why review is required</p>
        {reasons.length > 0 ? (
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
            {reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Automated passage support was not established.</p>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Task status: {task.status.replace("-", " ")} · version {task.version} · updated{" "}
        {new Date(task.updatedAt).toLocaleString()}
      </p>
    </section>
  )
}

export function CitationReviewDialog({
  open,
  onOpenChange,
  outputId,
  tenantId,
  task,
  onSummaryChange,
}: CitationReviewDialogProps) {
  const id = useId()
  const [reviewState, setReviewState] = useState<CitationReviewState | null>(null)
  const [form, setForm] = useState<CitationReviewFormValues>(EMPTY_CITATION_REVIEW_FORM)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const reviewStartedAt = useRef<number | null>(null)
  const currentTask = useMemo(
    () => task && reviewState ? findManualCitationTask(reviewState.tasks, task) : undefined,
    [reviewState, task],
  )

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_CITATION_REVIEW_FORM)
    reviewStartedAt.current = Date.now()
    setSuccess(null)
    setError(null)
    if (!outputId || !tenantId || !task) {
      setReviewState(null)
      setError("This research output must be saved before a citation decision can be recorded.")
      return
    }
    let active = true
    setLoading(true)
    void getCitationReviews(outputId, tenantId)
      .then((state) => {
        if (!active) return
        setReviewState(state)
        onSummaryChange?.(state)
        if (!findManualCitationTask(state.tasks, task)) {
          setError("No matching manual citation review task was found for this output.")
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        setReviewState(null)
        setError(cause instanceof Error ? cause.message : "Citation review tasks could not be loaded.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, outputId, tenantId, task, onSummaryChange])

  function update<K extends keyof CitationReviewFormValues>(
    key: K,
    value: CitationReviewFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  async function submit() {
    if (!outputId || !tenantId || !currentTask) return
    const validationError = validateCitationReviewForm(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      // Refresh immediately before deciding so the optimistic version is current.
      const latest = await getCitationReviews(outputId, tenantId)
      const latestTask = task ? findManualCitationTask(latest.tasks, task) : undefined
      if (!latestTask) throw new Error("This citation review task is no longer available.")
      if (!["pending", "in-review"].includes(latestTask.status)) {
        throw new Error("This citation task has already been decided. Review the latest status.")
      }
      const next = await submitCitationReviewDecision(
        outputId,
        latestTask.id,
        tenantId,
        buildCitationReviewDecision(form, latestTask.version),
      )
      setReviewState(next)
      onSummaryChange?.(next)
      const elapsedMs = reviewStartedAt.current
        ? Date.now() - reviewStartedAt.current
        : undefined
      if (form.decision === "REJECT") {
        trackResearchEvent(AnalyticsEvents.RESEARCH_CITATION_REJECTED, {
          aiOutputId: outputId,
          citationTaskId: latestTask.id,
          decision: "REJECT",
          elapsedMs,
        })
      } else {
        trackResearchEvent(AnalyticsEvents.RESEARCH_CITATION_RESOLVED, {
          aiOutputId: outputId,
          citationTaskId: latestTask.id,
          decision: form.decision,
          elapsedMs,
        })
      }
      if (elapsedMs !== undefined) {
        trackResearchEvent(AnalyticsEvents.RESEARCH_LAWYER_DECISION_TIME, {
          aiOutputId: outputId,
          citationTaskId: latestTask.id,
          decision: form.decision,
          elapsedMs,
        })
      }
      setSuccess(
        form.decision === "APPROVE"
          ? "Citation approval recorded."
          : form.decision === "REPLACE"
            ? "Replacement citation recorded."
            : "Citation rejection recorded.",
      )
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The citation decision could not be recorded.")
    } finally {
      setSubmitting(false)
    }
  }

  const evidenceRequired = form.decision !== "REJECT"
  const alreadyDecided = currentTask && !["pending", "in-review"].includes(currentTask.status)

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual citation review</DialogTitle>
          <DialogDescription>
            Record a lawyer decision separately from the automated citation audit. This does not change safe-for-reliance status.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the latest citation task…
          </div>
        ) : currentTask ? (
          <div className="space-y-4">
            <CitationReviewTaskDetails task={currentTask} requestedTask={task ?? undefined} />

            {success ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                <CheckCircle2 className="h-4 w-4" /> {success}
              </div>
            ) : alreadyDecided ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm" role="status">
                This task has already been {currentTask.status}. No further decision can be submitted.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
                <fieldset disabled={submitting} className="space-y-2">
                  <legend className="text-sm font-medium">Decision</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {(["APPROVE", "REJECT", "REPLACE"] as const).map((decision) => (
                      <label key={decision} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input
                          type="radio"
                          name={`${id}-decision`}
                          value={decision}
                          checked={form.decision === decision}
                          onChange={() => update("decision", decision)}
                        />
                        {decision[0]}{decision.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {evidenceRequired && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {form.decision === "REPLACE" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`${id}-replacement`}>Replacement citation</Label>
                        <Input id={`${id}-replacement`} value={form.replacementCitation} onChange={(event) => update("replacementCitation", event.target.value)} required />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-url`}>Source URL</Label>
                      <Input id={`${id}-url`} type="url" value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-document`}>Document reference</Label>
                      <Input id={`${id}-document`} value={form.sourceDocumentReference} onChange={(event) => update("sourceDocumentReference", event.target.value)} placeholder="Document ID, file, or repository reference" />
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-2">Provide either a source URL or a document reference.</p>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`${id}-passage`}>Exact supporting passage</Label>
                      <Textarea id={`${id}-passage`} value={form.exactPassage} onChange={(event) => update("exactPassage", event.target.value)} rows={4} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-pinpoint`}>Pinpoint</Label>
                      <Input id={`${id}-pinpoint`} value={form.pinpoint} onChange={(event) => update("pinpoint", event.target.value)} placeholder="Page, paragraph, or section" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-hash`}>Source SHA-256 hash</Label>
                      <Input id={`${id}-hash`} value={form.sourceHash} onChange={(event) => update("sourceHash", event.target.value)} minLength={64} maxLength={64} spellCheck={false} required />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-note`}>Reviewer note</Label>
                  <Textarea id={`${id}-note`} value={form.reviewerNote} onChange={(event) => update("reviewerNote", event.target.value)} rows={3} required />
                </div>

                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Record decision
                  </Button>
                </DialogFooter>
              </form>
            )}
          </div>
        ) : null}

        {!loading && error && !currentTask && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {success && (
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
