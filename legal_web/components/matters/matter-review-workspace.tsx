"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  createBulkDiligenceReview,
  listDiligenceJobs,
  type BulkDiligenceJob,
  type BulkReviewCitation,
} from "@/lib/api/series-a"
import type { ApiTenantDocument } from "@/lib/api/documents"
import { useRealtime } from "@/lib/contexts/realtime-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { REALTIME_EVENTS } from "@/lib/realtime/events"

type ReviewJob = BulkDiligenceJob & {
  progress?: number | null
  processedDocuments?: number | null
  processedCount?: number | null
  totalDocuments?: number | null
  error?: string | null
  errorMessage?: string | null
}

interface MatterReviewWorkspaceProps {
  tenantId: string
  matterId: string
  documents: ApiTenantDocument[]
  selectedDocumentIds: string[]
  onSelectedDocumentIdsChange: (ids: string[]) => void
  onOpenDocument: (documentId: string) => void
  documentsLoading?: boolean
}

function confidenceLabel(value?: number) {
  if (typeof value !== "number") return null
  const percent = Math.round((value <= 1 ? value : value / 100) * 100)
  return `${percent}% confidence`
}

function riskVariant(risk: string): "default" | "destructive" | "secondary" {
  const value = risk.toUpperCase()
  if (value.includes("HIGH") || value.includes("CRITICAL")) return "destructive"
  if (value.includes("MEDIUM")) return "default"
  return "secondary"
}

function CitationList({
  citations,
  onOpen,
}: {
  citations?: BulkReviewCitation[]
  onOpen: (documentId: string) => void
}) {
  if (!citations?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
      {citations.map((citation, index) => {
        const location = citation.chunk !== undefined
          ? `chunk ${citation.chunk + 1}`
          : citation.characterRange
            ? `chars ${citation.characterRange.start}–${citation.characterRange.end}`
            : null
        return (
          <Button
            key={`${citation.documentId}-${citation.chunk ?? index}-${index}`}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto max-w-full whitespace-normal px-2 py-1 text-left text-xs"
            onClick={() => onOpen(citation.documentId)}
            title={citation.note}
          >
            <span className="truncate">{citation.fileName ?? `File ${citation.documentId.slice(0, 8)}`}</span>
            {location && <span className="ml-1 text-muted-foreground">· {location}</span>}
          </Button>
        )
      })}
    </div>
  )
}

function FindingList<T>({
  title,
  description,
  items,
  render,
}: {
  title: string
  description: string
  items: T[]
  render: (item: T, index: number) => React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {items.length ? (
        <ul className="mt-3 space-y-3">{items.map((item, index) => <li key={index}>{render(item, index)}</li>)}</ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No {title.toLowerCase()} identified.</p>
      )}
    </section>
  )
}

function Synthesis({
  job,
  onOpenDocument,
}: {
  job: ReviewJob
  onOpenDocument: (documentId: string) => void
}) {
  const synthesis = job.matterSynthesis
  if (!synthesis) return null
  return (
    <div className="space-y-4 border-t bg-muted/10 p-4">
      <section className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">Cited matter synthesis</h4>
          {confidenceLabel(synthesis.confidence) && <Badge variant="secondary">{confidenceLabel(synthesis.confidence)}</Badge>}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{synthesis.executiveSummary}</p>
        <CitationList citations={synthesis.citations} onOpen={onOpenDocument} />
      </section>
      {job.coverageWarnings?.length ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4" role="status">
          <h4 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> Coverage warnings</h4>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {job.coverageWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <FindingList
          title="Chronology"
          description="Events grounded in the selected files"
          items={synthesis.chronology}
          render={(item) => (
            <>
              <p className="text-sm"><span className="font-medium">{item.date}</span> — {item.event}</p>
              {confidenceLabel(item.confidence) && <p className="mt-1 text-xs text-muted-foreground">{confidenceLabel(item.confidence)}</p>}
              <CitationList citations={item.citations} onOpen={onOpenDocument} />
            </>
          )}
        />
        <FindingList
          title="Missing items"
          description="Documents or information needed to complete the record"
          items={synthesis.missingItems}
          render={(item) => (
            <>
              <p className="text-sm font-medium">{item.item}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
              {confidenceLabel(item.confidence) && <p className="mt-1 text-xs text-muted-foreground">{confidenceLabel(item.confidence)}</p>}
              <CitationList citations={item.citations} onOpen={onOpenDocument} />
            </>
          )}
        />
        <FindingList
          title="Contradictions"
          description="Potential conflicts that require human review"
          items={synthesis.contradictions}
          render={(item) => (
            <>
              <p className="text-sm">{item.description}</p>
              {confidenceLabel(item.confidence) && <p className="mt-1 text-xs text-muted-foreground">{confidenceLabel(item.confidence)}</p>}
              <CitationList citations={item.citations} onOpen={onOpenDocument} />
            </>
          )}
        />
        <FindingList
          title="Recommended actions"
          description="Prioritized next steps for the matter team"
          items={synthesis.recommendedActions}
          render={(item) => (
            <>
              <div className="flex items-start gap-2">
                <Badge variant={item.priority === "HIGH" ? "destructive" : item.priority === "MEDIUM" ? "default" : "secondary"}>
                  {item.priority}
                </Badge>
                <p className="text-sm">{item.action}</p>
              </div>
              <CitationList citations={item.citations} onOpen={onOpenDocument} />
            </>
          )}
        />
      </div>
    </div>
  )
}

export function MatterReviewWorkspace({
  tenantId,
  matterId,
  documents,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onOpenDocument,
  documentsLoading,
}: MatterReviewWorkspaceProps) {
  const queryClient = useQueryClient()
  const { subscribe } = useRealtime()
  const { toast } = useToast()
  const [running, setRunning] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const { data: jobsData = [], isLoading, isError, refetch } = useApiData<BulkDiligenceJob[]>(
    ["diligence-jobs", tenantId, matterId],
    { apiFn: () => listDiligenceJobs(tenantId, matterId), enabled: !!tenantId && !!matterId },
  )
  const jobs = jobsData as ReviewJob[]
  const documentMap = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents])

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["diligence-jobs", tenantId, matterId] })
    const stopBulk = subscribe(REALTIME_EVENTS.BULK_REVIEW_PROGRESS, (payload) => {
      if (payload.data?.matterId === matterId) void refresh()
    })
    const stopAgent = subscribe(REALTIME_EVENTS.AGENT_JOB_UPDATED, (payload) => {
      if (!payload.data?.matterId || payload.data.matterId === matterId) void refresh()
    })
    return () => { stopBulk(); stopAgent() }
  }, [matterId, queryClient, subscribe, tenantId])

  const runReview = async (documentIds: string[], retryId?: string) => {
    if (!documentIds.length) {
      setError("Select at least one file in the Files view.")
      return
    }
    setError("")
    retryId ? setRetryingId(retryId) : setRunning(true)
    try {
      await createBulkDiligenceReview(tenantId, matterId, documentIds)
      if (!retryId) onSelectedDocumentIdsChange([])
      await queryClient.invalidateQueries({ queryKey: ["diligence-jobs", tenantId, matterId] })
      toast({ title: retryId ? "Review resumed" : "AI review started" })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The review could not be started."
      setError(message)
      toast({ title: "Could not start AI review", description: message, variant: "destructive" })
    } finally {
      setRunning(false)
      setRetryingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Start AI review</CardTitle>
          <CardDescription>Run a matter-wide review across the files selected in the Files view.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{selectedDocumentIds.length} file{selectedDocumentIds.length === 1 ? "" : "s"} selected</p>
              <p className="text-sm text-muted-foreground">
                {selectedDocumentIds.length ? selectedDocumentIds.map((id) => documentMap.get(id)?.fileName).filter(Boolean).slice(0, 3).join(", ") : "Return to Files to choose documents."}
                {selectedDocumentIds.length > 3 ? ` and ${selectedDocumentIds.length - 3} more` : ""}
              </p>
            </div>
            <Button disabled={running || documentsLoading || !selectedDocumentIds.length} onClick={() => void runReview(selectedDocumentIds)}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {running ? "Starting…" : "Run AI review"}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved AI reviews</CardTitle>
          <CardDescription>Open a review for cited synthesis, coverage, gaps, contradictions, and next actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading AI reviews">{[1, 2].map((item) => <Skeleton key={item} className="h-20" />)}</div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/30 p-6 text-center">
              <p className="text-sm text-destructive">Saved reviews could not be loaded.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
            </div>
          ) : !jobs.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No AI reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Select files, then run the first matter-wide review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => {
                const status = job.status.toUpperCase()
                const isRunning = ["QUEUED", "RUNNING", "PROCESSING"].includes(status)
                const isFailed = ["FAILED", "CANCELLED", "CANCELED"].includes(status)
                const isComplete = ["COMPLETED", "SUCCEEDED"].includes(status)
                const ids = Array.isArray(job.documentIds) ? job.documentIds : []
                const processed = job.processedDocuments ?? job.processedCount
                const total = job.totalDocuments ?? ids.length
                const progress = typeof job.progress === "number"
                  ? (job.progress <= 1 ? job.progress * 100 : job.progress)
                  : typeof processed === "number" && total ? (processed / total) * 100 : status === "QUEUED" ? 5 : 35
                const expanded = expandedJobId === job.id
                return (
                  <article key={job.id} className="overflow-hidden rounded-lg border">
                    <div className="p-4 transition-colors hover:bg-muted/30">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setExpandedJobId(expanded ? null : job.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                          <Badge variant={isFailed ? "destructive" : isComplete ? "default" : "secondary"}>
                            {isRunning && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            {isComplete ? "Ready" : status.charAt(0) + status.slice(1).toLowerCase()}
                          </Badge>
                          {isComplete && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          <span className="truncate text-sm text-muted-foreground">{format(new Date(job.createdAt), "MMM d, yyyy HH:mm")} · {ids.length} files</span>
                        </button>
                        {isFailed && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!ids.length || retryingId === job.id}
                            onClick={() => void runReview(ids, job.id)}
                          >
                            {retryingId === job.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Resume review
                          </Button>
                        )}
                      </div>
                      {isRunning && (
                        <div className="mt-3 pl-6">
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>{status === "QUEUED" ? "Waiting to start" : "Reviewing selected files"}</span>
                            <span>{typeof processed === "number" ? `${processed} of ${total}` : `${Math.round(progress)}%`}</span>
                          </div>
                          <Progress value={progress} aria-label={`Review ${Math.round(progress)} percent complete`} />
                        </div>
                      )}
                      {job.completedAt && <p className="mt-2 pl-6 text-xs text-muted-foreground">Completed {formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}</p>}
                      {isFailed && (job.errorMessage || job.error) && <p className="mt-2 pl-6 text-sm text-destructive">{job.errorMessage ?? job.error}</p>}
                    </div>

                    {expanded && <Synthesis job={job} onOpenDocument={onOpenDocument} />}
                    {expanded && job.summaryMatrix?.length ? (
                      <div className="overflow-x-auto border-t">
                        <Table>
                          <TableHeader><TableRow><TableHead className="w-8" /><TableHead>File</TableHead><TableHead>Summary</TableHead><TableHead>Risk and coverage</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {job.summaryMatrix.map((row) => {
                              const rowId = `${job.id}-${row.documentId}`
                              const rowExpanded = expandedDocumentId === rowId
                              return (
                                <Fragment key={rowId}>
                                  <TableRow className="cursor-pointer" onClick={() => setExpandedDocumentId(rowExpanded ? null : rowId)}>
                                    <TableCell>{rowExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                                    <TableCell className="max-w-[180px] truncate font-medium">{row.fileName ?? documentMap.get(row.documentId)?.fileName ?? row.documentId.slice(0, 8)}</TableCell>
                                    <TableCell className="max-w-md text-sm text-muted-foreground">{row.summary.slice(0, 160)}{row.summary.length > 160 ? "…" : ""}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {row.risks.slice(0, 2).map((risk) => <Badge key={risk} variant={riskVariant(risk)}>{risk}</Badge>)}
                                        {row.status && <Badge variant="outline">{row.status.replace("_", " ")}</Badge>}
                                        {confidenceLabel(row.confidence) && <Badge variant="secondary">{confidenceLabel(row.confidence)}</Badge>}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {rowExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="bg-muted/20 p-5">
                                        <p className="whitespace-pre-wrap text-sm">{row.summary}</p>
                                        {row.coverage && (
                                          <div className="mt-3 text-xs text-muted-foreground">
                                            Analyzed {row.coverage.charactersAnalyzed.toLocaleString()} of {row.coverage.charactersAvailable.toLocaleString()} characters
                                            {row.coverage.warnings.map((warning) => <p key={warning} className="mt-1 text-amber-700">• {warning}</p>)}
                                          </div>
                                        )}
                                        <CitationList citations={row.citations} onOpen={onOpenDocument} />
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Fragment>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : expanded && !job.matterSynthesis ? (
                      <div className="border-t p-6 text-center text-sm text-muted-foreground">
                        {isRunning ? "Findings will appear as the review completes." : "No saved findings are available for this review."}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
