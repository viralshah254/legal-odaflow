"use client"

import { CheckCircle2, Scale } from "lucide-react"
import { useTranslations } from "next-intl"

export interface ProceduralDetermination {
  recommendedKind: string
  userSelectedKind: string
  kindOverridden: boolean
  maintainabilityNotes: string[]
  governingSections: Array<{ actId: string; section: string; label: string }>
}

export interface ResearchPhaseInfo {
  retrievalConfidence: "high" | "medium" | "low"
  usedDeepResearch: boolean
  authorityCount: number
}

export function ProceduralDeterminationCard({
  procedural,
  research,
  resolvedItems,
  currentKind,
  currentLabel,
}: {
  procedural?: ProceduralDetermination | null
  research?: ResearchPhaseInfo | null
  resolvedItems?: string[]
  currentKind?: string
  currentLabel?: string
}) {
  const t = useTranslations("drafting.accuracy")

  if (!procedural && !research && !resolvedItems?.length && !currentKind) return null

  const proceedingKind = procedural?.recommendedKind ?? currentKind
  const proceedingLabel = currentLabel ?? proceedingKind?.replace(/^india_/, "").replace(/_/g, " ")

  return (
    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2 text-xs">
      {proceedingKind && (
        <p className="text-emerald-800 dark:text-emerald-300 font-medium">
          Proceeding type: {proceedingLabel}
          {proceedingKind !== currentKind && currentKind ? (
            <span className="text-muted-foreground font-normal"> ({currentKind})</span>
          ) : null}
        </p>
      )}
      {procedural?.kindOverridden && (
        <div className="flex gap-2">
          <Scale className="h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              {t("proceduralRouteConfirmed")}
            </p>
            <p className="text-emerald-800 dark:text-emerald-300 mt-0.5">
              {t("proceduralRouteDetail", {
                recommended: procedural.recommendedKind,
                selected: procedural.userSelectedKind,
              })}
            </p>
          </div>
        </div>
      )}
      {resolvedItems && resolvedItems.length > 0 && (
        <ul className="space-y-1.5 text-emerald-800 dark:text-emerald-300">
          {resolvedItems.slice(0, 5).map((item, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="leading-snug break-words line-clamp-3">{item}</span>
            </li>
          ))}
        </ul>
      )}
      {procedural?.governingSections && procedural.governingSections.length > 0 && (
        <p className="text-muted-foreground">
          {t("governingSections")}: {procedural.governingSections.map((s) => s.label).join(" · ")}
        </p>
      )}
      {research && (
        <p className="text-muted-foreground">
          {t("researchAuthorities", {
            count: research.authorityCount,
            deep: research.usedDeepResearch ? t("deepSearchSuffix") : "",
            confidence: research.retrievalConfidence,
          })}
        </p>
      )}
    </div>
  )
}
