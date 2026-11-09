"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { BookOpen, ChevronDown, ChevronUp, Crown, FileText, Loader2, Play, Settings2, Swords, Zap } from "lucide-react"
import {
  runSimilarCases,
  runOpponentAngles,
  runStrategyMemo,
  type AnalysisQuotaStatus,
  type CaseAnalysisRun,
  type LawyerLead,
  type LeadDocument,
} from "@/lib/api/marketplace"
import { getCreditWallet, updateAiPreferences } from "@/lib/api/credits"
import type { ConsumerDocument } from "@/lib/api/types"
import { DeepAnalysisProgress } from "./deep-analysis-progress"
import { AnalysisRunCard, pickBestPathToVictory } from "./legal-analysis-view"

type AnalysisKind = "similarCases" | "opponentAngles" | "strategyMemo"

const KIND_CONFIG: Record<
  AnalysisKind,
  {
    label: string
    description: string
    runType: string
    run: typeof runSimilarCases
    steps?: string[]
  }
> = {
  similarCases: {
    label: "Similar cases",
    description: "Find binding & persuasive case law across your jurisdiction.",
    runType: "SIMILAR_CASES",
    run: runSimilarCases,
  },
  opponentAngles: {
    label: "Opponent angles",
    description: "Anticipate claims, defences, and weaknesses before trial.",
    runType: "OPPONENT",
    run: runOpponentAngles,
  },
  strategyMemo: {
    label: "Strategy memo",
    description: "Full strategic brief with options, deadlines, and evidence priorities.",
    runType: "STRATEGY",
    run: runStrategyMemo,
  },
}

interface LeadAnalysisPanelProps {
  leadId: string
  lead: LawyerLead
  quotaStatus: AnalysisQuotaStatus | null
  analysisRuns: CaseAnalysisRun[]
  leadDocuments?: LeadDocument[]
  consumerDocuments?: ConsumerDocument[]
}

function isDocReady(doc: { ocrStatus?: string | null }) {
  return doc.ocrStatus === "COMPLETE" || doc.ocrStatus === "SKIPPED"
}

export function LeadAnalysisPanel({
  leadId,
  lead,
  quotaStatus,
  analysisRuns,
  leadDocuments = [],
  consumerDocuments = [],
}: LeadAnalysisPanelProps) {
  const tCommon = useTranslations("lawyer")
  const queryClient = useQueryClient()
  const [loadingKind, setLoadingKind] = useState<AnalysisKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focusPrompt, setFocusPrompt] = useState("")
  const [additionalContext, setAdditionalContext] = useState("")
  const [dockSettingsOpen, setDockSettingsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { data: wallet } = useQuery({
    queryKey: ["credit-wallet-meter"],
    queryFn: () => getCreditWallet(),
    staleTime: 60_000,
  })

  const availableModels = useMemo(() => {
    const models = wallet?.wallet.availablePremiumModels
    if (models && models.length > 0) return models
    return [
      { modelId: "gpt-5.6-sol", label: "Advanced reasoning" },
      { modelId: "gpt-5.6-terra", label: "Detailed analysis" },
      { modelId: "gpt-5.6-luna", label: "Quick analysis" },
    ]
  }, [wallet])

  const [premiumModelId, setPremiumModelId] = useState(
    quotaStatus?.deepAnalysisPremiumModelId ?? "gpt-5.6-sol",
  )

  // Sync to wallet preference once loaded
  useEffect(() => {
    if (wallet?.wallet.deepAnalysisPremiumModelId) {
      setPremiumModelId(wallet.wallet.deepAnalysisPremiumModelId)
    }
  }, [wallet?.wallet.deepAnalysisPremiumModelId])
  const [lastChargedCredits, setLastChargedCredits] = useState<Record<string, number>>({})

  const readyDocs = useMemo(
    () => [
      ...leadDocuments.filter(isDocReady).map((d) => ({ id: d.id, label: d.fileName, source: "Firm" as const })),
      ...consumerDocuments.filter(isDocReady).map((d) => ({ id: d.id, label: d.fileName, source: "Client" as const })),
    ],
    [leadDocuments, consumerDocuments],
  )

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    () => new Set(readyDocs.map((d) => d.id)),
  )

  useEffect(() => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev)
      for (const doc of readyDocs) next.add(doc.id)
      return next
    })
  }, [readyDocs])

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const jurisdictionLabel = [lead.countryCode, lead.jurisdiction].filter(Boolean).join(" · ")

  const persistModel = async (modelId: string) => {
    setPremiumModelId(modelId)
    try {
      await updateAiPreferences({ deepAnalysisPremiumModelId: modelId })
      queryClient.invalidateQueries({ queryKey: ["credit-wallet-meter"] })
    } catch {
      // best-effort persist
    }
  }

  const runAnalysis = async (kind: AnalysisKind) => {
    setLoadingKind(kind)
    setError(null)
    try {
      const body = {
        focusPrompt: focusPrompt.trim() || undefined,
        additionalContext: additionalContext.trim() || undefined,
        documentIds: selectedDocIds.size > 0 ? [...selectedDocIds] : undefined,
        premiumModelId,
      }
      const result = await KIND_CONFIG[kind].run(leadId, body)
      if ((result as any)?.creditsCharged) {
        setLastChargedCredits((prev) => ({ ...prev, [kind]: (result as any).creditsCharged }))
      }
      await queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] })
      queryClient.invalidateQueries({ queryKey: ["credit-wallet-meter"] })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoadingKind(null)
    }
  }

  const deepRuns = analysisRuns.filter((r) =>
    ["SIMILAR_CASES", "OPPONENT", "STRATEGY"].includes(r.runType),
  )

  const bestWinPath = useMemo(() => pickBestPathToVictory(deepRuns), [deepRuns])

  const hasAccess = quotaStatus?.includesDeepAnalysis ?? false
  const creditsRemaining = quotaStatus?.creditsRemaining

  const estRange = (kind: AnalysisKind) => {
    const est = quotaStatus?.estimatedCredits
    if (!est) return null
    const map: Record<AnalysisKind, keyof typeof est> = {
      similarCases: "similarCases",
      opponentAngles: "opponentAngles",
      strategyMemo: "strategyMemo",
    }
    const range = est[map[kind]]
    if (!range) return null
    return `~${range.min}–${range.max} credits`
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Deep analysis
          </span>
          {creditsRemaining != null && (
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {creditsRemaining} credits left
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {hasAccess
            ? "Premium AI analysis — typically 3–5 credits per run (debited based on model and token usage)."
            : "Upgrade to Professional to unlock deep analysis."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasAccess && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">{tCommon("professional_required")}</p>
            <p className="text-amber-700 dark:text-amber-400 mt-1">
              Upgrade your plan to access Similar Cases, Opponent Angles, and Strategy Memo.
            </p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <a href="/pricing">{tCommon("view_plans")}</a>
            </Button>
          </div>
        )}

        {hasAccess && (
          <>
            {bestWinPath && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">
                    Current win path
                    <span className="text-muted-foreground font-normal ml-2">
                      from {bestWinPath.source}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ol className="list-decimal pl-5 text-sm space-y-1">
                    {bestWinPath.steps.slice(0, 5).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Model selector */}
            <div className="flex items-center gap-3">
              <Crown className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="deep-model" className="text-xs font-medium text-muted-foreground mb-1 block">
                  Premium model
                </Label>
                <select
                  id="deep-model"
                  className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={premiumModelId}
                  onChange={(e) => persistModel(e.target.value)}
                >
                  {availableModels.map((m, index) => (
                    <option key={m.modelId} value={m.modelId}>
                      {`Advanced reasoning ${index + 1}`}
                      {(m as { estimatedCreditsTypical?: number }).estimatedCreditsTypical
                        ? ` · ~${(m as { estimatedCreditsTypical?: number }).estimatedCreditsTypical} credits/msg`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Run config */}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="focus-prompt">{tCommon("focus_optional")}</Label>
                <Input
                  id="focus-prompt"
                  placeholder={tCommon("eg_emphasise_lease_deposit_clause")}
                  value={focusPrompt}
                  onChange={(e) => setFocusPrompt(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="additional-context">{tCommon("additional_context_optional")}</Label>
                <Textarea
                  id="additional-context"
                  rows={2}
                  placeholder={tCommon("one-off_facts_for_this_analysis_run")}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                />
              </div>
            </div>

            {readyDocs.length > 0 && (
              <div className="space-y-2">
                <Label>{tCommon("include_documents")}</Label>
                <ul className="space-y-2 rounded-lg border p-3">
                  {readyDocs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`doc-${doc.id}`}
                        checked={selectedDocIds.has(doc.id)}
                        onCheckedChange={() => toggleDoc(doc.id)}
                      />
                      <label htmlFor={`doc-${doc.id}`} className="cursor-pointer truncate">
                        {doc.label}{" "}
                        <span className="text-muted-foreground">({doc.source})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Analysis cards */}
            <div className="grid md:grid-cols-3 gap-3">
              {(Object.keys(KIND_CONFIG) as AnalysisKind[]).map((kind) => {
                const cfg = KIND_CONFIG[kind]
                const est = estRange(kind)
                const charged = lastChargedCredits[kind]
                return (
                  <div
                    key={kind}
                    className="rounded-lg border bg-card p-4 space-y-3 ring-1 ring-amber-200/40 hover:ring-amber-300/70 transition-all"
                  >
                    <div>
                      <p className="font-medium text-sm">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                    </div>

                    {cfg.steps && (
                      <div className="flex gap-1.5 flex-wrap">
                        {cfg.steps.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs py-0">
                            {i + 1} {s}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      {charged != null ? (
                        <span className="text-foreground font-medium">−{charged} credits charged</span>
                      ) : est ? (
                        <span>{est} est.</span>
                      ) : null}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={!hasAccess || loadingKind !== null}
                      onClick={() => void runAnalysis(kind)}
                    >
                      {loadingKind === kind ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {loadingKind === kind ? "Running…" : "Run analysis"}
                    </Button>
                  </div>
                )
              })}
            </div>

            <DeepAnalysisProgress
              active={loadingKind !== null}
              kind={loadingKind}
              countryCode={lead.countryCode}
              jurisdiction={lead.jurisdiction}
              hasDocuments={selectedDocIds.size > 0}
            />
          </>
        )}

        {deepRuns.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium">{tCommon("analysis_history")}</p>
            {deepRuns.map((run) => (
              <AnalysisRunCard
                key={run.id}
                run={run}
                jurisdictionLabel={jurisdictionLabel}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* ── Floating deep-analysis action dock ── */}
    {mounted && hasAccess && createPortal(
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
        {/* Settings panel — slides up above dock */}
        {dockSettingsOpen && (
          <div className="pointer-events-auto w-[min(480px,90vw)] rounded-2xl border bg-background/95 backdrop-blur-md shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analysis settings</p>
              <button
                type="button"
                onClick={() => setDockSettingsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close settings"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dock-model" className="text-xs">Premium model</Label>
              <select
                id="dock-model"
                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={premiumModelId}
                onChange={(e) => void persistModel(e.target.value)}
              >
                {availableModels.map((m, index) => (
                  <option key={m.modelId} value={m.modelId}>
                    {`Advanced reasoning ${index + 1}`}
                    {(m as { estimatedCreditsTypical?: number }).estimatedCreditsTypical
                      ? ` · ~${(m as { estimatedCreditsTypical?: number }).estimatedCreditsTypical} credits/msg`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dock-focus" className="text-xs">{tCommon("focus_optional")}</Label>
              <Input
                id="dock-focus"
                placeholder={tCommon("eg_emphasise_lease_deposit_clause")}
                value={focusPrompt}
                onChange={(e) => setFocusPrompt(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dock-context" className="text-xs">{tCommon("additional_context_optional")}</Label>
              <Textarea
                id="dock-context"
                rows={2}
                placeholder={tCommon("one-off_facts_for_this_analysis_run")}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="resize-none text-sm"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {/* Main dock pill */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 backdrop-blur-md shadow-2xl px-2 py-2">
          {/* Analysis kind buttons */}
          {(Object.keys(KIND_CONFIG) as AnalysisKind[]).map((kind, idx) => {
            const cfg = KIND_CONFIG[kind]
            const isRunning = loadingKind === kind
            const DockIcon = kind === "similarCases" ? BookOpen : kind === "opponentAngles" ? Swords : FileText
            return (
              <button
                key={kind}
                type="button"
                disabled={loadingKind !== null}
                onClick={() => void runAnalysis(kind)}
                className={`
                  group flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium
                  transition-all duration-150
                  ${isRunning
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground hover:text-accent-foreground"
                  }
                  ${loadingKind !== null && !isRunning ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                `}
                title={cfg.description}
              >
                {isRunning
                  ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  : <DockIcon className="h-4 w-4 shrink-0" />
                }
                <span className="hidden sm:inline whitespace-nowrap">{cfg.label}</span>
              </button>
            )
          })}

          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          {/* Settings toggle */}
          <button
            type="button"
            onClick={() => setDockSettingsOpen((o) => !o)}
            className={`
              flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm transition-all
              ${dockSettingsOpen
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }
            `}
            title="Analysis settings"
            aria-label="Analysis settings"
          >
            <Settings2 className="h-4 w-4" />
            {dockSettingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>

          {/* Credits badge */}
          {creditsRemaining != null && (
            <>
              <div className="w-px h-6 bg-border mx-1 shrink-0" />
              <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground tabular-nums">
                <Zap className="h-3 w-3" />
                <span>{creditsRemaining}</span>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body,
    )}
    </>
  )
}
