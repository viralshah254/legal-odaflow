"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Zap } from "lucide-react"
import { listAiUsageLogs, type AdminAiFilters, type AiUsageLogRow } from "@/lib/api/admin-extended"
import { AdminAiFiltersBar, AdminPaginationBar } from "@/components/admin/admin-ai-filters"

export default function AdminAiLogsPage() {
  const [filters, setFilters] = useState<AdminAiFilters>({ limit: 50, offset: 0 })
  const [logs, setLogs] = useState<{ items: AiUsageLogRow[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await listAiUsageLogs(filters)
      setLogs(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI request audit trail ({logs.total.toLocaleString()} total)
          </p>
        </div>
        <Zap className="h-6 w-6 text-muted-foreground" />
      </div>

      <AdminAiFiltersBar filters={filters} onChange={setFilters} />

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
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Entity</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Model</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Credits</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Tokens</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.items.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-medium">{l.entityName ?? "—"}</div>
                      {l.mode && <div className="text-muted-foreground">{l.mode}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">{l.taskType}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {l.modelName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      ${Number(l.costUsd ?? 0).toFixed(6)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">
                      {l.chargedCredits ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                      {((l.inputTokens ?? 0) + (l.outputTokens ?? 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 font-medium ${l.status === "SUCCESS" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.items.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">No logs found.</div>
            )}
          </div>
          <AdminPaginationBar
            total={logs.total}
            limit={filters.limit ?? 50}
            offset={filters.offset ?? 0}
            onPage={(offset) => setFilters((f) => ({ ...f, offset }))}
          />
        </>
      )}
    </div>
  )
}
