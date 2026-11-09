"use client"

import { pollResearchUntilDone } from "@/lib/legal-research/job-polling"

import { useTranslations } from "next-intl"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import {
  clearLegalResearchLandingSession,
  loadLegalResearchLandingSession,
} from "@/components/marketing/landing-research-session"
import { ApiClientError } from "@/lib/api/client"
import { getAiReviewItem } from "@/lib/api/ai-review"
import {
  runLegalResearch,
  startLegalResearchJob,
  getResearchHistory,
  getSavedResearch,
  getResearchJobProgress,
  parseResearchJobResult,
  refineLegalResearch,
  researchResultFromHistory,
  researchResultFromSaved,
  searchResearchAuthorities,
} from "@/lib/api/ai"
import { getAgentJob } from "@/lib/api/agents"
import {
  sanitizeResearchJobError,
  toUserFacingErrorMessage,
  USER_CONNECTION_ERROR,
} from "@/lib/errors/user-facing-messages"
import type { ResearchHistoryItem } from "@/lib/api/ai"
import type {
  LegalResearchResponse,
  LegalResearchUnansweredQuestion,
  ResearchTaskKind,
} from "@/lib/api/types"
import type { CountryCode } from "@/lib/api/types"
import {
  appendResearchWorkspaceContext,
  createResearchWorkspace,
  getResearchWorkspace,
  isResearchWorkspaceFeatureDisabled,
  listResearchWorkspaceRevisions,
  updateResearchWorkspace,
  type ResearchContextKind,
  type ResearchWorkspace,
  type ResearchWorkspaceRevision,
} from "@/lib/api/research-workspaces"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { LegalResearchProgress, type ResearchJobPhase } from "@/components/legal-research/legal-research-progress"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Globe,
  History,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  SearchCode,
  Sparkles,
  X,
  ShieldCheck,
  Zap,
  BookOpen,
  Library,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AiModelPicker } from "@/components/credits/AiModelPicker"
import { CreditErrorBanner } from "@/components/credits/CreditErrorBanner"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { useAiModel } from "@/lib/contexts/ai-model-context"
import { CitationReviewDialog } from "@/components/research/citation-review-dialog"
import { ResearchActionsToolbar } from "@/components/research/research-actions-toolbar"
import { ResearchContextBar } from "@/components/research/research-context-bar"
import { JurisdictionMismatchDialog } from "@/components/research/jurisdiction-mismatch-dialog"
import { VoiceDictationButton } from "@/components/voice/voice-dictation-button"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { normalizeToSupportedCountry, getCountryName } from "@/lib/geo/detect-country"
import { isAllRegionsSelection, ALL_REGIONS_VALUE, matchRegionToJurisdictionList } from "@/lib/geo/country-states"
import {
  persistResearchJurisdictionChoice,
  readResearchJurisdictionChoice,
  resolveJurisdictionChoice,
  type JurisdictionChoice,
} from "@/lib/geo/jurisdiction-mismatch"
import {
  findResearchCountry,
  useResearchCountries,
} from "@/lib/hooks/use-research-countries"
import { getLocalesForCountry, pickDefaultLocaleForCountry } from "@/lib/i18n/locales"
import { useAutoResizeTextarea } from "@/lib/hooks/use-auto-resize-textarea"
import { SavedResearchList } from "@/components/research/saved-research-list"
import { ResearchPromptPanel } from "@/components/research/research-prompt-panel"
import { usePromptRefinement } from "@/lib/hooks/use-prompt-refinement"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PromptLibraryModal } from "@/components/task-patterns/prompt-library-modal"
import {
  domainsForJurisdiction,
  type Tier1Jurisdiction,
} from "@/lib/taxonomy/platform-taxonomy"
import {
  KnowledgeSourcePicker,
  DEFAULT_KNOWLEDGE_SOURCES,
  recommendedKnowledgeSources,
  sourceLabel,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import { CitationChallengeModal } from "@/components/citations/citation-challenge-modal"
import { ResearchResultsShell } from "@/components/research/research-results-shell"
import { ResearchAuthorityManager } from "@/components/research/research-authority-manager"
import type { ResearchAuthorityInput } from "@/lib/api/ai"
import {
  getCitationReviews,
  type CitationReviewState,
} from "@/lib/api/citation-reviews"
import {
  manualReviewStateFromCitationReviews,
} from "@/components/research/citation-review-dialog.helpers"
import type {
  CitationReviewTask,
  UnsupportedPropositionTask,
} from "@/lib/api/verification"
import { MatterResearchContext } from "@/components/research/matter-research-context"
import {
  WorkContextStartDialog,
  type WorkContextSelection,
} from "@/components/work-context/work-context-start-dialog"
import { startWorkContext } from "@/lib/api/work-context"
import { AnalyticsEvents } from "@/lib/analytics/events"
import { trackResearchEvent } from "@/lib/analytics/research-events"
import { researchTaskLabel } from "@/lib/research/research-task-sections"
import {
  inferAdaptiveResearchPreview,
  researchRecipeForTask,
  type DesiredResearchOutput,
} from "@/lib/research/adaptive-research-intent"

type ResearchOutputLanguage = "en" | "hi" | "hinglish"

type PendingContext = {
  questionId?: string
  affectedIssueIds: string[]
  sourceType: "user" | "matter" | "research_question" | "authority_manager"
  sourceId?: string
  targetQuery?: string
  action: "refine" | "answer" | "find_in_matter" | "authority_update"
}

/** Map UI locale picker values to legal-research API outputLanguage. */
function resolveResearchOutputLanguage(lang: string): ResearchOutputLanguage | undefined {
  if (lang === "en") return undefined
  if (lang === "hi" || lang === "hinglish") return lang
  // Regional Indian UI locales → Hindi research output until API supports them directly.
  return "hi"
}

const POLL_MS = 2000
const QUEUE_WAIT_TIMEOUT_MS = 60_000
const VERIFIED_RESEARCH_MODE = "DEEP" as const

async function runResearchViaJobOrSync(
  request: Parameters<typeof runLegalResearch>[0],
  tenantId: string,
  onUpdate: (update: {
    phase?: ResearchJobPhase
    message?: string
    result: LegalResearchResponse | null
    complete: boolean
  }) => void,
): Promise<LegalResearchResponse> {
  const { jobId } = await startLegalResearchJob(request, tenantId)
  // Never start an automatic duplicate inline request after queue/poll timeout.
  return waitForResearchJob(tenantId, jobId, onUpdate)

}

function questionDetails(question: LegalResearchUnansweredQuestion, index: number) {
  const asText = (value: unknown) =>
    typeof value === "string" ? value.trim() : ""
  if (typeof question === "string") {
    return { text: asText(question), questionId: `question-${index + 1}`, affectedIssueIds: [] as string[] }
  }
  const extended = question as LegalResearchUnansweredQuestion & { affectedIssueIds?: string[] }
  return {
    text: asText(question.question) || asText(question.text),
    questionId: question.id ?? `question-${index + 1}`,
    affectedIssueIds: Array.isArray(extended.affectedIssueIds) ? extended.affectedIssueIds : [],
  }
}

function revisionDiffSummary(revisions: ResearchWorkspaceRevision[]): string | null {
  const latest = revisions.at(-1)
  if (!latest) return null
  const previous = revisions.at(-2)
  if (!previous) return "Initial AI output linked"
  const delta = latest.aiOutput.outputMarkdown.length - previous.aiOutput.outputMarkdown.length
  if (delta === 0) return "No change in memorandum length"
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()} characters from the prior revision`
}

function mapProgressPhase(phase?: string): ResearchJobPhase | undefined {
  if (!phase) return undefined
  const allowed: ResearchJobPhase[] = [
    "queued",
    "classifying",
    "preflight",
    "planning",
    "retrieving",
    "resolving",
    "enriching",
    "generating",
    "verifying",
    "citation_audit",
    "finalizing",
    "completed",
  ]
  return allowed.includes(phase as ResearchJobPhase) ? (phase as ResearchJobPhase) : undefined
}

async function waitForResearchJob(
  tenantId: string,
  jobId: string,
  onUpdate: (update: {
    phase?: ResearchJobPhase
    message?: string
    result: LegalResearchResponse | null
    complete: boolean
    failed: boolean
    error?: string
  }) => void,
): Promise<LegalResearchResponse> {
  const waitStartedAt = Date.now()
  return pollResearchUntilDone(async (signal) => {
    const job = await getAgentJob(tenantId, jobId, signal)
    if (signal.aborted) return undefined
    const payload = job.payload && typeof job.payload === "object" ? job.payload as Record<string, unknown> : {}
    const progress = getResearchJobProgress(payload)
    const parsed = parseResearchJobResult(job.result && typeof job.result === "object" ? job.result as Record<string, unknown> : null)
    const complete = job.status === "COMPLETED", failed = job.status === "FAILED"
    const phase = mapProgressPhase(progress?.phase)
    if (!phase && !complete && !failed && Date.now() - waitStartedAt >= QUEUE_WAIT_TIMEOUT_MS) {
      throw new Error("No research worker claimed this job. Check research history before retrying; no duplicate request was started.")
    }
    onUpdate({ phase: phase ?? "queued", message: progress?.message, result: parsed, complete, failed,
      error: failed ? sanitizeResearchJobError(job.error ?? "Research job failed") : undefined })
    if (failed) throw new Error(sanitizeResearchJobError(job.error ?? "Research job failed"))
    if (complete) {
      if (!parsed) throw new Error("Research completed without a result")
      return parsed
    }
    return undefined
  }, { timeoutMs: 120_000, intervalMs: POLL_MS })
}

const QUERY_PLACEHOLDER =
  "What notice must a landlord give before terminating a monthly tenancy?"

function ConfidenceBadge({ confidence }: { confidence?: string }) {
  const color =
    confidence === "High"
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : confidence === "Medium"
        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        : "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {confidence ?? "—"}
    </span>
  )
}

/** Render inline bold (**text**) within a line of text. */
type ResearchTurn = { query: string; result: LegalResearchResponse }

export default function LegalResearchPage() {
  const t = useTranslations("matters")
  const tPromptRefine = useTranslations("promptRefine")
  const tCommon = useTranslations("common")
  const tResearchProgress = useTranslations("marketing.home.researchProgress")
  const tErr = useTranslations("errors")
  const { activeTenantId, activeTenant } = useTenant()
  const { toast } = useToast()

  const {
    countryCode: profileCountryCode,
    detectedRegion,
    isLoading: countryLoading,
    profileCountryCode: accountCountryCode,
    profileRegion: accountRegion,
    ipCountryCode,
    ipRegion,
    hasJurisdictionMismatch: jurisdictionMismatch,
    setCountryCode: _setSessionCountryCode,
  } = useDetectedCountry()

  const { countries: researchCountries } = useResearchCountries()

  const searchParams = useSearchParams()
  const urlCountryParam = searchParams.get("country")
  const urlCountry = (normalizeToSupportedCountry(urlCountryParam) || "") as CountryCode | ""

  const [countryCode, setCountryCode] = useState<CountryCode>(
    () => (urlCountry || "") as CountryCode,
  )
  const [jurisdiction, setJurisdiction] = useState(ALL_REGIONS_VALUE)
  const [mismatchDialogOpen, setMismatchDialogOpen] = useState(false)
  const [workContextOpen, setWorkContextOpen] = useState(false)
  const [workContext, setWorkContext] = useState<WorkContextSelection | null>(null)
  const countryManuallySet = useRef(Boolean(urlCountry))
  const mismatchPrompted = useRef(false)
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const { mode: aiModelMode, modelId: premiumModelId, setAiModel } = useAiModel()
  const [loading, setLoading] = useState(false)
  const [jobPhase, setJobPhase] = useState<ResearchJobPhase | undefined>()
  const [jobPhaseMessage, setJobPhaseMessage] = useState<string | undefined>()
  const [jobComplete, setJobComplete] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const [result, setResult] = useState<LegalResearchResponse | null>(null)
  const [researchMode, setResearchMode] = useState<"FAST" | "DEEP" | "GUIDANCE">(VERIFIED_RESEARCH_MODE)
  const [taskHint, setTaskHint] = useState<"AUTO" | ResearchTaskKind>("AUTO")
  const [desiredOutput, setDesiredOutput] = useState<DesiredResearchOutput>("ANSWER")
  const [outputLanguage, setOutputLanguage] = useState("en")
  const [sourceMode, setSourceMode] = useState<"AUTO" | "CUSTOM">("AUTO")
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [selectedSavedResearchIds, setSelectedSavedResearchIds] = useState<string[]>([])
  const [contextScope, setContextScope] = useState<"SELECTED" | "MATTER" | "FOLDERS">("MATTER")
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])
  const [challengeCitation, setChallengeCitation] = useState<{ title: string; source: string; url?: string } | null>(null)

  // Conversation thread state
  const [history, setHistory] = useState<ResearchTurn[]>([])
  const [contextInput, setContextInput] = useState("")
  const [contextKind, setContextKind] = useState<ResearchContextKind>("fact")
  const [pendingContext, setPendingContext] = useState<PendingContext>({
    affectedIssueIds: [],
    sourceType: "user",
    action: "refine",
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [refining, setRefining] = useState(false)
  const [pinnedAuthorityIds, setPinnedAuthorityIds] = useState<string[]>([])
  const [excludedAuthorityIds, setExcludedAuthorityIds] = useState<string[]>([])
  const [addedAuthorities, setAddedAuthorities] = useState<ResearchAuthorityInput[]>([])
  const [workspace, setWorkspace] = useState<ResearchWorkspace | null>(null)
  const [workspaceRevisions, setWorkspaceRevisions] = useState<ResearchWorkspaceRevision[]>([])
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(null)
  const [citationReviewState, setCitationReviewState] = useState<CitationReviewState | null>(null)
  const [selectedCitationTask, setSelectedCitationTask] = useState<CitationReviewTask | null>(null)

  // History sidebar state
  const [savedItems, setSavedItems] = useState<ResearchHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const [loadedHistoryKey, setLoadedHistoryKey] = useState<string | null>(null)
  const HISTORY_PREVIEW_COUNT = 5

  // UI state
  const [citationsOpen, setCitationsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryDomain, setLibraryDomain] = useState<string | null>(null)

  const resultRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<ResearchWorkspace | null>(null)
  const queryTextareaRef = useRef<HTMLTextAreaElement>(null)
  const drawerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const queryRef = useRef(query)
  queryRef.current = query
  useAutoResizeTextarea(queryTextareaRef, query)
  const upgradeAttempted = useRef(false)
  const [pendingUpgrade, setPendingUpgrade] = useState(false)

  const matterId = searchParams.get("matterId") ?? undefined
  const queryReady = query.trim().length >= 10
  const intentPreview = useMemo(() => inferAdaptiveResearchPreview(query), [query])
  const selectedTaskKind =
    taskHint === "AUTO" ? intentPreview.taskKind : taskHint
  const recommendedSources = useMemo(
    () => recommendedKnowledgeSources(selectedTaskKind, query),
    [query, selectedTaskKind],
  )
  const requestedKnowledgeSources =
    sourceMode === "AUTO" ? undefined : knowledgeSources
  const automaticEvidenceEstimate =
    intentPreview.targetCases > 0 || intentPreview.targetSections > 0
      ? FEATURE_CREDIT_COSTS.RESEARCH_ENRICH
      : 0
  const threadHydrated = useRef(false)
  const skipNextThreadSave = useRef(true)

  // No dedicated research-thread API exists yet. Keep the thread scoped to this
  // browser tab, tenant, and matter; persisted research results still use history.
  useEffect(() => {
    const key = `legal-research-thread:${activeTenantId ?? "anonymous"}:${matterId ?? "general"}`
    skipNextThreadSave.current = true
    try {
      const stored = window.sessionStorage.getItem(key)
      if (stored) setHistory(JSON.parse(stored) as ResearchTurn[])
    } catch {
      // Storage may be unavailable or contain stale data; research remains usable.
    } finally {
      threadHydrated.current = true
    }
  }, [activeTenantId, matterId])

  useEffect(() => {
    if (!threadHydrated.current) return
    if (skipNextThreadSave.current) {
      skipNextThreadSave.current = false
      return
    }
    const key = `legal-research-thread:${activeTenantId ?? "anonymous"}:${matterId ?? "general"}`
    try {
      if (history.length) window.sessionStorage.setItem(key, JSON.stringify(history.slice(-8)))
      else window.sessionStorage.removeItem(key)
    } catch {
      // Ignore quota/privacy-mode failures.
    }
  }, [activeTenantId, history, matterId])

  const { gate: creditsGate, handleApiError, openGate } = useInsufficientCreditsGate({
    feature: "research",
    tenantId: activeTenantId ?? undefined,
    countryCode: (profileCountryCode || countryCode || "IN") as CountryCode,
    requiredCredits: 1,
  })

  const promptRefine = usePromptRefinement({
    purpose: "research",
    tenantId: activeTenantId ?? undefined,
    getContext: useCallback(
      () => ({
        // Only fields accepted by RefinePromptDto (forbidNonWhitelisted).
        countryCode,
        jurisdiction: isAllRegionsSelection(jurisdiction) ? undefined : jurisdiction,
        ...(countryCode === "IN"
          ? (() => {
              const resolved = resolveResearchOutputLanguage(outputLanguage)
              return resolved ? { outputLanguage: resolved } : {}
            })()
          : {}),
        knowledgeSources: requestedKnowledgeSources,
      }),
      [
        countryCode,
        jurisdiction,
        outputLanguage,
        requestedKnowledgeSources,
      ],
    ),
  })

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const items = await getResearchHistory(activeTenantId ?? undefined)
      setSavedItems(items)
    } catch {
      // History is non-blocking — fail silently
    } finally {
      setHistoryLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => () => promptRefine.cancelPendingProceed(), [promptRefine.cancelPendingProceed])

  useEffect(() => {
    if (searchParams.get("upgrade") !== "1" || upgradeAttempted.current) return

    const session = loadLegalResearchLandingSession()
    const q = searchParams.get("q")?.trim() || session?.query?.trim()
    // Accept any valid 2-letter code from URL, not just IN/US
    const normalizedFromUrl = urlCountryParam
      ? (normalizeToSupportedCountry(urlCountryParam) as CountryCode | "")
      : ""
    const countryFromUrl = normalizedFromUrl || null

    if (countryFromUrl) {
      countryManuallySet.current = true
      setCountryCode(countryFromUrl as CountryCode)
    } else if (session?.countryCode) {
      countryManuallySet.current = true
      setCountryCode(session.countryCode as CountryCode)
    }

    if (q) {
      setQuery(q)
      clearLegalResearchLandingSession()
      setPendingUpgrade(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, urlCountryParam])

  // Pattern library / direct links: ?q= & ?country= without auto-run
  useEffect(() => {
    if (searchParams.get("upgrade") === "1") return
    const q = searchParams.get("q")?.trim()
    if (q) setQuery(q)
    const normalizedFromUrl = urlCountryParam
      ? (normalizeToSupportedCountry(urlCountryParam) as CountryCode | "")
      : ""
    if (normalizedFromUrl) {
      countryManuallySet.current = true
      setCountryCode(normalizedFromUrl as CountryCode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, urlCountryParam])

  useEffect(() => {
    if (!pendingUpgrade || upgradeAttempted.current) return
    if (query.trim().length < 10 || loading) return
    upgradeAttempted.current = true
    setPendingUpgrade(false)
    void handleResearchClick()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUpgrade, query, countryCode, loading])

  const researchDomains = useMemo(() => {
    const code = (countryCode || profileCountryCode || "IN") as Tier1Jurisdiction
    return domainsForJurisdiction(code, "research", "professional")
  }, [countryCode, profileCountryCode])

  const applyResearchLocation = useCallback(
    (nextCountry: string, nextRegion: string | null | undefined) => {
      const code = normalizeToSupportedCountry(nextCountry) as CountryCode
      if (!code) return
      setCountryCode(code)
      const countryConfig = findResearchCountry(researchCountries, code)
      const match = matchRegionToJurisdictionList(
        countryConfig?.supportedJurisdictions ?? [],
        nextRegion,
      )
      setJurisdiction(match || ALL_REGIONS_VALUE)
    },
    [researchCountries],
  )

  // Sync country from URL, then tenant / profile (unless user has already chosen)
  useEffect(() => {
    if (urlCountry) {
      countryManuallySet.current = true
      setCountryCode(urlCountry as CountryCode)
      return
    }
    if (countryManuallySet.current) return
    const tenantCountry = normalizeToSupportedCountry(activeTenant?.tenant.primaryCountry)
    const nextCountry = tenantCountry || profileCountryCode
    if (!countryLoading && nextCountry) {
      setCountryCode(nextCountry as CountryCode)
      if (detectedRegion && isAllRegionsSelection(jurisdiction) && nextCountry === profileCountryCode) {
        const countryConfig = findResearchCountry(researchCountries, nextCountry)
        const match = matchRegionToJurisdictionList(
          countryConfig?.supportedJurisdictions ?? [],
          detectedRegion,
        )
        if (match) setJurisdiction(match)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCountry, countryLoading, profileCountryCode, detectedRegion, researchCountries, activeTenant?.tenant.primaryCountry])

  // Prompt once when profile jurisdiction differs from IP location
  useEffect(() => {
    if (urlCountry) return
    if (countryManuallySet.current) return
    if (countryLoading || mismatchPrompted.current) return
    if (!jurisdictionMismatch || !accountCountryCode || !ipCountryCode) return

    const priorChoice = readResearchJurisdictionChoice()
    if (priorChoice) {
      mismatchPrompted.current = true
      const resolved = resolveJurisdictionChoice(
        priorChoice,
        { countryCode: accountCountryCode, region: accountRegion },
        { countryCode: ipCountryCode, region: ipRegion },
      )
      countryManuallySet.current = true
      applyResearchLocation(resolved.countryCode, resolved.region)
      return
    }

    mismatchPrompted.current = true
    setMismatchDialogOpen(true)
  }, [
    accountCountryCode,
    accountRegion,
    applyResearchLocation,
    countryLoading,
    ipCountryCode,
    ipRegion,
    jurisdictionMismatch,
    urlCountry,
  ])

  function handleJurisdictionChoice(choice: JurisdictionChoice) {
    if (!accountCountryCode || !ipCountryCode) return
    persistResearchJurisdictionChoice(choice)
    const resolved = resolveJurisdictionChoice(
      choice,
      { countryCode: accountCountryCode, region: accountRegion },
      { countryCode: ipCountryCode, region: ipRegion },
    )
    countryManuallySet.current = true
    applyResearchLocation(resolved.countryCode, resolved.region)
    setMismatchDialogOpen(false)
  }

  function handleJurisdictionMismatchDismiss() {
    persistResearchJurisdictionChoice("profile")
    setMismatchDialogOpen(false)
  }

  useEffect(() => {
    if (!countryCode) return
    const validLocales = getLocalesForCountry(countryCode)
    setOutputLanguage((current) =>
      validLocales.includes(current)
        ? current
        : pickDefaultLocaleForCountry(countryCode, current),
    )
  }, [countryCode])

  useEffect(() => {
    if (drawerOpen) {
      setTimeout(() => drawerTextareaRef.current?.focus(), 100)
    }
  }, [drawerOpen])

  function buildPriorContext(): string | undefined {
    if (history.length === 0) return undefined
    const last = history.at(-1)!
    const answerSnippet = last.result.answer.slice(0, 800)
    return `Prior question: ${last.query}\nPrior answer (summary): ${answerSnippet}`
  }

  function syncWorkspace(next: ResearchWorkspace | null) {
    workspaceRef.current = next
    setWorkspace(next)
  }

  async function refreshWorkspaceRevisions(workspaceId: string) {
    if (!activeTenantId) return
    try {
      setWorkspaceRevisions(await listResearchWorkspaceRevisions(activeTenantId, workspaceId))
    } catch {
      setWorkspaceStatus("Revision history is temporarily unavailable")
    }
  }

  async function ensureWorkspace(objective: string): Promise<ResearchWorkspace | null> {
    if (!activeTenantId || isResearchWorkspaceFeatureDisabled()) return null
    if (workspaceRef.current) return workspaceRef.current
    try {
      const created = await createResearchWorkspace(activeTenantId, {
        objective: objective.slice(0, 300),
        title: objective.slice(0, 120),
        jurisdiction: countryCode || undefined,
        region: isAllRegionsSelection(jurisdiction) ? undefined : jurisdiction,
        matterId,
        mode: researchMode === "DEEP" ? "deep" : "quick",
      })
      syncWorkspace(created)
      setWorkspaceRevisions([])
      setWorkspaceStatus("Workspace created · awaiting AI output")
      return created
    } catch {
      setWorkspaceStatus("Session-only fallback · workspace could not be saved")
      return null
    }
  }

  async function linkWorkspaceRevision(
    target: ResearchWorkspace | null,
    aiOutputId: string | undefined,
    previousAiOutputId?: string,
    context?: PendingContext,
    linkedContextKind?: ResearchContextKind,
    contextPersistenceFailed = false,
  ) {
    if (!activeTenantId || !target || !aiOutputId) {
      if (target && !aiOutputId) setWorkspaceStatus("Result available · AI output not linkable")
      return
    }
    const latestLinkedId = workspaceRevisions.at(-1)?.aiOutputId
    if (aiOutputId === previousAiOutputId || aiOutputId === latestLinkedId) {
      setWorkspaceStatus(
        contextPersistenceFailed
          ? "Same AI output · no revision linked · context stayed session-only"
          : "Refined result returned the same AI output · no revision linked",
      )
      return
    }
    try {
      const updated = await updateResearchWorkspace(activeTenantId, target.id, {
        expectedRevision: target.revision,
        status: "completed",
        revision: {
          aiOutputId,
          affectedIssueIds: context?.affectedIssueIds,
          provenance: {
            action: context?.action ?? "initial_research",
            questionId: context?.questionId,
            contextKind: context ? linkedContextKind : undefined,
          },
        },
      })
      syncWorkspace(updated)
      trackResearchEvent(AnalyticsEvents.RESEARCH_REVISION_COMPLETED, {
        workspaceId: updated.id,
        aiOutputId,
        revision: updated.revision,
        mode: updated.mode,
        affectedIssueCount: context?.affectedIssueIds.length ?? 0,
      })
      if (context?.action === "answer") {
        trackResearchEvent(AnalyticsEvents.RESEARCH_QUESTION_ANSWERED, {
          workspaceId: updated.id,
          questionId: context.questionId,
          mode: updated.mode,
          affectedIssueCount: context.affectedIssueIds.length,
        })
      }
      setWorkspaceStatus(
        contextPersistenceFailed
          ? `AI output linked at revision ${updated.revision} · context stayed session-only`
          : `AI output linked at workspace revision ${updated.revision}`,
      )
      await refreshWorkspaceRevisions(updated.id)
    } catch {
      try {
        const current = await getResearchWorkspace(activeTenantId, target.id)
        syncWorkspace(current)
      } catch {
        // The result remains usable even when workspace reconciliation fails.
      }
      setWorkspaceStatus("Result kept · AI output revision was not linked")
    }
  }

  async function runResearch(acceptedQuery?: string) {
    const effectiveQuery = (acceptedQuery ?? query).trim()
    if (effectiveQuery.length < 10) return
    setLoading(true)
    setError(null)
    setIsCreditError(false)
    setLoadedHistoryKey(null)
    setCitationsOpen(false)
    setJobPhase(undefined)
    setJobPhaseMessage("Submitting verified research")
    setJobComplete(false)
    setHasDraft(false)
    try {
      const request = {
        query: effectiveQuery,
        countryCode,
        jurisdiction: isAllRegionsSelection(jurisdiction) ? undefined : jurisdiction,
        aiModelMode,
        premiumModelId: aiModelMode === "PREMIUM" ? premiumModelId : undefined,
        researchMode,
        priorContext: buildPriorContext(),
        knowledgeSources: requestedKnowledgeSources,
        desiredOutput,
        requestedTaskKind: taskHint === "AUTO" ? undefined : taskHint,
        matterId,
        selectedDocumentIds,
        selectedSavedResearchIds,
        contextScope: matterId ? contextScope : undefined,
        selectedFolderIds,
        ...(countryCode === "IN"
          ? (() => {
              const resolved = resolveResearchOutputLanguage(outputLanguage)
              return resolved ? { outputLanguage: resolved } : {}
            })()
          : {}),
      }

      let res: LegalResearchResponse

      if (activeTenantId) {
        res = await runResearchViaJobOrSync(request, activeTenantId, ({ phase, message, result: draft, complete }) => {
          setJobPhase(phase)
          setJobPhaseMessage(message)
          setJobComplete(complete)
          if (draft?.answer) {
            setHasDraft(!complete)
            setResult(draft)
          }
        })
      } else {
        res = await runLegalResearch(request)
      }

      setResult(res)
      setJobComplete(true)
      setHasDraft(false)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    } catch (err: unknown) {
      const rawMsg =
        err instanceof ApiClientError
          ? err.statusCode === 502
            ? USER_CONNECTION_ERROR
            : err.statusCode === 504
              ? err.message
              : /timed out|timeout/i.test(err.message)
                ? tErr("timeout")
                : err.message
          : err instanceof Error
            ? /timed out|timeout/i.test(err.message)
              ? tErr("timeout")
              : err.message
            : tErr("connection")
      const msg = toUserFacingErrorMessage(rawMsg, tErr("connection"))
      const isPremiumCreditError = msg.toLowerCase().includes("not enough premium allowance") ||
        msg.toLowerCase().includes("premium allowance")
      if (isInsufficientCreditsError(err)) {
        setIsCreditError(true)
        if (isPremiumCreditError) {
          setAiModel("AUTO", premiumModelId)
          setResearchMode("FAST")
        }
        setError(handleApiError(err, msg))
      } else {
        // The backend may have completed the job even though the connection dropped.
        // Reload history — if the result landed, auto-display it instead of showing an error.
        const isNetworkError = msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("connection") ||
          msg.toLowerCase().includes("fetch")
        if (isNetworkError) {
          try {
            const freshItems = await getResearchHistory(activeTenantId ?? undefined)
            setSavedItems(freshItems)
            const latest = freshItems[0]
            const currentQuery = query.trim().toLowerCase()
            if (
              latest &&
              latest.inputQuery &&
              (latest.inputQuery.trim().toLowerCase() === currentQuery ||
                currentQuery.startsWith(latest.inputQuery.trim().toLowerCase().slice(0, 20)))
            ) {
              // Backend completed — silently load the result
              loadFromHistory(latest)
              return
            }
          } catch {
            // History reload failed — fall through to normal error handling
          }
          toast({
            title: "Connection interrupted",
            description: "The research may have completed — open Saved Research to check.",
            variant: "destructive",
          })
        } else {
          setIsCreditError(false)
          setError(msg)
          // Use a generic title for non-network backend errors so users aren't
          // told to "check their connection" when the problem is server-side.
          const toastTitle = msg.toLowerCase().includes("internal") || msg.toLowerCase().includes("unexpected")
            ? "Research failed"
            : tErr("connection")
          toast({ title: toastTitle, description: msg, variant: "destructive" })
        }
      }
    } finally {
      setLoading(false)
      setJobPhase(undefined)
      setJobPhaseMessage(undefined)
      setJobComplete(false)
      setHasDraft(false)
    }
  }

  async function handleResearchClick() {
    if (!queryReady || loading || promptRefine.loading || promptRefine.pendingProceed) return
    await promptRefine.runWithRefinement(query, {
      onAutoFill: setQuery,
      getCurrentText: () => queryRef.current,
      onProceed: runResearch,
    })
  }

  async function refineResearch(
    contextOverride?: string,
    metadataOverride?: { kind: ResearchContextKind; pending: PendingContext },
  ) {
    const additionalContext = (contextOverride ?? contextInput).trim()
    if (!additionalContext || !result) return
    const effectiveKind = metadataOverride?.kind ?? contextKind
    const effectivePending = metadataOverride?.pending ?? pendingContext
    setRefining(true)
    setDrawerOpen(false)
    setJobPhase(undefined)
    setJobPhaseMessage("Submitting research refinement")
    setJobComplete(false)
    setHasDraft(false)

    const currentTurn: ResearchTurn = { query, result }
    setHistory((prev) => [...prev, currentTurn])

    const refinedQuery = effectivePending.targetQuery ?? additionalContext
    setQuery(refinedQuery)

    const priorContext = [
      ...history.map((h) => `Q: ${h.query}\nA: ${h.result.answer.slice(0, 400)}`),
      `Q: ${query}\nA: ${result.answer.slice(0, 600)}`,
    ].join("\n\n---\n\n")

    try {
      let activeWorkspace = await ensureWorkspace(query)
      if (activeTenantId && activeWorkspace) {
        try {
          const appended = await appendResearchWorkspaceContext(activeTenantId, activeWorkspace.id, {
            expectedRevision: activeWorkspace.revision,
            kind: effectiveKind,
            label: effectivePending.targetQuery ?? "Research refinement context",
            content: {
              text: additionalContext,
              questionId: effectivePending.questionId,
              affectedIssueIds: effectivePending.affectedIssueIds,
            },
            provenance: {
              sourceType: effectivePending.sourceType,
              sourceId: effectivePending.sourceId ?? effectivePending.questionId,
              capturedAt: new Date().toISOString(),
              metadata: { action: effectivePending.action },
            },
            affectedIssueIds: effectivePending.affectedIssueIds,
          })
          activeWorkspace = {
            ...activeWorkspace,
            revision: appended.workspaceRevision,
            contextItems: [...activeWorkspace.contextItems, appended.item],
          }
          syncWorkspace(activeWorkspace)
          setWorkspaceStatus(`Context saved at workspace revision ${appended.workspaceRevision}`)
        } catch {
          try {
            activeWorkspace = await getResearchWorkspace(activeTenantId, activeWorkspace.id)
            syncWorkspace(activeWorkspace)
          } catch {
            // Keep the session result and context available locally.
          }
          setWorkspaceStatus("Context kept in this session · workspace append failed")
        }
      }

      const request = {
        query: refinedQuery,
        countryCode,
        jurisdiction: isAllRegionsSelection(jurisdiction) ? undefined : jurisdiction,
        aiModelMode,
        premiumModelId: aiModelMode === "PREMIUM" ? premiumModelId : undefined,
        researchMode,
        priorContext: [
          priorContext,
          pinnedAuthorityIds.length ? `Retain authorities: ${pinnedAuthorityIds.join(", ")}` : "",
          excludedAuthorityIds.length ? `Exclude authorities: ${excludedAuthorityIds.join(", ")}` : "",
          addedAuthorities.length ? `Add authorities: ${addedAuthorities.map((item) => item.title).join(", ")}` : "",
        ].filter(Boolean).join("\n").slice(0, 2000),
        knowledgeSources: requestedKnowledgeSources,
        desiredOutput,
        requestedTaskKind:
          (result.taskProfile?.kind as ResearchTaskKind | undefined) ??
          selectedTaskKind,
        asOfDate: result.researchPlan?.request?.asOfDate,
        eventDate: result.researchPlan?.request?.eventDate,
        matterId,
        selectedDocumentIds,
        selectedSavedResearchIds,
        contextScope: matterId ? contextScope : undefined,
        selectedFolderIds,
      }

      let res: LegalResearchResponse
      if (result.aiOutputId) {
        res = await refineLegalResearch(result.aiOutputId, {
          addedContext: additionalContext,
          pinnedAuthorityIds,
          excludedAuthorityIds,
          addedAuthorities,
          query: effectivePending.targetQuery ?? query,
          countryCode,
          jurisdiction: isAllRegionsSelection(jurisdiction) ? undefined : jurisdiction,
          desiredOutput,
          requestedTaskKind:
            (result.taskProfile?.kind as ResearchTaskKind | undefined) ??
            selectedTaskKind,
        }, activeTenantId ?? undefined)
      } else if (activeTenantId) {
        res = await runResearchViaJobOrSync(request, activeTenantId, ({ phase, message, result: draft, complete }) => {
          setJobPhase(phase)
          setJobPhaseMessage(message)
          setJobComplete(complete)
          if (draft?.answer) {
            setHasDraft(!complete)
            setResult(draft)
          }
        })
      } else {
        res = await runLegalResearch(request, activeTenantId ?? undefined)
      }

      const nextResult = { ...res, aiOutputId: res.aiOutputId ?? result.aiOutputId }
      setResult(nextResult)
      setContextInput("")
      setPendingContext({ affectedIssueIds: [], sourceType: "user", action: "refine" })
      setContextKind("fact")
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tErr("connection")
      const isCredErr = isInsufficientCreditsError(err)
      setIsCreditError(isCredErr)
      if (isCredErr) {
        setError(handleApiError(err, msg))
      } else {
        toast({ title: "Refinement failed", description: msg, variant: "destructive" })
      }
      setHistory((prev) => prev.slice(0, -1))
    } finally {
      setRefining(false)
      setJobPhase(undefined)
      setJobPhaseMessage(undefined)
      setJobComplete(false)
      setHasDraft(false)
    }
  }

  function openDrawerWithChip(question: string) {
    setContextInput(question)
    setContextKind("objective")
    setPendingContext({
      affectedIssueIds: [],
      sourceType: "research_question",
      targetQuery: question,
      action: "refine",
    })
    setDrawerOpen(true)
  }

  function answerQuestion(question: LegalResearchUnansweredQuestion, index: number) {
    const details = questionDetails(question, index)
    setContextInput("")
    setContextKind("fact")
    setPendingContext({
      questionId: details.questionId,
      affectedIssueIds: details.affectedIssueIds,
      sourceType: "research_question",
      sourceId: details.questionId,
      targetQuery: details.text,
      action: "answer",
    })
    setDrawerOpen(true)
  }

  function findQuestionInMatter(question: LegalResearchUnansweredQuestion, index: number) {
    if (!matterId) {
      toast({
        title: "No matter linked",
        description: "Open research from a matter to search its facts and evidence.",
      })
      return
    }
    const details = questionDetails(question, index)
    setContextInput("")
    setContextKind("evidence")
    setPendingContext({
      questionId: details.questionId,
      affectedIssueIds: details.affectedIssueIds,
      sourceType: "matter",
      sourceId: matterId,
      targetQuery: details.text,
      action: "find_in_matter",
    })
    setDrawerOpen(true)
  }

  function researchQuestionSeparately(question: LegalResearchUnansweredQuestion, index: number) {
    const { text } = questionDetails(question, index)
    reset()
    setQuery(text)
    setWorkspaceStatus(null)
    queryTextareaRef.current?.focus()
  }

  function reset() {
    setResult(null)
    setError(null)
    setIsCreditError(false)
    setQuery("")
    setHistory([])
    setContextInput("")
    setContextKind("fact")
    setPendingContext({ affectedIssueIds: [], sourceType: "user", action: "refine" })
    setDrawerOpen(false)
    setCitationsOpen(false)
    setLoadedHistoryKey(null)
    setPinnedAuthorityIds([])
    setExcludedAuthorityIds([])
    setAddedAuthorities([])
    syncWorkspace(null)
    setWorkspaceRevisions([])
    setWorkspaceStatus(null)
    setCitationReviewState(null)
    setSelectedCitationTask(null)
    setSelectedDocumentIds([])
    setSelectedSavedResearchIds([])
  }

  function restoreJurisdictionFromHistory(
    item: ResearchHistoryItem,
    histResult: LegalResearchResponse,
  ) {
    countryManuallySet.current = true

    const resultCountry = histResult.countryCode?.toUpperCase()
    const resultRegion =
      histResult.jurisdiction &&
      !isAllRegionsSelection(histResult.jurisdiction) &&
      !/^[A-Z]{2}$/i.test(histResult.jurisdiction.trim())
        ? histResult.jurisdiction
        : undefined

    const stored = item.jurisdiction?.trim()
    if (stored && /^[A-Z]{2}$/.test(stored)) {
      setCountryCode(stored as CountryCode)
      setJurisdiction(resultRegion ?? ALL_REGIONS_VALUE)
      return
    }

    if (resultCountry) {
      setCountryCode(resultCountry as CountryCode)
      setJurisdiction(stored || resultRegion || ALL_REGIONS_VALUE)
      return
    }

    if (stored) {
      setJurisdiction(stored)
    }
  }

  function loadFromHistory(item: ResearchHistoryItem) {
    const histResult = researchResultFromHistory(item)
    setResult(histResult)
    setQuery(item.inputQuery?.trim() || item.preview || "")
    restoreJurisdictionFromHistory(item, histResult)
    setLoadedHistoryKey(item.id)
    setHistory([])
    syncWorkspace(null)
    setWorkspaceRevisions([])
    setWorkspaceStatus(null)
    setCitationsOpen(false)
    setHistorySheetOpen(false)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  const outputIdParam = searchParams.get("outputId")
  const savedResearchIdParam = searchParams.get("savedResearchId")
  useEffect(() => {
    if (!savedResearchIdParam || !activeTenantId) return
    const loadedKey = `saved:${savedResearchIdParam}`
    if (loadedHistoryKey === loadedKey) return
    void getSavedResearch(savedResearchIdParam, activeTenantId)
      .then((item) => {
        const histResult = researchResultFromSaved(item)
        setResult(histResult)
        setQuery(item.query)
        if (item.countryCode) {
          countryManuallySet.current = true
          setCountryCode(item.countryCode as CountryCode)
        }
        const savedRegion =
          histResult.jurisdiction && !isAllRegionsSelection(histResult.jurisdiction)
            ? histResult.jurisdiction
            : undefined
        if (savedRegion) setJurisdiction(savedRegion)
        setLoadedHistoryKey(loadedKey)
        setHistory([])
        workspaceRef.current = null
        setWorkspace(null)
        setWorkspaceRevisions([])
        setWorkspaceStatus(null)
        setCitationsOpen(false)
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      })
      .catch(() => {
        toast({
          title: "Filed research unavailable",
          description: "The record may have been removed or you may no longer have access.",
          variant: "destructive",
        })
      })
  }, [
    activeTenantId,
    loadedHistoryKey,
    savedResearchIdParam,
    toast,
  ])

  useEffect(() => {
    if (!outputIdParam || !activeTenantId) return
    const match = savedItems.find((item) => item.id === outputIdParam)
    if (match) {
      if (loadedHistoryKey !== match.id) loadFromHistory(match)
      return
    }
    if (historyLoading) return
    void getAiReviewItem(outputIdParam, activeTenantId)
      .then((item) => {
        if (item.taskType !== "LEGAL_RESEARCH") return
        if (loadedHistoryKey === item.id) return
        loadFromHistory({
          id: item.id,
          inputQuery: item.title,
          outputMarkdown: item.outputMarkdown,
          preview: item.preview,
          createdAt: item.createdAt,
          citationCount: 0,
          verified: item.verified,
          jurisdiction: item.jurisdiction,
          legalDomain: item.legalDomain,
          requiresLawyerReview: true,
        })
      })
      .catch(() => {
        // Review item may have been cleared or is not research output.
      })
  }, [outputIdParam, savedItems, loadedHistoryKey, historyLoading, activeTenantId])

  useEffect(() => {
    const outputId = result?.aiOutputId
    if (!outputId || !activeTenantId) {
      setCitationReviewState(null)
      return
    }
    let active = true
    void getCitationReviews(outputId, activeTenantId)
      .then((state) => {
        if (active) setCitationReviewState(state)
      })
      .catch(() => {
        // Manual review is role-gated and remains separate from automated status.
        if (active) setCitationReviewState(null)
      })
    return () => {
      active = false
    }
  }, [result?.aiOutputId, activeTenantId])

  const handleCitationReviewSummary = useCallback((state: CitationReviewState) => {
    setCitationReviewState(state)
  }, [])

  const openCitationReview = useCallback((task: CitationReviewTask) => {
    setSelectedCitationTask(task)
  }, [])

  const openUnsupportedPropositionContext = useCallback((task: UnsupportedPropositionTask) => {
    const hasClaimedAuthority = task.citations.length > 0
    setContextKind(hasClaimedAuthority ? "authority" : "correction")
    setContextInput("")
    setPendingContext({
      questionId: task.propositionId,
      affectedIssueIds: task.propositionId ? [task.propositionId] : [],
      sourceType: "research_question",
      sourceId: task.propositionId ?? task.id,
      targetQuery: task.proposition,
      action: "refine",
    })
    setDrawerOpen(true)
  }, [])

  const turnNumber = history.length + 1
  const resultCitations = result?.citations ?? []
  const coverageTotal = result?.citationAudit?.totalClaims
  const coverageSupported = result?.citationAudit?.supportedClaims
  const coverageLabel =
    coverageTotal && coverageSupported != null
      ? `${Math.round((coverageSupported / coverageTotal) * 100)}% (${coverageSupported}/${coverageTotal} claims)`
      : resultCitations.length
        ? `${resultCitations.length} cited source${resultCitations.length === 1 ? "" : "s"}`
        : "Not reported"
  const relianceSafe = result?.citationAudit?.safeForReliance === true
  const latestRevisionDiff = revisionDiffSummary(workspaceRevisions)
  const displayedResearchMode = result?.researchMode ?? researchMode
  const displayedTask = researchTaskLabel(result?.taskProfile)
  const displayedSources =
    result?.taskProfile?.sourcePlan?.effectiveSources ??
    (sourceMode === "AUTO" ? recommendedSources : knowledgeSources)
  const displayedAsOfDate = result?.researchPlan?.asOfDate ?? result?.taskProfile?.asOfDate
  const displayedPublicationDecision =
    typeof result?.publicationDecision === "string"
      ? result.publicationDecision
      : result?.publicationDecision?.decision

  return (
    <div className="px-4 py-6 md:px-8">
      {/* Header — utility actions pinned top-right */}
      <div className="flex items-center justify-end gap-2 mb-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden sm:flex gap-1.5 shrink-0"
          onClick={() => setLibraryOpen(true)}
        >
          <Library className="h-3.5 w-3.5" />
          Patterns
        </Button>
        <button
          type="button"
          onClick={() => setHistorySheetOpen(true)}
          className="lg:hidden relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-card hover:bg-muted/50 active:scale-95 transition-all"
          aria-label="Saved research"
        >
          <History className="h-4.5 w-4.5 text-muted-foreground" />
          {savedItems.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {savedItems.length > 99 ? "99+" : savedItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Main content + sticky Saved Research sidebar */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Main content — page scrolls; sidebar stays put via sticky */}
        <div className="flex-1 min-w-0">
          {result ? (
            /* ── Results view ── */

            <div ref={resultRef} className="space-y-4 pb-32 sm:pb-24" data-tour="research-results">
              {(loading || refining) && (
                <LegalResearchProgress
                  active
                  query={query}
                  countryCode={countryCode}
                  researchMode={researchMode}
                  phase={jobPhase}
                  phaseMessage={jobPhaseMessage}
                  complete={jobComplete}
                  hasDraft={hasDraft}
                  isPriorContext={refining}
                />
              )}

              {query.trim() && (
                <ResearchPromptPanel
                  key={loadedHistoryKey ?? query}
                  query={query}
                  defaultOpen={false}
                />
              )}

              {/* Conversation breadcrumb */}
              {history.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {history.map((turn, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={turn.query}>
                        {turn.query.length > 40 ? turn.query.slice(0, 40) + "…" : turn.query}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    </div>
                  ))}
                  <span className="text-xs font-medium text-primary truncate max-w-[220px]" title={query}>
                    {query.length > 50 ? query.slice(0, 50) + "…" : query}
                  </span>
                </div>
              )}

              {/* Scope row — grouped pill cluster */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    {getCountryName(countryCode) || countryCode}
                    {result.jurisdiction ? ` · ${result.jurisdiction}` : ""}
                  </span>
                  {displayedTask && (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span className="text-xs font-medium text-primary">{displayedTask}</span>
                    </>
                  )}
                  {displayedAsOfDate && (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span className="text-xs text-muted-foreground">Law as of {displayedAsOfDate}</span>
                    </>
                  )}
                  {displayedSources.length > 0 && (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span className="text-xs text-muted-foreground">
                        Searched plan: {displayedSources.map((source) => sourceLabel(source as KnowledgeSource)).join(", ")}
                      </span>
                    </>
                  )}
                  {result.fromCache ? (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span className="text-xs text-muted-foreground">Cached · 0 credits</span>
                    </>
                  ) : result.creditsUsed != null ? (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span className="text-xs text-muted-foreground">
                        Credits used: {result.creditsUsed}
                        {result.timeToFirstDraftMs != null && result.timeToFirstDraftMs > 0
                          ? ` · Draft ready in ${(result.timeToFirstDraftMs / 1000).toFixed(1)}s`
                          : ""}
                      </span>
                    </>
                  ) : null}
                  {history.length > 0 && (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span className="text-xs text-primary font-medium">Turn {turnNumber}</span>
                    </>
                  )}
                </div>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {tCommon("new_research")}
                </Button>
                <ResearchActionsToolbar
                  result={result}
                  query={query}
                  countryCode={countryCode}
                  tenantId={activeTenantId}
                  aiOutputId={result.aiOutputId}
                  matterId={matterId}
                  onEnriched={setResult}
                  onPersisted={async (aiOutputId) => {
                    const approvedWorkspace = await ensureWorkspace(query)
                    await linkWorkspaceRevision(approvedWorkspace, aiOutputId)
                    await loadHistory()
                  }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Research quality and configuration">
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Research depth</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                    {result?.mode === "clarification_required" ? (
                      "Not run"
                    ) : (
                      <>
                        {displayedResearchMode === "DEEP" ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        ) : displayedResearchMode === "GUIDANCE" ? (
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 text-primary" />
                        )}
                        {displayedResearchMode === "DEEP"
                          ? "Verified"
                          : displayedResearchMode === "GUIDANCE"
                            ? "AI guidance"
                            : "Fast"}
                      </>
                    )}
                  </p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Model</p>
                  <p className="mt-1 text-sm font-medium">
                    {aiModelMode === "PREMIUM" ? "Premium" : "Auto"}
                  </p>

                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Confidence</p>
                  <div className="mt-1"><ConfidenceBadge confidence={result.confidence} /></div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Coverage</p>
                  <p className="mt-1 text-sm font-medium">{coverageLabel}</p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reliance</p>
                  <p className={`mt-1 text-sm font-medium ${relianceSafe ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {displayedPublicationDecision
                      ? displayedPublicationDecision.toLowerCase().replace(/_/g, " ")
                      : relianceSafe
                        ? "Audit supports reliance"
                        : "Lawyer review required"}
                  </p>
                </div>
              </div>

              {(workspaceStatus || workspace) && (
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {workspace ? `Durable workspace · revision ${workspace.revision}` : "Session workspace"}
                    </span>
                    {workspaceRevisions.length > 0 && (
                      <span className="text-muted-foreground">
                        {workspaceRevisions.length} linked AI revision{workspaceRevisions.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {workspaceStatus && <p className="mt-1 text-muted-foreground">{workspaceStatus}</p>}
                  {latestRevisionDiff && <p className="mt-1 text-muted-foreground">Diff summary: {latestRevisionDiff}</p>}
                </div>
              )}

              {/* Sources cited — collapsible, closed by default */}
              {resultCitations.length > 0 && (
                <Collapsible open={citationsOpen} onOpenChange={setCitationsOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                      <span className="text-sm font-semibold">
                        {tCommon("sources_cited")} ({resultCitations.length})
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          citationsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-b-lg border border-t-0 px-4 pb-4 pt-3 space-y-2">
                      {resultCitations.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 group">
                          <div className="flex-1 space-y-0.5">
                            <p className="text-sm font-medium">[{i + 1}] {c.title}</p>
                            <p className="text-xs text-muted-foreground">{c.source}</p>
                            {(c.judgmentDate || c.neutralCitation || c.citation || c.relevantParagraphs) && (
                              <p className="text-xs text-muted-foreground">
                                {[c.judgmentDate, c.neutralCitation, c.citation,
                                  Array.isArray(c.relevantParagraphs)
                                    ? `paras ${c.relevantParagraphs.join(", ")}`
                                    : c.relevantParagraphs]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {(c.exactPassage || c.passageText || c.excerpt) && (
                              <blockquote className="mt-1 border-l-2 border-primary/30 pl-2 text-xs leading-relaxed text-foreground">
                                “{c.exactPassage ?? c.passageText ?? c.excerpt}”
                              </blockquote>
                            )}
                            {(c.sourceName || c.sourceTier || c.authorityId || c.retrievedAt ||
                              c.sourceHash || c.pinpoint || c.provenance || c.integrity) && (
                              <p className="text-[11px] text-muted-foreground">
                                Provenance: {[c.provenance?.sourceName ?? c.sourceName ?? c.source,
                                  c.provenance?.sourceTier ?? c.sourceTier,
                                  c.provenance?.sourceId ?? c.authorityId,
                                  c.pinpoint,
                                  (c.provenance?.retrievedAt ?? c.retrievedAt)
                                    ? `retrieved ${new Date(c.provenance?.retrievedAt ?? c.retrievedAt!).toLocaleString()}`
                                    : undefined,
                                  (c.provenance?.contentHash ?? c.sourceHash)
                                    ? `hash ${(c.provenance?.contentHash ?? c.sourceHash)!.slice(0, 12)}…`
                                    : undefined,
                                  c.integrity?.status
                                    ? `integrity ${c.integrity.status.toLowerCase().replace(/_/g, " ")}`
                                    : undefined]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {c.url && (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary underline truncate block max-w-full"
                              >
                                {c.url}
                              </a>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setChallengeCitation(c)}
                            className="shrink-0 mt-0.5 text-[10px] font-medium text-muted-foreground border rounded px-1.5 py-0.5 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                          >
                            Challenge
                          </button>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <ResearchResultsShell
                result={result}
                query={query}
                citations={resultCitations}
                verificationCardProps={{
                  citationAudit: result.citationAudit,
                  totalCitations: resultCitations.length,
                  requiresLawyerReview: result.requiresLawyerReview,
                  researchMode: result.researchMode,
                  analyticalMode: result.analyticalMode,
                  relianceMode: result.relianceMode,
                  tripleCheckVerifiedCount: result.tripleCheck?.verifiedCount,
                  tripleCheckCorrectedCount: result.tripleCheck?.correctedCount,
                  fromCache: result.fromCache,
                  findings: result.findings,
                  propositions: result.propositions,
                  dimensions: result.dimensions,
                  publicationState: result.publicationState,
                  outputHash: result.outputHash,
                  generatedAt: result.generatedAt,
                  manualReview: citationReviewState
                    ? manualReviewStateFromCitationReviews(citationReviewState)
                    : undefined,
                  onResolveCitationTask: openCitationReview,
                  onReviewUnsupportedProposition: openUnsupportedPropositionContext,
                }}
                onAnswerQuestion={answerQuestion}
                onFindInMatter={findQuestionInMatter}
                onResearchSeparately={researchQuestionSeparately}
              />

              {resultCitations.length > 0 && (
                <ResearchAuthorityManager
                  citations={resultCitations}
                  pinnedAuthorityIds={pinnedAuthorityIds}
                  excludedAuthorityIds={excludedAuthorityIds}
                  addedAuthorities={addedAuthorities}
                  onPinnedChange={setPinnedAuthorityIds}
                  onExcludedChange={setExcludedAuthorityIds}
                  onAddedChange={setAddedAuthorities}
                  onSearch={(authorityQuery) =>
                    searchResearchAuthorities(
                      {
                        query: authorityQuery,
                        countryCode,
                        jurisdiction: isAllRegionsSelection(jurisdiction) ? undefined : jurisdiction,
                        limit: 8,
                      },
                      activeTenantId ?? undefined,
                    )
                  }
                  onApply={() => void refineResearch(
                    "Revise the memorandum using the selected authority instructions.",
                    {
                      kind: "authority",
                      pending: {
                        affectedIssueIds: [],
                        sourceType: "authority_manager",
                        action: "authority_update",
                      },
                    },
                  )}
                  applying={refining}
                />
              )}

              {/* AI-generated follow-up question chips — prominent action strips */}
              {(result.suggestedFollowUpQuestions?.length ?? 0) > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Explore further
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.suggestedFollowUpQuestions!.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => openDrawerWithChip(q)}
                        className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-xs text-left
                                   hover:bg-primary/5 hover:border-primary/40 hover:text-primary hover:shadow-sm
                                   transition-all cursor-pointer shadow-sm font-medium"
                      >
                        <Sparkles className="h-3 w-3 shrink-0 text-primary/60" />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Limitations */}
              {result.limitations && result.limitations.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Limitations
                  </p>
                  {result.limitations.map((l, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {l}
                    </p>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
            </div>
          ) : (
            /* ── Form view ── */
            <div className="space-y-4">

              {/* Compact header */}
              <div className="flex items-center gap-3 mb-1">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 shrink-0">
                  <SearchCode className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight leading-tight">{tCommon("ai_legal_research")}</h1>
                  <p className="text-xs text-muted-foreground">{tCommon("jurisdiction-scoped_answers_with_citations")}</p>
                </div>
              </div>

              {/* ── Primary query card — the main interaction target ── */}
              <div
                className="rounded-2xl border-2 bg-card shadow-sm overflow-hidden transition-all duration-200
                           border-border focus-within:border-primary/50 focus-within:shadow-md focus-within:shadow-primary/5"
                data-tour="research-query"
              >
                <div className="flex items-center justify-end gap-2 px-4 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setWorkContextOpen(true)}>
                    {workContext?.clientId ? "Work context set" : "Start work"}
                  </Button>
                </div>
                <WorkContextStartDialog
                  open={workContextOpen}
                  countryCode={countryCode}
                  onClose={() => setWorkContextOpen(false)}
                  onConfirm={(selection) => setWorkContext(selection)}
                />
                <ResearchContextBar
                  matterScope={Boolean(matterId)}
                  countryCode={countryCode}
                  jurisdiction={jurisdiction}
                  onJurisdictionChange={({ countryCode: code, jurisdiction: nextJurisdiction }) => {
                    countryManuallySet.current = true
                    setCountryCode(code)
                    setJurisdiction(nextJurisdiction)
                  }}
                  countryLoading={countryLoading}
                  outputLanguage={outputLanguage}
                  onOutputLanguageChange={setOutputLanguage}
                />

                {/* Label + textarea area */}
                <div className="px-4 pt-4 pb-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5 select-none">
                    <SearchCode className="h-3 w-3 text-primary/70" />
                    Describe your legal question
                  </label>

                  <div className="relative rounded-xl border border-border/60 bg-muted/30 px-3.5 pt-3 pb-10
                                  focus-within:border-primary/40 focus-within:bg-background transition-all">
                    <Textarea
                      ref={queryTextareaRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && queryReady && !loading && !promptRefine.loading && !promptRefine.pendingProceed) {
                          e.preventDefault()
                          void handleResearchClick()
                        }
                      }}
                      autoFocus
                      rows={5}
                      placeholder={`e.g. ${QUERY_PLACEHOLDER}`}
                      className="resize-none border-0 p-0 shadow-none focus-visible:ring-0 text-sm bg-transparent min-h-[140px] max-h-[min(50vh,420px)] overflow-y-hidden"
                    />
                    {/* Voice button + char hint — pinned to bottom-right inside the inner box */}
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                      {query.trim().length > 0 && query.trim().length < 10 && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          {10 - query.trim().length} more chars
                        </span>
                      )}
                      {query.trim().length >= 10 && (
                        <span className="text-[11px] text-muted-foreground/60 hidden sm:block">
                          ⌘↵ to run
                        </span>
                      )}
                      <VoiceDictationButton
                        onTranscript={(text, isFinal) => {
                          if (isFinal) setQuery(q => q ? q + " " + text : text)
                        }}
                        lang={countryCode === "IN" ? (outputLanguage === "hi" ? "hi-IN" : "en-IN") : "en-US"}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {queryReady && (
                  <div className="mx-4 mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Adaptive research plan
                        </p>
                        <p className="mt-1 text-xs font-medium leading-snug">
                          {taskHint === "AUTO" ? "Inferred: " : "Selected: "}
                          {researchTaskLabel({ kind: selectedTaskKind }) ?? intentPreview.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                          {researchRecipeForTask(selectedTaskKind)}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Research type
                          <select
                            value={taskHint}
                            onChange={(event) =>
                              setTaskHint(event.target.value as "AUTO" | ResearchTaskKind)
                            }
                            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground"
                          >
                            <option value="AUTO">Auto ({intentPreview.label})</option>
                            <option value="CASE_SURVEY">Case survey</option>
                            <option value="CASE_COMPARISON">Named-case comparison</option>
                            <option value="STATUTORY_INTERPRETATION">Act / section analysis</option>
                            <option value="SECTION_LOOKUP">Section lookup</option>
                            <option value="PROCEDURE">Procedure</option>
                            <option value="CURRENT_LAW">Current law</option>
                            <option value="GENERAL_RESEARCH">Subject / doctrine overview</option>
                            <option value="MATTER_OPINION">Matter opinion</option>
                          </select>
                        </label>
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Output
                          <select
                            value={desiredOutput}
                            onChange={(event) =>
                              setDesiredOutput(event.target.value as DesiredResearchOutput)
                            }
                            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground"
                          >
                            <option value="ANSWER">Answer</option>
                            <option value="AUTHORITY_LIST">Authority list</option>
                            <option value="ANALYSIS">Analysis</option>
                            <option value="MEMO">Memo</option>
                            <option value="VERIFICATION">Verification</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Topic chips — only when textarea is empty */}
                {!query && researchDomains.length > 0 && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Browse by topic</p>
                      <div className="flex flex-wrap gap-1.5">
                        {researchDomains.slice(0, 8).map((domain) => (
                          <button
                            key={domain.slug}
                            type="button"
                            onClick={() => {
                              setLibraryDomain(domain.slug)
                              setLibraryOpen(true)
                            }}
                            className="rounded-full border border-primary/20 bg-primary/5 text-primary px-2.5 py-1 text-[11px] hover:bg-primary/10 transition-colors"
                          >
                            {domain.label.split(" — ")[0].split(" – ")[0]}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setLibraryDomain(null)
                            setLibraryOpen(true)
                          }}
                          className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <BookOpen className="h-3 w-3" />
                          All patterns
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Knowledge source picker */}
                <div className="px-4 pb-3">
                  <MatterResearchContext
                    tenantId={activeTenantId ?? undefined}
                    matterId={matterId}
                    selectedDocumentIds={selectedDocumentIds}
                    selectedSavedResearchIds={selectedSavedResearchIds}
                    contextScope={contextScope}
                    onContextScopeChange={setContextScope}
                    selectedFolderIds={selectedFolderIds}
                    onSelectedFolderIdsChange={setSelectedFolderIds}
                    onMatterCountryChange={setCountryCode}
                    onSelectedDocumentIdsChange={setSelectedDocumentIds}
                    onSelectedSavedResearchIdsChange={setSelectedSavedResearchIds}
                  />
                </div>

                {/* Knowledge source picker */}
                <div className="px-4 pb-3 pt-1" data-tour="research-sources">
                  <KnowledgeSourcePicker
                    selected={knowledgeSources}
                    onChange={setKnowledgeSources}
                    countryCode={countryCode}
                    auto={sourceMode === "AUTO"}
                    onAutoChange={(auto) => setSourceMode(auto ? "AUTO" : "CUSTOM")}
                    recommended={recommendedSources}
                  />
                </div>

                {/* AI model + run button */}
                <div className="px-4 pb-4 pt-3 space-y-3 border-t">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Research depth</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setResearchMode("DEEP")}
                        aria-pressed={researchMode === "DEEP"}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          researchMode === "DEEP" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{tResearchProgress("verifiedModeHint")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResearchMode("FAST")}
                        aria-pressed={researchMode === "FAST"}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          researchMode === "FAST" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <Zap className="h-3.5 w-3.5" /> Fast
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{tResearchProgress("fastModeHint")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResearchMode("GUIDANCE")}
                        aria-pressed={researchMode === "GUIDANCE"}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          researchMode === "GUIDANCE" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <Sparkles className="h-3.5 w-3.5" /> AI only
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{tResearchProgress("guidanceModeHint")}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Model</span>
                    <div className="flex-1">
                      <AiModelPicker stageRouting />
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-11 text-sm font-semibold shadow-sm"
                    loading={loading || promptRefine.loading || promptRefine.pendingProceed}
                    disabled={!queryReady || loading || promptRefine.loading || promptRefine.pendingProceed}
                    onClick={() => void handleResearchClick()}
                  >
                    {loading || promptRefine.loading || promptRefine.pendingProceed ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SearchCode className="h-4 w-4" />
                    )}
                    {loading
                      ? t("researching")
                      : promptRefine.loading
                        ? t("promptRefinePreparing")
                        : promptRefine.pendingProceed
                          ? tPromptRefine("startingResearch", { seconds: promptRefine.countdownSeconds })
                          : t("runResearch")}
                  </Button>
                </div>
              </div>

              {/* Progress indicator */}
              {loading && (
                <LegalResearchProgress
                  active={loading}
                  query={query}
                  countryCode={countryCode}
                  researchMode={researchMode}
                  phase={jobPhase}
                  phaseMessage={jobPhaseMessage}
                  complete={jobComplete}
                  hasDraft={hasDraft}
                />
              )}

              {/* Error */}
              {error && !loading && (
                isCreditError ? (
                  <CreditErrorBanner message={error} onGetCredits={openGate} />
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">{error}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void runResearch()}
                        className="h-7 gap-1.5 text-destructive"
                        disabled={loading}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {t("runResearch")}
                      </Button>
                    </div>
                  </div>
                )
              )}

              <p className="text-xs text-muted-foreground leading-relaxed px-0.5">
                Umbrella provides legal information, document explanations, issue identification, and risk
                analysis. It is not a law firm and does not replace a licensed attorney. For legal advice
                specific to your situation, consult a qualified lawyer in your jurisdiction.
              </p>
            </div>
          )}
        </div>

        {/* Tips — mobile only (desktop tips live in sidebar) */}
        {!result && (
          <Card className="shrink-0 lg:hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Tips</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                "Be specific about jurisdiction and fact pattern for better citations.",
                "Verified mode requests an AI self-check; source verification may remain incomplete.",
                "Your country is auto-detected and synced across all features.",
              ].map((tip, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-primary font-bold mt-0.5">·</span>
                  <span>{tip}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── History sidebar — desktop only; mobile uses header button + sheet ── */}
        <aside className="hidden lg:flex w-full lg:w-[260px] shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh-5rem)] flex-col gap-3">
          <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0 max-h-[min(32rem,calc(100dvh-14rem))]">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Saved Research</span>
                {savedItems.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-medium">
                    {savedItems.length}
                  </span>
                )}
              </div>
              {result && (
                <button
                  onClick={reset}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  New
                </button>
              )}
            </div>

            {/* History list — scrolls inside the card when many items */}
            <div className="overflow-y-auto min-h-0 flex-1 divide-y">
              <SavedResearchList
                items={savedItems}
                loading={historyLoading}
                onSelect={loadFromHistory}
                limit={HISTORY_PREVIEW_COUNT}
                showAll={showAllHistory}
                onToggleShowAll={() => setShowAllHistory((v) => !v)}
                emptyMessage="Your past queries will appear here."
              />
            </div>
          </div>

          {/* Tips card (only on form view) */}
          {!result && (
            <Card className="shrink-0">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  "Be specific about jurisdiction and fact pattern for better citations.",
                  "Verified mode requests an AI self-check; source verification may remain incomplete.",
                  "Select a state or region when local rules matter; otherwise choose All regions.",
                ].map((tip, i) => (
                  <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-primary font-bold mt-0.5">·</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* ── Mobile saved research sheet ── */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 max-h-[85dvh] flex flex-col gap-0"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0 text-left space-y-1">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />
              Saved Research
              {savedItems.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-medium">
                  {savedItems.length}
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Tap a past query to reload its answer.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto min-h-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SavedResearchList
              items={savedItems}
              loading={historyLoading}
              onSelect={loadFromHistory}
            />
          </div>
          {result && (
            <div className="shrink-0 border-t px-4 py-3">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  reset()
                  setHistorySheetOpen(false)
                }}
              >
                <RefreshCw className="h-4 w-4" />
                {tCommon("new_research")}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CitationReviewDialog
        open={selectedCitationTask != null}
        onOpenChange={(open) => {
          if (!open) setSelectedCitationTask(null)
        }}
        outputId={result?.aiOutputId}
        tenantId={activeTenantId}
        task={selectedCitationTask}
        onSummaryChange={handleCitationReviewSummary}
      />

      {/* ── Floating Add Context button ── */}
      {result && !drawerOpen && !refining && (
        <button
          onClick={() => {
            setContextInput("")
            setPendingContext({ affectedIssueIds: [], sourceType: "user", action: "refine" })
            setContextKind("fact")
            setDrawerOpen(true)
          }}
          className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2
                     rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground
                     shadow-lg hover:bg-primary/90 active:scale-95 transition-all
                     sm:bottom-28 sm:right-8"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Add context
        </button>
      )}

      {/* ── Bottom context refinement drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t bg-background shadow-2xl
                          animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Add context &amp; refine</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {history.length > 0
                      ? `Turn ${turnNumber} · building on ${history.length} prior exchange${history.length !== 1 ? "s" : ""}`
                      : "Deepen the research with additional facts or a follow-up question"}
                  </p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full p-1.5 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {query && (
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    Current question
                  </p>
                  <p className="text-xs text-foreground line-clamp-2">{query}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Context category</span>
                  <select
                    value={contextKind}
                    onChange={(event) => setContextKind(event.target.value as ResearchContextKind)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="fact">Fact</option>
                    <option value="evidence">Evidence</option>
                    <option value="correction">Correction</option>
                    <option value="objective">Objective</option>
                    <option value="authority">Authority</option>
                  </select>
                </label>
                <div className="rounded-lg border bg-muted/20 px-3 py-2">
                  <p className="text-xs font-medium">Pending context summary</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {contextKind} · additional context for this research
                  </p>
                </div>
              </div>

              <Textarea
                ref={drawerTextareaRef}
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                rows={3}
                placeholder={
                  pendingContext.action === "answer"
                    ? "Enter the answer or additional fact for this unresolved question"
                    : pendingContext.action === "find_in_matter"
                      ? "Add the relevant fact or evidence found in the linked matter"
                      : "Add a fact, correction, authority, objective, or targeted follow-up question"
                }
                className="resize-none text-sm"
              />

              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 gap-2"
                  disabled={!contextInput.trim() || refining}
                  onClick={() => void refineResearch()}
                >
                  {refining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {refining ? "Researching…" : `Save ${contextKind} & refine`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDrawerOpen(false)}
                  className="gap-1.5"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Refining overlay */}
      {refining && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="rounded-xl bg-background border shadow-2xl overflow-hidden">
            <LegalResearchProgress
              active={refining}
              isPriorContext
              query={query}
              countryCode={countryCode}
              researchMode={researchMode}
              phase={jobPhase}
              phaseMessage={jobPhaseMessage}
              complete={jobComplete}
              hasDraft={hasDraft}
            />
          </div>
        </div>
      )}

      {creditsGate}

      <PromptLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        defaultFeature="research"
        defaultJurisdiction={countryCode || "IN"}
        defaultDomainSlug={libraryDomain}
      />

      {/* Citation Challenge modal */}
      <CitationChallengeModal
        open={!!challengeCitation}
        onOpenChange={(open: boolean) => { if (!open) setChallengeCitation(null) }}
        citation={challengeCitation}
        tenantId={activeTenantId ?? undefined}
      />

      {accountCountryCode && ipCountryCode && (
        <JurisdictionMismatchDialog
          open={mismatchDialogOpen}
          profile={{ countryCode: accountCountryCode, region: accountRegion }}
          ip={{ countryCode: ipCountryCode, region: ipRegion }}
          onChoose={handleJurisdictionChoice}
          onDismiss={handleJurisdictionMismatchDismiss}
        />
      )}

    </div>
  )
}
