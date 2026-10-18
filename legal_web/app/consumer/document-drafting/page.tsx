"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { LegalFormsWorkspace } from "@/components/legal-forms/legal-forms-workspace"
import { CONSUMER_DOCUMENT_DRAFTING_HREF, toConsumerDraftUrl } from "@/lib/drafting/draft-navigation"
import { Library } from "lucide-react"
import { cn } from "@/lib/utils"

type IntentStep = "input" | "context_review" | "results"

export default function ConsumerDocumentDraftingPage() {
  const t = useTranslations("consumer")
  const [intentStep, setIntentStep] = useState<IntentStep>("input")
  const draftingFocused = intentStep !== "input"

  return (
    <div
      className={cn(
        "mx-auto px-3 sm:px-4 py-4 sm:py-6",
        draftingFocused ? "max-w-[1600px]" : "max-w-7xl",
      )}
    >
      {!draftingFocused && (
        <div className="mb-6 sm:mb-8" data-tour="consumer-drafting-intro">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <Library className="h-3.5 w-3.5" />
              {t("nav.docuDraft")}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("nav.docuDraft")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("docuDraftSubtitle")}
          </p>
        </div>
      )}
      <div data-tour="consumer-drafting-workspace">
        <LegalFormsWorkspace
          onIntentStepChange={setIntentStep}
          returnToHref={CONSUMER_DOCUMENT_DRAFTING_HREF}
          rewriteDraftUrl={toConsumerDraftUrl}
        />
      </div>
    </div>
  )
}
