import { apiFetch } from "./client"

export interface OutcomeAnalysis {
  id: string
  tenantId: string
  matterId: string
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  winProbability?: number | null
  settlementProbability?: number | null
  lossProbability?: number | null
  keyFactors?: string[] | null
  riskAmplifiers?: string[] | null
  recommendations?: string[] | null
  summary?: string | null
  scenarios?: OutcomeScenario[] | null
  portalPublished?: boolean
  createdAt: string
  updatedAt: string
}

export interface OutcomeScenario {
  label: string
  probability: number
  description: string
}

export interface OutcomeBenchmark {
  practiceArea: string
  countryCode: string
  avgWinRate?: number | null
  avgSettlementRate?: number | null
  avgDurationDays?: number | null
  sampleSize?: number | null
}

export async function generateOutcomeAnalysis(
  tenantId: string,
  matterId: string,
): Promise<OutcomeAnalysis> {
  return apiFetch<OutcomeAnalysis>(`/matters/${matterId}/outcome-analysis/generate`, {
    method: "POST",
    tenantId,
    body: {},
  })
}

export async function listOutcomeAnalyses(
  tenantId: string,
  matterId: string,
): Promise<OutcomeAnalysis[]> {
  return apiFetch<OutcomeAnalysis[]>(`/matters/${matterId}/outcome-analysis`, { tenantId })
}

export async function patchOutcomeAnalysis(
  tenantId: string,
  matterId: string,
  analysisId: string,
  data: { status?: string; portalPublished?: boolean },
): Promise<OutcomeAnalysis> {
  return apiFetch<OutcomeAnalysis>(`/matters/${matterId}/outcome-analysis/${analysisId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function getOutcomeBenchmarks(
  tenantId: string,
  matterId: string,
  params?: { practiceArea?: string; countryCode?: string },
): Promise<OutcomeBenchmark> {
  const q = new URLSearchParams()
  if (params?.practiceArea) q.set("practiceArea", params.practiceArea)
  if (params?.countryCode) q.set("countryCode", params.countryCode)
  const suffix = q.toString() ? `?${q.toString()}` : ""
  return apiFetch<OutcomeBenchmark>(`/matters/${matterId}/outcome/benchmarks${suffix}`, { tenantId })
}
