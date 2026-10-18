"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, DollarSign, ChevronDown, ChevronRight, Bot, Download } from "lucide-react"
import { getAdminCostsByEntity, type AdminCostByEntity } from "@/lib/api/admin"
import {
  getEntityCostBreakdown,
  getAiCostsSummaryV2,
  listCreditLedger,
  listAiUsageLogs,
  getCostsByModel,
  listProviderBillingSnapshots,
  exportCreditLedgerCsv,
  type EntityTaskBreakdown,
  type AdminAiFilters,
  type AiCostsSummaryV2,
  type CreditLedgerEntry,
  type AiUsageLogRow,
  type AiCostByModelRow,
  type ProviderBillingSnapshot,
} from "@/lib/api/admin-extended"
import { AdminAiFiltersBar, AdminPaginationBar } from "@/components/admin/admin-ai-filters"
import { cn } from "@/lib/utils"

function EntityRow({ entity }: { entity: AdminCostByEntity }) {
  const [open, setOpen] = useState(false)
  const [breakdown, setBreakdown] = useState<EntityTaskBreakdown[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const toggle = useCallback(async () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      try {
        const data = await getEntityCostBreakdown(entity.entityId, entity.entityType)
        setBreakdown(data)
        setLoaded(true)
      } finally {
        setLoading(false)
      }
    }
  }, [open, loaded, entity.entityId, entity.entityType])

  const entityBadgeClass =
    entity.entityType === "tenant"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={toggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <div>
              <div className="font-medium text-sm">{entity.entityName}</div>
              <div className="text-xs text-muted-foreground">{entity.entityId.slice(0, 12)}…</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", entityBadgeClass)}>
            {entity.entityType}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-sm tabular-nums font-semibold">
          ${entity.totalCostUsd.toFixed(4)}
        </td>
        <td className="px-4 py-3 text-right text-xs tabular-nums hidden sm:table-cell">
          {entity.totalCreditsCharged.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums hidden md:table-cell">
          {entity.totalRequests.toLocaleString()}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-muted/20 border-b border-border px-12 py-3">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No breakdown data.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1.5">Task</th>
                    <th className="text-right py-1.5">Requests</th>
                    <th className="text-right py-1.5">Cost</th>
                    <th className="text-right py-1.5">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => (
                    <tr key={b.taskType}>
                      <td className="py-1.5">{b.taskType}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.requests}</td>
                      <td className="py-1.5 text-right tabular-nums">${b.totalCostUsd.toFixed(6)}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.creditsCharged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminCostsPage() {
  const [filters, setFilters] = useState<AdminAiFilters>({ limit: 50, offset: 0 })
  const [summary, setSummary] = useState<AiCostsSummaryV2 | null>(null)
  const [byEntity, setByEntity] = useState<{ items: AdminCostByEntity[]; total: number }>({ items: [], total: 0 })
  const [ledger, setLedger] = useState<{ items: CreditLedgerEntry[]; total: number }>({ items: [], total: 0 })
  const [logs, setLogs] = useState<{ items: AiUsageLogRow[]; total: number }>({ items: [], total: 0 })
  const [byModel, setByModel] = useState<AiCostByModelRow[]>([])
  const [billing, setBilling] = useState<ProviderBillingSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [s, e, l, lg, m, b] = await Promise.all([
        getAiCostsSummaryV2({ from: filters.from, to: filters.to }),
        getAdminCostsByEntity({
          from: filters.from,
          to: filters.to,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0,
        }),
        listCreditLedger(filters),
        listAiUsageLogs(filters),
        getCostsByModel({ from: filters.from, to: filters.to }),
        listProviderBillingSnapshots(14),
      ])
      setSummary(s)
      setByEntity(e)
      setLedger(l)
      setLogs(lg)
      setByModel(m)
      setBilling(b)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = () => {
    const csv = exportCreditLedgerCsv(ledger.items)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "credit-activity.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Costs</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform AI spend and credit activity</p>
        </div>
        <DollarSign className="h-6 w-6 text-muted-foreground" />
      </div>

      <AdminAiFiltersBar filters={filters} onChange={setFilters} />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Credits debited", value: summary.ledgerCreditsCharged.toLocaleString() },
            { label: "Provider cost (USD)", value: `$${summary.combinedProviderCostUsd.toFixed(4)}` },
            { label: "Ledger debits", value: summary.ledgerDebits.toLocaleString() },
            { label: "Usage log requests", value: summary.usageLogRequests.toLocaleString() },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
        <Tabs defaultValue="credit-activity">
          <TabsList className="mb-4 flex flex-wrap h-auto">
            <TabsTrigger value="credit-activity">Credit Activity</TabsTrigger>
            <TabsTrigger value="by-entity">By Tenant / User</TabsTrigger>
            <TabsTrigger value="by-model">By Model</TabsTrigger>
            <TabsTrigger value="logs">Request Logs</TabsTrigger>
            <TabsTrigger value="provider">Provider vs Platform</TabsTrigger>
          </TabsList>

          <TabsContent value="credit-activity">
            <div className="flex justify-end mb-2">
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Entity</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Task</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Model</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Credits</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Cost</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden lg:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.items.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-medium">{r.entityName ?? "—"}</div>
                        <div className="text-muted-foreground">{r.entityType ?? ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs hidden sm:table-cell">{r.taskType}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{r.modelName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">{r.credits}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">
                        ${Number(r.providerCostUsd ?? r.costUsd ?? 0).toFixed(6)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledger.items.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">No credit activity found.</div>
              )}
            </div>
            <AdminPaginationBar
              total={ledger.total}
              limit={filters.limit ?? 50}
              offset={filters.offset ?? 0}
              onPage={(offset) => setFilters((f) => ({ ...f, offset }))}
            />
          </TabsContent>

          <TabsContent value="by-entity">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Entity</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Type</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Cost USD</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Credits</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byEntity.items.map((e) => (
                    <EntityRow key={e.entityId} entity={e} />
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPaginationBar
              total={byEntity.total}
              limit={filters.limit ?? 50}
              offset={filters.offset ?? 0}
              onPage={(offset) => setFilters((f) => ({ ...f, offset }))}
            />
          </TabsContent>

          <TabsContent value="by-model">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Model</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Provider</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Requests</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Cost USD</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Credits</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium hidden lg:table-cell">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byModel.map((m) => (
                    <tr key={m.modelName} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                          {m.modelName}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{m.modelProvider ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">{m.totalRequests}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums font-semibold">${m.costUsd.toFixed(6)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">{m.creditsCharged}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground hidden lg:table-cell">
                        {m.totalTokens.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {byModel.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">No model usage yet.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Entity</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Task</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Model</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Cost</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.items.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs">{l.entityName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs">{l.taskType}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{l.modelName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">${Number(l.costUsd).toFixed(6)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">{l.chargedCredits ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPaginationBar
              total={logs.total}
              limit={filters.limit ?? 50}
              offset={filters.offset ?? 0}
              onPage={(offset) => setFilters((f) => ({ ...f, offset }))}
            />
          </TabsContent>

          <TabsContent value="provider">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Provider</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Reported</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Computed</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {billing.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs">{new Date(b.periodDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-xs">{b.provider}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">${b.reportedUsd.toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">${b.computedUsd.toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                        {b.variancePercent != null ? `${b.variancePercent.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {billing.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No reconciliation snapshots yet. Set OPENAI_ADMIN_API_KEY for provider totals.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
