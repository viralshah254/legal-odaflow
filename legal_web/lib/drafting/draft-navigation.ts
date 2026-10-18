/** Primary hub for official forms + Find & Draft. */
export const DOCUMENT_DRAFTING_HREF = "/app/legal-forms"
export const CONSUMER_DOCUMENT_DRAFTING_HREF = "/consumer/document-drafting"

/** Map lawyer draft routes to consumer equivalents where they exist. */
export function toConsumerDraftUrl(
  url: string,
  returnTo: string = CONSUMER_DOCUMENT_DRAFTING_HREF,
): string {
  const withReturn = appendReturnTo(url, returnTo)
  return withReturn
    .replace("/app/india-drafting", "/consumer/india-drafting")
    .replace("/app/legal-forms", CONSUMER_DOCUMENT_DRAFTING_HREF)
}

const LEGAL_FORMS_COUNTRY_KEY = "legal_forms_country_filter"
const DRAFT_SET_KEY = "umbrella_draft_set"
const DRAFT_QUEUE_KEY = "umbrella_draft_queue"
const DRAFT_SET_PARTY_KEY = "umbrella_draft_set_parties"
const DRAFT_SET_DETAILS_KEY = "umbrella_draft_set_details"
const DRAFT_SET_CASE_RECORD_KEY = "umbrella_draft_set_case_record"

export interface DraftSetPartyContext {
  clientName?: string
  opposingParty?: string
  courtName?: string
  parties?: {
    plaintiffs: Array<{ name: string; role: string }>
    defendants: Array<{ name: string; role: string }>
  }
}

export function saveDraftSetPartyContext(ctx: DraftSetPartyContext): void {
  try {
    sessionStorage.setItem(DRAFT_SET_PARTY_KEY, JSON.stringify(ctx))
  } catch {
    // ignore
  }
}

export function getDraftSetPartyContext(): DraftSetPartyContext | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_SET_PARTY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftSetPartyContext
    if (
      parsed.courtName &&
      (/\bscan\b/i.test(parsed.courtName) || /\bwas\s+performed\b/i.test(parsed.courtName))
    ) {
      parsed.courtName = undefined
    }
    return parsed
  } catch {
    return null
  }
}

export function clearDraftSetPartyContext(): void {
  try {
    sessionStorage.removeItem(DRAFT_SET_PARTY_KEY)
  } catch {
    // ignore
  }
}

/** Confirmed CaseRecord for the filing set — survives step navigation. */
export function saveDraftSetCaseRecord(record: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(DRAFT_SET_CASE_RECORD_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}

export function getDraftSetCaseRecord(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_SET_CASE_RECORD_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== "object") return null
    if (!Array.isArray(parsed.parties)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDraftSetCaseRecord(): void {
  try {
    sessionStorage.removeItem(DRAFT_SET_CASE_RECORD_KEY)
  } catch {
    // ignore
  }
}

/** Full case narrative for the filing set — survives URL truncation of `details`. */
export function saveDraftSetCaseDetails(details: string): void {
  try {
    const trimmed = details.trim()
    if (!trimmed) {
      sessionStorage.removeItem(DRAFT_SET_DETAILS_KEY)
      return
    }
    sessionStorage.setItem(DRAFT_SET_DETAILS_KEY, trimmed.slice(0, 50000))
  } catch {
    // ignore
  }
}

export function getDraftSetCaseDetails(): string {
  try {
    return sessionStorage.getItem(DRAFT_SET_DETAILS_KEY) ?? ""
  } catch {
    return ""
  }
}

export function clearDraftSetCaseDetails(): void {
  try {
    sessionStorage.removeItem(DRAFT_SET_DETAILS_KEY)
  } catch {
    // ignore
  }
}

export function appendReturnTo(
  url: string,
  returnTo: string = DOCUMENT_DRAFTING_HREF,
): string {
  const [path, query = ""] = url.split("?")
  const params = new URLSearchParams(query)
  if (!params.has("returnTo")) {
    params.set("returnTo", returnTo)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export function resolveDraftBackHref(
  searchParams: Pick<URLSearchParams, "get">,
  fallbackHub: string,
): string {
  const returnTo = searchParams.get("returnTo")
  if (returnTo?.startsWith("/app/")) return returnTo

  const kind = searchParams.get("kind") ?? ""
  if (kind === "us_form_catalog" || kind === "india_form_catalog") {
    return DOCUMENT_DRAFTING_HREF
  }

  return fallbackHub
}

export function draftBackLabel(returnHref: string): string {
  if (returnHref.includes("legal-forms")) return "Document Drafting"
  if (returnHref.includes("india-drafting")) return "India Drafting"
  if (returnHref.includes("us-drafting")) return "US Drafting"
  return "Back"
}

export function readLegalFormsCountryFilter(): string | null {
  try {
    return localStorage.getItem(LEGAL_FORMS_COUNTRY_KEY)
  } catch {
    return null
  }
}

export function persistLegalFormsCountryFilter(code: string): void {
  try {
    localStorage.setItem(LEGAL_FORMS_COUNTRY_KEY, code)
  } catch {
    // ignore
  }
}

/** Build draft editor URL from a saved draft record or history item. */
export function buildSavedDraftHref(record: {
  id: string
  kind: string
  label?: string | null
  category?: string | null
  countryCode: string
}): string {
  const base =
    record.countryCode === "US"
      ? "/app/us-drafting/draft"
      : "/app/india-drafting/draft"
  const params = new URLSearchParams()
  params.set("kind", record.kind)
  params.set("label", record.label ?? record.kind)
  params.set("draftId", record.id)
  if (record.category) params.set("category", record.category)
  return `${base}?${params.toString()}`
}

export function savedDraftsScreenHref(returnTo?: string): string {
  const params = new URLSearchParams()
  if (returnTo) params.set("returnTo", returnTo)
  const qs = params.toString()
  return qs ? `/app/saved-drafts?${qs}` : "/app/saved-drafts"
}

// ─── Filing set (multi-document bundle) ───────────────────────────────────────

export type DraftSetItemStatus =
  | "pending"
  | "generating"
  | "done"
  | "error"
  | "needs_confirm"
  | "blocked"

export type FinalDraftResolutionStatus =
  | "clean"
  | "repaired"
  | "needs_user_confirmation"
  | "needs_advocate_review"
  | "blocked"

export interface DraftSetItem {
  draftUrl: string
  label: string
  kind: string
  status: DraftSetItemStatus
  draftId?: string
  resolutionStatus?: FinalDraftResolutionStatus
}

/** Route generic research memo to consumer variant when intake has medical/consumer signals. */
export function resolveBundleResearchMemoKind(kind: string, caseDetails: string): string {
  if (kind !== "india_legal_research_memo") return kind
  if (
    /\b(consumer\s+complaint|consumer\s+commission|medical\s+negligence|deficiency\s+in\s+service|hospital|gallbladder|cholecystectomy|informed\s+consent|bile[- ]?duct)\b/i.test(
      caseDetails,
    )
  ) {
    return "india_consumer_research_memo"
  }
  return kind
}

export function remapDraftUrlKind(draftUrl: string, kind: string): string {
  if (!kind) return draftUrl
  try {
    const url = new URL(draftUrl, "http://local")
    url.searchParams.set("kind", kind)
    return `${url.pathname}${url.search}`
  } catch {
    return draftUrl.includes("kind=")
      ? draftUrl.replace(/kind=[^&]+/, `kind=${encodeURIComponent(kind)}`)
      : `${draftUrl}${draftUrl.includes("?") ? "&" : "?"}kind=${encodeURIComponent(kind)}`
  }
}

/** Map accuracy finalResolutionStatus → filing-set pill status. */
export function bundleStatusFromResolution(
  resolution?: FinalDraftResolutionStatus | string | null,
): DraftSetItemStatus {
  if (resolution === "clean" || resolution === "repaired") return "done"
  if (resolution === "needs_user_confirmation") return "needs_confirm"
  if (resolution === "blocked" || resolution === "needs_advocate_review") return "blocked"
  return "done"
}

export interface DraftSetState {
  items: DraftSetItem[]
  currentIndex: number
}

export interface DraftSetInitItem {
  draftUrl: string
  label: string
  kind?: string
}

function kindFromDraftUrl(draftUrl: string): string {
  try {
    const url = new URL(draftUrl, "http://local")
    return url.searchParams.get("kind") ?? ""
  } catch {
    return ""
  }
}

function saveDraftSet(state: DraftSetState): void {
  try {
    sessionStorage.setItem(DRAFT_SET_KEY, JSON.stringify(state))
    sessionStorage.removeItem(DRAFT_QUEUE_KEY)
  } catch {
    // ignore
  }
}

/** Initialize a filing set when user starts drafting a bundle. */
export function initDraftSet(items: DraftSetInitItem[]): void {
  if (items.length === 0) {
    clearDraftSet()
    return
  }
  saveDraftSet({
    items: items.map((item) => ({
      draftUrl: item.draftUrl,
      label: item.label,
      kind: item.kind ?? kindFromDraftUrl(item.draftUrl),
      status: "pending" as const,
    })),
    currentIndex: 0,
  })
}

export function getDraftSet(): DraftSetState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_SET_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DraftSetState
  } catch {
    return null
  }
}

export function clearDraftSet(): void {
  try {
    sessionStorage.removeItem(DRAFT_SET_KEY)
    sessionStorage.removeItem(DRAFT_QUEUE_KEY)
    sessionStorage.removeItem(DRAFT_SET_PARTY_KEY)
    sessionStorage.removeItem(DRAFT_SET_CASE_RECORD_KEY)
    sessionStorage.removeItem(DRAFT_SET_DETAILS_KEY)
  } catch {
    // ignore
  }
}

export function updateDraftSetItem(
  index: number,
  patch: Partial<Pick<DraftSetItem, "status" | "draftId" | "resolutionStatus">>,
): DraftSetState | null {
  const set = getDraftSet()
  if (!set || index < 0 || index >= set.items.length) return null
  const items = [...set.items]
  items[index] = { ...items[index], ...patch }
  const next = { ...set, items }
  saveDraftSet(next)
  return next
}

export function setDraftSetCurrentIndex(index: number): DraftSetState | null {
  const set = getDraftSet()
  if (!set || index < 0 || index >= set.items.length) return null
  const next = { ...set, currentIndex: index }
  saveDraftSet(next)
  return next
}

/** Sync current index when URL kind matches a set item. */
export function syncDraftSetIndexForKind(kind: string): DraftSetState | null {
  const set = getDraftSet()
  if (!set || !kind) return set
  const idx = set.items.findIndex((item) => item.kind === kind)
  if (idx < 0) return set
  if (idx === set.currentIndex) return set
  return setDraftSetCurrentIndex(idx)
}

export interface DraftSetNavContext {
  details?: string
  clientName?: string
  courtName?: string
  opposingParty?: string
  autoGenerate?: boolean
  knowledgeSources?: string
}

/** Build navigation URL for a filing-set item. */
export function buildDraftSetNavUrl(
  item: DraftSetItem,
  context: DraftSetNavContext = {},
): string {
  const url = new URL(item.draftUrl, "http://local")
  const existing = new URLSearchParams(url.search)
  const next = new URLSearchParams()

  // Copy non-party/details keys first (kind, label, category, etc.).
  for (const [key, value] of existing.entries()) {
    if (
      key === "details" ||
      key === "clientName" ||
      key === "courtName" ||
      key === "opposingParty" ||
      key === "autoGenerate" ||
      key === "draftId" ||
      key === "knowledgeSources"
    ) {
      continue
    }
    next.append(key, value)
  }

  if (item.status === "done" && item.draftId) {
    next.set("draftId", item.draftId)
  } else if (context.autoGenerate) {
    next.set("autoGenerate", "1")
  }

  // Party/court BEFORE details so long details cannot truncate them from the URL.
  const clientName =
    context.clientName?.trim() || existing.get("clientName")?.trim() || ""
  const courtName =
    context.courtName?.trim() || existing.get("courtName")?.trim() || ""
  const opposingParty =
    context.opposingParty?.trim() || existing.get("opposingParty")?.trim() || ""
  const details = context.details?.trim() || existing.get("details")?.trim() || ""

  if (clientName) next.set("clientName", clientName.slice(0, 200))
  if (courtName) next.set("courtName", courtName.slice(0, 200))
  if (opposingParty) next.set("opposingParty", opposingParty.slice(0, 200))
  if (details) next.set("details", details.slice(0, 800))
  if (context.knowledgeSources?.trim()) {
    next.set("knowledgeSources", context.knowledgeSources.trim())
  }

  const qs = next.toString()
  return qs ? `${url.pathname}?${qs}` : url.pathname
}

// ─── Legacy forward-only queue (deprecated — migrates to draft set) ───────────

/** @deprecated Use DraftSetItem */
export interface DraftQueueItem {
  draftUrl: string
  label: string
}

/** @deprecated Use initDraftSet */
export function setDraftQueue(items: DraftQueueItem[]): void {
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(DRAFT_QUEUE_KEY)
      return
    }
    sessionStorage.setItem(DRAFT_QUEUE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/** @deprecated Use getDraftSet */
export function peekDraftQueue(): DraftQueueItem[] {
  try {
    const raw = sessionStorage.getItem(DRAFT_QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as DraftQueueItem[]
  } catch {
    return []
  }
}

/** @deprecated Use setDraftSetCurrentIndex + buildDraftSetNavUrl */
export function shiftDraftQueue(): DraftQueueItem | null {
  const queue = peekDraftQueue()
  if (queue.length === 0) return null
  const [next, ...rest] = queue
  setDraftQueue(rest)
  return next
}

/** @deprecated Use clearDraftSet */
export function clearDraftQueue(): void {
  clearDraftSet()
}
