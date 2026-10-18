import { apiFetch } from "./client"

export type TaskPatternFeature =
  | "research"
  | "draft"
  | "review"
  | "intake"
  | "copilot"
  | "law_library"
  | "section_finder"

export interface StatuteRef {
  countryCode: string
  actId: string
  section?: string
}

export interface TaskPatternPrefill {
  query?: string
  countryCode?: string
  kind?: string
  label?: string
  details?: string
  documentType?: string
  focusAreas?: string[]
  brief?: string
  actId?: string
  section?: string
}

export interface LegalTaskPattern {
  id: string
  slug: string
  title: string
  description: string
  body: string
  targetFeature: TaskPatternFeature
  jurisdiction: "IN" | "US" | "KE" | "GB"
  practiceAreas: string[]
  tags: string[]
  statuteRefs?: StatuteRef[]
  prefill: TaskPatternPrefill
  scope: "system" | "firm" | "user"
  sortOrder: number
  usageCount?: number
  domainSlug?: string
}

export interface ListTaskPatternsParams {
  jurisdiction?: string
  targetFeature?: TaskPatternFeature
  practiceArea?: string
  q?: string
}

export async function listTaskPatterns(
  params: ListTaskPatternsParams = {},
): Promise<LegalTaskPattern[]> {
  const search = new URLSearchParams()
  if (params.jurisdiction) search.set("jurisdiction", params.jurisdiction)
  if (params.targetFeature) search.set("targetFeature", params.targetFeature)
  if (params.practiceArea) search.set("practiceArea", params.practiceArea)
  if (params.q) search.set("q", params.q)
  const qs = search.toString()
  return apiFetch<LegalTaskPattern[]>(`/task-patterns${qs ? `?${qs}` : ""}`)
}

export async function listTaskPatternPracticeAreas(
  jurisdiction?: string,
): Promise<string[]> {
  const qs = jurisdiction ? `?jurisdiction=${encodeURIComponent(jurisdiction)}` : ""
  return apiFetch<string[]>(`/task-patterns/practice-areas${qs}`)
}

export async function recordTaskPatternUse(
  patternId: string,
  payload: { jurisdiction?: string; targetFeature?: TaskPatternFeature; tenantId?: string },
): Promise<{ ok: boolean; usageCount?: number }> {
  return apiFetch(`/task-patterns/${encodeURIComponent(patternId)}/use`, {
    method: "POST",
    body: payload,
  })
}

export interface TaskPatternUsageAnalytics {
  windowDays: number
  patternLaunches: number
  aiResearchRuns: number
  aiDraftRuns: number
  estimatedAiSessions: number
  patternShareOfAiSessions: number
  phase2Gate: {
    target: number
    met: boolean
    description: string
  }
  topPatterns: Array<{ patternId: string; count: number; title: string }>
  catalogSize: number
}

export async function getTaskPatternUsageAnalytics(
  tenantId?: string,
  windowDays = 30,
): Promise<TaskPatternUsageAnalytics> {
  const params = new URLSearchParams()
  if (tenantId) params.set("tenantId", tenantId)
  params.set("windowDays", String(windowDays))
  return apiFetch(`/task-patterns/analytics/usage?${params.toString()}`)
}
