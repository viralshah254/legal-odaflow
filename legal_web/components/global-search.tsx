"use client"
import { useTranslations } from "next-intl"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useTenant } from "@/lib/contexts/tenant-context"
import { unifiedSearch, type UnifiedSearchResult } from "@/lib/api/search"

type SearchEntityType = "matter" | "client" | "document" | "task"

const ENTITY_BADGE: Record<
  SearchEntityType,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  matter: { label: "Matter", variant: "default" },
  client: { label: "Client", variant: "secondary" },
  document: { label: "Document", variant: "outline" },
  task: { label: "Task", variant: "outline" },
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

type SearchRow = {
  id: string
  type: SearchEntityType
  label: string
  sublabel?: string
  href: string
}

function flattenResults(results: UnifiedSearchResult): SearchRow[] {
  const rows: SearchRow[] = []

  for (const m of results.matters) {
    rows.push({
      id: m.id,
      type: "matter",
      label: m.title,
      sublabel: m.caseNumber ?? undefined,
      href: `/app/matters/${m.id}`,
    })
  }
  for (const c of results.clients) {
    rows.push({
      id: c.id,
      type: "client",
      label: c.name,
      sublabel: c.email ?? undefined,
      href: `/app/clients/${c.id}`,
    })
  }
  for (const d of results.documents) {
    rows.push({
      id: d.id,
      type: "document",
      label: d.fileName,
      href: d.matterId ? `/app/matters/${d.matterId}` : "/app/documents",
    })
  }
  for (const t of results.tasks) {
    rows.push({
      id: t.id,
      type: "task",
      label: t.title,
      href: t.matterId ? `/app/matters/${t.matterId}` : "/app/tasks",
    })
  }

  return rows
}

export function GlobalSearch() {
  const t = useTranslations("common")
  const router = useRouter()
  const { activeTenantId } = useTenant()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<UnifiedSearchResult | null>(null)
  const debouncedQuery = useDebouncedValue(query, 300)

  const runSearch = useCallback(async () => {
    if (!activeTenantId || debouncedQuery.trim().length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const data = await unifiedSearch(activeTenantId, debouncedQuery.trim())
      setResults(data)
    } catch {
      setResults({
        query: debouncedQuery.trim(),
        matters: [],
        clients: [],
        documents: [],
        tasks: [],
      })
    } finally {
      setLoading(false)
    }
  }, [activeTenantId, debouncedQuery])

  useEffect(() => {
    void runSearch()
  }, [runSearch])

  const rows = results ? flattenResults(results) : []
  const hasResults = rows.length > 0

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
      <Input
        placeholder={t("search_matters_clients_documents_tasks")}
        className="pl-9 w-full bg-muted/50 dark:bg-[hsl(var(--muted)/0.6)] border-border/60 hover:border-border focus-visible:bg-background dark:focus-visible:bg-[hsl(var(--input))] transition-colors h-8 text-[13px]"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && debouncedQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border/60 bg-popover shadow-[0_8px_24px_-4px_rgb(0_0_0/0.15)] dark:shadow-[0_8px_24px_-4px_rgb(0_0_0/0.55)] max-h-80 overflow-auto">
          {loading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : !hasResults ? (
            <p className="p-3 text-sm text-muted-foreground">{t("no_results")}</p>
          ) : (
            <div className="p-1">
              {rows.map((row) => {
                const badge = ENTITY_BADGE[row.type]
                return (
                  <button
                    key={`${row.type}-${row.id}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-sm flex items-center gap-2"
                    onMouseDown={() => router.push(row.href)}
                  >
                    <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                      {badge.label}
                    </Badge>
                    <span className="truncate flex-1">
                      {row.label}
                      {row.sublabel ? (
                        <span className="text-muted-foreground"> · {row.sublabel}</span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
