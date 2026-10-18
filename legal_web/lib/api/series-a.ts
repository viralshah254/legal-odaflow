import { apiFetch } from "./client"

export interface EvidenceItem {
  id: string
  tenantId: string
  matterId: string
  title: string
  description?: string | null
  documentId?: string | null
  chainOfCustody?: unknown
  createdAt: string
  updatedAt: string
  custodyLogs?: Array<{
    id: string
    evidenceId: string
    action: string
    actorId: string
    createdAt: string
  }>
}

export interface BulkDiligenceJob {
  id: string
  tenantId: string
  matterId: string
  documentIds: string[]
  status: string
  summaryMatrix?: Array<{
    documentId: string
    fileName?: string
    summary: string
    risks: string[]
    citations?: BulkReviewCitation[]
    confidence?: number
    status?: "COMPLETED" | "PARTIAL" | "NO_TEXT" | "FAILED"
    coverage?: {
      charactersAvailable: number
      charactersAnalyzed: number
      chunksTotal: number
      chunksAnalyzed: number
      complete: boolean
      warnings: string[]
    }
  }> | null
  matterSynthesis?: {
    executiveSummary: string
    chronology: Array<{
      date: string
      event: string
      citations: BulkReviewCitation[]
      confidence: number
    }>
    missingItems: Array<{
      item: string
      reason: string
      citations: BulkReviewCitation[]
      confidence: number
    }>
    contradictions: Array<{
      description: string
      citations: BulkReviewCitation[]
      confidence: number
    }>
    recommendedActions: Array<{
      action: string
      priority: "HIGH" | "MEDIUM" | "LOW"
      citations: BulkReviewCitation[]
    }>
    citations: BulkReviewCitation[]
    confidence: number
  }
  coverageWarnings?: string[]
  createdBy: string
  createdAt: string
  completedAt?: string | null
}

export interface BulkReviewCitation {
  documentId: string
  fileName?: string
  chunk?: number
  characterRange?: { start: number; end: number }
  note?: string
}

export interface SuggestedTimeEntry {
  id: string
  tenantId: string
  userId: string
  matterId?: string | null
  source: string
  minutes: number
  narrative?: string | null
  status: string
  createdAt: string
}

export interface EthicalWallGroup {
  id: string
  tenantId: string
  name: string
  matterIds: string[]
  userIds: string[]
  createdAt: string
  updatedAt: string
}

export async function listEvidence(
  tenantId: string,
  matterId: string,
): Promise<EvidenceItem[]> {
  return apiFetch<EvidenceItem[]>(`/evidence/matters/${matterId}`, { tenantId })
}

export async function createEvidence(
  tenantId: string,
  matterId: string,
  data: { title: string; description?: string; documentId?: string },
): Promise<EvidenceItem> {
  return apiFetch<EvidenceItem>(`/evidence/matters/${matterId}`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listDiligenceJobs(
  tenantId: string,
  matterId: string,
): Promise<BulkDiligenceJob[]> {
  return apiFetch<BulkDiligenceJob[]>(`/matters/${matterId}/diligence`, { tenantId })
}

export async function createBulkDiligenceReview(
  tenantId: string,
  matterId: string,
  documentIds: string[],
): Promise<BulkDiligenceJob> {
  return apiFetch<BulkDiligenceJob>(`/matters/${matterId}/diligence`, {
    method: "POST",
    tenantId,
    body: { documentIds },
  })
}

export async function listSuggestedTime(
  tenantId: string,
): Promise<SuggestedTimeEntry[]> {
  return apiFetch<SuggestedTimeEntry[]>("/time/suggestions", { tenantId })
}

export async function suggestTime(
  tenantId: string,
  data: {
    matterId?: string
    source: string
    minutes: number
    narrative?: string
  },
): Promise<SuggestedTimeEntry> {
  return apiFetch<SuggestedTimeEntry>("/time/suggestions", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function acceptSuggestedTime(
  tenantId: string,
  suggestionId: string,
): Promise<{ suggestion: SuggestedTimeEntry; entry: unknown }> {
  return apiFetch(`/time/suggestions/${suggestionId}/accept`, {
    method: "PATCH",
    tenantId,
  })
}

export async function dismissSuggestedTime(
  tenantId: string,
  suggestionId: string,
): Promise<SuggestedTimeEntry> {
  return apiFetch<SuggestedTimeEntry>(`/time/suggestions/${suggestionId}/dismiss`, {
    method: "PATCH",
    tenantId,
  })
}

export async function listEthicalWalls(
  tenantId: string,
): Promise<EthicalWallGroup[]> {
  return apiFetch<EthicalWallGroup[]>("/ethical-walls", { tenantId })
}

export async function createEthicalWall(
  tenantId: string,
  data: { name: string; matterIds: string[]; userIds: string[] },
): Promise<EthicalWallGroup> {
  return apiFetch<EthicalWallGroup>("/ethical-walls", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function deleteEthicalWall(
  tenantId: string,
  wallId: string,
): Promise<void> {
  await apiFetch(`/ethical-walls/${wallId}`, {
    method: "DELETE",
    tenantId,
  })
}
