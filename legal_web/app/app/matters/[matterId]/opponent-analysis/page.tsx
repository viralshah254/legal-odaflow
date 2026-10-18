"use client"

import { useTranslations } from "next-intl"
import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import {
  listOpponentAnalyses,
  runOpponentAnalysis,
  deleteOpponentAnalysisRun,
  type MatterAnalysisRun,
} from "@/lib/api/matter-analysis"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Sparkles,
  Shield,
  Sword,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Bot,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const QUICK_PROMPTS = [
  "What are the likely legal arguments the opposing party will make?",
  "Identify weaknesses in the opposing party's position based on the facts.",
  "What evidence would the opposing party need to succeed?",
  "Suggest counter-arguments to the strongest points the opponent can raise.",
]

function parseSection(text: string, keyword: string): string | null {
  const lines = text.split("\n")
  const idx = lines.findIndex((l) => l.toLowerCase().includes(keyword.toLowerCase()))
  if (idx === -1) return null
  const section: string[] = []
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].match(/^#{1,3} /) && i !== idx + 1) break
    section.push(lines[i])
  }
  return section.join("\n").trim() || null
}

function AnalysisCard({
  run,
  onDelete,
  onRerun,
  deleting,
}: {
  run: MatterAnalysisRun
  onDelete: (id: string) => void
  onRerun: (focusPrompt?: string) => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const content = run.contentMarkdown ?? ""
  const strategySection = parseSection(content, "opposing strategy") ?? parseSection(content, "strategy")
  const weaknessSection = parseSection(content, "weaknesses") ?? parseSection(content, "vulnerabilities")
  const counterSection = parseSection(content, "counter") ?? parseSection(content, "recommended")

  return (
    <Card className={cn("overflow-hidden", deleting && "opacity-50 pointer-events-none")}>
      <CardHeader
        className="cursor-pointer rounded-t-xl pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setExpanded((value) => !value)
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{run.title ?? "Opponent Analysis"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {run.trigger === "auto" && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Bot className="h-2.5 w-2.5" /> Auto
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(run.createdAt), "MMM d 'at' HH:mm")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onRerun()}
              title="Re-run analysis"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(run.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {strategySection || weaknessSection || counterSection ? (
            <div className="space-y-4">
              {strategySection && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Sword className="h-3.5 w-3.5 text-red-500" />
                    Opposing Strategy
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{strategySection}</p>
                </div>
              )}
              {weaknessSection && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    Weaknesses to Address
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{weaknessSection}</p>
                </div>
              )}
              {counterSection && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Target className="h-3.5 w-3.5 text-green-500" />
                    Counter-Strategies
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{counterSection}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {content}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default function OpponentAnalysisPage() {
  const t = useTranslations("matters")
  const tErr = useTranslations("errors")
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const QUERY_KEY = ["opponent-analyses", activeTenantId, matterId]

  const [focusPrompt, setFocusPrompt] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-opponent-matter", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: analyses = [] } = useApiData<MatterAnalysisRun[]>(
    QUERY_KEY,
    {
      apiFn: () => listOpponentAnalyses(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const handleAnalyze = useCallback(async (promptOverride?: string) => {
    if (!activeTenantId) return
    const prompt = promptOverride ?? focusPrompt.trim()
    setAnalyzing(true)
    setError("")
    try {
      await runOpponentAnalysis(activeTenantId, matterId, prompt ? { focusPrompt: prompt } : undefined)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setFocusPrompt("")
      toast({ title: "Opponent analysis complete", description: "New analysis saved." })
    } catch {
      setError("Analysis failed. Please try again.")
      toast({ title: tErr("toast.analysisFailed"), variant: "destructive" })
    } finally {
      setAnalyzing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, focusPrompt, matterId, queryClient, toast, tErr])

  const handleDelete = async (runId: string) => {
    if (!activeTenantId) return
    setDeletingId(runId)
    try {
      await deleteOpponentAnalysisRun(activeTenantId, matterId, runId)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    } catch {
      toast({ title: "Delete failed", variant: "destructive" })
    } finally {
      setDeletingId(null)
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
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t("opponent_analysis")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered analysis of the opposing party&apos;s strategy, weaknesses, and counter-strategies. Analyses are saved and persist across sessions.
          </p>
        </div>

        {/* Input panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sword className="h-4 w-4 text-muted-foreground" />
              Run new analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={focusPrompt}
              onChange={(e) => setFocusPrompt(e.target.value)}
              placeholder="Optional: focus on specific arguments, motions, evidence, or scenario…"
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  e.preventDefault()
                  void handleAnalyze()
                }
              }}
            />

            <Button
              onClick={() => void handleAnalyze()}
              disabled={analyzing}
              className="w-full gap-2"
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
              ) : (
                <><Sword className="h-4 w-4" /> Analyze Opponent</>
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick prompts */}
        {analyses.length === 0 && !analyzing && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Quick start prompts</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void handleAnalyze(p)}
                  disabled={analyzing}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {analyzing && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Analyzing opposing party&apos;s position…</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Persisted analyses */}
        {analyses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Saved analyses ({analyses.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => void handleAnalyze()}
                disabled={analyzing}
              >
                <Sparkles className="h-3 w-3" />
                New Analysis
              </Button>
            </div>
            {analyses.map((run) => (
              <AnalysisCard
                key={run.id}
                run={run}
                onDelete={handleDelete}
                onRerun={() => void handleAnalyze()}
                deleting={deletingId === run.id}
              />
            ))}
          </div>
        )}
      </div>
    </MatterWorkspaceShell>
  )
}
