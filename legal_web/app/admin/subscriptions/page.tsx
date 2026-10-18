"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  Search,
  CreditCard,
  TrendingUp,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react"
import { listAdminSubscriptions, type AdminSubscription } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd && status === "ACTIVE") {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
        Cancel pending
      </Badge>
    )
  }
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    TRIALING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    CANCELED:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    CANCELLED:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    CHECKOUT_PENDING:
      "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  }
  return (
    <Badge
      className={`text-xs border-0 ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.replace("_", " ")}
    </Badge>
  )
}

function cycleBadge(cycle: "monthly" | "annual" | null) {
  if (!cycle) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <Badge
      variant="outline"
      className={`text-xs ${cycle === "annual" ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}
    >
      {cycle === "annual" ? "Annual" : "Monthly"}
    </Badge>
  )
}

function CreditBar({
  remaining,
  total,
  percent,
}: {
  remaining: number
  total: number | null
  percent: number | null
}) {
  if (total === null || total === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {remaining.toLocaleString()} credits
      </span>
    )
  }
  const pct = percent ?? 0
  const barColor =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-[60px]">
        {remaining.toLocaleString()}/{total.toLocaleString()}
      </span>
    </div>
  )
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function entityBadge(type: "firm" | "consumer") {
  return type === "firm" ? (
    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-300">
      Firm
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:text-purple-300">
      Consumer
    </Badge>
  )
}

// ── Stats card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────

type TabKey = "all" | "firms" | "consumers" | "cancelled"

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<AdminSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<TabKey>("all")
  const [cycleFilter, setCycleFilter] = useState<"all" | "monthly" | "annual">("all")

  const load = () => {
    setLoading(true)
    setError("")
    listAdminSubscriptions()
      .then(setSubs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = subs.filter((s) => s.status === "ACTIVE" && !s.cancelAtPeriodEnd).length
    const trialing = subs.filter((s) => s.status === "TRIALING").length
    const pastDue = subs.filter((s) => s.status === "PAST_DUE").length
    const cancelled = subs.filter(
      (s) => s.status === "CANCELED" || s.status === "CANCELLED",
    ).length
    const cancelPending = subs.filter((s) => s.cancelAtPeriodEnd && s.status === "ACTIVE").length
    const annual = subs.filter((s) => s.billingCycle === "annual" && s.status === "ACTIVE").length
    const monthly = subs.filter((s) => s.billingCycle === "monthly" && s.status === "ACTIVE").length
    return { active, trialing, pastDue, cancelled, cancelPending, annual, monthly }
  }, [subs])

  // ── Filters ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = subs

    if (tab === "firms") list = list.filter((s) => s.entityType === "firm")
    else if (tab === "consumers") list = list.filter((s) => s.entityType === "consumer")
    else if (tab === "cancelled")
      list = list.filter(
        (s) =>
          s.status === "CANCELED" ||
          s.status === "CANCELLED" ||
          s.cancelAtPeriodEnd,
      )

    if (cycleFilter !== "all") list = list.filter((s) => s.billingCycle === cycleFilter)

    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (s) =>
          s.entityName.toLowerCase().includes(q) ||
          (s.userEmail ?? "").toLowerCase().includes(q) ||
          s.planId.toLowerCase().includes(q) ||
          s.status.toLowerCase().includes(q) ||
          s.countryCode.toLowerCase().includes(q),
      )
    }

    return list
  }, [subs, tab, cycleFilter, query])

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: subs.length },
    {
      key: "firms",
      label: "Firms",
      count: subs.filter((s) => s.entityType === "firm").length,
    },
    {
      key: "consumers",
      label: "Consumers",
      count: subs.filter((s) => s.entityType === "consumer").length,
    },
    {
      key: "cancelled",
      label: "Cancelled",
      count: subs.filter(
        (s) =>
          s.status === "CANCELED" ||
          s.status === "CANCELLED" ||
          s.cancelAtPeriodEnd,
      ).length,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All platform subscriptions — billing cycles, credit usage, and renewal status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Active"
          value={stats.active}
          icon={CreditCard}
          color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          label="Trialing"
          value={stats.trialing}
          icon={Clock}
          color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          label="Past due"
          value={stats.pastDue}
          icon={AlertTriangle}
          color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          label="Cancelled"
          value={stats.cancelled}
          icon={XCircle}
          color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          label="Cancel pending"
          value={stats.cancelPending}
          icon={TrendingUp}
          color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        />
      </div>

      {/* Billing cycle summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Active billing cycles:{" "}
          <strong className="text-foreground">{stats.monthly} monthly</strong>
          {" · "}
          <strong className="text-foreground">{stats.annual} annual</strong>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, plan, country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycleFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                cycleFilter === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {c === "all" ? "All cycles" : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
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
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  Type
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Cycle
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Credits used
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Renewal
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">
                  Country
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">
                  Since
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-[160px]">{s.entityName}</div>
                    {s.userEmail && (
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {s.userEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {entityBadge(s.entityType)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {s.planId}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {cycleBadge(s.billingCycle)}
                  </td>
                  <td className="px-4 py-3">
                    <CreditBar
                      remaining={s.creditsRemaining}
                      total={s.planCreditsTotal}
                      percent={s.percentUsed}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {s.cancelAtPeriodEnd ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        Ends {formatDate(s.currentPeriodEnd)}
                      </span>
                    ) : (
                      formatDate(s.currentPeriodEnd)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(s.status, s.cancelAtPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                    {s.countryCode}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                    {formatDate(s.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No subscriptions found.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
