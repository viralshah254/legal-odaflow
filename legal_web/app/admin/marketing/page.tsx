"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AdminDateRangeBar,
  resolveDateRange,
  type AdminDateRange,
} from "@/components/admin/admin-date-range-bar"
import {
  AdminSortableHeader,
  type SortDir,
} from "@/components/admin/admin-sortable-header"
import { AdminPaginationBar } from "@/components/admin/admin-ai-filters"
import {
  Globe,
  Users,
  MousePointerClick,
  Timer,
  BarChart2,
  TrendingUp,
  Info,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  getAdminMarketingSummary,
  getAdminMarketingTimeseries,
  getAdminMarketingUtm,
  getAdminMarketingFunnel,
  getAdminMarketingReferrers,
  getAdminSearchQueries,
  type AdminMarketingSummary,
  type AdminMarketingTimeseriesRow,
  type AdminMarketingUtmRow,
  type AdminMarketingFunnelStep,
  type AdminMarketingReferrerRow,
  type AdminSearchQueryRow,
} from "@/lib/api/admin"

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e"]

type FunnelSortField = "step" | "count" | "conversionPct"
type SearchSortField = "createdAt" | "countryCode" | "issueType" | "mode"

const SEARCH_PAGE_SIZE = 25

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌍"
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

function SearchQueryRow({ row }: { row: AdminSearchQueryRow }) {
  const [expanded, setExpanded] = useState(false)
  const truncated = row.facts.length > 120
  const display = expanded || !truncated ? row.facts : row.facts.slice(0, 120) + "…"
  return (
    <TableRow className="align-top">
      <TableCell className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
        {timeAgo(row.createdAt)}
      </TableCell>
      <TableCell className="py-2 pr-3 text-sm whitespace-nowrap">
        <span title={row.countryCode ?? undefined}>
          {countryFlag(row.countryCode)} {row.countryCode ?? "—"}
          {row.jurisdiction ? <span className="text-muted-foreground"> / {row.jurisdiction}</span> : null}
        </span>
      </TableCell>
      <TableCell className="py-2 pr-3">
        {row.issueType ? (
          <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            {row.issueType}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="py-2 pr-3">
        {row.mode ? (
          <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${
            row.mode === "FIRM_INTAKE" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
          }`}>
            {row.mode === "FIRM_INTAKE" ? "Firm" : "Consumer"}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="py-2 text-sm leading-relaxed max-w-md">
        <span className="text-foreground/90">{display}</span>
        {truncated && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-1.5 text-xs text-primary hover:underline inline-flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> less</> : <><ChevronDown className="h-3 w-3" /> more</>}
          </button>
        )}
      </TableCell>
    </TableRow>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string
  value: number | string | undefined
  icon?: React.ElementType
  sub?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-md p-1.5 bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <CardDescription className="text-xs truncate">{label}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{value ?? "—"}</CardTitle>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardHeader>
    </Card>
  )
}

export default function AdminMarketingPage() {
  const [summary, setSummary] = useState<AdminMarketingSummary | null>(null)
  const [timeseries, setTimeseries] = useState<AdminMarketingTimeseriesRow[]>([])
  const [utm, setUtm] = useState<AdminMarketingUtmRow[]>([])
  const [funnel, setFunnel] = useState<AdminMarketingFunnelStep[]>([])
  const [referrers, setReferrers] = useState<AdminMarketingReferrerRow[]>([])
  const [searchQueries, setSearchQueries] = useState<AdminSearchQueryRow[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [dateRange, setDateRange] = useState<AdminDateRange>({ preset: "30d" })
  const [countryFilter, setCountryFilter] = useState("")
  const [modeFilter, setModeFilter] = useState<string>("all")
  const [searchOffset, setSearchOffset] = useState(0)
  const [searchSortBy, setSearchSortBy] = useState<SearchSortField>("createdAt")
  const [searchSortDir, setSearchSortDir] = useState<SortDir>("desc")
  const [funnelSortBy, setFunnelSortBy] = useState<FunnelSortField>("step")
  const [funnelSortDir, setFunnelSortDir] = useState<SortDir>("asc")

  const resolvedRange = useMemo(() => resolveDateRange(dateRange), [dateRange])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { days } = resolvedRange

    try {
      await Promise.all([
        getAdminMarketingSummary().then(setSummary),
        getAdminMarketingTimeseries(days).then(setTimeseries),
        getAdminMarketingUtm(days).then(setUtm),
        getAdminMarketingFunnel(days).then(setFunnel),
        getAdminMarketingReferrers(days).then(setReferrers),
        getAdminSearchQueries({
          days,
          limit: SEARCH_PAGE_SIZE,
          offset: searchOffset,
          sortBy: searchSortBy,
          sortDir: searchSortDir,
          countryCode: countryFilter || undefined,
          mode: modeFilter === "all" ? undefined : modeFilter,
        }).then((d) => {
          setSearchQueries(d.rows)
          setSearchTotal(d.total)
        }),
      ])
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load some data")
    } finally {
      setLoading(false)
    }
  }, [
    resolvedRange,
    searchOffset,
    searchSortBy,
    searchSortDir,
    countryFilter,
    modeFilter,
  ])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const sortedFunnel = useMemo(() => {
    const rows = [...funnel]
    rows.sort((a, b) => {
      let cmp = 0
      if (funnelSortBy === "step") cmp = a.step.localeCompare(b.step)
      else if (funnelSortBy === "count") cmp = a.count - b.count
      else cmp = a.conversionPct - b.conversionPct
      return funnelSortDir === "asc" ? cmp : -cmp
    })
    return rows
  }, [funnel, funnelSortBy, funnelSortDir])

  const handleSearchSort = (field: SearchSortField) => {
    setSearchOffset(0)
    if (searchSortBy === field) {
      setSearchSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSearchSortBy(field)
      setSearchSortDir(field === "createdAt" ? "desc" : "asc")
    }
  }

  const handleFunnelSort = (field: FunnelSortField) => {
    if (funnelSortBy === field) {
      setFunnelSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setFunnelSortBy(field)
      setFunnelSortDir(field === "step" ? "asc" : "desc")
    }
  }

  const handleDateRangeChange = (next: AdminDateRange) => {
    setDateRange(next)
    setSearchOffset(0)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketing Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            First-party visitor, funnel, and UTM data stored in Postgres
          </p>
        </div>
        <BarChart2 className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* New-data notice */}
      <Card className="border-blue-500/30 bg-blue-50/5">
        <CardContent className="py-3 flex gap-2 items-start text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          <span>
            Data collection started when the tracking code was deployed. Charts fill over time — older sessions are not backfilled.
            UTM params are only captured when social links include them (e.g.{" "}
            <code className="text-xs bg-muted px-1 rounded">?utm_source=instagram</code>).
          </span>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Date range</Label>
            <AdminDateRangeBar value={dateRange} onChange={handleDateRangeChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Search country</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="e.g. IN, US"
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value.toUpperCase())
                    setSearchOffset(0)
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Search mode</Label>
                <Select
                  value={modeFilter}
                  onValueChange={(v) => {
                    setModeFilter(v)
                    setSearchOffset(0)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modes</SelectItem>
                    <SelectItem value="FIRM_INTAKE">Firm intake</SelectItem>
                    <SelectItem value="CONSUMER">Consumer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Today KPIs ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Today</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Visitors"
            value={summary?.visitorsToday ?? "—"}
            icon={Globe}
            sub="unique visitor IDs"
          />
          <KpiCard
            label="Page Views"
            value={summary?.pageViewsToday ?? "—"}
            icon={BarChart2}
          />
          <KpiCard
            label="Signups"
            value={summary?.signupsToday ?? "—"}
            icon={Users}
            sub={`${summary?.signupsThisWeek ?? "—"} this week`}
          />
          <KpiCard
            label="Checker Starts"
            value={summary?.issueCheckerStartsToday ?? "—"}
            icon={MousePointerClick}
          />
          <KpiCard
            label="Avg Session"
            value={
              summary != null
                ? fmtDuration(summary.avgSessionSecondsToday)
                : "—"
            }
            icon={Timer}
            sub="active time (heartbeat)"
          />
        </div>
      </div>

      {/* ── 30-day timeseries ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3">
          Visitors vs Signups — {resolvedRange.label.toLowerCase()}
        </h2>
        <Card>
          <CardContent className="pt-4 h-64">
            {timeseries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-10">
                {loading ? "Loading…" : "No data yet — check back after the first session is tracked."}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="visitors" stroke="#6366f1" strokeWidth={2} dot={false} name="Visitors" />
                  <Line type="monotone" dataKey="signups" stroke="#10b981" strokeWidth={2} dot={false} name="Signups" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── UTM + Referrers ─────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* UTM breakdown */}
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Top UTM Campaigns — {resolvedRange.label.toLowerCase()}
          </h2>
          <Card>
            <CardContent className="pt-4 h-64">
              {utm.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center pt-10">
                  {loading ? "Loading…" : "No UTM traffic yet. Add ?utm_campaign= to your social links."}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={utm.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="utmCampaign"
                      tick={{ fontSize: 9 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                      formatter={(v: number, _: string, entry: { payload?: AdminMarketingUtmRow }) => [
                        v,
                        `Visitors (${entry.payload?.utmSource ?? ""})`,
                      ]}
                    />
                    <Bar dataKey="visitors" fill="#6366f1" radius={[0, 3, 3, 0]} name="Visitors" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Referrer breakdown */}
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Top Referrers — {resolvedRange.label.toLowerCase()}
          </h2>
          <Card>
            <CardContent className="pt-4 h-64">
              {referrers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center pt-10">
                  {loading ? "Loading…" : "No referrer data yet."}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={referrers.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="referrerHost"
                      tick={{ fontSize: 9 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="visitors" fill="#22d3ee" radius={[0, 3, 3, 0]} name="Visitors" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Funnel table ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3">
          Landing Funnel — {resolvedRange.label.toLowerCase()}
        </h2>
        <Card>
          <CardContent className="pt-4 pb-2">
            {funnel.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {loading ? "Loading…" : "No funnel data yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <AdminSortableHeader
                        label="Step"
                        field="step"
                        activeField={funnelSortBy}
                        activeDir={funnelSortDir}
                        onSort={handleFunnelSort}
                      />
                      <AdminSortableHeader
                        label="Count"
                        field="count"
                        activeField={funnelSortBy}
                        activeDir={funnelSortDir}
                        onSort={handleFunnelSort}
                        align="right"
                      />
                      <AdminSortableHeader
                        label="Conv. from landing"
                        field="conversionPct"
                        activeField={funnelSortBy}
                        activeDir={funnelSortDir}
                        onSort={handleFunnelSort}
                        align="right"
                      />
                      <TableHead className="w-40">Bar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFunnel.map((step) => (
                      <TableRow key={step.step}>
                        <TableCell className="py-2 pr-4">{step.step}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums font-medium">
                          {step.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                          {step.conversionPct}%
                        </TableCell>
                        <TableCell className="py-2 pr-2">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(step.conversionPct, 100)}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Searches ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              Recent Issue Checker Searches — {resolvedRange.label.toLowerCase()}
            </h2>
          </div>
          {searchTotal > 0 && (
            <span className="text-xs text-muted-foreground">{searchTotal.toLocaleString()} total</span>
          )}
        </div>
        <Card>
          <CardContent className="pt-4 pb-2">
            {searchQueries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {loading ? "Loading…" : "No searches recorded yet. Queries are logged when the issue checker teaser or preview is generated."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <AdminSortableHeader
                        label="When"
                        field="createdAt"
                        activeField={searchSortBy}
                        activeDir={searchSortDir}
                        onSort={handleSearchSort}
                        className="whitespace-nowrap"
                      />
                      <AdminSortableHeader
                        label="Location"
                        field="countryCode"
                        activeField={searchSortBy}
                        activeDir={searchSortDir}
                        onSort={handleSearchSort}
                        className="whitespace-nowrap"
                      />
                      <AdminSortableHeader
                        label="Issue Type"
                        field="issueType"
                        activeField={searchSortBy}
                        activeDir={searchSortDir}
                        onSort={handleSearchSort}
                        className="whitespace-nowrap"
                      />
                      <AdminSortableHeader
                        label="Mode"
                        field="mode"
                        activeField={searchSortBy}
                        activeDir={searchSortDir}
                        onSort={handleSearchSort}
                        className="whitespace-nowrap"
                      />
                      <TableHead>Query</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchQueries.map((row) => (
                      <SearchQueryRow key={row.id} row={row} />
                    ))}
                  </TableBody>
                </Table>
                <AdminPaginationBar
                  total={searchTotal}
                  limit={SEARCH_PAGE_SIZE}
                  offset={searchOffset}
                  onPage={setSearchOffset}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Footer link ──────────────────────────────────────────────────────── */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/admin/dashboard" className="hover:text-foreground">← Back to Overview</Link>
        <TrendingUp className="h-3 w-3 mt-0.5" />
        <span>UTM links format: <code className="bg-muted px-1 rounded">?utm_source=instagram&utm_medium=social&utm_campaign=SLUG</code></span>
      </div>
    </div>
  )
}
