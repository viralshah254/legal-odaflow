import { apiFetch } from "./client"

export interface StrategyMemo {
  id: string
  tenantId: string
  matterId: string
  title: string
  content: string
  practiceArea?: string | null
  status: "DRAFT" | "FINAL" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  createdBy?: string | null
}

export interface CreateStrategyMemoRequest {
  title?: string
  content?: string
  practiceArea?: string
  prompt?: string
}

export interface UpdateStrategyMemoRequest {
  title?: string
  content?: string
  status?: "DRAFT" | "FINAL" | "ARCHIVED"
}

export async function listStrategyMemos(
  tenantId: string,
  matterId: string,
): Promise<StrategyMemo[]> {
  return apiFetch<StrategyMemo[]>(`/matters/${matterId}/strategy-memos`, { tenantId })
}

export async function createStrategyMemo(
  tenantId: string,
  matterId: string,
  data: CreateStrategyMemoRequest,
): Promise<StrategyMemo> {
  return apiFetch<StrategyMemo>(`/matters/${matterId}/strategy-memos`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function getStrategyMemo(
  tenantId: string,
  matterId: string,
  memoId: string,
): Promise<StrategyMemo> {
  return apiFetch<StrategyMemo>(`/matters/${matterId}/strategy-memos/${memoId}`, { tenantId })
}

export async function updateStrategyMemo(
  tenantId: string,
  matterId: string,
  memoId: string,
  data: UpdateStrategyMemoRequest,
): Promise<StrategyMemo> {
  return apiFetch<StrategyMemo>(`/matters/${matterId}/strategy-memos/${memoId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteStrategyMemo(
  tenantId: string,
  matterId: string,
  memoId: string,
): Promise<void> {
  await apiFetch(`/matters/${matterId}/strategy-memos/${memoId}`, {
    method: "DELETE",
    tenantId,
  })
}
