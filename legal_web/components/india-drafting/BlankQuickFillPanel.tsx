"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { fillIndiaDraftBlanks } from "@/lib/api/india-drafting"
import { extractBlankLabelsFromDraft } from "@/lib/drafting/draft-text-formatter"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"

interface BlankQuickFillPanelProps {
  draft: string
  blanks: string[]
  onBlanksChange: (blanks: string[]) => void
  caseDetails: string
  kind: string
  tenantId?: string
}

export function BlankQuickFillPanel({
  draft,
  blanks,
  onBlanksChange,
  caseDetails,
  kind,
  tenantId,
}: BlankQuickFillPanelProps) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labels = useMemo(() => extractBlankLabelsFromDraft(draft), [draft])
  const emptyLabels = labels.filter((label, i) => !(blanks[i]?.trim()))

  const handleAutoFill = async () => {
    if (emptyLabels.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const context: Record<string, string> = { caseDetails }
      labels.forEach((label, i) => {
        const value = blanks[i]?.trim()
        if (value) context[label] = value
      })

      const res = await fillIndiaDraftBlanks(
        {
          documentKind: kind,
          context,
          emptyFields: emptyLabels,
        },
        tenantId,
      )

      const next = [...blanks]
      labels.forEach((label, i) => {
        if (!next[i]?.trim() && res.suggestions[label]) {
          next[i] = res.suggestions[label]
        }
      })
      onBlanksChange(next)
      if (res.creditsUsed > 0) {
        invalidateCreditWalletQueries(queryClient, tenantId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-fill failed")
    } finally {
      setLoading(false)
    }
  }

  if (labels.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Quick fill blanks</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {emptyLabels.length} empty field{emptyLabels.length === 1 ? "" : "s"} remaining
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutoFill}
          disabled={loading || emptyLabels.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Filling…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Auto-fill
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
