"use client"

import { useEffect, useState } from "react"
import { FileText, FolderSearch, Loader2 } from "lucide-react"
import {
  getMatterResearchContext,
  type MatterResearchContextResponse,
} from "@/lib/api/ai"
import { Checkbox } from "@/components/ui/checkbox"
import {
  describeResearchContextSelection,
  toggleResearchContextId,
} from "@/lib/research/matter-context-selection"

interface MatterResearchContextProps {
  tenantId?: string
  matterId?: string
  selectedDocumentIds: string[]
  selectedSavedResearchIds: string[]
  onSelectedDocumentIdsChange: (ids: string[]) => void
  onSelectedSavedResearchIdsChange: (ids: string[]) => void
}

export function MatterResearchContext({
  tenantId,
  matterId,
  selectedDocumentIds,
  selectedSavedResearchIds,
  onSelectedDocumentIdsChange,
  onSelectedSavedResearchIdsChange,
}: MatterResearchContextProps) {
  const [context, setContext] = useState<MatterResearchContextResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onSelectedDocumentIdsChange([])
    onSelectedSavedResearchIdsChange([])
    setContext(null)
    setError(null)
    if (!tenantId || !matterId) return

    let active = true
    setLoading(true)
    void getMatterResearchContext(tenantId, matterId)
      .then((result) => {
        if (active) setContext(result)
      })
      .catch(() => {
        if (active) setError("Matter context is unavailable. No matter artifacts will be used.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [
    tenantId,
    matterId,
    onSelectedDocumentIdsChange,
    onSelectedSavedResearchIdsChange,
  ])

  if (!matterId) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading authorized matter context…
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        {error}
      </div>
    )
  }

  if (!context) return null

  return (
    <section className="space-y-3 rounded-xl border bg-muted/15 p-3" aria-labelledby="matter-research-context-title">
      <div className="flex items-start gap-2">
        <FolderSearch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 id="matter-research-context-title" className="text-sm font-semibold">
            Matter context: {context.matter.title}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Last updated {new Date(context.matter.updatedAt).toLocaleDateString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {context.matter.factsSummary || "No facts summary has been added."}
          </p>
        </div>
      </div>

      <p className="rounded-md bg-background px-2.5 py-2 text-xs font-medium">
        {describeResearchContextSelection(
          selectedDocumentIds.length,
          selectedSavedResearchIds.length,
        )}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold">Matter documents</legend>
          {context.documents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No accessible matter documents.</p>
          ) : context.documents.map((document) => {
            const checkboxId = `research-document-${document.id}`
            return (
              <label key={document.id} htmlFor={checkboxId} className="flex items-start gap-2 rounded-md border bg-background p-2 text-xs">
                <Checkbox
                  id={checkboxId}
                  checked={selectedDocumentIds.includes(document.id)}
                  disabled={!document.hasExtractedText}
                  onCheckedChange={(checked) =>
                    onSelectedDocumentIdsChange(
                      toggleResearchContextId(selectedDocumentIds, document.id, checked === true),
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-medium">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{document.fileName}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {document.hasExtractedText ? "Extracted text available" : "Text extraction unavailable"}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold">Prior filed research</legend>
          {context.savedResearch.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No research filed to this matter.</p>
          ) : context.savedResearch.map((item) => {
            const checkboxId = `research-saved-${item.id}`
            return (
              <label key={item.id} htmlFor={checkboxId} className="flex items-start gap-2 rounded-md border bg-background p-2 text-xs">
                <Checkbox
                  id={checkboxId}
                  checked={selectedSavedResearchIds.includes(item.id)}
                  onCheckedChange={(checked) =>
                    onSelectedSavedResearchIdsChange(
                      toggleResearchContextId(selectedSavedResearchIds, item.id, checked === true),
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{item.query}</span>
                </span>
              </label>
            )
          })}
        </fieldset>
      </div>
    </section>
  )
}
