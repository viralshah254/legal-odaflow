"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import { getAgentJob } from "@/lib/api/agents"
import {
  getResearchHistory,
  getResearchJobProgress,
  parseResearchJobResult,
  type ResearchHistoryItem,
} from "@/lib/api/ai"
import type { LegalResearchResponse } from "@/lib/api/types"
import { sanitizeResearchJobError } from "@/lib/errors/user-facing-messages"
import { isCitationAuditSafe } from "@/lib/api/verification"
import type { ResearchJobPhase } from "@/components/legal-research/legal-research-progress"
import { LegalResearchProgress } from "@/components/legal-research/legal-research-progress"
import { ResearchActionsToolbar } from "@/components/research/research-actions-toolbar"
import { ResearchResultsShell } from "@/components/research/research-results-shell"
import { SavedResearchList } from "@/components/research/saved-research-list"
import { ResearchPromptPanel } from "@/components/research/research-prompt-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertCircle,
  ArrowLeft,
  History,
  Loader2,
  SearchCode,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { ProvenancePanel } from "@/components/shared/provenance-panel"

const POLL_MS = 2000
const HISTORY_PREVIEW_COUNT = 5

function mapProgressPhase(phase?: string): ResearchJobPhase | undefined {
  if (!phase) return undefined
  const allowed: ResearchJobPhase[] = [
    "classifying",
    "retrieving",
    "generating",
    "verifying",
    "citation_audit",
    "finalizing",
    "completed",
  ]
  return allowed.includes(phase as ResearchJobPhase) ? (phase as ResearchJobPhase) : undefined
}

export default function ResearchSessionPage() {
  const params = useParams<{ jobId: string }>()
  const jobId = params.jobId
  const router = useRouter()
  const { activeTenantId } = useTenant()

  const [query, setQuery] = useState("")
  const [researchMode, setResearchMode] = useState<"FAST" | "DEEP" | "GUIDANCE">("FAST")
  const [countryCode, setCountryCode] = useState("IN")
  const [matterId, setMatterId] = useState<string | undefined>()
  const [status, setStatus] = useState<string>("QUEUED")
  const [phase, setPhase] = useState<ResearchJobPhase | undefined>()
  const [result, setResult] = useState<LegalResearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedItems, setSavedItems] = useState<ResearchHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  /** After Enrich, keep local result — job.result is never patched by enrich. */
  const enrichedLocallyRef = useRef(false)

  const complete = status === "COMPLETED"
  const failed = status === "FAILED"
  const active = !complete && !failed
  const hasDraft = Boolean(result?.answer) && active && !complete

  const loadHistory = useCallback(async () => {
    if (!activeTenantId) return
    setHistoryLoading(true)
    try {
      setSavedItems(await getResearchHistory(activeTenantId))
    } catch {
      // non-blocking
    } finally {
      setHistoryLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!activeTenantId || !jobId) return

    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const job = await getAgentJob(activeTenantId, jobId)
        if (cancelled) return

        setStatus(job.status)
        const paramsObj =
          job.payload && typeof job.payload === "object"
            ? (job.payload as Record<string, unknown>)
            : {}
        const jobParams =
          paramsObj.params && typeof paramsObj.params === "object"
            ? (paramsObj.params as Record<string, unknown>)
            : {}
        if (typeof jobParams.query === "string") setQuery(jobParams.query)
        if (
          jobParams.researchMode === "DEEP" ||
          jobParams.researchMode === "FAST" ||
          jobParams.researchMode === "GUIDANCE"
        ) {
          setResearchMode(jobParams.researchMode)
        }
        if (typeof jobParams.countryCode === "string") setCountryCode(jobParams.countryCode)
        if (typeof jobParams.matterId === "string") setMatterId(jobParams.matterId)

        const progress = getResearchJobProgress(paramsObj)
        setPhase(mapProgressPhase(progress?.phase))

        // Do not clobber a locally enriched result with the stale job snapshot.
        if (!enrichedLocallyRef.current) {
          const parsed = parseResearchJobResult(
            job.result && typeof job.result === "object"
              ? (job.result as Record<string, unknown>)
              : null,
          )
          if (parsed) setResult(parsed)
        }

        if (job.status === "FAILED") {
          setError(sanitizeResearchJobError(job.error ?? "Research job failed"))
        }

        if (job.status === "COMPLETED" || job.status === "FAILED") {
          if (interval) {
            clearInterval(interval)
            interval = null
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load research session")
        }
      }
    }

    void poll()
    interval = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [activeTenantId, jobId])

  useEffect(() => {
    if (complete) {
      void loadHistory()
    }
  }, [complete, loadHistory])

  function openHistoryItem(item: ResearchHistoryItem) {
    setHistorySheetOpen(false)
    const q = item.inputQuery?.trim()
    router.push(q ? `/app/research?q=${encodeURIComponent(q)}` : "/app/research")
  }

  const headerBadge = useMemo(() => {
    if (failed) return <Badge variant="destructive">Failed</Badge>
    if (complete) return <Badge className="bg-green-600/10 text-green-700 border-green-600/20">Complete</Badge>
    if (hasDraft) return <Badge className="bg-amber-600/10 text-amber-700 border-amber-600/20">Draft ready</Badge>
    return <Badge variant="secondary">Running</Badge>
  }, [complete, failed, hasDraft])

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <SearchCode className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold leading-tight">Research session</h1>
            {headerBadge}
          </div>
          {query && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 lg:hidden" title={query}>
              {query}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setHistorySheetOpen(true)}
            className="lg:hidden relative flex h-10 w-10 items-center justify-center rounded-xl border bg-card hover:bg-muted/50 active:scale-95 transition-all"
            aria-label="Saved research"
          >
            <History className="h-5 w-5 text-muted-foreground" />
            {savedItems.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {savedItems.length > 99 ? "99+" : savedItems.length}
              </span>
            )}
          </button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/app/research">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 min-w-0 space-y-4 pb-24">
          {active && (
            <LegalResearchProgress
              active
              query={query}
              countryCode={countryCode === "US" ? "US" : "IN"}
              researchMode={researchMode}
              complete={complete}
              hasDraft={hasDraft}
              phase={phase}
            />
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex gap-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {hasDraft && !complete && researchMode !== "GUIDANCE" && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              Draft ready — verifying citations. Counts may update when verification finishes.
            </div>
          )}

          {result?.answer && (
            <>
              {query.trim() && (
                <ResearchPromptPanel query={query} defaultOpen={false} />
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {result.researchMode === "DEEP" ? (
                  isCitationAuditSafe(result.citationAudit) &&
                  (result.publicationState === "READY_FOR_LAWYER_REVIEW" ||
                    result.publicationState === "VERIFIED_WITH_LIMITATIONS" ||
                    result.publicationState === "RESEARCH_BACKED") ? (
                    <Badge className="gap-1 bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/20">
                      <ShieldCheck className="h-3 w-3" />
                      {result.publicationState === "READY_FOR_LAWYER_REVIEW"
                        ? "Verified Research"
                        : "Research backed"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs font-normal border-amber-500/40 text-amber-700 dark:text-amber-400"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Deep research — verification limited
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Zap className="h-3 w-3" />
                    Fast Answer
                  </Badge>
                )}
                {result.modelName && (
                  <span className="text-xs text-muted-foreground">{result.modelName}</span>
                )}
                <div className="flex-1" />
                <ResearchActionsToolbar
                  result={result}
                  query={query}
                  countryCode={countryCode}
                  tenantId={activeTenantId}
                  aiOutputId={result.aiOutputId}
                  matterId={matterId}
                  onEnriched={(next: LegalResearchResponse) => {
                    enrichedLocallyRef.current = true
                    setResult(next)
                  }}
                />
              </div>

              <ResearchResultsShell
                result={result}
                query={query}
                citations={result.citations}
                verificationCardProps={{
                  citationAudit: result.citationAudit,
                  totalCitations: result.citations.length,
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
                }}
              />
            </>
          )}

          {!result?.answer && active && !error && (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Preparing your research…</span>
            </div>
          )}
        </div>

        {/* ── Sidebar — desktop only ── */}
        <aside className="hidden lg:flex w-full lg:w-[280px] shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh-5rem)] flex-col gap-3">
          {/* Provenance panel — shown when research is complete */}
          {result?.citations && result.citations.length > 0 && (
            <ProvenancePanel
              title="Sources"
              collapsible={false}
              items={result.citations.map((c, i) => ({
                id: `cite-${i}`,
                title: typeof c === "string" ? c : (c as { title?: string }).title ?? `Source ${i + 1}`,
                citation: typeof c === "string" ? c : (c as { citation?: string }).citation,
                sourceUrl: typeof c === "string" ? undefined : (c as { sourceUrl?: string; url?: string }).sourceUrl ?? (c as { url?: string }).url,
                jurisdiction: typeof c === "string" ? undefined : (c as { jurisdiction?: string }).jurisdiction,
                confidence: typeof c === "string" ? 0.8 : ((c as { confidence?: number }).confidence ?? 0.8),
                treatmentStatus: typeof c === "string" ? undefined : (c as { treatmentStatus?: string }).treatmentStatus,
              }))}
            />
          )}

          <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0 max-h-[min(32rem,calc(100dvh-14rem))]">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Saved Research</span>
                {savedItems.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-medium">
                    {savedItems.length}
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-y-auto min-h-0 flex-1 lg:min-h-[120px]">
              <SavedResearchList
                items={savedItems}
                loading={historyLoading}
                onSelect={openHistoryItem}
                limit={HISTORY_PREVIEW_COUNT}
                showAll={showAllHistory}
                onToggleShowAll={() => setShowAllHistory((v) => !v)}
                emptyMessage="Completed research appears here."
              />
            </div>
          </div>
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
              Tap a past query to open it in Legal Research.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto min-h-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SavedResearchList
              items={savedItems}
              loading={historyLoading}
              onSelect={openHistoryItem}
              emptyMessage="Completed research appears here."
            />
          </div>
          <div className="shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" className="w-full gap-2" asChild>
              <Link href="/app/research" onClick={() => setHistorySheetOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
                Back to Legal Research
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
