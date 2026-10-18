"use client"

import { useTranslations } from "next-intl"
import { AlertTriangle } from "lucide-react"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"

interface DraftStrippedCitationsBannerProps {
  verification: DraftVerificationAudit
}

export function DraftStrippedCitationsBanner({ verification }: DraftStrippedCitationsBannerProps) {
  const t = useTranslations("drafting.accuracy")
  if (verification.strippedCitations.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {t("strippedCitations", { count: verification.strippedCitations.length })}
      </p>
      <ul className="mt-1 list-disc list-inside text-amber-800/90 dark:text-amber-300/90">
        {verification.strippedCitations.slice(0, 3).map((s, i) => (
          <li key={i}>{s.original}</li>
        ))}
      </ul>
    </div>
  )
}
