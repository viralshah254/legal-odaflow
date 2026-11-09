import { apiFetch } from './client'

export type KnowledgeStatus = 'PENDING' | 'INDEXING' | 'APPROVED' | 'INDEX_FAILED' | 'REJECTED' | 'REVOKED'
export interface FirmKnowledgeItem {
  id: string
  tenantId: string
  title: string
  matterId: string | null
  documentId: string | null
  createdById: string
  lastEditedById: string
  sourceType: string
  sourceId: string
  contentHash: string
  revision: number
  status: KnowledgeStatus
  rightsBasis: string
  rightsExpired?: boolean
  rightsExpiresAt: string | null
  updatedAt: string
}
export interface FirmKnowledgeDetail extends FirmKnowledgeItem {
  content: string
  rightsExpired: boolean
  reviews: Array<{ id: string; decision: string; revision: number; createdAt: string; note?: string | null }>
}
export interface FirmKnowledgeList {
  items: FirmKnowledgeItem[]
  count: number
  limit: number
  canReview: boolean
  canSubmit: boolean
  independentReviewRequired: boolean
}
export interface FirmKnowledgeSubmission {
  sourceType: string
  sourceId: string
  title: string
  content: string
  matterId?: string
  documentId?: string
  rightsBasis: string
  rightsConfirmed: boolean
  rightsExpiresAt?: string
}
export const listFirmKnowledge = (tenantId: string) => apiFetch<FirmKnowledgeList>('/firm-memory/items', { tenantId })
export const getFirmKnowledge = (tenantId: string, id: string) => apiFetch<FirmKnowledgeDetail>(`/firm-memory/items/${encodeURIComponent(id)}`, { tenantId })
export const submitFirmKnowledge = (tenantId: string, body: FirmKnowledgeSubmission) => apiFetch<FirmKnowledgeItem>('/firm-memory/ingest', { tenantId, method: 'POST', body })
export const reviewFirmKnowledge = (tenantId: string, item: FirmKnowledgeItem, decision: 'approve' | 'reject' | 'revoke', confirmations: { selfReviewConfirmed?: boolean; firmWideConfirmed?: boolean; note?: string }) =>
  apiFetch<FirmKnowledgeItem>(`/firm-memory/items/${encodeURIComponent(item.id)}/${decision}`, { tenantId, method: 'POST', body: { expectedRevision: item.revision, expectedContentHash: item.contentHash, ...confirmations } })
