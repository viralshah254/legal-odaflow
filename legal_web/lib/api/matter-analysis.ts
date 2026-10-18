import { apiFetch } from "./client"

export interface MatterAnalysisRun {
  id: string
  tenantId: string
  matterId: string
  runType: "similar_cases" | "opponent_analysis"
  trigger: "manual" | "auto"
  title: string | null
  contentMarkdown: string | null
  structuredOutput: unknown | null
  status: string
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface RunAnalysisRequest {
  focusPrompt?: string
}

// Similar Cases

export async function listSimilarCases(
  tenantId: string,
  matterId: string,
): Promise<MatterAnalysisRun[]> {
  return apiFetch<MatterAnalysisRun[]>(`/matters/${matterId}/similar-cases`, { tenantId })
}

export async function runSimilarCases(
  tenantId: string,
  matterId: string,
  data?: RunAnalysisRequest,
): Promise<MatterAnalysisRun> {
  return apiFetch<MatterAnalysisRun>(`/matters/${matterId}/similar-cases`, {
    method: "POST",
    tenantId,
    body: data ?? {},
  })
}

export async function deleteSimilarCasesRun(
  tenantId: string,
  matterId: string,
  runId: string,
): Promise<void> {
  await apiFetch(`/matters/${matterId}/similar-cases/${runId}`, {
    method: "DELETE",
    tenantId,
  })
}

// Opponent Analysis

export async function listOpponentAnalyses(
  tenantId: string,
  matterId: string,
): Promise<MatterAnalysisRun[]> {
  return apiFetch<MatterAnalysisRun[]>(`/matters/${matterId}/opponent-analyses`, { tenantId })
}

export async function runOpponentAnalysis(
  tenantId: string,
  matterId: string,
  data?: RunAnalysisRequest,
): Promise<MatterAnalysisRun> {
  return apiFetch<MatterAnalysisRun>(`/matters/${matterId}/opponent-analyses`, {
    method: "POST",
    tenantId,
    body: data ?? {},
  })
}

export async function deleteOpponentAnalysisRun(
  tenantId: string,
  matterId: string,
  runId: string,
): Promise<void> {
  await apiFetch(`/matters/${matterId}/opponent-analyses/${runId}`, {
    method: "DELETE",
    tenantId,
  })
}

// Auto-generate strategy memo

export async function autoGenerateStrategyMemo(
  tenantId: string,
  matterId: string,
  data?: RunAnalysisRequest,
): Promise<{ id: string; title: string; content: string; createdAt: string }> {
  return apiFetch(`/matters/${matterId}/strategy-memos/auto-generate`, {
    method: "POST",
    tenantId,
    body: data ?? {},
  })
}
