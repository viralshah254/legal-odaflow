"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, History } from "lucide-react"
import { getDraftHistory, type DraftHistoryItem } from "@/lib/api/draft-history"
import { SavedDraftList } from "@/components/drafting/saved-draft-list"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DraftHistorySidebarProps {
  tenantId?: string
  countryCode?: string
  onSelect: (item: DraftHistoryItem) => void
  selectedId?: string
  refreshKey?: number
  className?: string
  mobileTriggerLabel?: string
  /** Allow collapsing the desktop panel to reclaim horizontal space */
  collapsible?: boolean
}

const PREVIEW_LIMIT = 5
const MINIMIZED_STORAGE_KEY = "saved-drafts-panel-minimized"

function readMinimizedPreference(): boolean {
  try {
    return localStorage.getItem(MINIMIZED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function DraftHistorySidebar({
  tenantId,
  countryCode,
  onSelect,
  selectedId,
  refreshKey = 0,
  className,
  mobileTriggerLabel = "Draft history",
  collapsible = true,
}: DraftHistorySidebarProps) {
  const [items, setItems] = useState<DraftHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (collapsible) setMinimized(readMinimizedPreference())
  }, [collapsible])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setItems(await getDraftHistory(tenantId, { countryCode, limit: 30 }))
    } catch {
      // non-blocking
    } finally {
      setLoading(false)
    }
  }, [tenantId, countryCode])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const handleSelect = (item: DraftHistoryItem) => {
    onSelect(item)
    setSheetOpen(false)
  }

  const toggleMinimized = () => {
    setMinimized((prev) => {
      const next = !prev
      try {
        localStorage.setItem(MINIMIZED_STORAGE_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      return next
    })
  }

  const list = (
    <SavedDraftList
      items={items}
      loading={loading}
      onSelect={handleSelect}
      selectedId={selectedId}
      limit={PREVIEW_LIMIT}
      showAll={showAll}
      onToggleShowAll={() => setShowAll((v) => !v)}
    />
  )

  return (
    <>
      {collapsible && minimized ? (
        <button
          type="button"
          onClick={toggleMinimized}
          className={cn(
            "hidden xl:flex flex-col items-center gap-2 w-11 shrink-0 sticky top-4 self-start",
            "rounded-xl border bg-card px-2 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors",
            className,
          )}
          aria-label="Expand saved drafts"
          title="Saved Drafts"
        >
          <History className="h-4 w-4" />
          <ChevronLeft className="h-3.5 w-3.5" />
          {items.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {items.length}
            </span>
          )}
        </button>
      ) : (
        <aside
          className={cn(
            "hidden xl:flex w-[260px] shrink-0 sticky top-4 self-start max-h-[calc(100dvh-5rem)] flex-col",
            className,
          )}
        >
          <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0 max-h-[min(32rem,calc(100dvh-14rem))]">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <History className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold truncate">Saved Drafts</span>
                {items.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-medium">
                    {items.length}
                  </span>
                )}
              </div>
              {collapsible && (
                <button
                  type="button"
                  onClick={toggleMinimized}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Minimize saved drafts"
                  title="Minimize"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="overflow-y-auto min-h-0 flex-1">{list}</div>
          </div>
        </aside>
      )}

      <div className="xl:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <History className="h-4 w-4" />
              {mobileTriggerLabel}
              {items.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{items.length}</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100vw,320px)]">
            <SheetHeader>
              <SheetTitle>Saved Drafts</SheetTitle>
              <SheetDescription>Tap a draft to reopen it — no extra credits.</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto flex-1 mt-4 -mx-2">{list}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
