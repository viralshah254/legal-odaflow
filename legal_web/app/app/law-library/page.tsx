"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  getIngestStatus,
  getIngestJobStatus,
  listActSections,
  listIndiaAbbreviations,
  listStatuteRegistry,
  resolveIndexedSectionCount,
  searchLawLibrary,
  enqueueCorpusSync,
  seedPrioritySections,
  type IndiaAbbreviationEntry,
  type LawLibrarySearchResult,
  type StatuteRegistryEntry,
  type StatuteSectionRow,
} from "@/lib/api/law-library"
import { useToast } from "@/hooks/use-toast"
import {
  CorpusSyncProgressBanner,
  type CorpusSyncProgressState,
} from "@/components/law-library/corpus-sync-progress"
import {
  BookOpen,
  BookMarked,
  Database,
  FileText,
  Globe2,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PromptLibraryModal } from "@/components/task-patterns/prompt-library-modal"
import {
  domainsForJurisdiction,
  PLATFORM_DOMAIN_BY_SLUG,
  type Tier1Jurisdiction,
} from "@/lib/taxonomy/platform-taxonomy"

const COUNTRY_CODES = ["IN", "US", "KE", "GB"] as const

export default function LawLibraryPage() {
  const t = useTranslations("lawyer")
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const [countryCode, setCountryCode] = useState<string>("IN")
  const [query, setQuery] = useState("")
  const [actFilter, setActFilter] = useState("")
  const [searching, setSearching] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<CorpusSyncProgressState | null>(null)
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncNotifiedRef = useRef<string | null>(null)
  const [results, setResults] = useState<LawLibrarySearchResult | null>(null)
  const [selectedActId, setSelectedActId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<"acts" | "detail">("acts")
  const [activeTab, setActiveTab] = useState("browse")
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [domainFilter, setDomainFilter] = useState<string | null>(null)

  const { data: ingestStatus, isLoading: statusLoading, refetch: refetchStatus } = useApiData(
    ["law-library-ingest", countryCode],
    { apiFn: () => getIngestStatus(countryCode) },
  )

  const { data: registry = [], isLoading: registryLoading, refetch: refetchRegistry } = useApiData(
    ["law-library-registry", countryCode],
    { apiFn: () => listStatuteRegistry(countryCode) },
  )

  const { data: indiaAbbreviations = [], isLoading: abbrevLoading } = useApiData(
    ["law-library-india-abbreviations"],
    { apiFn: () => listIndiaAbbreviations(), enabled: countryCode === "IN" },
  )

  const filteredRegistry = useMemo(() => {
    let rows = registry
    const q = actFilter.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (a) =>
          a.shortName.toLowerCase().includes(q) ||
          a.fullName.toLowerCase().includes(q) ||
          a.acronyms.some((ac) => ac.toLowerCase().includes(q)),
      )
    }
    if (domainFilter) {
      const domain = PLATFORM_DOMAIN_BY_SLUG[domainFilter]
      const tags = domain?.statuteTags ?? []
      if (tags.length > 0) {
        rows = rows.filter((a) =>
          (a.practiceAreas ?? []).some((tag) => tags.includes(tag)),
        )
      }
    }
    return rows
  }, [registry, actFilter, domainFilter])

  const browseDomains = useMemo(
    () => domainsForJurisdiction(countryCode as Tier1Jurisdiction, "law_library", "professional"),
    [countryCode],
  )

  const selectedAct: StatuteRegistryEntry | null =
    registry.find((a) => a.id === selectedActId) ?? filteredRegistry[0] ?? null

  const indexedCount = resolveIndexedSectionCount(ingestStatus, countryCode)
  const registryActCount = registry.length
  const expectedPrioritySections = registry.reduce(
    (n, a) => n + a.prioritySections.length,
    0,
  )

  const runSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await searchLawLibrary(query.trim(), countryCode)
      setResults(res)
    } finally {
      setSearching(false)
    }
  }

  const registryByActId = useMemo(
    () => new Map(registry.map((a) => [a.id, a.shortName] as const)),
    [registry],
  )

  const handleCorpusSync = async () => {
    setSyncing(true)
    const baselineIndexed = indexedCount
    try {
      const result = await enqueueCorpusSync(countryCode)
      if (result.status === "FAILED") {
        throw new Error(result.message ?? "Failed to enqueue corpus sync")
      }
      toast({
        title: "Corpus sync started",
        description: `Indexing ${countryCode} statutes in the background. Progress updates below.`,
      })
      setSyncProgress({
        jobId: result.agentJobId,
        countryCode,
        status: result.status,
        startedAt: Date.now(),
        baselineIndexed,
      })
    } catch (err) {
      toast({
        title: "Could not start corpus sync",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!syncProgress) return
    if (syncProgress.status === "COMPLETED" || syncProgress.status === "FAILED") return

    const poll = async () => {
      try {
        const [job, status] = await Promise.all([
          getIngestJobStatus(syncProgress.jobId),
          getIngestStatus(syncProgress.countryCode),
        ])
        await Promise.all([refetchStatus(), refetchRegistry()])

        setSyncProgress((prev) =>
          prev ? { ...prev, status: job.status, countryCode: job.countryCode ?? prev.countryCode } : null,
        )

        if (job.status === "COMPLETED" && syncNotifiedRef.current !== `${syncProgress.jobId}:completed`) {
          syncNotifiedRef.current = `${syncProgress.jobId}:completed`
          toast({
            title: "Corpus sync complete",
            description: `${resolveIndexedSectionCount(status, syncProgress.countryCode).toLocaleString()} sections indexed for ${syncProgress.countryCode}.`,
          })
        } else if (job.status === "FAILED" && syncNotifiedRef.current !== `${syncProgress.jobId}:failed`) {
          syncNotifiedRef.current = `${syncProgress.jobId}:failed`
          toast({
            title: "Corpus sync failed",
            description: job.error ?? "Check worker logs and try again.",
            variant: "destructive",
          })
        }
      } catch {
        // keep polling — transient network errors are expected during long jobs
      }
    }

    void poll()
    syncPollRef.current = setInterval(() => void poll(), 3000)
    return () => {
      if (syncPollRef.current) clearInterval(syncPollRef.current)
    }
  }, [syncProgress?.jobId, syncProgress?.status, refetchRegistry, refetchStatus, toast])

  const handleSeedPriority = async () => {
    setSeeding(true)
    try {
      await seedPrioritySections(countryCode)
      toast({
        title: "Priority sections seeded",
        description: `Catalogued priority sections for ${countryCode}.`,
      })
      await Promise.all([refetchStatus(), refetchRegistry()])
    } catch (err) {
      toast({
        title: "Seed failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    const urlCountry = searchParams.get("country")?.toUpperCase()
    const urlQuery = searchParams.get("q")?.trim()
    const cc =
      urlCountry && COUNTRY_CODES.includes(urlCountry as (typeof COUNTRY_CODES)[number])
        ? urlCountry
        : countryCode

    if (urlCountry && COUNTRY_CODES.includes(urlCountry as (typeof COUNTRY_CODES)[number])) {
      setCountryCode(urlCountry)
    }
    if (urlQuery) {
      setQuery(urlQuery)
      setActiveTab("search")
      void (async () => {
        setSearching(true)
        try {
          const res = await searchLawLibrary(urlQuery, cc)
          setResults(res)
        } finally {
          setSearching(false)
        }
      })()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const selectAct = (actId: string) => {
    setSelectedActId(actId)
    setMobileTab("detail")
  }

  const handleSectionClick = (act: StatuteRegistryEntry, section: string) => {
    setQuery(`${act.shortName} section ${section}`)
    setActiveTab("search")
    void (async () => {
      setSearching(true)
      try {
        const res = await searchLawLibrary(`${act.shortName} section ${section}`, countryCode)
        setResults(res)
      } finally {
        setSearching(false)
      }
    })()
  }

  return (
    <div className="px-4 py-6 md:px-8 space-y-6 max-w-6xl">

      {/* ── Hero header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 shrink-0">
            <BookMarked className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("nav.lawLibrary")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Browse statutes, search indexed corpus, and explore legal authorities
            </p>
          </div>
        </div>

        {/* Country selector + admin actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={countryCode} onValueChange={(v) => { setCountryCode(v); setSelectedActId(null); setMobileTab("acts"); setDomainFilter(null) }}>
            <SelectTrigger className="w-[90px] h-8 text-xs">
              <Globe2 className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTenantId && indexedCount === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={seeding}
              onClick={() => void handleSeedPriority()}
              className="h-8 text-xs gap-1.5"
            >
              {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Seed sections
            </Button>
          )}

          {activeTenantId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncing || syncProgress?.status === "QUEUED" || syncProgress?.status === "RUNNING"}
              onClick={() => void handleCorpusSync()}
              className="h-8 text-xs gap-1.5"
            >
              {syncing || syncProgress?.status === "QUEUED" || syncProgress?.status === "RUNNING"
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              {syncProgress?.status === "QUEUED" || syncProgress?.status === "RUNNING" ? "Syncing…" : "Sync corpus"}
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setLibraryOpen(true)}
          >
            <MessageSquare className="h-3 w-3" />
            Example tasks
          </Button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Indexed</p>
            <p className="text-base font-bold leading-tight">
              {statusLoading ? "—" : indexedCount.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground ml-1">sections</span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Registry</p>
            <p className="text-base font-bold leading-tight">
              {registryLoading ? "—" : registryActCount.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground ml-1">acts</span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Priority</p>
            <p className="text-base font-bold leading-tight">
              {expectedPrioritySections.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground ml-1">catalogued</span>
            </p>
          </div>
        </div>
      </div>

      {syncProgress && (
        <CorpusSyncProgressBanner
          progress={syncProgress}
          indexedCount={indexedCount}
          acts={ingestStatus?.acts ?? []}
          registryByActId={registryByActId}
          onDismiss={() => setSyncProgress(null)}
        />
      )}

      {/* ── Domain filter chips ── */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setDomainFilter(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
            !domainFilter
              ? "border-primary bg-primary/10 text-primary shadow-sm"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          All domains
        </button>
        {browseDomains.map((domain) => (
          <button
            key={domain.slug}
            type="button"
            onClick={() => setDomainFilter(domain.slug)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all max-w-[200px] truncate",
              domainFilter === domain.slug
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {domain.label.split(" — ")[0]}
          </button>
        ))}
      </div>

      {/* ── Mobile act/detail tabs ── */}
      <div className="lg:hidden flex gap-1 sticky top-0 z-10 bg-background/95 backdrop-blur py-1 -mx-1 px-1">
        <button
          type="button"
          onClick={() => setMobileTab("acts")}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
            mobileTab === "acts" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          Acts ({filteredRegistry.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("detail")}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
            mobileTab === "detail" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          Detail
        </button>
      </div>

      {/* ── Main tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 bg-muted/60 p-0.5 rounded-lg">
          <TabsTrigger value="browse" className="h-8 rounded-md text-xs px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Acts &amp; sections
          </TabsTrigger>
          {countryCode === "IN" && (
            <TabsTrigger value="abbreviations" className="h-8 rounded-md text-xs px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              Abbreviations
            </TabsTrigger>
          )}
          <TabsTrigger value="search" className="h-8 rounded-md text-xs px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Search corpus
          </TabsTrigger>
        </TabsList>

        {/* ── Browse tab ── */}
        <TabsContent value="browse" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Act list */}
            <div className={cn("lg:col-span-1 flex flex-col gap-3", mobileTab !== "acts" && "hidden lg:flex")}>
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Statute Registry</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {registryLoading ? "Loading…" : `${filteredRegistry.length} of ${registryActCount} acts`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{countryCode}</Badge>
                </div>
                <div className="px-3 py-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter acts…"
                      value={actFilter}
                      onChange={(e) => setActFilter(e.target.value)}
                      className="h-8 pl-8 text-xs bg-muted/30 border-0 focus-visible:ring-1"
                    />
                  </div>
                </div>
                <div className="max-h-[min(68vh,700px)] overflow-y-auto">
                  {registryLoading ? (
                    <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : filteredRegistry.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">No acts match your filter.</p>
                  ) : (
                    <div className="divide-y">
                      {filteredRegistry.map((act) => {
                        const indexed = act.indexedSectionCount ?? 0
                        const isSelected = selectedAct?.id === act.id
                        return (
                          <button
                            key={act.id}
                            type="button"
                            className={cn(
                              "w-full text-left px-4 py-3 transition-colors group",
                              isSelected
                                ? "bg-primary/5 border-l-2 border-l-primary"
                                : "hover:bg-muted/50 border-l-2 border-l-transparent",
                            )}
                            onClick={() => selectAct(act.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={cn("text-xs font-medium leading-snug truncate", isSelected && "text-primary")}>
                                {act.shortName}
                              </span>
                              {indexed > 0 ? (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0 mt-0.5">
                                  {indexed.toLocaleString()} §
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50 shrink-0 mt-0.5">—</span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                              {formatActCatalogLine(act)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Act detail */}
            <div className={cn("lg:col-span-2", mobileTab !== "detail" && "hidden lg:block")}>
              <div className="rounded-xl border bg-card overflow-hidden">
                {selectedAct ? (
                  <>
                    <div className="px-5 py-4 border-b bg-muted/20">
                      <h2 className="text-sm font-semibold leading-snug">{selectedAct.fullName}</h2>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {selectedAct.acronyms.length > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/70">Acronyms: </span>
                            {selectedAct.acronyms.join(", ")}
                          </span>
                        )}
                        {selectedAct.jurisdiction && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/70">Jurisdiction: </span>
                            {selectedAct.jurisdiction}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">{formatActSectionSummary(selectedAct)}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <ActSectionBrowser
                        act={selectedAct}
                        countryCode={countryCode}
                        onSectionClick={(section) => handleSectionClick(selectedAct, section)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                    <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                      <BookOpen className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Select an act from the list</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Browse sections or tap any section to search the corpus</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Abbreviations tab ── */}
        {countryCode === "IN" && (
          <TabsContent value="abbreviations" className="mt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/20">
                <p className="text-sm font-semibold">India Legal Abbreviations</p>
                <p className="text-xs text-muted-foreground mt-0.5">Courts, tribunals, statutes, and common terms</p>
              </div>
              <div className="p-5">
                {abbrevLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <AbbreviationTables rows={indiaAbbreviations} />
                )}
              </div>
            </div>
          </TabsContent>
        )}

        {/* ── Search corpus tab ── */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <div className="rounded-xl border-2 border-border bg-card overflow-hidden focus-within:border-primary/50 focus-within:shadow-sm transition-all">
            <div className="flex items-center gap-3 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                placeholder="e.g. BNSS section 438, IPC 302, contract breach notice period…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                data-tour="law-library-search"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <Button
                onClick={() => void runSearch()}
                disabled={searching || !query.trim()}
                size="sm"
                className="shrink-0 gap-1.5 h-8 text-xs"
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>

          {results && (
            <div className="grid md:grid-cols-2 gap-4">
              <SearchResultsCard title="Hybrid search" hits={results.hybrid} />
              <SearchResultsCard title="Statute sections" hits={results.statuteSections} />
            </div>
          )}

          {!results && !searching && (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Search the indexed corpus</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Enter a section reference, case name, or legal concept above</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PromptLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        defaultFeature="law_library"
        defaultJurisdiction={countryCode}
        defaultDomainSlug={domainFilter}
      />
    </div>
  )
}

function formatActCatalogLine(act: StatuteRegistryEntry): string {
  const indexed = act.indexedSectionCount ?? 0
  const catalogued = act.cataloguedSectionCount ?? act.sectionCount ?? 0
  const parts: string[] = []
  if (indexed > 0) parts.push(`${indexed.toLocaleString()} indexed`)
  if (catalogued > 0) parts.push(`${catalogued.toLocaleString()} in corpus`)
  if (parts.length === 0 && act.hasCorpusStructure) parts.push("corpus structure available")
  return parts.length > 0 ? parts.join(" · ") : "No corpus metadata yet"
}

function formatActSectionSummary(act: StatuteRegistryEntry): string {
  const indexed = act.indexedSectionCount ?? 0
  const catalogued = act.cataloguedSectionCount ?? act.sectionCount ?? 0
  if (catalogued > 0) {
    return `${indexed.toLocaleString()} of ${catalogued.toLocaleString()} sections indexed`
  }
  if (indexed > 0) {
    return `${indexed.toLocaleString()} sections indexed`
  }
  return "No sections indexed yet — run corpus sync to index text"
}

function formatSectionLabel(section: string): string {
  if (section.startsWith("order-")) return `Order ${section.slice(6)}`
  if (section.startsWith("schedule-")) return `Schedule ${section.slice(9)}`
  return `§ ${section}`
}

function ActSectionBrowser({
  act,
  countryCode,
  onSectionClick,
}: {
  act: StatuteRegistryEntry
  countryCode: string
  onSectionClick: (section: string) => void
}) {
  const [sectionFilter, setSectionFilter] = useState("")
  const [debouncedFilter, setDebouncedFilter] = useState("")
  const [sections, setSections] = useState<StatuteSectionRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilter(sectionFilter.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [sectionFilter])

  const loadSections = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError("")
      try {
        const res = await listActSections(act.id, countryCode, {
          offset: nextOffset,
          limit: 100,
          q: debouncedFilter || undefined,
        })
        setTotal(res.total)
        setOffset(nextOffset + res.sections.length)
        setSections((prev) => (append ? [...prev, ...res.sections] : res.sections))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sections")
        if (!append) {
          setSections([])
          setTotal(0)
          setOffset(0)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [act.id, countryCode, debouncedFilter],
  )

  useEffect(() => {
    void loadSections(0, false)
  }, [loadSections])

  const hasMore = sections.length < total

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Sections
          {!loading && total > 0 && (
            <span className="text-muted-foreground font-normal ml-1">
              ({sections.length.toLocaleString()} of {total.toLocaleString()} shown)
            </span>
          )}
        </p>
        <Input
          placeholder="Filter sections…"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="h-8 text-sm max-w-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sections…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {act.hasCorpusStructure
            ? "No sections match your filter."
            : "No corpus structure for this act yet. Run corpus sync to index sections from source PDFs."}
        </p>
      ) : (
        <>
          <div className="max-h-[min(60vh,560px)] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {sections.map((row) => (
                <button
                  key={row.section}
                  type="button"
                  className={cn(
                    "text-left rounded-lg border px-3 py-2.5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm group",
                    row.indexed
                      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-border bg-muted/20",
                  )}
                  onClick={() => onSectionClick(row.section)}
                  title={row.title ?? undefined}
                >
                  <span className={cn(
                    "block font-mono text-xs font-semibold mb-0.5",
                    row.indexed ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                  )}>
                    {formatSectionLabel(row.section)}
                  </span>
                  {row.title && (
                    <span className="block text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                      {row.title}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          {hasMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => void loadSections(offset, true)}
              className="gap-1.5"
            >
              {loadingMore ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
              ) : (
                `Load more (${(total - sections.length).toLocaleString()} remaining)`
              )}
            </Button>
          )}
        </>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800" />
          Indexed in corpus
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted border border-border" />
          Not yet indexed
        </span>
        <span className="ml-auto">Tap any section to search</span>
      </div>
    </div>
  )
}

function SearchResultsCard({
  title,
  hits,
}: {
  title: string
  hits: LawLibrarySearchResult["hybrid"]
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs text-muted-foreground">{hits.length} hit{hits.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {hits.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No results. Try seeding priority sections or running corpus sync.</p>
          </div>
        ) : (
          hits.map((hit) => (
            <div key={hit.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
              <p className="font-medium text-sm leading-snug">{hit.title}</p>
              {hit.citation && (
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{hit.citation}</p>
              )}
              {hit.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: hit.summary }} />
              )}
              {hit.sourceUrl && (
                <a
                  href={hit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  {hit.sourceName}
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const ABBR_SECTIONS: { key: IndiaAbbreviationEntry["category"]; label: string }[] = [
  { key: "court", label: "Courts" },
  { key: "tribunal", label: "Tribunals" },
  { key: "statute", label: "Statutes & codes" },
  { key: "procedure", label: "Procedure & litigation" },
  { key: "institution", label: "Institutions" },
  { key: "general", label: "General" },
]

function AbbreviationTables({ rows }: { rows: IndiaAbbreviationEntry[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {ABBR_SECTIONS.map(({ key, label }) => {
        const sectionRows = rows.filter((row) => row.category === key)
        if (sectionRows.length === 0) return null
        return (
          <div key={key}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">{label}</h3>
            <div className="space-y-1.5">
              {sectionRows.map((row) => (
                <div key={row.abbr} className="flex items-start gap-2.5">
                  <span className="font-mono text-[11px] font-semibold text-primary bg-primary/8 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                    {row.abbr}
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{row.fullForm}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
