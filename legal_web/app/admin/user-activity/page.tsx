"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, History, Search } from "lucide-react"
import {
  listAdminUserActivity,
  type AdminActivityCategory,
  type AdminUserActivityFilters,
  type AdminUserActivityRow,
} from "@/lib/api/admin-extended"
import { AdminPaginationBar } from "@/components/admin/admin-ai-filters"
import { AdminUserActivityDetailSheet } from "@/components/admin/admin-user-activity-detail-sheet"

const CATEGORY_STYLES: Record<AdminActivityCategory, string> = {
  research: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  drafting: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  copilot: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  search: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  other: "bg-muted text-muted-foreground",
}

const CATEGORIES: { value: "" | AdminActivityCategory; label: string }[] = [
  { value: "", label: "All" },
  { value: "research", label: "Research" },
  { value: "drafting", label: "Drafting" },
  { value: "copilot", label: "Copilot" },
  { value: "search", label: "Search" },
  { value: "other", label: "Other" },
]

export default function AdminUserActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminUserActivityPageInner />
    </Suspense>
  )
}

function AdminUserActivityPageInner() {
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get("userId") ?? undefined

  const [filters, setFilters] = useState<AdminUserActivityFilters>({
    limit: 50,
    offset: 0,
    userId: initialUserId,
  })
  const [qInput, setQInput] = useState("")
  const [data, setData] = useState<{ items: AdminUserActivityRow[]; total: number }>({
    items: [],
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Sync userId from URL when landing from Users sheet
  useEffect(() => {
    const uid = searchParams.get("userId")
    if (uid) {
      setFilters((f) => (f.userId === uid ? f : { ...f, userId: uid, offset: 0 }))
    }
  }, [searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await listAdminUserActivity(filters)
      setData({ items: result.items, total: result.total })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  // Debounce free-text search into filters.q
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => {
        const next = qInput.trim() || undefined
        if (f.q === next) return f
        return { ...f, q: next, offset: 0 }
      })
    }, 300)
    return () => clearTimeout(t)
  }, [qInput])

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Activity</h1>
          <p className="text-muted-foreground text-sm mt-1">
            What users search, research, draft, and prompt ({data.total.toLocaleString()} events)
          </p>
        </div>
        <History className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            className="h-8 text-xs mt-1"
            value={filters.from?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined,
                offset: 0,
              }))
            }
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            className="h-8 text-xs mt-1"
            value={filters.to?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined,
                offset: 0,
              }))
            }
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Category</Label>
          <select
            className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={filters.category ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                category: (e.target.value || undefined) as AdminActivityCategory | undefined,
                offset: 0,
              }))
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c.label} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">User ID</Label>
          <Input
            className="h-8 text-xs mt-1"
            value={filters.userId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                userId: e.target.value || undefined,
                offset: 0,
              }))
            }
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tenant ID</Label>
          <Input
            className="h-8 text-xs mt-1"
            value={filters.tenantId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                tenantId: e.target.value || undefined,
                offset: 0,
              }))
            }
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Search prompts</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 text-xs pl-8"
              placeholder="Query text…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
        </div>
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
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Prompt</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                    Task / Mode
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                    Firm
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-medium">{row.userName ?? "—"}</div>
                      <div className="text-muted-foreground">{row.userEmail ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={`text-xs border-0 ${CATEGORY_STYLES[row.category]}`}>
                        {row.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-xs">
                      <p className="line-clamp-2">{row.promptPreview || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      <div>{row.taskType ?? "—"}</div>
                      {row.mode ? <div className="text-[10px]">{row.mode}</div> : null}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                      {row.tenantName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No activity found.
              </div>
            )}
          </div>
          <AdminPaginationBar
            total={data.total}
            limit={filters.limit ?? 50}
            offset={filters.offset ?? 0}
            onPage={(offset) => setFilters((f) => ({ ...f, offset }))}
          />
        </>
      )}

      <AdminUserActivityDetailSheet
        activityId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </div>
  )
}
