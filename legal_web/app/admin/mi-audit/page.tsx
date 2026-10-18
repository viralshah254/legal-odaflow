"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Brain } from "lucide-react"
import { listMiAuditLogs, type MiAuditLogEntry } from "@/lib/api/mi-metadata"
import { format } from "date-fns"

export default function MiAuditAdminPage() {
  const [logs, setLogs] = useState<MiAuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    listMiAuditLogs({ limit: 200 })
      .then((r) => setLogs(r.items))
      .finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter((l) => {
    if (!query) return true
    const meta = l.metadata as { consumer?: string; practiceArea?: string } | undefined
    return (
      l.action.includes(query) ||
      (meta?.consumer ?? "").includes(query) ||
      (meta?.practiceArea ?? "").includes(query)
    )
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">MI Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Matter Intelligence classification decisions
          </p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filter consumer or practice area..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2">Consumer</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Practice area</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">Confidence</th>
                <th className="text-left px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const meta = log.metadata as {
                  consumer?: string
                  practiceArea?: string
                  confidence?: number
                }
                return (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{meta?.consumer ?? "—"}</td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      {meta?.practiceArea ?? "—"}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      {meta?.confidence != null ? `${Math.round(meta.confidence * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM d, HH:mm")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card className="mt-4">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No MI audit entries yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
