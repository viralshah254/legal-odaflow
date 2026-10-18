"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search } from "lucide-react"
import {
  listDemoRequests,
  getDemoRequestStats,
  updateDemoRequest,
  type DemoRequest,
  type DemoRequestStats,
} from "@/lib/api/admin"

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CLOSED", label: "Closed" },
]

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  NEW: "destructive",
  CONTACTED: "default",
  QUALIFIED: "secondary",
  CLOSED: "outline",
}

const PAGE = 50

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminDemoRequestsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [items, setItems] = useState<DemoRequest[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<DemoRequestStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "")
  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  const pushParams = useCallback(
    (status: string, q: string) => {
      const p = new URLSearchParams()
      if (status) p.set("status", status)
      if (q) p.set("q", q)
      router.replace(`/admin/demo-requests?${p.toString()}`, { scroll: false })
    },
    [router],
  )

  const load = useCallback((status: string, q: string, off = 0) => {
    setLoading(true)
    Promise.all([
      listDemoRequests({
        status: status || undefined,
        q: q || undefined,
        limit: PAGE,
        offset: off,
      }),
      getDemoRequestStats(),
    ])
      .then(([list, st]) => {
        setItems(list.items)
        setTotal(list.total)
        setStats(st)
        setError("")
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load demo requests")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(statusFilter, query, offset)
  }, [load, statusFilter, query, offset])

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updated = await updateDemoRequest(id, { status })
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)))
      getDemoRequestStats().then(setStats).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    pushParams(statusFilter, query)
    load(statusFilter, query, 0)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demo Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inbound demo requests from the marketing site — follow up and track pipeline status.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total", value: stats.total },
            { label: "Last 7 days", value: stats.last7Days },
            { label: "New", value: stats.new },
            { label: "Contacted", value: stats.contacted },
            { label: "Qualified", value: stats.qualified },
            { label: "Closed", value: stats.closed },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name, email, company…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
              pushParams(e.target.value, query)
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-16 text-muted-foreground text-sm">No demo requests yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">Submitted</th>
                  <th className="p-3 font-medium">Contact</th>
                  <th className="p-3 font-medium">Company</th>
                  <th className="p-3 font-medium">Details</th>
                  <th className="p-3 font-medium">Message</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b align-top hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{row.contactName}</div>
                      <a
                        href={`mailto:${row.email}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {row.email}
                      </a>
                      {row.phone && (
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {row.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{row.companyName}</div>
                      {row.jobTitle && (
                        <div className="text-xs text-muted-foreground">{row.jobTitle}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground space-y-1">
                      <div>{row.countryCode}</div>
                      {row.firmSize && <div>{row.firmSize} people</div>}
                      <Badge variant="outline" className="text-[10px]">
                        {row.source}
                      </Badge>
                    </td>
                    <td className="p-3 max-w-[220px]">
                      <p className="text-xs text-muted-foreground line-clamp-4">
                        {row.message || "—"}
                      </p>
                    </td>
                    <td className="p-3">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={row.status}
                        onChange={(e) => handleStatusChange(row.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <Badge variant={STATUS_BADGE[row.status] ?? "outline"} className="mt-2 block w-fit">
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset((o) => o + PAGE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
