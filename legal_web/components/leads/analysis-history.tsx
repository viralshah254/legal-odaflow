"use client"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CaseAnalysisRun } from "@/lib/api/marketplace"
import { formatDate } from "@/lib/utils"

const RUN_LABELS: Record<string, string> = {
  PREVIEW: "Intake preview",
  SIMILAR_CASES: "Similar cases",
  OPPONENT: "Opponent angles",
  STRATEGY: "Strategy memo",
  DOC_REFRESH: "Document refresh",
}

interface AnalysisHistoryProps {
  runs: CaseAnalysisRun[]
  selectedRunId?: string | null
  onSelectRun?: (run: CaseAnalysisRun) => void
}

export function AnalysisHistory({
  runs,
  selectedRunId,
  onSelectRun,
}: AnalysisHistoryProps) {
  const tCommon = useTranslations("common")
  if (!runs.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tCommon("analysis_history")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No analysis runs yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tCommon("analysis_history")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelectRun?.(run)}
            className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
              selectedRunId === run.id ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {RUN_LABELS[run.runType] ?? run.runType}
              </span>
              <Badge variant="outline" className="text-xs">
                {run.trigger}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(run.createdAt)}
            </p>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
