import { apiFetch } from "./client"

export interface PendingAiReviewItem {
  id: string
  taskType: string
  mode: string
  title: string
  preview: string
  outputMarkdown: string
  matterId: string | null
  matterTitle: string | null
  riskLevel: string | null
  jurisdiction: string | null
  legalDomain: string | null
  verified: boolean
  createdAt: string
  authorName: string | null
  authorEmail: string | null
}

export async function listAiReviewQueue(
  tenantId?: string,
  limit = 50,
): Promise<PendingAiReviewItem[]> {
  const items = await apiFetch<PendingAiReviewItem[]>(
    `/ai/review-queue?limit=${limit}`,
    { tenantId },
  )
  return Array.isArray(items) ? items : []
}

export async function getAiReviewItem(
  outputId: string,
  tenantId?: string,
): Promise<PendingAiReviewItem> {
  return apiFetch<PendingAiReviewItem>(`/ai/review-queue/${outputId}`, { tenantId })
}

export async function approveAiOutput(
  outputId: string,
  tenantId?: string,
): Promise<{ id: string; approved: true }> {
  return apiFetch<{ id: string; approved: true }>(
    `/ai/review-queue/${outputId}/approve`,
    { method: "POST", tenantId },
  )
}

export function resolveAiReviewOpenHref(item: PendingAiReviewItem): string {
  if (item.taskType === "LEGAL_RESEARCH") {
    const params = new URLSearchParams({ outputId: item.id })
    if (item.matterId) params.set("matterId", item.matterId)
    return `/app/research?${params.toString()}`
  }
  if (item.matterId) {
    return `/app/matters/${item.matterId}`
  }
  return `/app/research?outputId=${item.id}`
}

export function formatAiReviewTaskType(taskType: string): string {
  return taskType
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}
