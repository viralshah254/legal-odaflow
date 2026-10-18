import { apiFetch } from "./client"

export interface MatterAnalysisSnapshot {
  id: string
  matterId: string
  status: string
  scope: "full" | "incremental"
  summary: string
  risks: string[]
  nextActions: string[]
  evidenceGaps: string[]
  contradictions: string[]
  sourceDocumentCount: number
  createdAt: string
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeMatterAnalysisSnapshot(
  raw: MatterAnalysisSnapshot | null | undefined,
): MatterAnalysisSnapshot | null {
  if (!raw) return null
  return {
    ...raw,
    risks: asStringList(raw.risks),
    nextActions: asStringList(raw.nextActions),
    evidenceGaps: asStringList(raw.evidenceGaps),
    contradictions: asStringList(raw.contradictions),
  }
}

export async function getLatestMatterAnalysis(
  tenantId: string,
  matterId: string,
): Promise<MatterAnalysisSnapshot | null> {
  const raw = await apiFetch<MatterAnalysisSnapshot | null>(
    `/matters/${matterId}/analysis/latest`,
    { tenantId },
  )
  return normalizeMatterAnalysisSnapshot(raw)
}

export async function runMatterAnalysis(
  tenantId: string,
  matterId: string,
  scope: "full" | "incremental" = "full",
): Promise<MatterAnalysisSnapshot> {
  const raw = await apiFetch<MatterAnalysisSnapshot>(`/matters/${matterId}/analysis/run`, {
    method: "POST",
    tenantId,
    body: { scope },
  })
  return normalizeMatterAnalysisSnapshot(raw)!
}
