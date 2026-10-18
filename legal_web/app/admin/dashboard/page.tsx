"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Users,
  Building2,
  Activity,
  FileText,
  Gift,
  Contact,
  Scale,
  DollarSign,
  TrendingUp,
  BarChart2,
  BookOpen,
  Database,
  Zap,
  ShieldCheck,
  Globe,
  MousePointerClick,
  Timer,
} from "lucide-react"
import {
  getAdminStats,
  getAdminPresence,
  getAdminMarketingSummary,
  getAdminMarketingTimeseries,
  listAdminAuditLogs,
  type AdminStats,
  type AdminPresence,
  type AdminMarketingSummary,
  type AdminMarketingTimeseriesRow,
  type AdminAuditLogEntry,
} from "@/lib/api/admin"
import { getAiCostsSummaryV2, getCostsByModel, getAdminAiProfitability } from "@/lib/api/admin-extended"
import type { AiCostsSummaryV2, AiCostByModelRow, AiProfitabilityRow } from "@/lib/api/admin-extended"

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#34d399"]

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtUsd(v: number) {
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function displaySessionSeconds(
  user: AdminPresence["users"][number],
  now: number,
  presenceFetchedAt: number,
): number {
  if (!user.isOnline) return user.sessionSeconds
  const elapsed = Math.floor((now - presenceFetchedAt) / 1000)
  return user.sessionSeconds + elapsed
}

function buildSignupTimelineFromTimeseries(
  rows: AdminMarketingTimeseriesRow[],
  aggregateMonthly: boolean,
) {
  if (rows.length === 0) return []

  if (!aggregateMonthly) {
    return rows.map((r) => ({
      month: r.day.slice(5),
      count: r.signups,
      fullLabel: r.day,
    }))
  }

  const counts: Record<string, number> = {}
  rows.forEach((r) => {
    const key = r.day.slice(0, 7)
    counts[key] = (counts[key] ?? 0) + r.signups
  })
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count, fullLabel: month }))
}

function buildCumulativeFromTimeseries(rows: AdminMarketingTimeseriesRow[], aggregateMonthly: boolean) {
  const timeline = buildSignupTimelineFromTimeseries(rows, aggregateMonthly)
  let running = 0
  return timeline.map((p) => {
    running += p.count
    return { month: p.month, count: p.count, total: running }
  })
}

type AuditSortField = "createdAt" | "action" | "entityType"

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  label: string
  value: number | string | undefined
  icon?: React.ElementType
  sub?: string
  accent?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start gap-3">
        {Icon && (
          <div className={`mt-0.5 rounded-md p-1.5 ${accent ?? "bg-primary/10"}`}>
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

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const NAV_CARDS = [
  { href: "/admin/users", icon: Users, title: "Users", desc: "Manage platform users and roles" },
  { href: "/admin/tenants", icon: Building2, title: "Tenants", desc: "Manage law firm tenants" },
  { href: "/admin/review-requests", icon: Scale, title: "Review Requests", desc: "Consumer lawyer review requests" },
  { href: "/admin/marketplace-lawyers", icon: ShieldCheck, title: "Marketplace Lawyers", desc: "Verify firms for Find a Lawyer directory" },
  { href: "/admin/referrals", icon: Gift, title: "Referrals", desc: "Attribution, fraud signals & rewards" },
  { href: "/admin/lawyer-prospects", icon: Contact, title: "Lawyer Prospects", desc: "Outreach directory" },
  { href: "/admin/compliance", icon: ShieldCheck, title: "Compliance", desc: "Country policies and audit logs" },
  { href: "/admin/costs", icon: DollarSign, title: "AI Costs", desc: "Platform AI spend tracking" },
  { href: "/admin/ai-profitability", icon: TrendingUp, title: "AI Profitability", desc: "Credit revenue vs model cost" },
  { href: "/admin/credit-rates", icon: BarChart2, title: "Credit Rates", desc: "Task credit pricing by segment" },
  { href: "/admin/ai-model-costs", icon: BarChart2, title: "Model Costs", desc: "Provider token pricing config" },
  { href: "/admin/ai-logs", icon: Zap, title: "AI Logs", desc: "Request audit trail" },
  { href: "/admin/audit", icon: FileText, title: "Full Audit", desc: "Complete platform audit log" },
  { href: "/admin/legal-sources", icon: BookOpen, title: "Legal Sources", desc: "RAG source registry" },
  { href: "/admin/training-datasets", icon: Database, title: "Training Datasets", desc: "Approved anonymised datasets" },
]

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [presence, setPresence] = useState<AdminPresence | null>(null)
  const [presenceFetchedAt, setPresenceFetchedAt] = useState(() => Date.now())
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const [timeseries, setTimeseries] = useState<AdminMarketingTimeseriesRow[]>([])
  const [aiSummary, setAiSummary] = useState<AiCostsSummaryV2 | null>(null)
  const [modelCosts, setModelCosts] = useState<AiCostByModelRow[]>([])
  const [profitability, setProfitability] = useState<AiProfitabilityRow[]>([])
  const [marketing, setMarketing] = useState<AdminMarketingSummary | null>(null)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [dateRange, setDateRange] = useState<AdminDateRange>({ preset: "30d" })
  const [auditSortBy, setAuditSortBy] = useState<AuditSortField>("createdAt")
  const [auditSortDir, setAuditSortDir] = useState<SortDir>("desc")
  const [auditActionFilter, setAuditActionFilter] = useState("")
  const [auditEntityFilter, setAuditEntityFilter] = useState("")
  const [auditOffset, setAuditOffset] = useState(0)
  const [loadingCharts, setLoadingCharts] = useState(true)
  const [error, setError] = useState("")

  const resolvedRange = useMemo(() => resolveDateRange(dateRange), [dateRange])
  const aggregateMonthly = resolvedRange.days > 90
  const auditLimit = 20

  const loadPresence = useCallback(() => {
    getAdminPresence()
      .then((data) => {
        setPresence(data)
        setPresenceFetchedAt(Date.now())
      })
      .catch(() => {})
  }, [])

  const loadFilteredData = useCallback(async () => {
    setLoadingCharts(true)
    const { from, to, days } = resolvedRange

    try {
      const [
        statsResult,
        timeseriesResult,
        aiSummaryResult,
        modelCostsResult,
        profitabilityResult,
        marketingResult,
        auditResult,
      ] = await Promise.allSettled([
        getAdminStats().then(setStats),
        getAdminMarketingTimeseries(days).then(setTimeseries),
        getAiCostsSummaryV2(from && to ? { from, to } : undefined).then(setAiSummary),
        getCostsByModel(from && to ? { from, to } : undefined).then(setModelCosts),
        getAdminAiProfitability({
          groupBy: "taskType",
          ...(from && to ? { from, to } : {}),
        }).then(setProfitability),
        getAdminMarketingSummary().then(setMarketing),
        listAdminAuditLogs({
          from: dateRange.preset === "all" ? undefined : from,
          to: dateRange.preset === "all" ? undefined : to,
          action: auditActionFilter || undefined,
          entityType: auditEntityFilter || undefined,
          limit: auditLimit,
          offset: auditOffset,
          sortBy: auditSortBy,
          sortDir: auditSortDir,
        }).then((r) => {
          setAuditLogs(r.items)
          setAuditTotal(r.total)
        }),
      ])

      const failed = [
        statsResult,
        timeseriesResult,
        aiSummaryResult,
        modelCostsResult,
        profitabilityResult,
        marketingResult,
        auditResult,
      ].find((r) => r.status === "rejected")

      if (failed && failed.status === "rejected") {
        const e = failed.reason
        setError(e instanceof Error ? e.message : "Failed to load some data")
      } else {
        setError("")
      }
    } finally {
      setLoadingCharts(false)
    }
  }, [
    resolvedRange,
    dateRange.preset,
    auditActionFilter,
    auditEntityFilter,
    auditOffset,
    auditSortBy,
    auditSortDir,
  ])

  useEffect(() => {
    void loadFilteredData()
  }, [loadFilteredData])

  useEffect(() => {
    loadPresence()
    const iv = setInterval(loadPresence, 30_000)
    return () => clearInterval(iv)
  }, [loadPresence])

  useEffect(() => {
    const hasOnline = presence?.users.some((u) => u.isOnline)
    if (!hasOnline) return
    const iv = setInterval(() => setPresenceNow(Date.now()), 1_000)
    return () => clearInterval(iv)
  }, [presence?.users])

  const handleAuditSort = (field: AuditSortField) => {
    setAuditOffset(0)
    if (auditSortBy === field) {
      setAuditSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setAuditSortBy(field)
      setAuditSortDir(field === "createdAt" ? "desc" : "asc")
    }
  }

  const handleDateRangeChange = (next: AdminDateRange) => {
    setDateRange(next)
    setAuditOffset(0)
  }

  // Derived
  const signupTimeline = buildSignupTimelineFromTimeseries(timeseries, aggregateMonthly)
  const cumulativeTimeline = buildCumulativeFromTimeseries(timeseries, aggregateMonthly)

  const presenceCountry = presence
    ? Object.entries(presence.byCountry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }))
    : []

  const presenceUserType = presence
    ? Object.entries(presence.byUserType).map(([name, value]) => ({ name, value }))
    : []

  const topModels = modelCosts
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 6)
    .map((r) => ({ name: r.modelName, cost: r.costUsd, requests: r.totalRequests }))

  const topTasks = profitability
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 8)
    .map((r) => ({
      name: (r.taskType ?? r.key ?? "—").replace(/_/g, " "),
      requests: r.requestCount,
      margin: r.grossMarginPercent,
    }))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform health and user traffic — live · charts filtered by{" "}
            <span className="text-foreground/80">{resolvedRange.label.toLowerCase()}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Date range</Label>
            <AdminDateRangeBar value={dateRange} onChange={handleDateRangeChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div>
                <Label className="text-xs text-muted-foreground">Audit action</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="Filter by action…"
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value)
                    setAuditOffset(0)
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Audit entity type</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="e.g. User, Matter…"
                  value={auditEntityFilter}
                  onChange={(e) => {
                    setAuditEntityFilter(e.target.value)
                    setAuditOffset(0)
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* ── Marketing today ───────────────────────────────────────────────── */}
      <div>
        <SectionHeading
          title="Marketing Today"
          sub="Visitors, signups, and funnel events since midnight · first-party data"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Visitors Today"
            value={marketing?.visitorsToday ?? "—"}
            icon={Globe}
            sub="unique visitor IDs"
          />
          <KpiCard
            label="Page Views Today"
            value={marketing?.pageViewsToday ?? "—"}
            icon={BarChart2}
          />
          <KpiCard
            label="Signups Today"
            value={marketing?.signupsToday ?? "—"}
            icon={Users}
            sub={`${marketing?.signupsThisWeek ?? "—"} this week`}
          />
          <KpiCard
            label="Checker Starts Today"
            value={marketing?.issueCheckerStartsToday ?? "—"}
            icon={MousePointerClick}
          />
          <KpiCard
            label="Avg Session Today"
            value={
              marketing != null
                ? fmtDuration(marketing.avgSessionSecondsToday)
                : "—"
            }
            icon={Timer}
            sub="active time (heartbeat)"
          />
        </div>
        <div className="mt-2">
          <Link href="/admin/marketing" className="text-xs text-primary hover:underline">
            View full marketing analytics →
          </Link>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Users" value={stats?.totalUsers} icon={Users} />
        <KpiCard label="Tenants" value={stats?.totalTenants} icon={Building2} />
        <KpiCard label="Consumer Cases" value={stats?.totalConsumerCases} icon={Activity} />
        <KpiCard label="Matters" value={stats?.totalMatters} icon={FileText} />
        <KpiCard label="AI Requests" value={stats?.totalAiUsageLogs} icon={Zap} />
        {/* Live presence card */}
        <Card className="border-green-500/30 bg-green-50/5">
          <CardHeader className="pb-2 flex flex-row items-start gap-3">
            <div className="mt-0.5 rounded-md p-1.5 bg-green-500/10">
              <span className="block h-4 w-4 relative">
                <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
                <span className="absolute inset-1 rounded-full bg-green-500" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <CardDescription className="text-xs">Online Now</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-green-600 dark:text-green-400">
                {presence?.onlineCount ?? "—"}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* ── User growth ────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading
          title="User Growth"
          sub={
            aggregateMonthly
              ? `Monthly signups and cumulative total (${resolvedRange.label.toLowerCase()})`
              : `Daily signups and cumulative total (${resolvedRange.label.toLowerCase()})`
          }
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {aggregateMonthly ? "New Signups / Month" : "New Signups / Day"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-52">
              {loadingCharts ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">Loading…</p>
              ) : signupTimeline.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">No signups in this period</p>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signupTimeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} name="Signups" />
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cumulative Signups</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-52">
              {loadingCharts ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">Loading…</p>
              ) : cumulativeTimeline.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">No signups in this period</p>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeTimeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#userGrad)"
                    name="Cumulative Signups"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Live traffic ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeading
          title="Live Traffic"
          sub={`${presence?.onlineCount ?? 0} users online right now · refreshes every 30 s`}
        />
        <div className="grid lg:grid-cols-2 gap-4">
          {/* By country */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Online by Country
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-52">
              {presenceCountry.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">No users online</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={presenceCountry}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={32} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Bar dataKey="value" fill="#22d3ee" radius={[0, 3, 3, 0]} name="Users" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* By user type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Online by User Type</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-52 flex items-center justify-center">
              {presenceUserType.length === 0 ? (
                <p className="text-xs text-muted-foreground">No users online</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={presenceUserType}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {presenceUserType.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Users Today</CardTitle>
            <CardDescription className="text-xs">
              Lawyer app sessions via WebSocket · online users update every second
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {!presence || presence.users.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No user sessions today</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time today</TableHead>
                    <TableHead className="hidden sm:table-cell">Connected since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presence.users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.name?.trim() || user.email}
                          </p>
                          {user.name?.trim() && (
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isOnline ? (
                          <Badge className="gap-1.5 border-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"
                              aria-hidden="true"
                            />
                            Online
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Offline</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {fmtDuration(
                          displaySessionSeconds(user, presenceNow, presenceFetchedAt),
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {user.isOnline && user.connectedAt ? fmtTime(user.connectedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── AI usage & cost ───────────────────────────────────────────────── */}
      <div>
        <SectionHeading
          title="AI Usage & Cost"
          sub={`Spend and request volume by model and task (${resolvedRange.label.toLowerCase()})`}
        />

        {/* AI summary KPIs */}
        {aiSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Total AI Cost" value={fmtUsd(aiSummary.combinedProviderCostUsd)} icon={DollarSign} />
            <KpiCard label="Platform Margin" value={fmtUsd(aiSummary.totalPlatformMarginUsd)} icon={TrendingUp} />
            <KpiCard label="Total Requests" value={aiSummary.usageLogRequests.toLocaleString()} icon={Zap} />
            <KpiCard
              label="Avg Cost / Request"
              value={fmtUsd(aiSummary.avgCostPerRequest)}
              icon={BarChart2}
              sub={`${(aiSummary.avgCreditsPerDebit ?? 0).toFixed(1)} credits avg`}
            />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Cost by model */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cost by Model (USD)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-56">
              {topModels.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topModels} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => fmtUsd(v)}
                    />
                    <Bar dataKey="cost" fill="#f59e0b" radius={[0, 3, 3, 0]} name="Cost (USD)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Requests by task */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Requests by Task Type</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-56">
              {topTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topTasks} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Bar dataKey="requests" fill="#10b981" radius={[0, 3, 3, 0]} name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Recent audit ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeading
          title="Recent Activity"
          sub={`${auditTotal.toLocaleString()} events in selected range · click column headers to sort`}
        />
        <Card>
          <CardContent className="pt-4 pb-3">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {loadingCharts ? "Loading…" : "No audit events match your filters"}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <AdminSortableHeader
                          label="Action"
                          field="action"
                          activeField={auditSortBy}
                          activeDir={auditSortDir}
                          onSort={handleAuditSort}
                        />
                        <AdminSortableHeader
                          label="Entity"
                          field="entityType"
                          activeField={auditSortBy}
                          activeDir={auditSortDir}
                          onSort={handleAuditSort}
                        />
                        <TableHead className="hidden md:table-cell">User</TableHead>
                        <AdminSortableHeader
                          label="When"
                          field="createdAt"
                          activeField={auditSortBy}
                          activeDir={auditSortDir}
                          onSort={handleAuditSort}
                          className="whitespace-nowrap"
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium text-xs">{log.action}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.entityType}
                            {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {log.user?.email ?? (log.userId ? `${log.userId.slice(0, 8)}…` : "—")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <AdminPaginationBar
                  total={auditTotal}
                  limit={auditLimit}
                  offset={auditOffset}
                  onPage={setAuditOffset}
                />
              </>
            )}
            <div className="mt-3">
              <Link href="/admin/audit" className="text-xs text-primary hover:underline">
                View full audit log →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeading title="Quick Access" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {NAV_CARDS.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="hover:border-primary/40 transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <c.icon className="h-5 w-5 text-primary mb-1" />
                  <CardTitle className="text-sm">{c.title}</CardTitle>
                  <CardDescription className="text-xs">{c.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
