"use client"

import { useState } from "react"
import { LegalFormsWorkspace } from "@/components/legal-forms/legal-forms-workspace"
import { DraftHistorySidebar } from "@/components/drafting/draft-history-sidebar"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useRouter } from "next/navigation"
import { buildSavedDraftHref } from "@/lib/drafting/draft-navigation"
import { Library } from "lucide-react"
import { getDraftById, type DraftHistoryItem } from "@/lib/api/draft-history"
import { cn } from "@/lib/utils"

type IntentStep = "input" | "context_review" | "results"

export default function LegalFormsPage() {
  const { activeTenantId } = useTenant()
  const router = useRouter()
  const [intentStep, setIntentStep] = useState<IntentStep>("input")
  const draftingFocused = intentStep !== "input"

  const handleHistorySelect = (item: DraftHistoryItem) => {
    if (!activeTenantId) return
    void getDraftById(item.id, activeTenantId).then((record) => {
      router.push(buildSavedDraftHref(record))
    })
  }

  return (
    <div
      className={cn(
        "mx-auto px-3 sm:px-4 py-4 sm:py-6",
        draftingFocused ? "max-w-[1600px]" : "max-w-7xl",
      )}
    >
      <div className="flex flex-col xl:flex-row xl:gap-6 xl:items-start">
        <div className="flex-1 min-w-0">
          {!draftingFocused && (
            <div className="mb-6 sm:mb-8" data-tour="legal-forms-intro">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Library className="h-3.5 w-3.5" />
                  Reference catalog
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Official Legal Forms
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Browse 10,800+ USCIS, IRS, state &amp; county court, federal district, UK, Kenya, and India filing forms. Draft any form on demand with AI.
              </p>
            </div>
          )}
          <div data-tour="legal-forms-workspace">
            <LegalFormsWorkspace onIntentStepChange={setIntentStep} />
          </div>
        </div>
        {!draftingFocused && (
          <DraftHistorySidebar
            tenantId={activeTenantId ?? undefined}
            onSelect={handleHistorySelect}
            collapsible
          />
        )}
      </div>
      {draftingFocused && (
        <div className="mt-4 xl:hidden">
          <DraftHistorySidebar
            tenantId={activeTenantId ?? undefined}
            onSelect={handleHistorySelect}
            mobileTriggerLabel="Saved drafts"
          />
        </div>
      )}
    </div>
  )
}
