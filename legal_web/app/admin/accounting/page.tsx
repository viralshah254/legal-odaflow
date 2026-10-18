"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, TrendingDown, DollarSign, Landmark, Receipt, Wallet, PiggyBank, ArrowRight } from "lucide-react"
import {
  getAccountingSummary,
  getRevenueSummary,
  type AccountingSummary,
  type RevenueSourceBreakdown,
} from "@/lib/api/admin-extended"

const SOURCE_LABELS: Record<string, string> = {
  subscription: "Subscriptions",
  credit_topup: "Credit Top-ups",
  marketplace: "Marketplace",
  lawyer_review: "Lawyer Reviews",
  other: "Other",
}

const SOURCE_COLORS: Record<string, string> = {
  subscription: "bg-blue-500",
  credit_topup: "bg-emerald-500",
  marketplace: "bg-violet-500",
  lawyer_review: "bg-amber-500",
  other: "bg-slate-400",
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-lg p-2 ${trend === "down" ? "bg-red-500/10" : "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${trend === "down" ? "text-red-500" : "text-primary"}`} />
          </div>
        </div>
        {trend === "up" && <TrendingUp className="mt-3 h-3.5 w-3.5 text-emerald-500" />}
        {trend === "down" && <TrendingDown className="mt-3 h-3.5 w-3.5 text-red-500" />}
      </CardContent>
    </Card>
  )
}

export default function AccountingOverviewPage() {
  const [summary, setSummary] = useState<AccountingSummary | null>(null)
  const [breakdown, setBreakdown] = useState<RevenueSourceBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAccountingSummary(), getRevenueSummary()])
      .then(([s, b]) => {
        setSummary(s)
        setBreakdown(b)
      })
      .catch((err) => setError(err.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  const totalGross = breakdown.reduce((s, r) => s + r.grossAmount, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Platform Accounting</h1>
          <p className="text-sm text-muted-foreground">All-time P&amp;L — platform books only</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title="Gross Revenue"
              value={fmt(summary.grossRevenue)}
              icon={DollarSign}
              trend="up"
            />
            <KpiCard
              title="Net Revenue"
              value={fmt(summary.netRevenue)}
              sub={`After tax & fees`}
              icon={Wallet}
            />
            <KpiCard
              title="Tax Collected"
              value={fmt(summary.taxCollected)}
              sub="Via Stripe automatic tax"
              icon={PiggyBank}
            />
            <KpiCard
              title="Total Expenses"
              value={fmt(summary.totalExpenses)}
              icon={Receipt}
              trend="down"
            />
            <KpiCard
              title="Net Margin"
              value={fmt(summary.netMargin)}
              sub="Net revenue − expenses"
              icon={summary.netMargin >= 0 ? TrendingUp : TrendingDown}
              trend={summary.netMargin >= 0 ? "up" : "down"}
            />
          </div>

          {breakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Revenue by Source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {breakdown
                  .sort((a, b) => b.grossAmount - a.grossAmount)
                  .map((row) => {
                    const pct = totalGross > 0 ? (row.grossAmount / totalGross) * 100 : 0
                    return (
                      <div key={row.source} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium">
                            {SOURCE_LABELS[row.source] ?? row.source}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {fmt(row.grossAmount)} &middot; {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${SOURCE_COLORS[row.source] ?? "bg-slate-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/accounting/revenue", icon: Wallet, label: "Revenue ledger", desc: "All transactions" },
          { href: "/admin/accounting/expenses", icon: Receipt, label: "Expenses", desc: "Add & manage costs" },
          { href: "/admin/accounting/taxes", icon: PiggyBank, label: "Taxes", desc: "Collected by country" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
