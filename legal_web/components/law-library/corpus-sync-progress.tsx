"use client"

import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { IngestActStatus } from "@/lib/api/law-library"

export interface CorpusSyncProgressState {
  jobId: string
  countryCode: string
  status: string
  startedAt: number
  baselineIndexed: number
}

interface CorpusSyncProgressProps {
  progress: CorpusSyncProgressState
  indexedCount: number
  acts: IngestActStatus[]
  registryByActId: Map<string, string>
  onDismiss: () => void
}

function statusLabel(status: string): string {
  switch (status) {
    case "QUEUED":
      return "Queued"
    case "RUNNING":
      return "Indexing statutes"
    case "COMPLETED":
      return "Complete"
    case "FAILED":
      return "Failed"
    default:
      return status
  }
}

function computeProgressPct(
  status: string,
  startedAt: number,
  acts: IngestActStatus[],
): number {
  if (status === "COMPLETED") return 100
  if (status === "FAILED") return 100
  if (status === "QUEUED") return 8

  const actsUpdatedThisRun = acts.filter(
    (a) => a.lastIngestAt && new Date(a.lastIngestAt).getTime() >= startedAt,
  ).length

  return Math.min(92, 12 + actsUpdatedThisRun * 8)
}

export function CorpusSyncProgressBanner({
  progress,
  indexedCount,
  acts,
  registryByActId,
  onDismiss,
}: CorpusSyncProgressProps) {
  const isActive = progress.status === "QUEUED" || progress.status === "RUNNING"
  const sectionsAdded = Math.max(0, indexedCount - progress.baselineIndexed)
  const actsUpdatedThisRun = acts.filter(
    (a) => a.lastIngestAt && new Date(a.lastIngestAt).getTime() >= progress.startedAt,
  ).length
  const latestAct = acts
    .filter((a) => a.lastIngestAt && new Date(a.lastIngestAt).getTime() >= progress.startedAt)
    .sort(
      (a, b) =>
        new Date(b.lastIngestAt ?? 0).getTime() - new Date(a.lastIngestAt ?? 0).getTime(),
    )[0]
  const latestActLabel = latestAct
    ? registryByActId.get(latestAct.actId) ?? latestAct.actId
    : null
  const progressPct = computeProgressPct(progress.status, progress.startedAt, acts)

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 space-y-2",
        progress.status === "FAILED"
          ? "border-destructive/40 bg-destructive/5"
          : progress.status === "COMPLETED"
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {isActive && <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5 text-primary" />}
          {progress.status === "COMPLETED" && (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          )}
          {progress.status === "FAILED" && (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Corpus sync {statusLabel(progress.status).toLowerCase()} — {progress.countryCode}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isActive
                ? "Priority statutes are being indexed from source PDFs. This may take several minutes."
                : progress.status === "COMPLETED"
                  ? "Indexing finished. Browse acts below for section text."
                  : "The sync job did not complete successfully."}
            </p>
          </div>
        </div>
        {!isActive && (
          <Button type="button" variant="ghost" size="sm" className="shrink-0 h-7 text-xs" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>

      <Progress value={progressPct} className="h-1.5" />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{indexedCount.toLocaleString()}</span> sections indexed
          {sectionsAdded > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400"> (+{sectionsAdded.toLocaleString()})</span>
          )}
        </span>
        {isActive && actsUpdatedThisRun > 0 && (
          <span>
            <span className="font-medium text-foreground">{actsUpdatedThisRun}</span> acts updated this run
          </span>
        )}
        {isActive && latestActLabel && (
          <span className="truncate max-w-full">
            Latest: <span className="font-medium text-foreground">{latestActLabel}</span>
          </span>
        )}
      </div>
    </div>
  )
}
