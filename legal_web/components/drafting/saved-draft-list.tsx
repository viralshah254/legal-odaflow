"use client"

import { CheckCircle2, Clock, Loader2, AlertTriangle } from "lucide-react"
import type { DraftHistoryItem } from "@/lib/api/draft-history"
import { cn } from "@/lib/utils"

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

export function SavedDraftList({
  items,
  loading,
  onSelect,
  selectedId,
  limit,
  showAll,
  onToggleShowAll,
  emptyMessage = "Your generated drafts will appear here.",
}: {
  items: DraftHistoryItem[]
  loading: boolean
  onSelect: (item: DraftHistoryItem) => void
  selectedId?: string
  limit?: number
  showAll?: boolean
  onToggleShowAll?: () => void
  emptyMessage?: string
}) {
  const visibleItems = limit != null && !showAll ? items.slice(0, limit) : items

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-muted-foreground px-4">{emptyMessage}</p>
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
          className={cn(
            "w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/40 transition-colors",
            selectedId === item.id && "bg-muted/40",
          )}
        >
          <p className="text-xs font-medium text-foreground line-clamp-3 leading-snug mb-1.5 break-words">
            {item.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex rounded px-1 py-0.5 text-[10px] font-semibold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
              {item.countryCode}
            </span>
            {item.category && (
              <span className="text-[10px] text-muted-foreground">{item.category}</span>
            )}
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              title={new Date(item.createdAt).toLocaleString()}
            >
              <Clock className="h-2.5 w-2.5 shrink-0" />
              {formatRelativeTime(item.createdAt)}
            </span>
            {item.creditsUsed > 0 && (
              <span className="text-[10px] text-muted-foreground">{item.creditsUsed} cr</span>
            )}
            {item.verificationStatus === "verified" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-label="Verified" />
            ) : item.requiresLawyerReview ? (
              <AlertTriangle className="h-3 w-3 text-amber-500" aria-label="Review needed" />
            ) : null}
          </div>
        </button>
      ))}
      {limit != null && items.length > limit && onToggleShowAll && (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="w-full px-4 py-2.5 text-xs font-medium text-primary hover:bg-muted/20"
        >
          {showAll ? "Show less" : `Show all ${items.length} drafts`}
        </button>
      )}
    </div>
  )
}
