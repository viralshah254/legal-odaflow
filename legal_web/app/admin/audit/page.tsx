"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Search, FileText } from "lucide-react"
import { apiFetch } from "@/lib/api/client"

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  createdAt: string
  user?: { email: string; name: string | null } | null
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    setLoading(true)
    apiFetch<{ items: AuditLog[]; total: number }>(`/admin/audit/logs?limit=200`)
      .then((r) => { setLogs(r.items); setTotal(r.total) })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter(
    (l) =>
      !query ||
      l.action.toLowerCase().includes(query.toLowerCase()) ||
      l.entityType.toLowerCase().includes(query.toLowerCase()) ||
      (l.user?.email ?? "").toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Full Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete platform event log · {total.toLocaleString()} total events
          </p>
        </div>
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filter by action, entity or user..."
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
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Entity</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">User</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-xs">{l.action}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    {l.entityType}
                    {l.entityId ? ` · ${l.entityId.slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                    {l.user?.email ?? (l.userId ? l.userId.slice(0, 8) + "…" : "—")}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No logs found.</div>
          )}
        </div>
      )}
    </div>
  )
}
