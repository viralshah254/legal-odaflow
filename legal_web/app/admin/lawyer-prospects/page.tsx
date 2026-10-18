"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, Search, Download, Upload, CheckCircle2, Phone, MessageCircle, MapPin, ArrowUp, ArrowDown, ArrowUpDown, Mail, X, ChevronLeft, ChevronRight, SlidersHorizontal, UserPlus } from "lucide-react"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  listLawyerProspects,
  getLawyerProspectStats,
  importLawyerProspects,
  exportLawyerProspectsCsv,
  updateLawyerProspectOutreach,
  startGooglePlacesScrape,
  getProspectImportRun,
  getGooglePlacesLocations,
  cancelProspectImportRun,
  testGooglePlacesApi,
  compareGooglePlacesApi,
  type LawyerProspect,
  type LawyerProspectStats,
  type ProspectImportRun,
  type GooglePlacesLocationTree,
  type GooglePlacesApiTestResult,
  type GooglePlacesApiCompareResult,
  type GooglePlacesScrapeMode,
} from "@/lib/api/admin"
import {
  getGooglePlacesScrapeDisplay,
  formatGooglePlacesLocation,
  isActiveGooglePlacesRun,
} from "@/lib/admin/google-places-progress"
import { AddLawyerProspectDialog } from "@/components/admin/add-lawyer-prospect-dialog"

const OUTREACH_OPTIONS = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "CONVERTED",
  "DO_NOT_CONTACT",
]

const OUTREACH_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  CONVERTED: "Converted",
  DO_NOT_CONTACT: "Do not contact",
}

const COUNTRY_OPTIONS = [
  { value: "", label: "All countries" },
  { value: "IN", label: "India" },
  { value: "US", label: "USA" },
  { value: "GB", label: "UK" },
]

const CITY_CHIPS = ["Ahmedabad", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune"]

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "manual", label: "Manual" },
  { value: "chambers", label: "Chambers" },
  { value: "law_asia", label: "Law.asia" },
  { value: "iflr1000", label: "IFLR1000" },
  { value: "osm", label: "OSM" },
  { value: "lawrato", label: "LawRato" },
  { value: "vakilsearch", label: "VakilSearch" },
  { value: "advocatekhoj", label: "AdvocateKhoj" },
  { value: "justdial", label: "JustDial" },
  { value: "google_places", label: "Google Places" },
  { value: "vakeelkhoj_india", label: "VakeelKhoj" },
  { value: "sulekha", label: "Sulekha" },
  { value: "india_bar", label: "Bar councils" },
  { value: "probono", label: "Pro bono / NALSA" },
  { value: "justia", label: "Justia" },
  { value: "state_bars", label: "State Bars" },
  { value: "avvo", label: "Avvo" },
]

type SortField = "fullName" | "city" | "source" | "outreachStatus" | "createdAt" | "phone" | "organisation"
type SortDir = "asc" | "desc"

const DEFAULT_SORT: { sortBy: SortField; sortDir: SortDir } = {
  sortBy: "createdAt",
  sortDir: "desc",
}

const SORT_FIELDS: SortField[] = [
  "fullName",
  "city",
  "source",
  "outreachStatus",
  "createdAt",
  "phone",
  "organisation",
]

interface Filters {
  country: string
  state: string
  city: string
  source: string
  hasPhone: boolean
  hasWhatsapp: boolean
  hasEmail: boolean
  whatsappVerified: boolean
  lawyerVerified: boolean
  outreachStatus: string
  q: string
  sortBy: SortField
  sortDir: SortDir
}

function parseSortField(value: string | null): SortField {
  return SORT_FIELDS.includes(value as SortField) ? (value as SortField) : DEFAULT_SORT.sortBy
}

function filtersToApiParams(f: Filters, off = 0) {
  return {
    country: f.country || undefined,
    state: f.state || undefined,
    city: f.city || undefined,
    source: f.source || undefined,
    hasEmail: f.hasEmail ? true : undefined,
    hasPhone: f.hasPhone ? true : undefined,
    hasWhatsapp: f.hasWhatsapp ? true : undefined,
    whatsappConfidence: f.whatsappVerified ? "verified" : undefined,
    lawyerVerified: f.lawyerVerified ? true : undefined,
    outreachStatus: f.outreachStatus || undefined,
    q: f.q || undefined,
    sortBy: f.sortBy,
    sortDir: f.sortDir,
    limit: 100,
    offset: off,
  }
}

function SortableHeader({
  label,
  field,
  activeField,
  activeDir,
  onSort,
  className,
}: {
  label: string
  field: SortField
  activeField: SortField
  activeDir: SortDir
  onSort: (field: SortField) => void
  className?: string
}) {
  const active = activeField === field
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span>{label}</span>
        {active ? (
          activeDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-35" />
        )}
      </button>
    </TableHead>
  )
}

function ContactCell({ p }: { p: LawyerProspect }) {
  const isVerified = p.whatsappConfidence === "verified"
  const isHigh = p.whatsappConfidence === "high"
  return (
    <div className="space-y-0.5">
      {p.phone ? (
        <div className="flex items-center gap-1 font-mono text-xs">{p.phone}</div>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
      {p.whatsapp && (isVerified || isHigh) && (
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          {isVerified ? "WhatsApp verified" : "WhatsApp likely"}
        </div>
      )}
      {p.lawyerVerified && (
        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <CheckCircle2 className="h-3 w-3" />
          Bar verified{p.barEnrollmentNumber ? ` · ${p.barEnrollmentNumber}` : ""}
        </div>
      )}
      {p.alternatePhone && (
        <div className="text-xs text-muted-foreground">Alt: {p.alternatePhone}</div>
      )}
    </div>
  )
}

function getPracticeTypeLabel(p: LawyerProspect): "Individual" | "Law firm" {
  return p.organisation?.trim() ? "Law firm" : "Individual"
}

function getSourceLabel(source: string): string {
  return SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source
}

function formatCountryDisplay(country: string | null | undefined): string {
  if (!country?.trim()) return "—"
  const normalized = country.trim()
  const codeMap: Record<string, string> = {
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
  }
  return codeMap[normalized.toUpperCase()] ?? normalized
}

function PracticeCell({ p }: { p: LawyerProspect }) {
  const practiceType = getPracticeTypeLabel(p)
  return (
    <div className="space-y-1">
      <Badge variant={practiceType === "Law firm" ? "default" : "secondary"} className="text-[10px] font-normal">
        {practiceType}
      </Badge>
      {p.organisation?.trim() && (
        <div className="text-xs text-muted-foreground max-w-[180px] truncate" title={p.organisation}>
          {p.organisation}
        </div>
      )}
    </div>
  )
}

export default function AdminLawyerProspectsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [prospects, setProspects] = useState<LawyerProspect[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<LawyerProspectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [importing, setImporting] = useState(false)
  const [offset, setOffset] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const [filters, setFilters] = useState<Filters>({
    country: searchParams.get("country") ?? "",
    state: searchParams.get("state") ?? "",
    city: searchParams.get("city") ?? "",
    source: searchParams.get("source") ?? "",
    hasPhone: searchParams.get("hasPhone") === "true",
    hasWhatsapp: searchParams.get("hasWhatsapp") === "true",
    hasEmail: searchParams.get("hasEmail") === "true",
    whatsappVerified: searchParams.get("whatsappConfidence") === "verified",
    lawyerVerified: searchParams.get("lawyerVerified") === "true",
    outreachStatus: searchParams.get("outreachStatus") ?? "",
    q: searchParams.get("q") ?? "",
    sortBy: parseSortField(searchParams.get("sortBy")),
    sortDir: searchParams.get("sortDir") === "asc" ? "asc" : "desc",
  })

  const [cityInput, setCityInput] = useState(filters.city)
  const [stateInput, setStateInput] = useState(filters.state)
  const [customRegionMode, setCustomRegionMode] = useState(false)
  const [googlePlacesOpen, setGooglePlacesOpen] = useState(false)
  const [addProspectOpen, setAddProspectOpen] = useState(false)
  const [placesLocations, setPlacesLocations] = useState<GooglePlacesLocationTree[]>([])
  const [scrapeCountry, setScrapeCountry] = useState("IN")
  const [scrapeState, setScrapeState] = useState("Gujarat")
  const [scrapeCity, setScrapeCity] = useState("Ahmedabad")
  const [scrapeMode, setScrapeMode] = useState<GooglePlacesScrapeMode>("full")
  const [apiCompareRunning, setApiCompareRunning] = useState(false)
  const [apiCompareResult, setApiCompareResult] = useState<GooglePlacesApiCompareResult | null>(null)
  const [scrapeStarting, setScrapeStarting] = useState(false)
  const [scrapeCancelling, setScrapeCancelling] = useState(false)
  const [apiTestRunning, setApiTestRunning] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<GooglePlacesApiTestResult | null>(null)
  const [activeScrapeRun, setActiveScrapeRun] = useState<ProspectImportRun | null>(null)
  const [scrapeNotice, setScrapeNotice] = useState("")
  const [customScrapeState, setCustomScrapeState] = useState(false)
  const [customScrapeCity, setCustomScrapeCity] = useState(false)

  const OTHER_STATE = "__other_state__"
  const OTHER_CITY = "__other_city__"

  const selectedCountry = placesLocations.find((c) => c.code === scrapeCountry)
  const selectedState = selectedCountry?.states.find(
    (s) => s.name.toLowerCase() === scrapeState.trim().toLowerCase(),
  )
  const catalogCities = selectedState?.cities ?? []
  const showCitySelect = catalogCities.length > 0 && !customScrapeCity

  const filterCountryTree = placesLocations.find((c) => c.code === filters.country)
  const filterRegionOptions = filterCountryTree?.states.map((s) => s.name) ?? []
  const filterStateEntry = filterCountryTree?.states.find(
    (s) => s.name.toLowerCase() === filters.state.trim().toLowerCase(),
  )
  const filterCityOptions = filters.state.trim()
    ? (filterStateEntry?.cities ?? [])
    : (filterCountryTree?.states.flatMap((s) => s.cities) ?? [])
  const cityChipOptions = filters.country === "IN" && !filters.state.trim()
    ? CITY_CHIPS
    : filterCityOptions.length > 0
      ? [...new Set(filterCityOptions)]
      : filters.country === "IN"
        ? CITY_CHIPS
        : []

  const openGooglePlacesDialog = useCallback(async () => {
    setError("")
    try {
      const tree = placesLocations.length ? placesLocations : await getGooglePlacesLocations()
      if (!placesLocations.length) setPlacesLocations(tree)

      const countryCode = filters.country || "IN"
      const country = tree.find((c) => c.code === countryCode) ?? tree[0]
      const cityName = filters.city || ""
      let stateName = ""
      for (const st of country?.states ?? []) {
        if (st.cities.some((c) => c.toLowerCase() === cityName.toLowerCase())) {
          stateName = st.name
          break
        }
      }
      if (!stateName && cityName.toLowerCase() === "ahmedabad") {
        stateName = "Gujarat"
      }

      setScrapeCountry(country?.code ?? "IN")
      setScrapeState(stateName || country?.states[0]?.name || "")
      setScrapeCity(cityName || "Ahmedabad")
      setCustomScrapeState(false)
      setCustomScrapeCity(
        Boolean(cityName) &&
          !(country?.states ?? [])
            .flatMap((s) => s.cities)
            .some((c) => c.toLowerCase() === cityName.toLowerCase()),
      )
      setApiTestResult(null)
      setGooglePlacesOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google Places locations")
    }
  }, [filters.country, filters.city, placesLocations])

  useEffect(() => {
    getGooglePlacesLocations()
      .then(setPlacesLocations)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!filters.state.trim()) {
      setCustomRegionMode(false)
      return
    }
    const inCatalog = filterRegionOptions.some(
      (r) => r.toLowerCase() === filters.state.trim().toLowerCase(),
    )
    setCustomRegionMode(!inCatalog)
  }, [filters.state, filterRegionOptions])

  const pushParams = useCallback((f: Filters) => {
    const p = new URLSearchParams()
    if (f.country) p.set("country", f.country)
    if (f.state) p.set("state", f.state)
    if (f.city) p.set("city", f.city)
    if (f.source) p.set("source", f.source)
    if (f.hasPhone) p.set("hasPhone", "true")
    if (f.hasWhatsapp) p.set("hasWhatsapp", "true")
    if (f.hasEmail) p.set("hasEmail", "true")
    if (f.whatsappVerified) p.set("whatsappConfidence", "verified")
    if (f.lawyerVerified) p.set("lawyerVerified", "true")
    if (f.outreachStatus) p.set("outreachStatus", f.outreachStatus)
    if (f.q) p.set("q", f.q)
    if (f.sortBy !== DEFAULT_SORT.sortBy) p.set("sortBy", f.sortBy)
    if (f.sortDir !== DEFAULT_SORT.sortDir) p.set("sortDir", f.sortDir)
    router.replace(`/admin/lawyer-prospects?${p.toString()}`, { scroll: false })
  }, [router])

  const load = useCallback(
    (f: Filters, off = 0) => {
      setLoading(true)
      const listParams = filtersToApiParams(f, off)
      Promise.all([
        listLawyerProspects(listParams),
        getLawyerProspectStats({
          country: listParams.country,
          state: listParams.state,
          city: listParams.city,
          source: listParams.source,
          hasEmail: listParams.hasEmail,
          hasPhone: listParams.hasPhone,
          hasWhatsapp: listParams.hasWhatsapp,
          whatsappConfidence: listParams.whatsappConfidence,
          lawyerVerified: listParams.lawyerVerified,
          outreachStatus: listParams.outreachStatus,
          q: listParams.q,
          sortBy: listParams.sortBy,
          sortDir: listParams.sortDir,
        }),
      ])
        .then(([r, s]) => {
          setProspects(r.items)
          setTotal(r.total)
          setStats(s)
            if (
              s.lastImportRun &&
              (s.lastImportRun.status === "RUNNING" || s.lastImportRun.status === "CANCELLING") &&
              s.lastImportRun.sourceSummary?.startsWith("google_places:")
            ) {
            getProspectImportRun(s.lastImportRun.id)
              .then((run) => setActiveScrapeRun(run))
              .catch(() => {})
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => {
    load(filters, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeScrapeRun || !isActiveGooglePlacesRun(activeScrapeRun)) return

    const interval = window.setInterval(async () => {
      try {
        const run = await getProspectImportRun(activeScrapeRun.id)
        setActiveScrapeRun(run)
        if (run.status === "COMPLETED") {
          setActiveScrapeRun(null)
          setScrapeCancelling(false)
          const locationLabel = formatGooglePlacesLocation(run.sourceSummary)
          setScrapeNotice(
            `Google Places import complete for ${locationLabel || "selected city"}: ${run.insertedCount} new, ${run.updatedCount} updated.`,
          )
          const locationParts = run.sourceSummary?.split(":") ?? []
          const nextFilters = {
            ...filters,
            city: locationParts[3] ?? scrapeCity,
            country: locationParts[1] ?? scrapeCountry,
            source: "google_places",
          }
          applyFilters(nextFilters, 0)
        } else if (run.status === "CANCELLED") {
          setActiveScrapeRun(null)
          setScrapeCancelling(false)
          setScrapeNotice(
            run.errorMessage ??
              `Stopped. ${run.insertedCount} new, ${run.updatedCount} updated.`,
          )
          const locationParts = run.sourceSummary?.split(":") ?? []
          const nextFilters = {
            ...filters,
            city: locationParts[3] ?? scrapeCity,
            country: locationParts[1] ?? scrapeCountry,
            source: "google_places",
          }
          applyFilters(nextFilters, 0)
        } else if (run.status === "FAILED") {
          setActiveScrapeRun(null)
          setScrapeCancelling(false)
          setError(run.errorMessage ?? "Google Places scrape failed")
        }
      } catch {
        // keep polling until terminal state or unmount
      }
    }, 3000)

    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScrapeRun?.id, activeScrapeRun?.status])

  const handleStopGooglePlacesScrape = async () => {
    if (!activeScrapeRun) return
    setScrapeCancelling(true)
    setError("")
    try {
      await cancelProspectImportRun(activeScrapeRun.id)
      const run = await getProspectImportRun(activeScrapeRun.id)
      setActiveScrapeRun(run)
    } catch (err) {
      setScrapeCancelling(false)
      setError(err instanceof Error ? err.message : "Failed to stop Google Places scrape")
    }
  }

  const handleTestGooglePlacesApi = async () => {
    setApiTestRunning(true)
    setApiTestResult(null)
    setApiCompareResult(null)
    try {
      const countryName = selectedCountry?.name ?? "India"
      const result = await testGooglePlacesApi({
        city: scrapeCity,
        state: scrapeState,
        country: countryName,
      })
      setApiTestResult(result)
    } catch (err) {
      setApiTestResult({
        ok: false,
        configured: true,
        status: "REQUEST_FAILED",
        error: err instanceof Error ? err.message : "API test failed",
        resultCount: 0,
        sampleName: null,
      })
    } finally {
      setApiTestRunning(false)
    }
  }

  const handleCompareGooglePlacesApi = async () => {
    setApiCompareRunning(true)
    setApiCompareResult(null)
    try {
      const countryName = selectedCountry?.name ?? "India"
      const result = await compareGooglePlacesApi({
        city: scrapeCity,
        state: scrapeState,
        country: countryName,
        limit: 100,
      })
      setApiCompareResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "API compare failed")
    } finally {
      setApiCompareRunning(false)
    }
  }

  const handleStartGooglePlacesScrape = async () => {
    if (!scrapeCountry || !scrapeState || !scrapeCity) return
    setScrapeStarting(true)
    setError("")
    setScrapeNotice("")
    try {
      const { runId } = await startGooglePlacesScrape({
        country: scrapeCountry,
        state: scrapeState,
        city: scrapeCity,
        mode: scrapeMode,
      })
      const run = await getProspectImportRun(runId)
      setActiveScrapeRun(run)
      setGooglePlacesOpen(false)
      if (run.status === "RUNNING") {
        setScrapeNotice("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Google Places scrape")
    } finally {
      setScrapeStarting(false)
    }
  }

  const applyFilters = (next: Filters, off = 0) => {
    setFilters(next)
    setCityInput(next.city)
    setStateInput(next.state)
    setOffset(off)
    pushParams(next)
    load(next, off)
  }

  const handleFilterChange = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }
    applyFilters(next, 0)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters({ ...filters, q: filters.q }, 0)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError("")
    try {
      await importLawyerProspects(file, `upload-${Date.now()}`)
      load(filters, 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleSort = (field: SortField) => {
    const nextDir: SortDir =
      filters.sortBy === field
        ? filters.sortDir === "asc"
          ? "desc"
          : "asc"
        : field === "createdAt"
          ? "desc"
          : "asc"
    applyFilters({ ...filters, sortBy: field, sortDir: nextDir }, 0)
  }

  const handleExport = async () => {
    try {
      const p = filtersToApiParams(filters, 0)
      const blob = await exportLawyerProspectsCsv({
        country: p.country,
        state: p.state,
        city: p.city,
        source: p.source,
        hasEmail: p.hasEmail,
        hasPhone: p.hasPhone,
        hasWhatsapp: p.hasWhatsapp,
        whatsappConfidence: p.whatsappConfidence,
        lawyerVerified: p.lawyerVerified,
        outreachStatus: p.outreachStatus,
        q: p.q,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `lawyer-prospects-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Export failed")
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updated = await updateLawyerProspectOutreach(id, status)
      setProspects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, outreachStatus: updated.outreachStatus } : p)),
      )
    } catch {
      setError("Failed to update status")
    }
  }

  const PAGE = 100
  const totalPages = Math.ceil(total / PAGE)
  const currentPage = Math.floor(offset / PAGE)
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE, total)

  const activeFilterChips: { key: string; label: string; clear: () => void }[] = []
  if (filters.country) {
    const label = COUNTRY_OPTIONS.find((o) => o.value === filters.country)?.label ?? filters.country
    activeFilterChips.push({
      key: "country",
      label: `Country: ${label}`,
      clear: () => {
        setStateInput("")
        setCityInput("")
        handleFilterChange({ country: "", state: "", city: "" })
      },
    })
  }
  if (filters.state) {
    activeFilterChips.push({
      key: "state",
      label: `Region: ${filters.state}`,
      clear: () => {
        setStateInput("")
        handleFilterChange({ state: "", city: "" })
      },
    })
  }
  if (filters.city) {
    activeFilterChips.push({
      key: "city",
      label: `City: ${filters.city}`,
      clear: () => {
        setCityInput("")
        handleFilterChange({ city: "" })
      },
    })
  }
  if (filters.source) {
    const label = SOURCE_OPTIONS.find((o) => o.value === filters.source)?.label ?? filters.source
    activeFilterChips.push({ key: "source", label: `Source: ${label}`, clear: () => handleFilterChange({ source: "" }) })
  }
  if (filters.outreachStatus) {
    activeFilterChips.push({
      key: "outreach",
      label: `Outreach: ${OUTREACH_LABELS[filters.outreachStatus] ?? filters.outreachStatus}`,
      clear: () => handleFilterChange({ outreachStatus: "" }),
    })
  }
  if (filters.q) {
    activeFilterChips.push({ key: "q", label: `Search: “${filters.q}”`, clear: () => handleFilterChange({ q: "" }) })
  }
  if (filters.hasPhone) activeFilterChips.push({ key: "hasPhone", label: "Has phone", clear: () => handleFilterChange({ hasPhone: false }) })
  if (filters.hasWhatsapp) activeFilterChips.push({ key: "hasWhatsapp", label: "Has WhatsApp", clear: () => handleFilterChange({ hasWhatsapp: false }) })
  if (filters.hasEmail) activeFilterChips.push({ key: "hasEmail", label: "Has email", clear: () => handleFilterChange({ hasEmail: false }) })
  if (filters.whatsappVerified) activeFilterChips.push({ key: "waVerified", label: "WhatsApp verified", clear: () => handleFilterChange({ whatsappVerified: false }) })
  if (filters.lawyerVerified) activeFilterChips.push({ key: "barVerified", label: "Bar verified", clear: () => handleFilterChange({ lawyerVerified: false }) })
  if (filters.sortBy !== DEFAULT_SORT.sortBy || filters.sortDir !== DEFAULT_SORT.sortDir) {
    activeFilterChips.push({
      key: "sort",
      label: `Sort: ${filters.sortBy} ${filters.sortDir}`,
      clear: () => applyFilters({ ...filters, ...DEFAULT_SORT }, 0),
    })
  }

  const EMPTY_FILTERS: Filters = {
    country: "",
    state: "",
    city: "",
    source: "",
    hasPhone: false,
    hasWhatsapp: false,
    hasEmail: false,
    whatsappVerified: false,
    lawyerVerified: false,
    outreachStatus: "",
    q: "",
    ...DEFAULT_SORT,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lawyer Prospects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Outreach directory
            {total > 0 && !loading && (
              <span className="ml-2 text-foreground font-medium">· {total.toLocaleString()} results</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="file" accept=".csv" ref={fileRef} onChange={handleImport} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => setAddProspectOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add prospect
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={openGooglePlacesDialog}
            disabled={!!activeScrapeRun && isActiveGooglePlacesRun(activeScrapeRun)}
          >
            <MapPin className="h-4 w-4 mr-1.5" />
            Google Places
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
            Import CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              const params = new URLSearchParams()
              if (filters.city) params.set("city", filters.city)
              if (filters.source) params.set("source", filters.source)
              if (filters.whatsappVerified) params.set("whatsappConfidence", "verified")
              router.push(`/admin/whatsapp-campaigns?${params.toString()}`)
            }}
          >
            <MessageCircle className="h-4 w-4 mr-1.5" />
            Send WA
          </Button>
        </div>
      </div>

      {activeScrapeRun && isActiveGooglePlacesRun(activeScrapeRun) && (() => {
        const display = getGooglePlacesScrapeDisplay(
          activeScrapeRun,
          `${scrapeCity}, ${scrapeState}, ${scrapeCountry}`,
        )
        return (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {activeScrapeRun.status === "CANCELLING"
                      ? `Stopping Google Places scrape — saving collected firms…`
                      : `Fetching law firms from Google Places — ${display.locationLabel}`}
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {activeScrapeRun.status === "CANCELLING"
                      ? "Importing any firms discovered so far, then closing the run."
                      : display.phaseLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeScrapeRun.status === "RUNNING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-blue-300 bg-white/80 hover:bg-white dark:bg-blue-950/60"
                    onClick={handleStopGooglePlacesScrape}
                    disabled={scrapeCancelling}
                  >
                    {scrapeCancelling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    Stop
                  </Button>
                )}
                <span className="text-xs font-mono tabular-nums">{display.percent}%</span>
              </div>
            </div>
            <Progress value={display.percent} className="h-2 bg-blue-100 dark:bg-blue-950" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
              {display.phase === "discovery" ? (
                <>
                  <span>
                    Search {display.discoveryStep}/{display.discoveryStepTotal} complete
                    {display.placeCount > 0
                      ? ` · ${display.placeCount.toLocaleString()} firms found so far`
                      : ""}
                  </span>
                  <span>Last activity {display.lastActivityLabel} ago</span>
                  <span>Elapsed {display.elapsedLabel}</span>
                  <span className="opacity-75">DB import after discovery (batches of 50)</span>
                </>
              ) : (
                <>
                  <span>{display.placeCount.toLocaleString()} firms discovered</span>
                  <span>
                    {display.firmsProcessed.toLocaleString()} / {display.placeCount.toLocaleString()} processed
                  </span>
                  <span>
                    Import batch {display.doneBatches}/{display.totalBatches} (50 firms each)
                  </span>
                  <span>Last activity {display.lastActivityLabel} ago</span>
                </>
              )}
              <span>
                {display.insertedCount.toLocaleString()} new · {display.updatedCount.toLocaleString()} updated
              </span>
            </div>
            {display.isStale && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No progress updates for 3+ minutes — the worker may have stopped. Refresh the page; if it
                fails, start again to resume from the last checkpoint.
              </p>
            )}
          </div>
        )
      })()}

      {scrapeNotice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
          {scrapeNotice}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total", value: stats.total.toLocaleString() },
            { label: "With Email", value: `${stats.withEmail.toLocaleString()} (${stats.emailCoveragePct}%)` },
            { label: "With Phone", value: `${stats.withPhone.toLocaleString()} (${stats.phoneCoveragePct}%)` },
            { label: "WhatsApp Verified", value: `${stats.withWhatsappVerified.toLocaleString()} (${stats.whatsappVerifiedCoveragePct}%)` },
            { label: "Bar + WhatsApp", value: `${stats.barAndWhatsappVerified.toLocaleString()} (${stats.barAndWhatsappVerifiedPct}%)` },
            { label: "WhatsApp High", value: `${stats.withWhatsappHigh.toLocaleString()} (${stats.whatsappHighCoveragePct}%)` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold mt-0.5">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters &amp; sort
        </div>

        {/* Row 1: country, region, city */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="text-sm rounded-md border border-border bg-background px-2.5 py-1.5 h-9 min-w-[8.5rem]"
            value={filters.country}
            onChange={(e) => {
              setStateInput("")
              setCityInput("")
              handleFilterChange({ country: e.target.value, state: "", city: "" })
            }}
          >
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="text-sm rounded-md border border-border bg-background px-2.5 py-1.5 h-9 min-w-[9rem]"
            value={
              customRegionMode
                ? "__custom__"
                : filters.state
            }
            onChange={(e) => {
              const value = e.target.value
              setCityInput("")
              if (value === "__custom__") {
                setCustomRegionMode(true)
                setStateInput(filters.state || "")
                return
              }
              setCustomRegionMode(false)
              setStateInput(value)
              handleFilterChange({ state: value, city: "" })
            }}
          >
            <option value="">All regions</option>
            {filterRegionOptions.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
            <option value="__custom__">Other region…</option>
          </select>

          {customRegionMode || (filters.country && filterRegionOptions.length === 0) ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setCityInput("")
                handleFilterChange({ state: stateInput, city: "" })
              }}
              className="flex gap-1"
            >
              <Input
                className="h-9 text-sm w-36"
                placeholder="Type region…"
                value={stateInput}
                onChange={(e) => setStateInput(e.target.value)}
              />
              <Button type="submit" size="sm" variant="ghost" className="h-9 text-xs px-2">Go</Button>
            </form>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleFilterChange({ city: cityInput })
            }}
            className="flex gap-1"
          >
            <Input
              className="h-9 text-sm w-36"
              placeholder="Type city…"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
            />
            <Button type="submit" size="sm" variant="ghost" className="h-9 text-xs px-2">Go</Button>
          </form>
        </div>

        {/* Row 2: city quick picks */}
        {cityChipOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground mr-1">City:</span>
            {cityChipOptions.map((c) => (
              <Badge
                key={c}
                variant={filters.city === c ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => {
                  const next = filters.city === c ? "" : c
                  setCityInput(next)
                  handleFilterChange({ city: next })
                }}
              >
                {c}
              </Badge>
            ))}
            {filters.city && !cityChipOptions.includes(filters.city) && (
              <Badge
                variant="default"
                className="text-xs cursor-pointer"
                onClick={() => {
                  setCityInput("")
                  handleFilterChange({ city: "" })
                }}
              >
                {filters.city} ×
              </Badge>
            )}
          </div>
        )}

        {/* Row 3: source, outreach, search */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="text-sm rounded-md border border-border bg-background px-2.5 py-1.5 h-9"
            value={filters.source}
            onChange={(e) => handleFilterChange({ source: e.target.value })}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="text-sm rounded-md border border-border bg-background px-2.5 py-1.5 h-9"
            value={filters.outreachStatus}
            onChange={(e) => handleFilterChange({ outreachStatus: e.target.value })}
          >
            <option value="">All outreach</option>
            {OUTREACH_OPTIONS.map((o) => (
              <option key={o} value={o}>{OUTREACH_LABELS[o] ?? o}</option>
            ))}
          </select>

          <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 min-w-48">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Search name, org, email…"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" className="h-9">Search</Button>
          </form>
        </div>

        {/* Row 4: toggles */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Quick filters:</span>
          {[
            { key: "hasPhone" as const, label: "Has phone", icon: <Phone className="h-3 w-3 mr-1" /> },
            { key: "hasWhatsapp" as const, label: "Has WhatsApp", icon: <MessageCircle className="h-3 w-3 mr-1" /> },
            { key: "hasEmail" as const, label: "Has email", icon: <Mail className="h-3 w-3 mr-1" /> },
            { key: "whatsappVerified" as const, label: "WhatsApp verified", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
            { key: "lawyerVerified" as const, label: "Bar verified", icon: null },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterChange({ [key]: !filters[key] })}
              className={`flex items-center text-xs rounded-full px-3 py-1 border transition-colors ${
                filters[key]
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border bg-background hover:border-muted-foreground hover:bg-muted/40"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}

          {activeFilterChips.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground ml-auto underline-offset-2 hover:underline"
              onClick={() => {
                setCityInput("")
                setStateInput("")
                setCustomRegionMode(false)
                applyFilters(EMPTY_FILTERS, 0)
              }}
            >
              Clear all ({activeFilterChips.length})
            </button>
          )}
        </div>

        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
            {activeFilterChips.map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
                onClick={chip.clear}
              >
                {chip.label}
                <X className="h-3 w-3 opacity-70" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {total === 0 ? (
                "No results"
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {total.toLocaleString()}
                  </span>
                </>
              )}
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Page {currentPage + 1} of {totalPages}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full caption-bottom text-sm min-w-[1200px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80 shadow-sm">
                  <TableRow>
                    <TableHead className="w-14 text-center tabular-nums sticky left-0 z-20 bg-muted/95">#</TableHead>
                    <SortableHeader
                      label="Name"
                      field="fullName"
                      activeField={filters.sortBy}
                      activeDir={filters.sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Practice"
                      field="organisation"
                      activeField={filters.sortBy}
                      activeDir={filters.sortDir}
                      onSort={handleSort}
                    />
                    <TableHead>Email</TableHead>
                    <SortableHeader
                      label="Phone"
                      field="phone"
                      activeField={filters.sortBy}
                      activeDir={filters.sortDir}
                      onSort={handleSort}
                    />
                    <TableHead>Country</TableHead>
                    <TableHead>State</TableHead>
                    <SortableHeader
                      label="City"
                      field="city"
                      activeField={filters.sortBy}
                      activeDir={filters.sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Source"
                      field="source"
                      activeField={filters.sortBy}
                      activeDir={filters.sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Outreach"
                      field="outreachStatus"
                      activeField={filters.sortBy}
                      activeDir={filters.sortDir}
                      onSort={handleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((p, index) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums font-medium sticky left-0 z-10 bg-card">
                        {(offset + index + 1).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.fullName}</div>
                        {p.practiceAreas && (
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">{p.practiceAreas}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <PracticeCell p={p} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.email ? (
                          <a href={`mailto:${p.email}`} className="text-primary hover:underline truncate max-w-[200px] inline-block">
                            {p.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ContactCell p={p} />
                      </TableCell>
                      <TableCell className="text-xs">{formatCountryDisplay(p.country)}</TableCell>
                      <TableCell className="text-xs">{p.state || "—"}</TableCell>
                      <TableCell className="text-xs">{p.city || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs rounded-full bg-muted px-2 py-0.5">{getSourceLabel(p.source)}</span>
                      </TableCell>
                      <TableCell>
                        <select
                          className="text-xs rounded-md border border-border bg-background px-2 py-1.5 min-w-[7.5rem]"
                          value={p.outreachStatus}
                          onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        >
                          {OUTREACH_OPTIONS.map((o) => (
                            <option key={o} value={o}>{OUTREACH_LABELS[o] ?? o.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            {prospects.length === 0 && (
              <div className="py-16 text-center text-muted-foreground text-sm border-t border-border">
                No prospects match your filters.
                {activeFilterChips.length > 0 && (
                  <div className="mt-2">
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => { setCityInput(""); setStateInput(""); setCustomRegionMode(false); applyFilters(EMPTY_FILTERS, 0) }}>
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                Rows {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 0}
                  onClick={() => {
                    const next = offset - PAGE
                    setOffset(next)
                    load(filters, next)
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-0.5" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => {
                    const next = offset + PAGE
                    setOffset(next)
                    load(filters, next)
                  }}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddLawyerProspectDialog
        open={addProspectOpen}
        onOpenChange={setAddProspectOpen}
        onCreated={() => load(filters, offset)}
      />

      <Dialog open={googlePlacesOpen} onOpenChange={setGooglePlacesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fetch from Google Places</DialogTitle>
            <DialogDescription>
              Discover law firms via the official Google Places API and import public business
              contact details into this directory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Import mode</span>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="google-places-mode"
                    checked={scrapeMode === "full"}
                    onChange={() => setScrapeMode("full")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Full discovery</span>
                    <span className="block text-xs text-muted-foreground">
                      Text search + area grid — finds new firms and updates existing
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="google-places-mode"
                    checked={scrapeMode === "enrichment"}
                    onChange={() => setScrapeMode("enrichment")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Enrichment only</span>
                    <span className="block text-xs text-muted-foreground">
                      Text search only — updates existing prospects missing phone/website (lower cost)
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="google-places-country">
                Country
              </label>
              <select
                id="google-places-country"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={scrapeCountry}
                onChange={(e) => {
                  const code = e.target.value
                  const country = placesLocations.find((c) => c.code === code)
                  setScrapeCountry(code)
                  setCustomScrapeState(false)
                  setCustomScrapeCity(false)
                  setScrapeState(country?.states[0]?.name ?? "")
                  setScrapeCity(country?.states[0]?.cities[0] ?? "")
                }}
              >
                {placesLocations.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="google-places-state">
                State / Region
              </label>
              {customScrapeState ? (
                <Input
                  id="google-places-state"
                  placeholder="Type state or region"
                  value={scrapeState}
                  onChange={(e) => setScrapeState(e.target.value)}
                />
              ) : (
                <select
                  id="google-places-state"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={scrapeState}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === OTHER_STATE) {
                      setCustomScrapeState(true)
                      setScrapeState("")
                      setCustomScrapeCity(true)
                      setScrapeCity("")
                      return
                    }
                    const state = selectedCountry?.states.find((s) => s.name === value)
                    setScrapeState(value)
                    setCustomScrapeCity(false)
                    setScrapeCity(state?.cities[0] ?? "")
                  }}
                >
                  {(selectedCountry?.states ?? []).map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                  <option value={OTHER_STATE}>Other (type custom)…</option>
                </select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="google-places-city">
                City
              </label>
              {showCitySelect ? (
                <select
                  id="google-places-city"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={scrapeCity}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === OTHER_CITY) {
                      setCustomScrapeCity(true)
                      setScrapeCity("")
                      return
                    }
                    setScrapeCity(value)
                  }}
                >
                  {catalogCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                  <option value={OTHER_CITY}>Other (type custom)…</option>
                </select>
              ) : (
                <Input
                  id="google-places-city"
                  placeholder="e.g. Ahmedabad, Surat, Los Angeles"
                  value={scrapeCity}
                  onChange={(e) => setScrapeCity(e.target.value)}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pick a state and city from the lists, or choose &quot;Other&quot; to type any location.
              Custom cities are geocoded automatically via Google. Uses region-biased lawyer queries,
              rate limiting, and minimal field requests.
            </p>
            <p className="text-xs text-muted-foreground">
              Place data © Google —{" "}
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/policies"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Google Places policies
              </a>
            </p>
            {apiTestResult && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  apiTestResult.ok
                    ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100"
                    : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                }`}
              >
                {apiTestResult.ok ? (
                  <>
                    API key works ({apiTestResult.apiVersion ?? "legacy"} API) —{" "}
                    {apiTestResult.resultCount} results for {scrapeCity}
                    {apiTestResult.sampleName ? ` (e.g. ${apiTestResult.sampleName})` : ""}
                    {apiTestResult.samplePhone ? ` · phone: ${apiTestResult.samplePhone}` : ""}
                  </>
                ) : (
                  <>
                    API test failed — {apiTestResult.status}
                    {apiTestResult.error ? `: ${apiTestResult.error}` : ""}
                    {!apiTestResult.configured ? " (key not set on server)" : ""}
                  </>
                )}
              </div>
            )}
            {apiCompareResult && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 space-y-1">
                <p className="font-medium">
                  Legacy vs New API ({apiCompareResult.city}, up to {apiCompareResult.limit} firms)
                </p>
                <p>
                  Legacy: {apiCompareResult.legacy.totalCalls} billable calls (
                  {apiCompareResult.legacy.searchCalls} search + {apiCompareResult.legacy.detailCalls}{" "}
                  details)
                </p>
                {apiCompareResult.newApi.error ? (
                  <p className="text-red-700 dark:text-red-300">
                    New API error: {apiCompareResult.newApi.error}
                  </p>
                ) : (
                  <p>
                    New API: {apiCompareResult.newApi.totalCalls} billable calls (
                    {apiCompareResult.newApi.searchCalls} search + {apiCompareResult.newApi.detailCalls}{" "}
                    details) — ~{apiCompareResult.savingsPercent}% fewer calls
                  </p>
                )}
                <p className="opacity-90">{apiCompareResult.recommendation}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestGooglePlacesApi}
              disabled={apiTestRunning || apiCompareRunning || scrapeStarting}
            >
              {apiTestRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Test API key
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCompareGooglePlacesApi}
              disabled={apiCompareRunning || apiTestRunning || scrapeStarting}
            >
              {apiCompareRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Compare Legacy vs New
            </Button>
            </div>
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => setGooglePlacesOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartGooglePlacesScrape}
              disabled={scrapeStarting || !scrapeCountry || !scrapeState || !scrapeCity}
            >
              {scrapeStarting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Start scrape
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
