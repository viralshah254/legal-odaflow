import type {
  CitationReviewDecision,
  CitationReviewState,
  ManualCitationReviewTask,
  SubmitCitationReviewDecision,
} from "@/lib/api/citation-reviews"
import type {
  CitationReviewTask,
  ManualReviewState,
} from "@/lib/api/verification"

export interface CitationReviewFormValues {
  decision: CitationReviewDecision
  reviewerNote: string
  sourceUrl: string
  sourceDocumentReference: string
  sourceHash: string
  exactPassage: string
  pinpoint: string
  replacementCitation: string
}

export const EMPTY_CITATION_REVIEW_FORM: CitationReviewFormValues = {
  decision: "APPROVE",
  reviewerNote: "",
  sourceUrl: "",
  sourceDocumentReference: "",
  sourceHash: "",
  exactPassage: "",
  pinpoint: "",
  replacementCitation: "",
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function findManualCitationTask(
  tasks: ManualCitationReviewTask[],
  requestedTask: CitationReviewTask,
): ManualCitationReviewTask | undefined {
  const authorityMatch = requestedTask.authorityId
    ? tasks.find(
        (task) =>
          stringValue(task.auditEntry.authorityId) === requestedTask.authorityId &&
          task.citation === requestedTask.citation,
      )
    : undefined
  return authorityMatch ?? tasks.find((task) => task.citation === requestedTask.citation)
}

export function citationTaskProposition(
  task: ManualCitationReviewTask,
): string | undefined {
  return (
    stringValue(task.claim) ??
    stringValue(task.auditEntry.claim) ??
    stringValue(task.auditEntry.proposition) ??
    stringValue(task.auditEntry.propositionActuallyDecided)
  )
}

export function citationTaskFailureReasons(
  task: ManualCitationReviewTask,
  requestedTask?: CitationReviewTask,
): string[] {
  const auditReasons = [
    ...(Array.isArray(task.auditEntry.reasons) ? task.auditEntry.reasons : []),
    ...(Array.isArray(task.auditEntry.missingReasons)
      ? task.auditEntry.missingReasons
      : []),
    ...(Array.isArray(task.auditEntry.checks)
      ? task.auditEntry.checks.flatMap((check) => {
          if (!check || typeof check !== "object") return []
          const item = check as Record<string, unknown>
          return item.state === "PASS" ? [] : [item.reason]
        })
      : []),
    ...(requestedTask?.reasons ?? []),
  ]
  return auditReasons
    .map(stringValue)
    .filter((reason): reason is string => Boolean(reason))
    .filter((reason, index, all) => all.indexOf(reason) === index)
}

export function validateCitationReviewForm(
  values: CitationReviewFormValues,
): string | null {
  if (values.reviewerNote.trim().length < 2) {
    return "Enter a reviewer note of at least 2 characters."
  }
  if (values.decision === "REJECT") return null
  if (!values.sourceUrl.trim() && !values.sourceDocumentReference.trim()) {
    return "Enter a source URL or document reference."
  }
  if (values.exactPassage.trim().length < 12) {
    return "Enter the exact supporting passage (at least 12 characters)."
  }
  if (!values.pinpoint.trim()) return "Enter a pinpoint reference."
  if (!/^[a-f0-9]{64}$/i.test(values.sourceHash.trim())) {
    return "Enter the source’s 64-character SHA-256 hash."
  }
  if (
    values.decision === "REPLACE" &&
    values.replacementCitation.trim().length < 3
  ) {
    return "Enter the replacement citation."
  }
  return null
}

export function buildCitationReviewDecision(
  values: CitationReviewFormValues,
  expectedVersion: number,
): SubmitCitationReviewDecision {
  const base = {
    decision: values.decision,
    reviewerNote: values.reviewerNote.trim(),
    expectedVersion,
  } as const
  if (values.decision === "REJECT") return base
  return {
    ...base,
    sourceUrl: values.sourceUrl.trim() || undefined,
    sourceDocumentReference:
      values.sourceDocumentReference.trim() || undefined,
    sourceHash: values.sourceHash.trim().toLowerCase(),
    exactPassage: values.exactPassage.trim(),
    pinpoint: values.pinpoint.trim(),
    evidenceKind: "PASSAGE",
    replacementCitation:
      values.decision === "REPLACE"
        ? values.replacementCitation.trim()
        : undefined,
  }
}

export function manualReviewStateFromCitationReviews(
  state: CitationReviewState,
): ManualReviewState {
  const latestReview = state.reviews.at(-1)
  if (state.summary.total === 0) return { status: "NOT_REVIEWED" }
  if (state.summary.rejected > 0) {
    return {
      status: "CHANGES_REQUESTED",
      reviewedAt: latestReview?.reviewedAt,
      note: latestReview?.reviewerNote,
    }
  }
  if (state.summary.complete) {
    return {
      status: "APPROVED",
      reviewedAt: latestReview?.reviewedAt,
      note: latestReview?.reviewerNote,
    }
  }
  if (state.summary.decided > 0 || state.summary.inReview > 0) {
    return {
      status: "IN_REVIEW",
      reviewedAt: latestReview?.reviewedAt,
      note: latestReview?.reviewerNote,
    }
  }
  return { status: "NOT_REVIEWED" }
}
