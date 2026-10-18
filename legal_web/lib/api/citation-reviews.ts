import { apiFetch } from "./client"

export type CitationReviewDecision = "APPROVE" | "REJECT" | "REPLACE"
export type CitationReviewStatus =
  | "pending"
  | "in-review"
  | "approved"
  | "rejected"
  | "replaced"

export interface ManualCitationReviewTask {
  id: string
  tenantId: string
  aiOutputId: string
  matterId?: string | null
  citationKey: string
  citation: string
  claim?: string | null
  auditEntry: Record<string, unknown>
  status: CitationReviewStatus
  version: number
  createdAt: string
  updatedAt: string
}

export interface ManualCitationReview {
  id: string
  taskId: string
  tenantId: string
  aiOutputId: string
  reviewerId: string
  decision: CitationReviewDecision
  reviewerNote: string
  sourceUrl?: string | null
  sourceDocumentReference?: string | null
  sourceHash?: string | null
  exactPassage?: string | null
  pinpoint?: string | null
  evidenceKind?: "PASSAGE" | "IDENTITY_ONLY" | null
  replacementCitation?: string | null
  reviewedAt: string
}

export interface CitationReviewSummary {
  total: number
  pending: number
  inReview: number
  approved: number
  rejected: number
  replaced: number
  decided: number
  complete: boolean
  automatedCitationAuditUnchanged: true
  safeForRelianceUnchanged: true
}

export interface CitationReviewState {
  tasks: ManualCitationReviewTask[]
  reviews: ManualCitationReview[]
  summary: CitationReviewSummary
}

export interface SubmitCitationReviewDecision {
  decision: CitationReviewDecision
  reviewerNote: string
  expectedVersion: number
  sourceUrl?: string
  sourceDocumentReference?: string
  sourceHash?: string
  exactPassage?: string
  pinpoint?: string
  evidenceKind?: "PASSAGE"
  replacementCitation?: string
}

export function getCitationReviews(
  outputId: string,
  tenantId: string,
): Promise<CitationReviewState> {
  return apiFetch(`/ai/research/${outputId}/citation-reviews`, { tenantId })
}

export function submitCitationReviewDecision(
  outputId: string,
  taskId: string,
  tenantId: string,
  input: SubmitCitationReviewDecision,
): Promise<CitationReviewState> {
  return apiFetch(
    `/ai/research/${outputId}/citation-reviews/${taskId}/decision`,
    {
      method: "POST",
      tenantId,
      body: input,
    },
  )
}
