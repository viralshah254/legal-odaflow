"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Building2 } from "lucide-react"
import { listAdminTenants, type AdminTenant } from "@/lib/api/admin"

function subStatusBadge(status: string | undefined, cancelAtPeriodEnd: boolean | undefined) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>
  if (cancelAtPeriodEnd && status === "ACTIVE") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Cancelling
      </span>
    )
  }
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    TRIALING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.replace("_", " ")}
    </span>
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
  if (!total) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {remaining.toLocaleString()}
      </span>
    )
  }
  const pct = percent ?? 0
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {remaining.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground/50">({pct}%)</span>
    </div>
  )
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    listAdminTenants()
      .then(setTenants)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = tenants.filter(
    (t) => !query || t.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Law firm organisations ({tenants.length})
          </p>
        </div>
        <Building2 className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search tenants..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  Country
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Plan
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Cycle
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Credits
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Renewal
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Users
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Matters
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Sub Status
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.defaultCurrency}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {t.primaryCountry}
                  </td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell">
                    {t.billingPlan ? (
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                        {t.billingPlan}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {t.subscription?.billingCycle ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${t.subscription.billingCycle === "annual" ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}
                      >
                        {t.subscription.billingCycle === "annual" ? "Annual" : "Monthly"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CreditBar
                      remaining={t.aiCreditsRemaining ?? 0}
                      total={t.subscription?.planCreditsTotal ?? null}
                      percent={t.subscription?.percentUsed ?? null}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {t.subscription?.cancelAtPeriodEnd ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        Ends {formatDate(t.subscription.currentPeriodEnd)}
                      </span>
                    ) : (
                      formatDate(t.subscription?.currentPeriodEnd)
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {t._count?.tenantUsers ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {t._count?.matters ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {subStatusBadge(
                      t.subscription?.status,
                      t.subscription?.cancelAtPeriodEnd,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.isActive ? "default" : "secondary"} className="text-xs">
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No tenants found.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
