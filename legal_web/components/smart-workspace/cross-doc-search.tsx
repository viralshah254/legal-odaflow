"use client"

import { useState, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiFetch } from "@/lib/api/client"
import { Search, Loader2, X, FileText, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchHit {
  documentId: string
  fileName: string
  page?: number
  startOffset: number
  endOffset: number
  excerpt: string
  score: number
}

interface CrossDocSearchProps {
  workspaceId: string
  tenantId?: string
  onJumpToHit: (hit: SearchHit) => void
  className?: string
}

/**
 * Cross-document search panel for the Smart Research Workspace.
 * Searches all documents in the workspace and returns excerpts with jump-to links.
 */
export function CrossDocSearch({ workspaceId, tenantId, onJumpToHit, className }: CrossDocSearchProps) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const data = await apiFetch<SearchHit[]>(
        `/smart-workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}&limit=30`,
        { tenantId },
      )
      setHits(data)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, tenantId, query])

  const clear = () => {
    setQuery("")
    setHits([])
    setSearched(false)
    inputRef.current?.focus()
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search all documents..."
            className="pl-7 h-7 text-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          {query && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={clear}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={runSearch} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {hits.length > 0 && (
          <div className="py-1">
            <p className="px-3 py-1 text-[10px] text-muted-foreground">
              {hits.length} hit{hits.length !== 1 ? "s" : ""} across workspace
            </p>
            {hits.map((hit, i) => (
              <button
                key={i}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors group"
                onClick={() => onJumpToHit(hit)}
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground truncate">
                    {hit.fileName}{hit.page ? ` · p.${hit.page}` : ""}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: hit.excerpt.replace(
                        new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
                        '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">$1</mark>',
                      ),
                    }}
                  />
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 mt-1" />
              </button>
            ))}
          </div>
        )}

        {searched && hits.length === 0 && !loading && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              No results for &ldquo;{query}&rdquo; in workspace documents.
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
