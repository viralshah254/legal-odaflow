"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Check, FileSearch, FileText, Lightbulb, Loader2, Scale, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface IntakeProgressStage {
  id: string
  label: string
  icon: LucideIcon
  durationMs: number
  rotatingLabels?: string[]
}

const ROTATING_LABEL_INTERVAL_MS = 2000

interface StagedAnalysisProgressProps {
  active: boolean
  stages: IntakeProgressStage[]
  className?: string
  title?: string
}

export function StagedAnalysisProgress({
  active,
  stages,
  className,
  title,
}: StagedAnalysisProgressProps) {
  const [stageIndex, setStageIndex] = useState(0)
  const [rotatingIndex, setRotatingIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setStageIndex(0)
      setRotatingIndex(0)
      return
    }

    setStageIndex(0)
    setRotatingIndex(0)
    let index = 0
    let timeoutId: ReturnType<typeof setTimeout>

    const scheduleNext = () => {
      const stage = stages[index]
      const delay = stage?.durationMs ?? 0
      if (delay <= 0 || index >= stages.length - 1) return

      timeoutId = setTimeout(() => {
        index = Math.min(index + 1, stages.length - 1)
        setStageIndex(index)
        setRotatingIndex(0)
        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [active, stages])

  const currentStage = stages[stageIndex]
  const rotatingLabels = currentStage?.rotatingLabels

  useEffect(() => {
    if (!active || !rotatingLabels?.length || rotatingLabels.length <= 1) {
      setRotatingIndex(0)
      return
    }

    const intervalId = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % rotatingLabels.length)
    }, ROTATING_LABEL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [active, stageIndex, rotatingLabels])

  if (!active) return null

  const progressPercent =
    stages.length <= 1 ? 100 : Math.round(((stageIndex + 1) / stages.length) * 100)

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ul className="space-y-2.5">
        {stages.map((stage, index) => {
          const Icon = stage.icon
          const isDone = index < stageIndex
          const isCurrent = index === stageIndex
          const displayLabel =
            isCurrent && stage.rotatingLabels?.length
              ? stage.rotatingLabels[rotatingIndex % stage.rotatingLabels.length]
              : stage.label

          return (
            <li
              key={stage.id}
              className={cn(
                "flex items-center gap-3 text-sm transition-opacity",
                isDone && "text-muted-foreground",
                isCurrent && "text-foreground font-medium",
                !isDone && !isCurrent && "text-muted-foreground/50",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  isDone && "border-primary/30 bg-primary/10 text-primary",
                  isCurrent && "border-primary bg-primary/15 text-primary",
                  !isDone && !isCurrent && "border-muted bg-muted/30",
                )}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Icon className="h-3.5 w-3.5 opacity-60" aria-hidden />
                )}
              </span>
              <span className={cn(isCurrent && stage.rotatingLabels?.length && "transition-opacity duration-300")}>
                {displayLabel}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface IntakeAnalysisProgressProps {
  active: boolean
  hasDocuments?: boolean
  variant?: "preview" | "fullReport"
  className?: string
}

export function IntakeAnalysisProgress({
  active,
  hasDocuments = false,
  variant = "preview",
  className,
}: IntakeAnalysisProgressProps) {
  const t = useTranslations("issueChecker")

  const stages = useMemo<IntakeProgressStage[]>(() => {
    const base =
      variant === "fullReport"
        ? [
            { id: "case", label: t("progressReviewCaseFile"), icon: FileSearch, durationMs: 2000 },
            { id: "sections", label: t("progressBuildSections"), icon: FileText, durationMs: 4000 },
            { id: "authorities", label: t("progressResearchLaw"), icon: Scale, durationMs: 3500 },
            { id: "analysis", label: t("progressAnalyzeRisks"), icon: Lightbulb, durationMs: 3000 },
            { id: "finalize", label: t("progressFinalizeReport"), icon: Sparkles, durationMs: 0 },
          ]
        : [
            { id: "case", label: t("progressReviewCase"), icon: FileSearch, durationMs: 2500 },
            { id: "documents", label: t("progressAnalyzeDocuments"), icon: FileText, durationMs: 3500 },
            { id: "authorities", label: t("progressSearchAuthorities"), icon: Scale, durationMs: 2800 },
            { id: "strategy", label: t("progressPlanStrategy"), icon: Lightbulb, durationMs: 2200 },
            { id: "draft", label: t("progressDraftAnalysis"), icon: Sparkles, durationMs: 0 },
          ]

    return hasDocuments ? base : base.filter((s) => s.id !== "documents")
  }, [hasDocuments, variant, t])

  return <StagedAnalysisProgress active={active} stages={stages} className={className} />
}
