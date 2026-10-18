"use client"

import { AlertTriangle, ArrowRight, Brain, ListChecks, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  MatterProfile,
  MatterTaskGraph,
  RecommendationMode,
} from "@/lib/matter-intelligence"
import { cn } from "@/lib/utils"

export interface MatterIntelligencePanelProps {
  matterProfile?: MatterProfile
  taskGraph?: MatterTaskGraph
  recommendedActions?: string[]
  issues?: string[]
  recommendationMode?: RecommendationMode
  nextBestAction?: string
  onLowConfidenceAction?: () => void
  outcomeHint?: string
  className?: string
}

function humanizeSlug(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"

  return (
    <div className="flex items-center gap-2" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Confidence ${pct} percent`}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

export function MatterIntelligencePanel({
  matterProfile,
  taskGraph,
  recommendedActions,
  issues,
  recommendationMode,
  nextBestAction,
  onLowConfidenceAction,
  outcomeHint,
  className,
}: MatterIntelligencePanelProps) {
  const t = useTranslations("matterIntelligence")

  if (!matterProfile) return null

  const actions =
    recommendedActions?.length
      ? recommendedActions
      : taskGraph?.recommendedActions ?? []
  const issueList = issues?.length ? issues : matterProfile.issues ?? []
  const bestAction = nextBestAction ?? taskGraph?.nextBestAction
  const showLowConfidenceCta = recommendationMode === "low_confidence"

  const chips = [
    matterProfile.practiceArea && {
      key: "practiceArea",
      label: humanizeSlug(matterProfile.practiceArea),
    },
    matterProfile.subPracticeArea && {
      key: "subPracticeArea",
      label: humanizeSlug(matterProfile.subPracticeArea),
    },
    matterProfile.nature && matterProfile.nature !== "unknown" && {
      key: "nature",
      label: humanizeSlug(matterProfile.nature),
    },
    matterProfile.forum && {
      key: "forum",
      label: humanizeSlug(matterProfile.forum),
    },
  ].filter(Boolean) as Array<{ key: string; label: string }>

  return (
    <Card variant="flat" className={cn("overflow-hidden", className)} role="region" aria-labelledby="mi-panel-title">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle id="mi-panel-title" className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary shrink-0" />
              {t("title")}
            </CardTitle>
            <CardDescription className="text-xs">{t("subtitle")}</CardDescription>
          </div>
          {recommendationMode === "low_confidence" && (
            <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-400">
              {t("lowConfidenceBadge")}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip.key} variant="secondary" className="text-[11px] font-normal">
                {chip.label}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("confidence")}
          </p>
          <ConfidenceBar confidence={matterProfile.confidence} />
        </div>

        {outcomeHint && (
          <p className="text-xs text-muted-foreground leading-snug border-l-2 border-primary/40 pl-3">
            {outcomeHint}
          </p>
        )}

        {bestAction && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
              {t("nextBestAction")}
            </p>
            <p className="text-sm font-medium leading-snug">{bestAction}</p>
          </div>
        )}

        {actions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {t("recommendedActions")}
            </p>
            <ul className="space-y-1.5">
              {actions.map((action, index) => (
                <li
                  key={`${action}-${index}`}
                  className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm leading-snug"
                >
                  <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {issueList.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="h-3 w-3" />
              {t("issues")}
            </p>
            <ul className="space-y-1">
              {issueList.map((issue, index) => (
                <li
                  key={`${issue}-${index}`}
                  className="text-sm text-muted-foreground leading-snug pl-3 border-l-2 border-border"
                >
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showLowConfidenceCta && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/20 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
                {t("lowConfidenceBanner")}
              </p>
            </div>
            {onLowConfidenceAction && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={onLowConfidenceAction}
              >
                {t("refineDescription")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
