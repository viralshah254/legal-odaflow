import { getApiBaseUrl } from "./api-base"

export interface SectionFinderEntry {
  id: string
  legacyActId: string
  legacyActShort: string
  legacyActFull: string
  legacySection: string
  legacyTitle: string
  newActId: string
  newActShort: string
  newActFull: string
  newSection: string
  newTitle: string
  changeType: string
  changeSummary: string
  punishment: string
  maxYears?: number
  minYears?: number
  isBailable: boolean
  isCognizable: boolean
  isCompoundable: boolean
  trialCourt: string
  trialCourtLabel: string
  bailPosture: string
  practiceNote?: string
  sectionText?: string
  transitionWarning?: string
  sourceRef: string
  transitionDate: string
  matchSource?: "curated" | "remap" | "corpus" | "network" | "ai"
  tier?: "enriched" | "crosswalk"
  isInForce?: boolean
  successorSection?: string
  successorActShort?: string
  officialRemovalNote?: string
  effectiveAsOf?: string
  lastVerifiedAt?: string
  amendingInstrument?: string
}

export interface SectionFinderAiSuggestion {
  actId: string
  actShort: string
  section: string
  title: string
  confidence: "low" | "medium" | "high"
  rationale: string
  source: "ai_suggest"
  verificationState: "ai_suggested"
}

export interface SectionFinderResult {
  query: string
  countryCode: string
  matches: SectionFinderEntry[]
  total: number
  transitionDate: string
  lawCurrencyCutoff?: string
  disclaimer: string
  resolvedSections?: SectionFinderEntry[]
  /** Lower-model suggestions when index misses — not Verified. */
  aiSuggestions?: SectionFinderAiSuggestion[]
  aiSuggestionModel?: string
  aiSuggestionsNote?: string
  actStructure?: {
    actId: string
    sectionCount: number
    orderCount?: number
    scheduleCount?: number
    structureProfile?: string
    lastSectionId?: string
  }
}

export interface ActStructureSummary {
  actId: string
  manifestActId?: string
  shortName?: string
  fullName?: string
  sectionCount: number
  orderCount: number
  scheduleCount: number
  articleCount: number
  structureProfile: string
  lastSectionId?: string
}

export interface PopularSectionQuery {
  displayLabel: string
  normalizedQuery: string
  actId?: string
  sectionNumber?: string
  legalAuthorityId?: string
  title?: string
  searchCount: number
}

export interface SectionFinderSuggestion {
  displayLabel: string
  normalizedQuery: string
  actId?: string
  sectionNumber?: string
  legalAuthorityId?: string
  title?: string
  legacyActShort?: string
  legacySection?: string
  matchSource?: SectionFinderEntry["matchSource"] | "popular" | "index" | "profile"
  score?: number
}

export interface SectionFinderLookupHint {
  authorityId?: string
  actId?: string
  section?: string
}

export async function findSection(
  q: string,
  countryCode = "IN",
  token?: string,
  locale?: string,
  jurisdiction?: string,
  hint?: SectionFinderLookupHint,
  matterId?: string,
): Promise<SectionFinderResult> {
  const params = new URLSearchParams({
    q,
    countryCode,
  })
  if (locale && locale !== "en") {
    params.set("locale", locale)
  }
  if (jurisdiction && jurisdiction !== "FED") {
    params.set("jurisdiction", jurisdiction)
  }
  if (hint?.authorityId) {
    params.set("authorityId", hint.authorityId)
  }
  if (hint?.actId) {
    params.set("actId", hint.actId)
  }
  if (hint?.section) {
    params.set("section", hint.section)
  }
  if (matterId) {
    params.set("matterId", matterId)
  }
  const url = `${getApiBaseUrl()}/legal-sources/section-finder?${params.toString()}`
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? "Section lookup failed")
  }
  return res.json() as Promise<SectionFinderResult>
}

export async function suggestSection(
  q: string,
  countryCode = "IN",
  limit = 10,
  signal?: AbortSignal,
  jurisdiction?: string,
): Promise<SectionFinderSuggestion[]> {
  const trimmed = q.trim()
  if (trimmed.length < 2) {
    return []
  }
  const params = new URLSearchParams({
    q: trimmed,
    countryCode,
    limit: String(limit),
  })
  if (jurisdiction && jurisdiction !== "FED") {
    params.set("jurisdiction", jurisdiction)
  }
  const url = `${getApiBaseUrl()}/legal-sources/section-finder/suggest?${params.toString()}`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    return []
  }
  return res.json() as Promise<SectionFinderSuggestion[]>
}

export async function getPopularSections(
  countryCode = "IN",
  limit = 10,
  jurisdiction?: string,
): Promise<PopularSectionQuery[]> {
  const params = new URLSearchParams({
    countryCode,
    limit: String(limit),
  })
  if (jurisdiction && jurisdiction !== "FED") {
    params.set("jurisdiction", jurisdiction)
  }
  const url = `${getApiBaseUrl()}/legal-sources/section-finder/popular?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    return []
  }
  return res.json() as Promise<PopularSectionQuery[]>
}

export async function getActStructures(countryCode = "IN"): Promise<ActStructureSummary[]> {
  const params = new URLSearchParams({ countryCode })
  const url = `${getApiBaseUrl()}/legal-sources/section-finder/acts?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    return []
  }
  return res.json() as Promise<ActStructureSummary[]>
}

export interface ResolveAndPinResponse {
  status: "found" | "resolved_ingest" | "not_found" | "invalid"
  pin?: {
    actId?: string
    section: string
    label?: string
    authorityId?: string
    textExcerpt?: string
    source: "section_finder" | "user_unresolved" | "resolved_ingest"
  }
  matchSource?: string
  message?: string
  addedToSectionFinder?: boolean
}

export async function resolveAndPinSection(
  payload: {
    q: string
    countryCode?: string
    actId?: string
    section?: string
    allowSoftPin?: boolean
  },
  token?: string,
): Promise<ResolveAndPinResponse> {
  const url = `${getApiBaseUrl()}/legal-sources/section-finder/resolve-and-pin`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? "Section resolve failed")
  }
  return res.json() as Promise<ResolveAndPinResponse>
}
