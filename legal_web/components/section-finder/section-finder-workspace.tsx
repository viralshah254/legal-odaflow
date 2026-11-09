"use client"


import { useTranslations } from "next-intl"
import { getMatterResearchContext } from "@/lib/api/ai"
import { resolveSectionFinderCountry } from "@/lib/section-finder-country"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  ChevronRight,
  AlertTriangle,
  Info,
  ArrowRight,
  Scale,
  Gavel,
  FileText,
  BookOpen,
  CheckCircle2,
  XCircle,
  Database,
  Link2,
  Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { findSection, getPopularSections, suggestSection, type PopularSectionQuery, type SectionFinderEntry, type SectionFinderLookupHint, type SectionFinderResult, type SectionFinderSuggestion } from "@/lib/api/section-finder"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import { useLocale } from "@/lib/contexts/locale-context"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { PdfExportButton } from "@/components/export/pdf-export-button"
import {
  getSectionFinderMeta,
  US_STATE_OPTIONS,
  type SectionFinderCountry,
} from "@/lib/section-finder-config"

function sourceLabelsForCountry(country: SectionFinderCountry): Record<
  NonNullable<SectionFinderEntry["matchSource"]>,
  string
> {
  const networkLabel =
    country === "KE"
      ? "Fetched from Kenya Law — cached for future lookups"
      : country === "US"
        ? "Fetched from official US code source — cached for future lookups"
        : "Fetched from India Code — cached for future lookups"

  return {
    curated: "Verified crosswalk",
    remap: "Official 2023 remap",
    corpus: country === "KE" ? "Kenya Law corpus" : "Bare-act corpus",
    network: networkLabel,
    ai: "AI-assisted (not verified)",
  }
}

function formatActStructureBadge(structure: NonNullable<SectionFinderResult["actStructure"]>): string {
  const parts: string[] = []
  if (structure.structureProfile?.includes("article")) {
    parts.push(`${structure.sectionCount} articles`)
  } else if (structure.sectionCount > 0) {
    parts.push(`${structure.sectionCount} sections`)
  }
  if (structure.orderCount && structure.orderCount > 0) {
    parts.push(`${structure.orderCount} orders`)
  }
  if (structure.scheduleCount && structure.scheduleCount > 0) {
    parts.push(`${structure.scheduleCount} schedule${structure.scheduleCount !== 1 ? "s" : ""}`)
  }
  return parts.join(" · ")
}

function formatProvisionHeader(
  entry: SectionFinderEntry,
  structure?: SectionFinderResult["actStructure"],
): string | null {
  if (!structure) return null
  const sec = entry.legacySection.toUpperCase()
  if (sec.startsWith("ORDER-")) {
    return `Order ${sec.replace(/^ORDER-/, "")} of ${structure.orderCount ?? 0} — ${entry.legacyActShort}`
  }
  if (sec.startsWith("SCHEDULE-")) {
    return `Schedule ${sec.replace(/^SCHEDULE-/, "")} of ${structure.scheduleCount ?? 0} — ${entry.legacyActShort}`
  }
  if (structure.structureProfile?.includes("article")) {
    return `Article ${entry.legacySection} of ${structure.sectionCount} — ${entry.legacyActShort}`
  }
  return `§${entry.legacySection} of ${structure.sectionCount} — ${entry.legacyActShort}`
}

function shouldShowPracticeNote(entry: SectionFinderEntry): boolean {
  if (!entry.practiceNote?.trim()) return false
  if (entry.matchSource === "curated" || entry.matchSource === "remap") return true
  const note = entry.practiceNote.trim()
  const text = entry.sectionText?.trim()
  if (!text) return true
  if (text.startsWith(note)) return false
  if (note.startsWith(text.slice(0, Math.min(120, text.length)))) return false
  if (note.length >= text.length * 0.9) return false
  return true
}

function Badge({ children, color }: { children: React.ReactNode; color: "green" | "red" | "yellow" | "blue" | "gray" }) {
  const map = {
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800",
    red: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800",
    yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800",
    blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800",
    gray: "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  }
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", map[color])}>
      {children}
    </span>
  )
}

const TABLE_DUMP_PATTERN = /Table of Rates|Proper fee|Rs\. Rs\. Rs\. A\. P/i

function isTableDumpText(text: string | undefined | null): boolean {
  if (!text?.trim()) return false
  return TABLE_DUMP_PATTERN.test(text)
}

function displaySectionTitle(entry: SectionFinderEntry): string {
  if (isTableDumpText(entry.legacyTitle)) {
    return `${entry.legacyActShort} §${entry.legacySection}`
  }
  return entry.legacyTitle
}

const SECTION_TEXT_PREVIEW = 500

function SectionCard({
  entry,
  onAction,
  countryCode = "IN",
  actStructure,
  defaultExpanded = false,
}: {
  entry: SectionFinderEntry
  onAction?: (action: string, entry: SectionFinderEntry) => void
  countryCode?: string
  actStructure?: SectionFinderResult["actStructure"]
  defaultExpanded?: boolean
}) {
  const sectionBody =
    entry.sectionText && !isTableDumpText(entry.sectionText) ? entry.sectionText : undefined
  const [expanded, setExpanded] = useState(
    defaultExpanded || !(entry.sectionText && entry.sectionText.length > 800),
  )
  const [showFullText, setShowFullText] = useState(false)
  const sourceLabels = sourceLabelsForCountry(
    (countryCode === "US" || countryCode === "GB" || countryCode === "KE"
      ? countryCode
      : "IN") as SectionFinderCountry,
  )
  const isNew = entry.newActId !== "unchanged" && !!entry.newSection
  const isOmitted = entry.changeType === "omitted" || entry.isInForce === false
  const isCommencementPending = entry.amendingInstrument?.includes("commencement") ||
    entry.practiceNote?.toLowerCase().includes("notification status")

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {isOmitted && (
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            This section is no longer in force under current law.
          </p>
        </div>
      )}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950 dark:to-gray-900 flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex-1 min-w-0 text-left rounded-md -m-1 p-1 hover:bg-white/60 dark:hover:bg-gray-800/40 transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex-1 min-w-0">
            {formatProvisionHeader(entry, actStructure) && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                {formatProvisionHeader(entry, actStructure)}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {entry.legacyActShort} §{entry.legacySection}
              </span>
              {isNew && (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                    {entry.newActShort} §{entry.newSection}
                  </span>
                </>
              )}
              {isOmitted && <Badge color="yellow">Omitted</Badge>}
              {!isOmitted && entry.changeType === "omitted" && <Badge color="red">Repealed</Badge>}
              {isCommencementPending && <Badge color="yellow">Commencement pending</Badge>}
              {entry.matchSource && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  entry.matchSource === "ai"
                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-700"
                    : entry.matchSource === "network"
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800"
                      : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                )}>
                  {entry.matchSource === "ai" ? (
                    <Bot className="h-3 w-3" />
                  ) : entry.matchSource === "corpus" || entry.matchSource === "network" ? (
                    <Database className="h-3 w-3" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                  {sourceLabels[entry.matchSource]}
                </span>
              )}
            </div>
            <p
              className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-tight line-clamp-2"
              title={displaySectionTitle(entry)}
            >
              {displaySectionTitle(entry)}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={expanded ? "Collapse section" : "Expand section"}
        >
          <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-90")} />
        </button>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {sectionBody ? (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-4 py-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> Section Text
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {showFullText || sectionBody.length <= SECTION_TEXT_PREVIEW
                  ? sectionBody
                  : `${sectionBody.slice(0, SECTION_TEXT_PREVIEW).trim()}…`}
              </p>
              {sectionBody.length > SECTION_TEXT_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowFullText(v => !v)}
                  className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showFullText ? "Show less" : "Show full section"}
                </button>
              )}
            </div>
          ) : !isOmitted ? (
            <p className="text-sm text-muted-foreground italic">
              Section text is unavailable here. Consult the linked official source before relying on this result.
            </p>
          ) : null}

          {!isOmitted && (
            <div className="flex flex-wrap gap-2">
              <Badge color={entry.isCognizable ? "blue" : "gray"}>
                {entry.isCognizable ? "Cognizable" : "Non-cognizable"}
              </Badge>
              <Badge color={entry.isBailable ? "green" : "red"}>
                {entry.isBailable ? "Bailable" : "Non-bailable"}
              </Badge>
              {entry.isCompoundable && <Badge color="yellow">Compoundable</Badge>}
              <Badge color="gray">{entry.trialCourtLabel}</Badge>
            </div>
          )}

          {!isOmitted && entry.punishment && entry.punishment !== "N/A — procedural provision" && !entry.punishment.startsWith("Not applicable") && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                <Gavel className="h-3.5 w-3.5" /> Punishment
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200">{entry.punishment}</p>
            </div>
          )}

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> {isOmitted ? "Legal status" : "Bail Posture"}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{isOmitted ? entry.changeSummary : entry.bailPosture}</p>
          </div>

          {(entry.successorSection || entry.officialRemovalNote) && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Transition</p>
              {entry.officialRemovalNote && (
                <p className="text-sm text-amber-900 dark:text-amber-200 mb-1">{entry.officialRemovalNote}</p>
              )}
              {entry.successorSection && entry.successorActShort && (
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Related provision: {entry.successorActShort} §{entry.successorSection}
                </p>
              )}
            </div>
          )}

          {(isNew || isOmitted) && (
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> What Changed
              </p>
              <p className="text-sm text-indigo-900 dark:text-indigo-200">{entry.changeSummary}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                <span className="font-medium">Source:</span> {entry.sourceRef}
              </p>
            </div>
          )}

          {shouldShowPracticeNote(entry) && (
            <div className="rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-4 py-3">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> Practice Note
              </p>
              <p className="text-sm text-violet-900 dark:text-violet-200">{entry.practiceNote}</p>
            </div>
          )}

          {entry.transitionWarning && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              BNS/BNSS/BSA effective 1 Jul 2024 — verify applicable code for pre-2024 matters.
            </p>
          )}

          {entry.matchSource === "ai" && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-4 py-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">AI-generated result.</span> This result was generated by AI and has not been verified against the published gazette text. Confirm against the official statute before relying on it in any legal proceeding.
              </p>
            </div>
          )}

          {onAction && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => onAction("research", entry)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:hover:bg-indigo-900 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 transition-colors"
              >
                <Search className="h-3 w-3" /> Research this section
              </button>
              <button
                onClick={() => onAction("issue-checker", entry)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" /> Check my issue
              </button>
              <button
                onClick={() => onAction("draft", entry)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:hover:bg-violet-900 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 transition-colors"
              >
                <FileText className="h-3 w-3" /> Draft application
              </button>
              <PdfExportButton
                title={`${entry.legacyActShort} §${entry.legacySection} — Section Reference`}
                content={[
                  `**${entry.legacyActShort} §${entry.legacySection}** — ${entry.legacyTitle}`,
                  isNew ? `**New equivalent:** ${entry.newActShort} §${entry.newSection} — ${entry.newTitle}` : "",
                  entry.sectionText ? `**Section Text:**\n${entry.sectionText}` : "",
                  `**Punishment:** ${entry.punishment}`,
                  `**Bail:** ${entry.bailPosture}`,
                  entry.changeSummary ? `**What Changed:** ${entry.changeSummary}` : "",
                  shouldShowPracticeNote(entry) && entry.practiceNote ? `**Practice Note:** ${entry.practiceNote}` : "",
                  `**Source:** ${entry.sourceRef}`,
                ].filter(Boolean).join("\n\n")}
                meta={{ countryCode, citations: [entry.sourceRef] }}
                label="Export PDF"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SectionFinderWorkspaceProps {
  context?: "consumer" | "lawyer"
}

export function SectionFinderWorkspace({ context = "lawyer" }: SectionFinderWorkspaceProps) {
  const tRelease = useTranslations("common.release")
  const { countryCode: detectedCountry, isLoading: countryLoading } = useDetectedCountry()
  const { activeTenantId } = useTenant()
  const { locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const matterIdFromUrl = searchParams.get("matterId") ?? undefined
  const initialQuery = searchParams.get("q") ?? ""
  const paramCountry = searchParams.get("country")?.toUpperCase()
  const initialCountry = resolveSectionFinderCountry(paramCountry) ?? "IN"
  const [manualCountry, setManualCountry] = useState<SectionFinderCountry | null>(null)
  const [matterCountry, setMatterCountry] = useState<string | null>(null)
  const [matterContextError, setMatterContextError] = useState(false)
  const countryScope = matterIdFromUrl ? matterCountry : manualCountry ?? paramCountry ?? detectedCountry
  const resolvedCountry = resolveSectionFinderCountry(countryScope)
  const countryReady = Boolean(resolvedCountry && (matterIdFromUrl ? matterCountry : manualCountry || paramCountry || !countryLoading))
  const initialJurisdiction = searchParams.get("jurisdiction")?.toUpperCase() ?? "FED"
  const [selectedCountry, setSelectedCountry] = useState<SectionFinderCountry>(initialCountry)
  const [usJurisdiction, setUsJurisdiction] = useState(initialJurisdiction)
  const [query, setQuery] = useState(initialQuery)
  const [result, setResult] = useState<SectionFinderResult | null>(null)
  const [popularQueries, setPopularQueries] = useState<PopularSectionQuery[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const [suggestions, setSuggestions] = useState<SectionFinderSuggestion[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeSuggestIndex, setActiveSuggestIndex] = useState(-1)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)
  const autoRan = useRef(false)

  useEffect(() => {
    if (resolvedCountry) setSelectedCountry(resolvedCountry)
  }, [resolvedCountry])

  useEffect(() => {
    if (!matterIdFromUrl) return
    setMatterCountry(null)
    setMatterContextError(false)
    if (!activeTenantId) return
    let active = true
    void getMatterResearchContext(activeTenantId, matterIdFromUrl).then((result) => {
      if (active) setMatterCountry(result.matter.countryCode ?? null)
    }).catch(() => { if (active) setMatterContextError(true) })
    return () => { active = false }
  }, [activeTenantId, matterIdFromUrl])

  const meta = getSectionFinderMeta(resolvedCountry ?? selectedCountry)
  const activeCountryCode = resolvedCountry ?? selectedCountry
  const activeJurisdiction = selectedCountry === "US" ? usJurisdiction : undefined
  const researchRoute = context === "consumer" ? "/consumer/research" : "/app/research"
  const draftRoute =
    context === "consumer"
      ? `/consumer/document-drafting?country=${selectedCountry}`
      : selectedCountry === "US"
        ? "/app/us-drafting"
        : selectedCountry === "IN"
          ? "/app/india-drafting"
          : `/app/legal-forms?country=${selectedCountry}`

  const subscribeHref =
    context === "consumer" ? "/consumer/subscription" : "/app/settings/plan-usage"

  const { gate: creditsGate, handleApiError } = useInsufficientCreditsGate({
    feature: "sectionFinder",
    tenantId: activeTenantId ?? undefined,
    countryCode: activeCountryCode,
    subscribeHref,
    requiredCredits: FEATURE_CREDIT_COSTS.SECTION_LOOKUP,
  })

  const doSearch = useCallback(async (q: string, hint?: SectionFinderLookupHint) => {
    if (!q.trim() || !countryReady) return
    setSuggestOpen(false)
    setActiveSuggestIndex(-1)
    setLoading(true)
    setError(null)
    try {
      const r = await findSection(q.trim(), activeCountryCode, undefined, locale, activeJurisdiction, hint, matterIdFromUrl)
      setResult(r)
      setQuery(q.trim())
      void getPopularSections(activeCountryCode, 10, activeJurisdiction).then(setPopularQueries)
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    } catch (e) {
      const isCredErr = isInsufficientCreditsError(e)
      handleApiError(e, e instanceof Error ? e.message : "Lookup failed. Please try again.")
      setIsCreditError(isCredErr)
      if (!isCredErr) {
        setError(e instanceof Error ? e.message : "Lookup failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }, [locale, activeCountryCode, activeJurisdiction, handleApiError, countryReady, matterIdFromUrl])

  const selectSuggestion = useCallback((suggestion: SectionFinderSuggestion) => {
    setQuery(suggestion.displayLabel)
    setSuggestOpen(false)
    setActiveSuggestIndex(-1)
    const hint: SectionFinderLookupHint | undefined =
      suggestion.legalAuthorityId || (suggestion.actId && suggestion.sectionNumber)
        ? {
            authorityId: suggestion.legalAuthorityId,
            actId: suggestion.actId,
            section: suggestion.sectionNumber,
          }
        : undefined
    void doSearch(suggestion.displayLabel, hint)
  }, [doSearch])

  useEffect(() => {
    const trimmed = query.trim()
    if (!countryReady || trimmed.length < 2) {
      suggestAbortRef.current?.abort()
      setSuggestions([])
      setSuggestOpen(false)
      setActiveSuggestIndex(-1)
      setSuggestLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      suggestAbortRef.current?.abort()
      const controller = new AbortController()
      suggestAbortRef.current = controller
      setSuggestLoading(true)

      void suggestSection(trimmed, activeCountryCode, 10, controller.signal, activeJurisdiction)
        .then((items) => {
          if (controller.signal.aborted) return
          setSuggestions(items)
          setSuggestOpen(items.length > 0)
          setActiveSuggestIndex(items.length > 0 ? 0 : -1)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setSuggestions([])
          setSuggestOpen(false)
          setActiveSuggestIndex(-1)
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSuggestLoading(false)
          }
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query, activeCountryCode, activeJurisdiction, countryReady])

  useEffect(() => {
    return () => {
      suggestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (countryReady) {
      void getPopularSections(activeCountryCode, 10, activeJurisdiction).then(setPopularQueries)
    }
  }, [activeCountryCode, activeJurisdiction, countryReady])

  useEffect(() => {
    if (initialQuery && !autoRan.current && countryReady) {
      autoRan.current = true
      void doSearch(initialQuery)
    }
  }, [initialQuery, countryReady, doSearch])

  useEffect(() => {
    if (!initialQuery && !countryLoading) {
      inputRef.current?.focus()
    }
  }, [initialQuery, countryLoading])

  useEffect(() => {
    setResult(null)
    setError(null)
    autoRan.current = false
  }, [selectedCountry, usJurisdiction])


  function handleAction(action: string, entry: SectionFinderEntry) {
    const q = `${entry.legacyActShort} ${entry.legacySection} - ${entry.legacyTitle}`
    if (action === "research") router.push(`${researchRoute}?q=${encodeURIComponent(q)}`)
    else if (action === "issue-checker") router.push(`/legal-issue-checker?q=${encodeURIComponent(q)}`)
    else if (action === "draft") router.push(`${draftRoute}${draftRoute.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}`)
  }

  if (!countryReady) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 rounded-xl border bg-card p-6" aria-live="polite">
        <h1 className="text-xl font-semibold">{tRelease("sectionFinder")}</h1>
        <p className="text-sm text-muted-foreground">
          {matterIdFromUrl && !matterCountry && !matterContextError
            ? "Loading the matter's legal country…"
            : matterContextError
              ? "Matter context is unavailable. Reopen the matter and retry."
              : countryScope
                ? `Section lookup is not yet supported for ${countryScope}. Another country's law will not be substituted.`
                : "Choose the legal country before looking up a provision."}
        </p>
        {!matterIdFromUrl && (
          <div className="flex flex-wrap gap-2">
            {(["IN", "US", "GB", "KE"] as const).map((code) => (
              <button key={code} type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setManualCountry(code)}>{code}</button>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Hero search — primary action above the fold */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-200/60 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50 via-white to-orange-50/40 dark:from-indigo-950/40 dark:via-gray-950 dark:to-orange-950/20 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent dark:from-indigo-900/20 pointer-events-none" />
        <div className="relative px-4 py-5 sm:px-6 sm:py-6 space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {meta.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-gray-200/80 dark:border-gray-700 overflow-hidden shadow-sm">
                <button
                  type="button"
                  disabled={Boolean(matterIdFromUrl)} onClick={() => { setManualCountry("IN"); setSelectedCountry("IN") }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    selectedCountry === "IN"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
                      : "bg-white/80 text-gray-600 hover:bg-gray-50 dark:bg-gray-900/80 dark:text-gray-400",
                  )}
                >
                  🇮🇳 India
                </button>
                <button
                  type="button"
                  disabled={Boolean(matterIdFromUrl)} onClick={() => { setManualCountry("US"); setSelectedCountry("US") }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    selectedCountry === "US"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      : "bg-white/80 text-gray-600 hover:bg-gray-50 dark:bg-gray-900/80 dark:text-gray-400",
                  )}
                >
                  🇺🇸 United States
                </button>
                <button
                  type="button"
                  disabled={Boolean(matterIdFromUrl)} onClick={() => { setManualCountry("GB"); setSelectedCountry("GB") }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    selectedCountry === "GB"
                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                      : "bg-white/80 text-gray-600 hover:bg-gray-50 dark:bg-gray-900/80 dark:text-gray-400",
                  )}
                >
                  🇬🇧 United Kingdom
                </button>
                <button
                  type="button"
                  disabled={Boolean(matterIdFromUrl)} onClick={() => { setManualCountry("KE"); setSelectedCountry("KE") }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    selectedCountry === "KE"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "bg-white/80 text-gray-600 hover:bg-gray-50 dark:bg-gray-900/80 dark:text-gray-400",
                  )}
                >
                  🇰🇪 Kenya
                </button>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100/80 dark:bg-indigo-950 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/80 dark:ring-indigo-800">
                {meta.badge}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100/80 dark:bg-green-950 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:text-green-300 ring-1 ring-green-200/80 dark:ring-green-800">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </span>
            </div>
          </div>

          {selectedCountry === "US" && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="us-jurisdiction" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Scope
              </label>
              <select
                id="us-jurisdiction"
                value={usJurisdiction}
                onChange={e => setUsJurisdiction(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {US_STATE_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-500/70 z-10" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={suggestOpen}
                aria-autocomplete="list"
                aria-controls="section-finder-suggest-list"
                aria-label={`Search ${meta.title}`}
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setSuggestOpen(true)
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setSuggestOpen(true)
                }}
                onBlur={() => {
                  window.setTimeout(() => setSuggestOpen(false), 150)
                }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown" && suggestOpen && suggestions.length > 0) {
                    e.preventDefault()
                    setActiveSuggestIndex(i => (i + 1) % suggestions.length)
                    return
                  }
                  if (e.key === "ArrowUp" && suggestOpen && suggestions.length > 0) {
                    e.preventDefault()
                    setActiveSuggestIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1))
                    return
                  }
                  if (e.key === "Escape") {
                    setSuggestOpen(false)
                    setActiveSuggestIndex(-1)
                    return
                  }
                  if (e.key === "Enter") {
                    if (suggestOpen && activeSuggestIndex >= 0 && suggestions[activeSuggestIndex]) {
                      e.preventDefault()
                      selectSuggestion(suggestions[activeSuggestIndex])
                      return
                    }
                    void doSearch(query)
                  }
                }}
                placeholder={meta.placeholder}
                className="w-full pl-12 pr-4 py-4 sm:py-[1.125rem] rounded-xl border-2 border-indigo-200/80 dark:border-indigo-800/80 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 text-base shadow-md shadow-indigo-500/5"
              />
              {suggestOpen && (suggestions.length > 0 || suggestLoading) && (
                <ul
                  id="section-finder-suggest-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
                >
                  {suggestLoading && suggestions.length === 0 && (
                    <li className="px-4 py-3 text-sm text-gray-400">Searching…</li>
                  )}
                  {suggestions.map((suggestion, index) => (
                    <li key={suggestion.normalizedQuery} role="option" aria-selected={index === activeSuggestIndex}>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => selectSuggestion(suggestion)}
                        onMouseEnter={() => setActiveSuggestIndex(index)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm transition-colors",
                          index === activeSuggestIndex
                            ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100",
                        )}
                      >
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{suggestion.displayLabel}</span>
                        {suggestion.title && (
                          <span
                            className="text-gray-500 dark:text-gray-400 line-clamp-1 truncate max-w-[min(100%,40rem)] inline-block align-bottom"
                            title={suggestion.title}
                          >
                            {" "}
                            · {suggestion.title}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => doSearch(query)}
              disabled={loading || !query.trim()}
              className="shrink-0 px-6 sm:px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-base shadow-md shadow-indigo-600/25 transition-colors"
            >
              {loading ? "Looking up…" : "Look up"}
            </button>
          </div>

          {popularQueries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Try a lookup
              </p>
              <div className="flex flex-wrap gap-1.5">
                {popularQueries.slice(0, 8).map(q => (
                  <button
                    key={q.normalizedQuery}
                    type="button"
                    onClick={() => {
                      setQuery(q.displayLabel)
                      const hint: SectionFinderLookupHint | undefined =
                        q.legalAuthorityId || (q.actId && q.sectionNumber)
                          ? {
                              authorityId: q.legalAuthorityId,
                              actId: q.actId,
                              section: q.sectionNumber,
                            }
                          : undefined
                      void doSearch(q.displayLabel, hint)
                    }}
                    className="inline-flex items-center rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 bg-white/80 dark:bg-gray-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{q.displayLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 sm:line-clamp-none">
            {meta.description}
          </p>
        </div>
      </section>

      {error && !isCreditError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-2">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div ref={resultsRef}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{result.matches.length}</span> result{result.matches.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            </p>
            {result.actStructure && (
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full">
                {formatActStructureBadge(result.actStructure)}
              </span>
            )}
            <span className="text-xs text-gray-400">
              Law current through {result.lawCurrencyCutoff ? new Date(result.lawCurrencyCutoff).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "30 June 2026"}
            </span>
          </div>

          {result.matches.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 py-8 text-center">
                <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No matching section in the index</p>
                <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                  {result.aiSuggestionsNote ||
                    "We've noted this lookup — coverage is expanding. AI suggestions below are not verified."}
                </p>
              </div>
              {(result.aiSuggestions?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    AI-suggested — not verified
                    {result.aiSuggestionModel ? ` · ${result.aiSuggestionModel}` : ""}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {result.aiSuggestions!.map((s) => (
                      <li
                        key={`${s.actId}-${s.section}-${s.title}`}
                        className="rounded-lg border border-amber-100 dark:border-amber-900/40 bg-white/70 dark:bg-gray-900/40 px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-gray-900 dark:text-white">
                          {s.actShort} §{s.section}
                          {s.title ? ` — ${s.title}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Confidence: {s.confidence}. {s.rationale}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {result.matches.map((entry, index) => (
                <SectionCard
                  key={entry.id}
                  entry={entry}
                  onAction={handleAction}
                  countryCode={activeCountryCode}
                  actStructure={result.actStructure}
                  defaultExpanded={result.matches.length === 1 || index === 0}
                />
              ))}
            </div>
          )}

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-3 mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{result.disclaimer}</p>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            Browse by category
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {meta.categoryCards.map(card => {
            const Icon = card.icon
            return (
              <div
                key={card.title}
                className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-2", card.bgClass)}>
                  <Icon className={cn("h-4 w-4", card.iconClass)} />
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">{card.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{card.description}</p>
              </div>
            )
          })}
          </div>
        </div>
      )}
      {creditsGate}
    </div>
  )
}
