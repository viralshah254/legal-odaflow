"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, RefreshCw } from "lucide-react"
import {
  listUnmatchedSections,
  getUnmatchedSectionStats,
  updateUnmatchedSection,
  triggerUnmatchedSectionIngest,
  type UnmatchedSection,
  type UnmatchedSectionStats,
} from "@/lib/api/admin"

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
]

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  resolved: "secondary",
  ignored: "outline",
}

const PAGE = 100

function formatTrail(trail: UnmatchedSection["fallbackTrail"]): string {
  if (!trail?.steps?.length) return "—"
  return trail.steps.join(" → ")
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminUnmatchedSectionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [items, setItems] = useState<UnmatchedSection[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<UnmatchedSectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [offset, setOffset] = useState(0)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "")

  const pushParams = useCallback(
    (status: string) => {
      const p = new URLSearchParams()
      if (status) p.set("status", status)
      router.replace(`/admin/unmatched-sections?${p.toString()}`, { scroll: false })
    },
    [router],
  )

  const load = useCallback((status: string, off = 0) => {
    setLoading(true)
    Promise.all([
      listUnmatchedSections({
        status: status || undefined,
        sort: "searchCount",
        limit: PAGE,
        offset: off,
      }),
      getUnmatchedSectionStats(),
    ])
      .then(([r, s]) => {
        setItems(r.items)
        setTotal(r.total)
        setStats(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(statusFilter, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyStatusFilter = (status: string, off = 0) => {
    setStatusFilter(status)
    setOffset(off)
    pushParams(status)
    load(status, off)
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updated = await updateUnmatchedSection(id, { status })
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...updated } : row)))
      void getUnmatchedSectionStats().then(setStats)
    } catch {
      setError("Failed to update status")
    }
  }

  const handleTriggerIngest = async (row: UnmatchedSection) => {
    setIngestingId(row.id)
    setError("")
    try {
      const result = await triggerUnmatchedSectionIngest(row.id)
      if (result.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: "resolved",
                  resolvedNote: result.sourceName
                    ? `Ingest triggered — section resolved from ${result.sourceName}`
                    : item.resolvedNote,
                  resolvedAuthorityId: result.resolvedAuthorityId ?? item.resolvedAuthorityId,
                }
              : item,
          ),
        )
        void getUnmatchedSectionStats().then(setStats)
      } else {
        setError(`Ingest did not resolve ${row.rawQuery}. Check parsed act/section and corpus sources.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed")
    } finally {
      setIngestingId(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE)
  const currentPage = Math.floor(offset / PAGE)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Unmatched Sections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Section Finder queries with no match — triage and trigger corpus ingest
            {total > 0 && !loading && (
              <span className="ml-2 text-foreground font-medium">· {total.toLocaleString()} results</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => load(statusFilter, offset)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open", value: stats.open.toLocaleString() },
            { label: "In progress", value: stats.inProgress.toLocaleString() },
            { label: "Resolved (7d)", value: stats.resolved7d.toLocaleString() },
            { label: "Ignored", value: stats.ignored.toLocaleString() },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold mt-0.5">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-1">Status:</span>
          {STATUS_OPTIONS.filter((o) => o.value !== "").map((o) => (
            <Badge
              key={o.value}
              variant={statusFilter === o.value ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => applyStatusFilter(statusFilter === o.value ? "" : o.value, 0)}
            >
              {o.label}
            </Badge>
          ))}
          {statusFilter && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
              onClick={() => applyStatusFilter("", 0)}
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
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
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Query</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Parsed</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Searches</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Fallback trail</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{row.rawQuery}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Last searched {formatDate(row.lastSearchedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {row.parsedActId || row.parsedSection ? (
                        <div className="font-mono text-xs">
                          {[row.parsedActId, row.parsedSection ? `§${row.parsedSection}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {row.parsedActToken && (
                        <div className="text-xs text-muted-foreground mt-0.5">token: {row.parsedActToken}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{row.searchCount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_BADGE[row.status] ?? "outline"} className="text-xs">
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                      {row.resolvedNote && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[200px]">{row.resolvedNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell max-w-xs">
                      {formatTrail(row.fallbackTrail)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-2 min-w-[160px]">
                        <select
                          className="text-xs rounded border border-border bg-background px-1.5 py-1"
                          value={row.status}
                          onChange={(e) => handleStatusChange(row.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!row.parsedActId || !row.parsedSection || ingestingId === row.id}
                          onClick={() => handleTriggerIngest(row)}
                        >
                          {ingestingId === row.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          Trigger ingest
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No unmatched section queries found.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {offset + 1}–{Math.min(offset + PAGE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 0}
                  onClick={() => {
                    const next = offset - PAGE
                    setOffset(next)
                    load(statusFilter, next)
                  }}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => {
                    const next = offset + PAGE
                    setOffset(next)
                    load(statusFilter, next)
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
