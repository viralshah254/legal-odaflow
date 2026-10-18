import { apiFetch } from "./client"

export interface IngestStatusRow {
  countryCode: string
  _count: { id: number }
}

export interface IngestActStatus {
  actId: string
  sectionCount: number
  cataloguedSectionCount?: number | null
  lastIngestAt: string | null
  sourceName: string | null
  sourceUrl: string | null
  manifestSource: string | null
  meetsTier1Threshold: boolean
}

export interface IngestStatusResponse {
  summary: IngestStatusRow[]
  acts: IngestActStatus[]
}

export interface StatuteRegistryEntry {
  id: string
  shortName: string
  fullName: string
  countryCode: string
  acronyms: string[]
  jurisdiction?: string | null
  sectionCount?: number | null
  cataloguedSectionCount?: number
  indexedSectionCount?: number
  hasCorpusStructure?: boolean
  prioritySections: string[]
  practiceAreas?: string[]
}

export interface StatuteSectionRow {
  section: string
  title: string | null
  indexed: boolean
  legalAuthorityId: string | null
}

export interface ListActSectionsResponse {
  actId: string
  countryCode: string
  total: number
  offset: number
  limit: number
  sections: StatuteSectionRow[]
}

export interface LawLibrarySearchHit {
  id: string
  title: string
  citation: string | null
  sourceName: string
  summary: string | null
  sourceUrl: string | null
  authorityType: string
  score: number
}

export interface LawLibrarySearchResult {
  query: string
  countryCode: string
  hybrid: LawLibrarySearchHit[]
  statuteSections: LawLibrarySearchHit[]
}

export async function getIngestStatus(
  countryCode = "IN",
): Promise<IngestStatusResponse> {
  const raw = await apiFetch<IngestStatusResponse | IngestStatusRow[]>(
    `/legal-sources/ingest-status?countryCode=${encodeURIComponent(countryCode)}`,
  )
  // Backend returns { summary, acts }; tolerate legacy flat array.
  if (Array.isArray(raw)) {
    return { summary: raw, acts: [] }
  }
  return {
    summary: raw.summary ?? [],
    acts: raw.acts ?? [],
  }
}

export function resolveIndexedSectionCount(
  status: IngestStatusResponse | undefined,
  countryCode: string,
): number {
  return (
    status?.summary.find((r) => r.countryCode === countryCode)?._count.id ?? 0
  )
}

export async function listStatuteRegistry(
  countryCode = "IN",
): Promise<StatuteRegistryEntry[]> {
  return apiFetch<StatuteRegistryEntry[]>(
    `/legal-sources/statute-registry?countryCode=${encodeURIComponent(countryCode)}`,
  )
}

export async function listActSections(
  actId: string,
  countryCode = "IN",
  options: { offset?: number; limit?: number; q?: string } = {},
): Promise<ListActSectionsResponse> {
  const params = new URLSearchParams({
    countryCode,
    offset: String(options.offset ?? 0),
    limit: String(options.limit ?? 100),
  })
  if (options.q?.trim()) {
    params.set("q", options.q.trim())
  }
  return apiFetch<ListActSectionsResponse>(
    `/legal-sources/statute-registry/${encodeURIComponent(actId)}/sections?${params.toString()}`,
  )
}

export async function searchLawLibrary(
  query: string,
  countryCode = "IN",
): Promise<LawLibrarySearchResult> {
  const params = new URLSearchParams({ q: query, countryCode })
  return apiFetch<LawLibrarySearchResult>(`/legal-sources/search?${params.toString()}`)
}

export interface CorpusSyncEnqueueResult {
  agentJobId: string
  bullJobId?: string
  queue: string
  status: string
  message?: string
}

export interface IngestJobStatus {
  id: string
  status: string
  jobType: string
  error: string | null
  result: unknown
  createdAt: string
  completedAt: string | null
  countryCode?: string
}

export async function enqueueCorpusSync(countryCode: string): Promise<CorpusSyncEnqueueResult> {
  return apiFetch<CorpusSyncEnqueueResult>(
    `/legal-sources/ingest-statutes?countryCode=${encodeURIComponent(countryCode)}`,
    { method: "POST" },
  )
}

export async function getIngestJobStatus(jobId: string): Promise<IngestJobStatus> {
  return apiFetch<IngestJobStatus>(
    `/legal-sources/ingest-jobs/${encodeURIComponent(jobId)}`,
  )
}

export async function seedPrioritySections(countryCode: string): Promise<unknown> {
  return apiFetch(
    `/legal-sources/seed-statute-sections?countryCode=${encodeURIComponent(countryCode)}`,
    { method: "POST" },
  )
}

export interface IndiaAbbreviationEntry {
  abbr: string
  fullForm: string
  category: "court" | "tribunal" | "statute" | "procedure" | "institution" | "general"
  aliases?: string[]
  relatedActId?: string
}

export async function listIndiaAbbreviations(
  category?: IndiaAbbreviationEntry["category"],
): Promise<IndiaAbbreviationEntry[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : ""
  return apiFetch<IndiaAbbreviationEntry[]>(`/legal-sources/india-abbreviations${params}`)
}
