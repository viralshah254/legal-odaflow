"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Loader2,
  Scale,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkspaceShell } from "@/components/shared/workspace-shell"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high" | "critical"
type ObligationStatus = "active" | "overdue" | "completed" | "waived"

interface ReviewObligation {
  id: string
  title: string
  party: string
  deadline?: string
  consequence?: string
  obligationType: string
  status: ObligationStatus
}

interface ReviewFinding {
  id: string
  category: "risk" | "obligation" | "term" | "redline"
  severity: RiskLevel
  title: string
  description: string
  originalText?: string
  suggestedText?: string
  status: "open" | "accepted" | "rejected"
}

interface DefinedTerm {
  term: string
  definition: string
}

interface ReviewWorkspaceData {
  id: string
  documentTitle: string
  documentType: string
  status: string
  riskSummary?: { overall: RiskLevel; clauseCount: Record<RiskLevel, number> }
  findings: ReviewFinding[]
  obligations: ReviewObligation[]
  definedTerms: DefinedTerm[]
}

// ── Risk badge ──────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    high: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
    critical: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  }
  return (
    <span className={cn("rounded px-2 py-0.5 text-xs font-medium capitalize", map[level])}>
      {level}
    </span>
  )
}

// ── Obligation status badge ─────────────────────────────────────────────────

function ObligationBadge({ status }: { status: ObligationStatus }) {
  const map: Record<ObligationStatus, { cls: string; icon: React.ReactNode }> = {
    active: { cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400", icon: <Clock className="h-3 w-3" /> },
    overdue: { cls: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400", icon: <AlertTriangle className="h-3 w-3" /> },
    completed: { cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
    waived: { cls: "bg-secondary text-secondary-foreground", icon: <XCircle className="h-3 w-3" /> },
  }
  const { cls, icon } = map[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium capitalize", cls)}>
      {icon}
      {status}
    </span>
  )
}

// ── Inline diff view ────────────────────────────────────────────────────────

function InlineDiff({ original, suggested }: { original: string; suggested: string }) {
  // Compute word-level diff
  const origWords = original.split(/\s+/)
  const suggWords = suggested.split(/\s+/)

  const removed = new Set(origWords.filter((w) => !suggWords.includes(w)))
  const added = new Set(suggWords.filter((w) => !origWords.includes(w)))

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
        <div className="rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm leading-relaxed">
          {origWords.map((word, i) => (
            <span
              key={i}
              className={
                removed.has(word)
                  ? "line-through text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded px-0.5 mx-0.5"
                  : "mx-0.5"
              }
            >
              {word}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Suggested</p>
        <div className="rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm leading-relaxed">
          {suggWords.map((word, i) => (
            <span
              key={i}
              className={
                added.has(word)
                  ? "underline text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 rounded px-0.5 mx-0.5"
                  : "mx-0.5"
              }
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Finding card ────────────────────────────────────────────────────────────

function FindingCard({
  finding,
  onAccept,
  onReject,
}: {
  finding: ReviewFinding
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden transition-opacity",
      finding.status !== "open" ? "opacity-60" : "",
    )}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted/30"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RiskBadge level={finding.severity} />
            <span className="text-sm font-medium">{finding.title}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{finding.description}</p>
          )}
        </div>
        {finding.status !== "open" && (
          <Badge variant="outline" className="text-xs shrink-0 capitalize">
            {finding.status}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
          <p className="text-sm mt-3">{finding.description}</p>

          {finding.originalText && finding.suggestedText && (
            <InlineDiff original={finding.originalText} suggested={finding.suggestedText} />
          )}

          {finding.status === "open" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700"
                onClick={() => onAccept(finding.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
                onClick={() => onReject(finding.id)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function ReviewWorkspace({
  workspaceId,
  tenantId,
}: {
  workspaceId: string
  tenantId: string
}) {
  const [findingStates, setFindingStates] = useState<Record<string, "open" | "accepted" | "rejected">>({})

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["review-workspace", workspaceId, tenantId],
    queryFn: () =>
      apiFetch<ReviewWorkspaceData>(
        `/platform/document-review/workspaces/${workspaceId}?tenantId=${tenantId}`,
      ),
  })

  const handleAccept = useCallback((findingId: string) => {
    setFindingStates((prev) => ({ ...prev, [findingId]: "accepted" }))
  }, [])

  const handleReject = useCallback((findingId: string) => {
    setFindingStates((prev) => ({ ...prev, [findingId]: "rejected" }))
  }, [])

  const findings = useMemo(
    () =>
      (workspace?.findings ?? []).map((f) => ({
        ...f,
        status: findingStates[f.id] ?? f.status,
      })),
    [workspace, findingStates],
  )

  const openCount = findings.filter((f) => f.status === "open").length
  const criticalCount = findings.filter((f) => f.severity === "critical" && f.status === "open").length
  const highCount = findings.filter((f) => f.severity === "high" && f.status === "open").length

  const riskLevel = workspace?.riskSummary?.overall

  const overdueObligations = workspace?.obligations.filter((o) => o.status === "overdue").length ?? 0

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <WorkspaceShell
      title={workspace?.documentTitle ?? "Document Review"}
      workflowStatus={workspace?.status}
      riskLevel={riskLevel}
      actions={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {criticalCount > 0 && (
            <span className="text-red-600 font-medium">{criticalCount} critical</span>
          )}
          {highCount > 0 && (
            <span className="text-orange-600 font-medium">{highCount} high</span>
          )}
          <span>{openCount} open</span>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue="findings">
          <TabsList className="mb-4">
            <TabsTrigger value="findings" className="gap-2">
              <Scale className="h-3.5 w-3.5" />
              Findings
              {openCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs">
                  {openCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="obligations" className="gap-2">
              <Clock className="h-3.5 w-3.5" />
              Obligations
              {overdueObligations > 0 && (
                <span className="ml-1 rounded-full bg-red-500/10 text-red-600 px-1.5 py-0.5 text-xs">
                  {overdueObligations}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-2">
              <Layers className="h-3.5 w-3.5" />
              Defined Terms
            </TabsTrigger>
            <TabsTrigger value="redline" className="gap-2">
              <FileText className="h-3.5 w-3.5" />
              Redline
            </TabsTrigger>
          </TabsList>

          {/* ── Findings tab ── */}
          <TabsContent value="findings" className="space-y-3">
            {findings.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No findings for this document.
              </div>
            ) : (
              <>
                {/* Risk summary */}
                {workspace?.riskSummary && (
                  <div className="rounded-lg border bg-card px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium">Risk Summary</span>
                      <RiskBadge level={workspace.riskSummary.overall} />
                      {(Object.entries(workspace.riskSummary.clauseCount) as [RiskLevel, number][])
                        .filter(([, count]) => count > 0)
                        .map(([level, count]) => (
                          <span key={level} className="text-xs text-muted-foreground">
                            {count} {level}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Findings list grouped by severity */}
                {(["critical", "high", "medium", "low"] as RiskLevel[]).map((severity) => {
                  const group = findings.filter((f) => f.severity === severity)
                  if (group.length === 0) return null
                  return (
                    <div key={severity}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 capitalize">
                        {severity} ({group.length})
                      </p>
                      <div className="space-y-2">
                        {group.map((finding) => (
                          <FindingCard
                            key={finding.id}
                            finding={finding}
                            onAccept={handleAccept}
                            onReject={handleReject}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </TabsContent>

          {/* ── Obligations tab ── */}
          <TabsContent value="obligations" className="space-y-3">
            {workspace?.obligations.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No obligations extracted.
              </div>
            ) : (
              (workspace?.obligations ?? []).map((obligation) => (
                <div key={obligation.id} className="rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-medium">{obligation.title}</p>
                        <ObligationBadge status={obligation.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Party: {obligation.party}</span>
                        <span className="capitalize">Type: {obligation.obligationType}</span>
                        {obligation.deadline && (
                          <span>Due: {new Date(obligation.deadline).toLocaleDateString()}</span>
                        )}
                      </div>
                      {obligation.consequence && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Consequence: {obligation.consequence}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ── Defined Terms tab ── */}
          <TabsContent value="terms" className="space-y-2">
            {workspace?.definedTerms.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No defined terms extracted.
              </div>
            ) : (
              <div className="divide-y rounded-lg border bg-card overflow-hidden">
                {(workspace?.definedTerms ?? []).map((dt, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-semibold">{dt.term}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dt.definition}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Redline tab ── */}
          <TabsContent value="redline" className="space-y-4">
            {findings.filter((f) => f.category === "redline" && f.originalText && f.suggestedText).length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                <FileText className="h-8 w-8 opacity-30 mx-auto" />
                <p>No redline suggestions.</p>
              </div>
            ) : (
              findings
                .filter((f) => f.category === "redline" && f.originalText && f.suggestedText)
                .map((finding) => (
                  <div key={finding.id} className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/20 border-b">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={finding.severity} />
                        <span className="text-sm font-medium">{finding.title}</span>
                      </div>
                      {finding.status === "open" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleAccept(finding.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleReject(finding.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {finding.status !== "open" && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {finding.status}
                        </Badge>
                      )}
                    </div>
                    <div className="p-4">
                      <InlineDiff
                        original={finding.originalText!}
                        suggested={finding.suggestedText!}
                      />
                    </div>
                  </div>
                ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceShell>
  )
}
