"use client"

import { useMemo } from "react"
import { StagedAnalysisProgress } from "@/components/issue-checker/intake-analysis-progress"
import {
  buildDeepAnalysisStages,
  getDeepAnalysisProgressTitle,
  type DeepAnalysisKind,
} from "@/lib/leads/deep-analysis-progress-stages"

interface DeepAnalysisProgressProps {
  active: boolean
  kind: DeepAnalysisKind | null
  countryCode: string
  jurisdiction?: string | null
  hasDocuments?: boolean
  className?: string
}

export function DeepAnalysisProgress({
  active,
  kind,
  countryCode,
  jurisdiction,
  hasDocuments = false,
  className,
}: DeepAnalysisProgressProps) {
  const stages = useMemo(() => {
    if (!kind) return []
    return buildDeepAnalysisStages(kind, { countryCode, jurisdiction, hasDocuments })
  }, [kind, countryCode, jurisdiction, hasDocuments])

  const title = useMemo(() => {
    if (!kind) return undefined
    return getDeepAnalysisProgressTitle(kind, { countryCode, jurisdiction, hasDocuments })
  }, [kind, countryCode, jurisdiction, hasDocuments])

  if (!active || !kind || stages.length === 0) return null

  return (
    <StagedAnalysisProgress
      active={active}
      stages={stages}
      title={title}
      className={className}
    />
  )
}
