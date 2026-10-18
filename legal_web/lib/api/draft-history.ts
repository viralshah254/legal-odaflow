import { apiFetch } from "./client"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"

export interface DraftHistoryItem {
  id: string
  title: string
  preview: string
  kind: string
  label?: string | null
  countryCode: string
  category?: string | null
  source: string
  creditsUsed: number
  requiresLawyerReview: boolean
  verificationStatus?: string
  createdAt: string
  updatedAt: string
}

export interface CourtDraftRecordFull extends DraftHistoryItem {
  subtitle?: string | null
  jurisdiction?: string | null
  language: string
  caseDetails?: string | null
  clientName?: string | null
  courtName?: string | null
  opposingParty?: string | null
  draftText: string
  verificationAudit?: DraftVerificationAudit | null
  clientId?: string | null
  matterId?: string | null
  linkedClientName?: string | null
}

export async function getDraftHistory(
  tenantId?: string,
  params?: { countryCode?: string; kind?: string; limit?: number },
): Promise<DraftHistoryItem[]> {
  const qs = new URLSearchParams()
  if (params?.countryCode) qs.set("countryCode", params.countryCode)
  if (params?.kind) qs.set("kind", params.kind)
  if (params?.limit) qs.set("limit", String(params.limit))
  const query = qs.toString()
  return apiFetch<DraftHistoryItem[]>(`/ai/drafts/history${query ? `?${query}` : ""}`, {
    tenantId,
  })
}

export async function getDraftById(
  id: string,
  tenantId?: string,
): Promise<CourtDraftRecordFull> {
  return apiFetch<CourtDraftRecordFull>(`/ai/drafts/${id}`, { tenantId })
}

export async function updateSavedDraft(
  id: string,
  payload: { draftText: string; expectedRevision?: number },
  tenantId?: string,
): Promise<DraftHistoryItem> {
  return apiFetch<DraftHistoryItem>(`/ai/drafts/${id}`, {
    method: "PATCH",
    tenantId,
    body: payload,
  })
}
