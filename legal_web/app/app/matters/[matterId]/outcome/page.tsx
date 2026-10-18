"use client"
import { useTranslations } from "next-intl"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import {
  generateOutcomeAnalysis,
  listOutcomeAnalyses,
  patchOutcomeAnalysis,
  getOutcomeBenchmarks,
  type OutcomeAnalysis,
  type OutcomeBenchmark,
} from "@/lib/api/matter-outcome"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Globe, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

function ProbabilityBar({ label, value, color }: { label: string; value?: number | null; color: string }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground font-mono">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function OutcomePage() {
  const t = useTranslations("matters")
  const tErr = useTranslations("errors")
  const tCommon = useTranslations("common")
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [generating, setGenerating] = useState(false)
  const [publishConfirm, setPublishConfirm] = useState<{ id: string; current: boolean } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-outcome-matter", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: analyses = [], isLoading: analysesLoading, error } = useApiData<OutcomeAnalysis[]>(
    ["outcome-analyses", activeTenantId, matterId],
    {
      apiFn: () => listOutcomeAnalyses(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: benchmarks } = useApiData<OutcomeBenchmark>(
    ["outcome-benchmarks", activeTenantId, matterId, matter?.practiceArea, matter?.jurisdiction],
    {
      apiFn: () => getOutcomeBenchmarks(activeTenantId!, matterId, {
        practiceArea: matter?.practiceArea ?? undefined,
        countryCode: matter?.jurisdiction ?? undefined,
      }),
      enabled: !!activeTenantId && !!matterId && !!matter,
    },
  )

  const handleGenerate = useCallback(async () => {
    if (!activeTenantId) return
    setGenerating(true)
    try {
      const analysis = await generateOutcomeAnalysis(activeTenantId, matterId)
      queryClient.invalidateQueries({ queryKey: ["outcome-analyses", activeTenantId, matterId] })
      setExpandedId(analysis.id)
      toast({ title: tErr("toast.outcomeAnalysisGenerated") })
    } catch {
      toast({ title: tErr("toast.failedToGenerateAnalysis"), variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }, [activeTenantId, matterId, queryClient, toast])

  const handlePublishToggle = async () => {
    if (!activeTenantId || !publishConfirm) return
    setPublishing(true)
    try {
      await patchOutcomeAnalysis(activeTenantId, matterId, publishConfirm.id, {
        portalPublished: !publishConfirm.current,
      })
      queryClient.invalidateQueries({ queryKey: ["outcome-analyses", activeTenantId, matterId] })
      toast({ title: publishConfirm.current ? tErr("toast.unpublishedFromPortal") : tErr("toast.publishedToClientPortal") })
    } catch {
      toast({ title: tErr("toast.failedToUpdate"), variant: "destructive" })
    } finally {
      setPublishing(false)
      setPublishConfirm(null)
    }
  }

  if (matterLoading || !matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId!} showIntelligenceSidebar={false}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t("outcome_analytics")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered outcome prediction based on matter facts and firm benchmarks.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("analyzing")}</>
            ) : (
              <><Sparkles className="h-4 w-4" />{t("generateAnalysis")}</>
            )}
          </Button>
        </div>

        {/* Firm benchmarks */}
        {benchmarks && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Firm benchmarks — {benchmarks.practiceArea ?? matter.practiceArea ?? "General"}
              </CardTitle>
              {benchmarks.sampleSize && (
                <CardDescription>Based on {benchmarks.sampleSize} similar matters</CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              {benchmarks.avgWinRate !== null && benchmarks.avgWinRate !== undefined && (
                <div>
                  <p className="text-2xl font-bold text-green-600">{Math.round(benchmarks.avgWinRate * 100)}%</p>
                  <p className="text-xs text-muted-foreground">{t("avg_win_rate")}</p>
                </div>
              )}
              {benchmarks.avgSettlementRate !== null && benchmarks.avgSettlementRate !== undefined && (
                <div>
                  <p className="text-2xl font-bold text-blue-600">{Math.round(benchmarks.avgSettlementRate * 100)}%</p>
                  <p className="text-xs text-muted-foreground">{t("avg_settlement")}</p>
                </div>
              )}
              {benchmarks.avgDurationDays !== null && benchmarks.avgDurationDays !== undefined && (
                <div>
                  <p className="text-2xl font-bold">{benchmarks.avgDurationDays}</p>
                  <p className="text-xs text-muted-foreground">{t("avg_days_to_resolve")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">{t("failed_to_load_analyses")}</p>
              <Button variant="outline" size="sm" className="mt-3"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["outcome-analyses", activeTenantId, matterId] })}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {analysesLoading && !error && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!analysesLoading && !error && analyses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-4">
              <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium text-lg">{t("no_outcome_analysis_yet")}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Generate an AI-powered outcome prediction showing win/settlement/loss probabilities, key risk factors, and recommended next steps.
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={generating} size="lg" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate outcome analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Analyses */}
        {analyses.map((analysis) => {
          const isExpanded = expandedId === analysis.id || analyses.length === 1
          return (
            <Card key={analysis.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer pb-3"
                onClick={() => setExpandedId(isExpanded ? null : analysis.id)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        Analysis — {format(new Date(analysis.createdAt), "MMM d, yyyy 'at' HH:mm")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={analysis.portalPublished ? "default" : "outline"} className="text-xs">
                      {analysis.portalPublished ? "Published" : "Private"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setPublishConfirm({ id: analysis.id, current: !!analysis.portalPublished })}
                    >
                      {analysis.portalPublished ? "Unpublish" : "Publish to portal"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-6 pt-0">
                  {/* Summary */}
                  {analysis.summary && (
                    <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                  )}

                  {/* Probability bars */}
                  {(analysis.winProbability !== null || analysis.settlementProbability !== null || analysis.lossProbability !== null) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">{t("outcome_probabilities")}</h4>
                      <ProbabilityBar label="Win" value={analysis.winProbability} color="bg-green-500" />
                      <ProbabilityBar label="Settlement" value={analysis.settlementProbability} color="bg-blue-500" />
                      <ProbabilityBar label="Loss" value={analysis.lossProbability} color="bg-red-400" />
                    </div>
                  )}

                  {/* Key factors */}
                  {analysis.keyFactors && analysis.keyFactors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        Key factors in your favour
                      </h4>
                      <ul className="space-y-1">
                        {analysis.keyFactors.map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">+</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risk amplifiers */}
                  {analysis.riskAmplifiers && analysis.riskAmplifiers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Risk factors to address
                      </h4>
                      <ul className="space-y-1">
                        {analysis.riskAmplifiers.map((r, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">!</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations && analysis.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">{tCommon("recommended_next_steps")}</h4>
                      <ol className="space-y-1 list-decimal list-inside">
                        {analysis.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-muted-foreground">{r}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Publish confirm */}
      <Dialog open={!!publishConfirm} onOpenChange={(o) => !o && setPublishConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {publishConfirm?.current ? "Unpublish from client portal?" : "Publish to client portal?"}
            </DialogTitle>
            <DialogDescription>
              {publishConfirm?.current
                ? "The client will no longer be able to see this analysis."
                : "The client will be able to view this outcome analysis in their portal."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirm(null)}>{tCommon("cancel")}</Button>
            <Button onClick={handlePublishToggle} disabled={publishing}>
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {publishConfirm?.current ? "Unpublish" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MatterWorkspaceShell>
  )
}
