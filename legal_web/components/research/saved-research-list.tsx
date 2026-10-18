"use client"

import { BookOpen, CheckCircle2, Clock, Loader2 } from "lucide-react"
import type { ResearchHistoryItem } from "@/lib/api/ai"
import { isResearchVerifiedForDisplay } from "@/lib/api/verification"

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function SavedResearchList({
  items,
  loading,
  onSelect,
  limit,
  showAll,
  onToggleShowAll,
  emptyMessage = "Your research will appear here after you run a query.",
}: {
  items: ResearchHistoryItem[]
  loading: boolean
  onSelect: (item: ResearchHistoryItem) => void
  limit?: number
  showAll?: boolean
  onToggleShowAll?: () => void
  emptyMessage?: string
}) {
  const visibleItems =
    limit != null && !showAll ? items.slice(0, limit) : items

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center gap-2 px-4">
        <BookOpen className="h-7 w-7 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground text-center leading-relaxed">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {visibleItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/40 transition-colors"
        >
          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug mb-1.5">
            {item.inputQuery
              ? item.inputQuery.length > 80
                ? item.inputQuery.slice(0, 80) + "…"
                : item.inputQuery
              : (item.preview ?? "").slice(0, 60) + (item.preview ? "…" : "")}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Personal history
            </span>
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              title={new Date(item.createdAt).toLocaleString()}
            >
              <Clock className="h-2.5 w-2.5 shrink-0" />
              {formatRelativeTime(item.createdAt)}
            </span>
            {item.citationCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {item.citationCount} source{item.citationCount !== 1 ? "s" : ""}
              </span>
            )}
            {isResearchVerifiedForDisplay(
              item.publicationState,
              item.verified,
              item.citationAudit?.safeForReliance,
            ) && (
              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Verified
              </span>
            )}
            {item.jurisdiction && (
              <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {item.jurisdiction}
              </span>
            )}
            {item.legalDomain && item.legalDomain !== "GENERAL" && (
              <span className="inline-flex items-center rounded bg-muted px-1 text-[10px] text-muted-foreground">
                {item.legalDomain.replace(/_/g, " ").toLowerCase()}
              </span>
            )}
          </div>
        </button>
      ))}

      {limit != null && items.length > limit && onToggleShowAll && (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="w-full px-4 py-2.5 text-xs text-primary font-medium hover:bg-muted/30 transition-colors text-left"
        >
          {showAll ? "Show less" : `View all ${items.length} results`}
        </button>
      )}
    </div>
  )
}
