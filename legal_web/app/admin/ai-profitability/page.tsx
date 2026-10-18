"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, TrendingUp } from "lucide-react"
import { getAdminAiProfitability, type AiProfitabilityRow, type AdminAiFilters } from "@/lib/api/admin-extended"
import { AdminAiFiltersBar } from "@/components/admin/admin-ai-filters"

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
}

function rowLabel(r: AiProfitabilityRow) {
  return r.key ?? r.taskType ?? "unknown"
}

export default function AdminAiProfitabilityPage() {
  const [groupBy, setGroupBy] = useState<"taskType" | "modelName" | "tenantId">("taskType")
  const [filters, setFilters] = useState<AdminAiFilters>({})
  const [rows, setRows] = useState<AiProfitabilityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await getAdminAiProfitability({ ...filters, groupBy })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [filters, groupBy])

  useEffect(() => {
    load()
  }, [load])

  const totalRevenue = rows.reduce((s, r) => s + r.totalCreditValueUsd, 0)
  const totalCost = rows.reduce((s, r) => s + r.totalActualCostUsd, 0)
  const totalMargin = rows.reduce((s, r) => s + r.platformMarginUsd, 0)
  const overallGM = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Profitability</h1>
          <p className="text-muted-foreground text-sm mt-1">Credit revenue vs model cost breakdown</p>
        </div>
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>

      <AdminAiFiltersBar filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Revenue (credits)", value: `$${totalRevenue.toFixed(2)}` },
          { label: "AI Cost", value: `$${totalCost.toFixed(4)}` },
          { label: "Platform Margin", value: `$${totalMargin.toFixed(2)}` },
          { label: "Gross Margin %", value: pct(overallGM), highlight: overallGM >= 40 },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.highlight !== undefined ? (s.highlight ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : ""}`}>
                {s.value}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
        <TabsList className="mb-4">
          <TabsTrigger value="taskType">By Task</TabsTrigger>
          <TabsTrigger value="modelName">By Model</TabsTrigger>
          <TabsTrigger value="tenantId">By Tenant</TabsTrigger>
        </TabsList>
        <TabsContent value={groupBy}>
          {error && (
            <Card className="mb-4 border-destructive/50">
              <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No profitability data yet.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      {groupBy === "taskType" ? "Task Type" : groupBy === "modelName" ? "Model" : "Tenant"}
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Country</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Requests</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Credits</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Revenue</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">AI Cost</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-xs">{rowLabel(r)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                        {r.countryCode ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">{r.requestCount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">
                        {r.totalCreditsCharged.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">
                        ${r.totalCreditValueUsd.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">
                        ${r.totalActualCostUsd.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums font-semibold">
                        <span className={r.grossMarginPercent >= 40 ? "text-green-600 dark:text-green-400" : r.grossMarginPercent >= 0 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
                          {pct(r.grossMarginPercent)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
