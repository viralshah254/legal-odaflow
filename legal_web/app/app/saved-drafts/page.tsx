"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, History, Loader2 } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getDraftById, getDraftHistory, type DraftHistoryItem } from "@/lib/api/draft-history"
import { SavedDraftList } from "@/components/drafting/saved-draft-list"
import { buildSavedDraftHref, resolveDraftBackHref } from "@/lib/drafting/draft-navigation"
import { Button } from "@/components/ui/button"

function SavedDraftsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const [items, setItems] = useState<DraftHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const backHref = resolveDraftBackHref(searchParams, "/app/legal-forms")

  const load = useCallback(async () => {
    if (!activeTenantId) return
    setLoading(true)
    try {
      setItems(await getDraftHistory(activeTenantId, { limit: 50 }))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSelect = (item: DraftHistoryItem) => {
    if (!activeTenantId) return
    void getDraftById(item.id, activeTenantId).then((record) => {
      router.push(buildSavedDraftHref(record))
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <History className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Saved Drafts</h1>
          {items.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {items.length}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Reopen a previous draft — no extra credits to view or continue editing.
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden" data-tour="saved-drafts-list">
        <SavedDraftList
          items={items}
          loading={loading}
          onSelect={handleSelect}
          showAll
          emptyMessage="No saved drafts yet. Generate a draft from Document Drafting and it will appear here."
        />
      </div>
    </div>
  )
}

export default function SavedDraftsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SavedDraftsContent />
    </Suspense>
  )
}
