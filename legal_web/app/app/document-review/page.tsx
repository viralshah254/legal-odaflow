"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import {
  runDocumentReview,
  runDocumentReviewFile,
  extractDocumentReviewText,
  runTabularDocumentReview,
  runLegalResearch,
  saveDocumentReview,
  listSavedDocumentReviews,
  getSavedDocumentReview,
  type DocumentReviewAmendment,
  type DocumentReviewClause,
  type DocumentReviewCon,
  type DocumentReviewDocumentType,
  type DocumentReviewPro,
  type DocumentReviewResult,
  type DocumentReviewRisk,
  type SavedDocumentReviewSummary,
} from "@/lib/api/ai"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { uploadFileViaPresignedUrl, uploadTenantDocument } from "@/lib/api/documents"
import type { ApiClient } from "@/lib/api/types"
import type { ApiMatter } from "@/lib/api/matters"
import type { CountryCode } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertCircle,
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileSearch,
  FileText,
  HelpCircle,
  History,
  Loader2,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react"
import { TabularReviewTable } from "@/components/tabular-review/tabular-review-table"
import type { TabularReviewResult } from "@/components/tabular-review/tabular-review-table"
import { useToast } from "@/hooks/use-toast"
import { AiModelPicker } from "@/components/credits/AiModelPicker"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { PdfExportButton, ShareButton } from "@/components/export/pdf-export-button"
import { useAiModel } from "@/lib/contexts/ai-model-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { COUNTRY_NAMES, TIER1_COUNTRY_CODES } from "@/lib/geo/detect-country"
import { useTourOptional } from "@/lib/contexts/tour-context"
import { cn } from "@/lib/utils"

const COUNTRIES = [
  ...TIER1_COUNTRY_CODES.map((code) => ({ code, label: COUNTRY_NAMES[code] ?? code })),
  ...Object.entries(COUNTRY_NAMES)
    .filter(([code]) => !TIER1_COUNTRY_CODES.includes(code) && code !== "OTHER")
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label)),
]

const DOCUMENT_TYPES: { value: DocumentReviewDocumentType; label: string }[] = [
  { value: "CONTRACT", label: "Contract" },
  { value: "LEGAL_NOTICE", label: "Legal Notice" },
  { value: "AGREEMENT", label: "Agreement" },
  { value: "PETITION", label: "Petition" },
  { value: "MOU", label: "Memorandum of Understanding" },
  { value: "AFFIDAVIT", label: "Affidavit" },
  { value: "WILL", label: "Will / Testament" },
  { value: "GENERAL", label: "General Legal Document" },
]

const ANALYSIS_STAGES = [
  "Extracting document text…",
  "Identifying document structure…",
  "Analysing key clauses…",
  "Scoring risk and compliance…",
  "Generating amendment suggestions…",
]

const TABULAR_COMPARE_STAGES = [
  "Aligning clauses between documents…",
  "Detecting additions, removals, and edits…",
  "Assessing risk levels…",
  "Building comparison table…",
]

function RiskBadge({ severity }: { severity: "HIGH" | "MEDIUM" | "LOW" }) {
  if (severity === "HIGH")
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800">
        HIGH
      </Badge>
    )
  if (severity === "MEDIUM")
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">
        MEDIUM
      </Badge>
    )
  return (
    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
      LOW
    </Badge>
  )
}

function RiskScoreGauge({ score, label }: { score: number; label: string }) {
  const color =
    label === "Critical"
      ? "text-red-600 dark:text-red-400"
      : label === "High"
        ? "text-orange-600 dark:text-orange-400"
        : label === "Moderate"
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400"
  const trackColor =
    label === "Critical"
      ? "bg-red-500"
      : label === "High"
        ? "bg-orange-500"
        : label === "Moderate"
          ? "bg-amber-500"
          : "bg-emerald-500"
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("text-5xl font-bold tabular-nums", color)}>{score}</div>
      <div className={cn("text-sm font-semibold", color)}>{label} Risk</div>
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-2 rounded-full transition-all", trackColor)} style={{ width: `${score}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">out of 100</div>
    </div>
  )
}

function AnalysisProgress({
  stage,
  stages,
  title,
  subtitle,
}: {
  stage: number
  stages: string[]
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1 max-w-md">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{stages[stage] ?? "Processing…"}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/80 pt-1 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex gap-1.5">
        {stages.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-6 rounded-full transition-all duration-500",
              i <= stage ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  )
}

function ProConsTab({ pros, cons, onHighlight }: { pros: DocumentReviewPro[]; cons: DocumentReviewCon[]; onHighlight?: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" /> Strengths ({pros.length})
        </h3>
        {pros.map((p, i) => (
          <Card
            key={i}
            className={cn(
              "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 transition-shadow",
              p.sourceText && "cursor-pointer hover:shadow-md",
            )}
            onClick={() => p.sourceText && onHighlight?.(`pro:${i}`)}
          >
            <CardContent className="p-4 space-y-1">
              <p className="font-medium text-sm text-emerald-800 dark:text-emerald-300">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.detail}</p>
            </CardContent>
          </Card>
        ))}
        {pros.length === 0 && <p className="text-sm text-muted-foreground">No strengths identified.</p>}
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
          <XCircle className="w-4 h-4" /> Weaknesses ({cons.length})
        </h3>
        {cons.map((c, i) => (
          <Card
            key={i}
            className={cn(
              "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 transition-shadow",
              c.sourceText && "cursor-pointer hover:shadow-md",
            )}
            onClick={() => c.sourceText && onHighlight?.(`con:${i}`)}
          >
            <CardContent className="p-4 space-y-1">
              <p className="font-medium text-sm text-red-800 dark:text-red-300">{c.title}</p>
              <p className="text-sm text-muted-foreground">{c.detail}</p>
            </CardContent>
          </Card>
        ))}
        {cons.length === 0 && <p className="text-sm text-muted-foreground">No weaknesses identified.</p>}
      </div>
    </div>
  )
}

function RisksTab({ risks, onHighlight }: { risks: DocumentReviewRisk[]; onHighlight?: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {risks.map((r, i) => (
        <Card
          key={i}
          className={cn(
            "border transition-shadow",
            r.severity === "HIGH"
              ? "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20"
              : r.severity === "MEDIUM"
                ? "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20",
            r.sourceText && "cursor-pointer hover:shadow-md",
          )}
          onClick={() => r.sourceText && onHighlight?.(`risk:${i}`)}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{r.title}</p>
              <RiskBadge severity={r.severity} />
            </div>
            <p className="text-sm text-muted-foreground">{r.detail}</p>
            {r.legalBasis && (
              <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
                Legal basis: {r.legalBasis}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
      {risks.length === 0 && (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-sm">No significant risks identified.</span>
        </div>
      )}
    </div>
  )
}

function ClausesTab({
  clauses,
  onHighlight,
}: {
  clauses: DocumentReviewClause[]
  onHighlight?: (id: string) => void
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  return (
    <div className="space-y-3">
      {clauses.map((c, i) => (
        <Collapsible key={i} open={open.has(i)} onOpenChange={() => toggle(i)}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors hover:bg-muted/50 cursor-pointer hover:shadow-sm",
                c.flagged
                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border-border bg-card",
              )}
              onClick={() => onHighlight?.(`clause:${c.title}`)}
            >
              <div className="flex items-center gap-2">
                {c.flagged && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
                <span className="font-medium text-sm">{c.title}</span>
              </div>
              <ChevronDown
                className={cn("w-4 h-4 text-muted-foreground transition-transform", open.has(i) && "rotate-180")}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-3 border border-t-0 rounded-b-lg space-y-3 bg-card/60">
              {c.originalText && (
                <div className="bg-muted/50 rounded p-3 text-xs font-mono text-muted-foreground leading-relaxed">
                  {c.originalText}
                </div>
              )}
              <p className="text-sm text-foreground">{c.analysis}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
      {clauses.length === 0 && <p className="text-sm text-muted-foreground">No clauses extracted.</p>}
    </div>
  )
}


// ---------------------------------------------------------------------------
// Word-level diff helper
// ---------------------------------------------------------------------------
type DiffToken = { text: string; type: "same" | "removed" | "added" }

function computeWordDiff(original: string, revised: string): DiffToken[] {
  const ow = original.split(/(\s+)/)
  const rw = revised.split(/(\s+)/)
  const dp: number[][] = Array.from({ length: ow.length + 1 }, () =>
    new Array(rw.length + 1).fill(0),
  )
  for (let i = 1; i <= ow.length; i++)
    for (let j = 1; j <= rw.length; j++)
      dp[i][j] =
        ow[i - 1] === rw[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])

  const tokens: DiffToken[] = []
  let i = ow.length, j = rw.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ow[i - 1] === rw[j - 1]) {
      tokens.unshift({ text: ow[i - 1], type: "same" })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ text: rw[j - 1], type: "added" })
      j--
    } else {
      tokens.unshift({ text: ow[i - 1], type: "removed" })
      i--
    }
  }
  return tokens
}

function WordDiff({ original, revised }: { original: string; revised: string }) {
  const tokens = computeWordDiff(original, revised)
  return (
    <span className="leading-relaxed">
      {tokens.map((t, idx) =>
        t.type === "removed" ? (
          <mark
            key={idx}
            className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded px-0.5 line-through"
          >
            {t.text}
          </mark>
        ) : t.type === "added" ? (
          <mark
            key={idx}
            className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded px-0.5"
          >
            {t.text}
          </mark>
        ) : (
          <span key={idx}>{t.text}</span>
        ),
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Amendments tab
// ---------------------------------------------------------------------------
function AmendmentsTab({
  amendments,
  onHighlight,
  onApplyFix,
  onUndoFix,
  appliedAmendments,
}: {
  amendments: DocumentReviewAmendment[]
  onHighlight?: (id: string) => void
  onApplyFix?: (clauseRef: string, originalText: string, suggestedText: string) => void
  onUndoFix?: (clauseRef: string) => void
  appliedAmendments?: Map<string, { originalText: string; suggestedText: string }>
}) {
  const { toast } = useToast()
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }
  const appliedCount = appliedAmendments?.size ?? 0
  const total = amendments.length
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{appliedCount} of {total} amendments applied</span>
            {appliedCount === total && total > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">All done ✓</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: total > 0 ? `${(appliedCount / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {amendments.map((a, i) => {
        const isApplied = appliedAmendments?.has(a.clauseRef) ?? false
        return (
          <Card
            key={i}
            className={cn(
              "border bg-card transition-all",
              isApplied
                ? "border-emerald-300 dark:border-emerald-700 shadow-emerald-100 dark:shadow-none"
                : "border-primary/20 hover:shadow-md cursor-pointer",
            )}
            onClick={() => {
              if (!isApplied) onHighlight?.(`amendment:${a.clauseRef}`)
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">{a.clauseRef}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.issue}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isApplied ? (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      ✓ Applied
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      #{i + 1}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Before / After diff layout */}
              {a.originalText && a.suggestedText ? (
                isApplied ? (
                  /* Applied: show unified diff view */
                  <div className="rounded border border-emerald-200 dark:border-emerald-800 overflow-hidden text-sm">
                    <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-muted">
                      Changes applied
                    </div>
                    <div className="p-3 leading-relaxed">
                      <WordDiff original={a.originalText} revised={a.suggestedText} />
                    </div>
                  </div>
                ) : (
                  /* Pending: 2-column before/after */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Before</p>
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2.5 text-muted-foreground leading-relaxed">
                        {a.originalText}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">After</p>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded p-2.5 text-foreground leading-relaxed">
                        {a.suggestedText}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested</p>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded p-2.5 text-sm leading-relaxed">
                    {a.suggestedText}
                  </div>
                </div>
              )}

              {/* Reason + actions */}
              <div className="flex items-start justify-between gap-2 pt-1">
                <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
                  <span className="font-medium text-foreground">Why: </span>
                  {a.reason}
                </p>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); copy(a.suggestedText) }}
                    title="Copy suggested text"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                  </Button>
                  {isApplied ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        onClick={(e) => { e.stopPropagation(); onHighlight?.(`applied:${a.clauseRef}`) }}
                        title="Jump to location in document"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={(e) => { e.stopPropagation(); onUndoFix?.(a.clauseRef) }}
                        title="Undo this amendment"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Undo
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!a.originalText || !a.suggestedText}
                      className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (a.originalText && a.suggestedText) {
                          onApplyFix?.(a.clauseRef, a.originalText, a.suggestedText)
                        }
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Apply
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
      {amendments.length === 0 && (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-sm">No amendments suggested — document looks well-drafted.</span>
        </div>
      )}
    </div>
  )
}

function OverviewTab({
  result,
  amendments,
  onHighlight,
  onApplyFix,
  onUndoFix,
  appliedAmendments,
}: {
  result: DocumentReviewResult
  amendments: DocumentReviewAmendment[]
  onHighlight?: (id: string) => void
  onApplyFix?: (clauseRef: string, originalText: string, suggestedText: string) => void
  onUndoFix?: (clauseRef: string) => void
  appliedAmendments?: Map<string, { originalText: string; suggestedText: string }>
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{result.documentType}</Badge>
              {result.modelName && (
                <Badge variant="secondary" className="text-xs">
                  {result.modelName}
                </Badge>
              )}
              {result.creditsUsed !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {result.creditsUsed} credits
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
          </div>
          <div className="shrink-0 flex flex-col items-center gap-3">
            <RiskScoreGauge score={result.overallRiskScore} label={result.riskLabel} />
            <div className="flex gap-1.5">
              <PdfExportButton
                title={`Document Review — ${result.documentType ?? "Legal Document"}`}
                content={[
                  `**Document Type:** ${result.documentType ?? "Unknown"}`,
                  `**Risk Level:** ${result.riskLabel ?? ""} (${result.overallRiskScore ?? "N/A"}/10)`,
                  `**Summary:** ${result.summary ?? ""}`,
                  result.risks?.length ? `\n**Key Risks:**\n${result.risks.map((r) => `- ${r.title}: ${r.detail}`).join("\n")}` : "",
                  result.amendments?.length ? `\n**Suggested Amendments:**\n${result.amendments.map((a) => `- ${a.clauseRef}: ${a.suggestedText}`).join("\n")}` : "",
                ].filter(Boolean).join("\n")}
                meta={{ date: new Date().toLocaleDateString() }}
                variant="icon"
                label="Export PDF"
              />
              <ShareButton
                title={`Document Review — ${result.documentType ?? "Legal Document"}`}
                text={`Document Review (${result.documentType ?? ""}): ${result.summary ?? ""} — Risk: ${result.riskLabel ?? ""}`}
                label="Share"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {result.parties.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Parties
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.parties.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground text-xs">· {p.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.keyDates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Key Dates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.keyDates.map((d, i) => (
              <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-lg p-3 text-sm">
                <span className="font-mono font-medium shrink-0 text-xs bg-background border rounded px-1.5 py-0.5">
                  {d.date}
                </span>
                <span className="text-muted-foreground">{d.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Recommendations</h3>
          <ul className="space-y-1.5">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {amendments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Suggested Fixes ({amendments.length})
          </h3>
          <div className="space-y-3">
            {amendments.map((a, i) => {
              const isApplied = appliedAmendments?.has(a.clauseRef) ?? false
              return (
                <div
                  key={i}
                  className={cn(
                    "border rounded-lg overflow-hidden transition-shadow",
                    isApplied
                      ? "border-emerald-300 dark:border-emerald-700"
                      : "cursor-pointer hover:shadow-sm",
                  )}
                  onClick={() => {
                    if (isApplied) onHighlight?.(`applied:${a.clauseRef}`)
                    else onHighlight?.(`amendment:${a.clauseRef}`)
                  }}
                >
                  <div className="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isApplied ? (
                        <Badge className="text-xs shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs shrink-0">Fix {i + 1}</Badge>
                      )}
                      <span className="text-xs font-medium truncate">{a.clauseRef}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:block">— {a.issue}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2 gap-1"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.suggestedText) }}
                      >
                        <ClipboardCopy className="w-3 h-3" />
                      </Button>
                      {isApplied ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                          onClick={(e) => { e.stopPropagation(); onUndoFix?.(a.clauseRef) }}
                        >
                          <XCircle className="w-3 h-3" />
                          Undo
                        </Button>
                      ) : (
                        a.originalText && a.suggestedText && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2 gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            onClick={(e) => { e.stopPropagation(); onApplyFix?.(a.clauseRef, a.originalText, a.suggestedText) }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Apply
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/10">
                    <p className="text-xs text-muted-foreground mb-0.5 uppercase tracking-wide font-medium">Replace with:</p>
                    <p className="text-xs text-foreground leading-relaxed line-clamp-3">{a.suggestedText}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {result.complianceFlags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" /> Compliance Flags
          </h3>
          <ul className="space-y-1.5">
            {result.complianceFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Annotation helpers ────────────────────────────────────────────────────────

type Segment = {
  text: string
  color?: "amber" | "emerald" | "emerald-strong" | "rose" | "red" | "blue" | "green"
  id?: string
}

/** Find the start/end of a snippet in docText. Tries exact match first,
 *  then normalized-whitespace fallback. Returns null when not found. */
function findTextRange(docText: string, snippet: string): { start: number; end: number } | null {
  if (!snippet?.trim()) return null
  // 1. Exact match
  const idx = docText.indexOf(snippet)
  if (idx >= 0) return { start: idx, end: idx + snippet.length }
  // 2. Normalize runs of whitespace/newlines in both texts and re-search
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim()
  const normDoc = normalize(docText)
  const normSnip = normalize(snippet)
  if (!normSnip) return null
  const normIdx = normDoc.indexOf(normSnip)
  if (normIdx < 0) return null
  // Map normalized index back to original doc index by counting original chars
  let origPos = 0
  let normPos = 0
  while (normPos < normIdx && origPos < docText.length) {
    if (/\s/.test(docText[origPos])) {
      while (origPos < docText.length && /\s/.test(docText[origPos])) origPos++
      normPos++ // one space in normalized
    } else {
      origPos++
      normPos++
    }
  }
  const start = origPos
  // Advance through snippet length in normalized space
  let normEnd = normIdx + normSnip.length
  normPos = normIdx
  while (normPos < normEnd && origPos < docText.length) {
    if (/\s/.test(docText[origPos])) {
      while (origPos < docText.length && /\s/.test(docText[origPos])) origPos++
      normPos++
    } else {
      origPos++
      normPos++
    }
  }
  return { start, end: origPos }
}

type HighlightColor = "amber" | "emerald" | "emerald-strong" | "rose" | "red" | "blue" | "green"

/** Priority order: higher index = wins overlap */
const COLOR_PRIORITY: Record<HighlightColor, number> = {
  blue: 0,
  "emerald-strong": 1,
  emerald: 2,
  rose: 3,
  amber: 4,
  red: 5,
  green: 6,
}

function buildAnnotatedSegments(
  docText: string,
  result: DocumentReviewResult,
  appliedAmendments: Map<string, { originalText: string; suggestedText: string }>,
): Segment[] {
  if (!docText) return [{ text: "" }]

  type Range = { start: number; end: number; color: HighlightColor; id: string }
  const ranges: Range[] = []

  // Non-flagged key clauses (emerald)
  for (const clause of result.keyClauses) {
    if (clause.flagged) continue
    const r = findTextRange(docText, clause.originalText)
    if (r) ranges.push({ ...r, color: "emerald-strong", id: `clause:${clause.title}` })
  }

  // Flagged key clauses (amber) — higher priority than emerald
  for (const clause of result.keyClauses) {
    if (!clause.flagged) continue
    const r = findTextRange(docText, clause.originalText)
    if (r) ranges.push({ ...r, color: "amber", id: `clause:${clause.title}` })
  }

  // Strengths (emerald light)
  result.pros.forEach((pro, i) => {
    if (!pro.sourceText?.trim()) return
    const r = findTextRange(docText, pro.sourceText)
    if (r) ranges.push({ ...r, color: "emerald", id: `pro:${i}` })
  })

  // Weaknesses (rose)
  result.cons.forEach((con, i) => {
    if (!con.sourceText?.trim()) return
    const r = findTextRange(docText, con.sourceText)
    if (r) ranges.push({ ...r, color: "rose", id: `con:${i}` })
  })

  // HIGH risks (red) — higher priority
  result.risks.forEach((risk, i) => {
    if (risk.severity !== "HIGH" || !risk.sourceText?.trim()) return
    const r = findTextRange(docText, risk.sourceText)
    if (r) ranges.push({ ...r, color: "red", id: `risk:${i}` })
  })

  // Unapplied amendments (blue)
  for (const amendment of result.amendments) {
    if (appliedAmendments.has(amendment.clauseRef)) continue
    if (!amendment.originalText?.trim()) continue
    const r = findTextRange(docText, amendment.originalText)
    if (r) ranges.push({ ...r, color: "blue", id: `amendment:${amendment.clauseRef}` })
  }

  // Applied amendments (green) — highest priority, use suggestedText location
  for (const [clauseRef, { suggestedText }] of appliedAmendments) {
    if (!suggestedText?.trim()) continue
    const r = findTextRange(docText, suggestedText)
    if (r) ranges.push({ ...r, color: "green", id: `applied:${clauseRef}` })
  }

  // Resolve overlaps: sort by start, then by priority (lower priority = placed first, higher wins)
  ranges.sort((a, b) => a.start - b.start || COLOR_PRIORITY[b.color] - COLOR_PRIORITY[a.color])

  const merged: Range[] = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start < cursor) {
      // Check if this higher-priority range should replace last merged range
      const last = merged[merged.length - 1]
      if (last && COLOR_PRIORITY[r.color] > COLOR_PRIORITY[last.color] && r.start >= last.start) {
        // Replace
        merged.pop()
        if (last.start < r.start) {
          merged.push({ start: last.start, end: r.start, color: last.color, id: last.id })
        }
        merged.push(r)
        cursor = r.end
        if (last.end > r.end) {
          merged.push({ start: r.end, end: last.end, color: last.color, id: last.id })
          cursor = last.end
        }
      }
      continue
    }
    merged.push(r)
    cursor = r.end
  }

  const segments: Segment[] = []
  let pos = 0
  for (const r of merged) {
    if (r.start > pos) segments.push({ text: docText.slice(pos, r.start) })
    segments.push({ text: docText.slice(r.start, r.end), color: r.color, id: r.id })
    pos = r.end
  }
  if (pos < docText.length) segments.push({ text: docText.slice(pos) })
  return segments.length ? segments : [{ text: docText }]
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function DocumentReviewPage() {
  const { activeTenantId } = useTenant()
  const { countryCode: profileCountryCode } = useDetectedCountry()
  const tour = useTourOptional()
  const { gate: creditsGate, handleApiError } = useInsufficientCreditsGate({
    feature: "documentReview",
    tenantId: activeTenantId ?? undefined,
    countryCode: profileCountryCode || "IN",
    requiredCredits: FEATURE_CREDIT_COSTS.DOCUMENT_REVIEW,
  })
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const docPaneRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()

  const [pageMode, setPageMode] = useState<"single" | "tabular">(
    () => (searchParams.get("mode") === "tabular" ? "tabular" : "single"),
  )
  const [tabularSeen, setTabularSeen] = useState(true) // default true; set false below after mount

  useEffect(() => {
    const seen = typeof window !== "undefined" && localStorage.getItem("tabular_review_seen")
    if (!seen) setTabularSeen(false)
    if (searchParams.get("mode") === "tabular") {
      setPageMode("tabular")
      setTabularSeen(true)
    }
  }, [searchParams])

  const handleSelectTabular = () => {
    setPageMode("tabular")
    setResult(null)
    if (!tabularSeen) {
      setTabularSeen(true)
      if (typeof window !== "undefined") localStorage.setItem("tabular_review_seen", "1")
    }
  }

  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState("")
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload")
  const [countryCode, setCountryCode] = useState(() => profileCountryCode || "")
  const [documentType, setDocumentType] = useState<DocumentReviewDocumentType>("GENERAL")
  const { mode: aiModelMode, modelId: premiumModelId } = useAiModel()
  const [loading, setLoading] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [result, setResult] = useState<DocumentReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const [followUp, setFollowUp] = useState("")
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null)
  const countryManuallySet = useRef(false)

  const handleCountryChange = useCallback((code: string) => {
    countryManuallySet.current = true
    setCountryCode(code)
  }, [])

  const handleTabCountryChange = useCallback((code: string) => {
    countryManuallySet.current = true
    setTabCountry(code)
  }, [])

  // Keep country in sync with profile when user hasn't manually changed it
  useEffect(() => {
    if (!countryManuallySet.current && profileCountryCode) {
      setCountryCode(profileCountryCode)
      setTabCountry(profileCountryCode)
    }
  }, [profileCountryCode])

  // Tabular review state
  const [tabDocAText, setTabDocAText] = useState("")
  const [tabDocBText, setTabDocBText] = useState("")
  const [tabDocAName, setTabDocAName] = useState("Document A")
  const [tabDocBName, setTabDocBName] = useState("Document B")
  const [tabCountry, setTabCountry] = useState(() => profileCountryCode || "")
  const [tabLoading, setTabLoading] = useState(false)
  const [tabStageIdx, setTabStageIdx] = useState(0)
  const [tabResult, setTabResult] = useState<TabularReviewResult | null>(null)
  const [tabError, setTabError] = useState<string | null>(null)
  const [tabDocAInputMode, setTabDocAInputMode] = useState<"paste" | "upload">("paste")
  const [tabDocBInputMode, setTabDocBInputMode] = useState<"paste" | "upload">("paste")
  const [tabDocAFile, setTabDocAFile] = useState<File | null>(null)
  const [tabDocBFile, setTabDocBFile] = useState<File | null>(null)
  const [tabDocAExtracting, setTabDocAExtracting] = useState(false)
  const [tabDocBExtracting, setTabDocBExtracting] = useState(false)
  const [tabDocAError, setTabDocAError] = useState<string | null>(null)
  const [tabDocBError, setTabDocBError] = useState<string | null>(null)
  const tabFileARef = useRef<HTMLInputElement>(null)
  const tabFileBRef = useRef<HTMLInputElement>(null)

  const extractTextFromFile = async (
    file: File,
    setText: (t: string) => void,
    setName: (n: string) => void,
    setExtracting: (v: boolean) => void,
    setError: (message: string | null) => void,
  ) => {
    setName(file.name.replace(/\.[^.]+$/, ""))
    setError(null)
    setText("")
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      try {
        const text = await file.text()
        if (!text.trim()) {
          setError("Could not extract text — try Paste mode or a different file.")
          return
        }
        setText(text)
      } catch {
        setError("Could not read this text file.")
      }
      return
    }
    setExtracting(true)
    try {
      const res = await extractDocumentReviewText(file, activeTenantId ?? undefined)
      const extracted = res.extractedText?.trim() ?? ""
      if (!extracted) {
        setError("Could not extract text — try Paste mode or a different file.")
        return
      }
      setText(res.extractedText ?? "")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not extract text from this file."
      setError(message)
      toast({
        variant: "destructive",
        title: "Text extraction failed",
        description: message,
      })
    } finally {
      setExtracting(false)
    }
  }

  const handleTabularSubmit = async () => {
    if (!tabDocAText.trim() || !tabDocBText.trim()) {
      setTabError("Please provide text for both documents.")
      return
    }
    setTabLoading(true)
    setTabError(null)
    setTabResult(null)
    setTabStageIdx(0)

    const interval = setInterval(() => {
      setTabStageIdx((s) => Math.min(s + 1, TABULAR_COMPARE_STAGES.length - 1))
    }, 3500)

    try {
      const data = await runTabularDocumentReview(
        {
          docAText: tabDocAText,
          docBText: tabDocBText,
          docAName: tabDocAName,
          docBName: tabDocBName,
          countryCode: tabCountry,
          aiModelMode,
          premiumModelId,
        },
        activeTenantId ?? undefined,
      )
      setTabResult(data)
    } catch (err) {
      const isCredErr = isInsufficientCreditsError(err)
      const msg = err instanceof Error ? err.message : "Tabular review failed"
      handleApiError(err, msg)
      setIsCreditError(isCredErr)
      if (!isCredErr) {
        setTabError(msg)
        toast({ title: "Comparison failed", description: msg, variant: "destructive" })
      }
    } finally {
      clearInterval(interval)
      setTabLoading(false)
    }
  }

  // Split-view state
  const [documentText, setDocumentText] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState("")
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [appliedAmendments, setAppliedAmendments] = useState<Map<string, { originalText: string; suggestedText: string }>>(new Map())
  const highlightCycleRef = useRef<Record<string, number>>({})
  const resultsTourStartedRef = useRef(false)
  const [mobileShowDoc, setMobileShowDoc] = useState(false)

  // Save review dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveClientId, setSaveClientId] = useState("")
  const [saveMatterId, setSaveMatterId] = useState("")
  const [saveReviewMeta, setSaveReviewMeta] = useState(true)
  const [saveDocument, setSaveDocument] = useState(true)
  const [clients, setClients] = useState<ApiClient[]>([])
  const [matters, setMatters] = useState<ApiMatter[]>([])

  // Recent reviews
  const [savedReviews, setSavedReviews] = useState<SavedDocumentReviewSummary[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedOpen, setSavedOpen] = useState(true)

  const loadSavedReviews = useCallback(() => {
    if (!activeTenantId) return
    listSavedDocumentReviews(undefined, activeTenantId)
      .then(setSavedReviews)
      .catch(() => {})
  }, [activeTenantId])

  useEffect(() => {
    if (!activeTenantId) return
    setSavedLoading(true)
    listSavedDocumentReviews(undefined, activeTenantId)
      .then(setSavedReviews)
      .catch(() => {})
      .finally(() => setSavedLoading(false))
  }, [activeTenantId])

  useEffect(() => {
    if (saveDialogOpen && activeTenantId) {
      listClients(activeTenantId).then(setClients).catch(() => {})
    }
  }, [saveDialogOpen, activeTenantId])

  useEffect(() => {
    if (!saveDialogOpen || !activeTenantId) return
    const filters = saveClientId ? { clientId: saveClientId } : {}
    listMatters(activeTenantId, filters).then(setMatters).catch(() => {})
  }, [saveDialogOpen, saveClientId, activeTenantId])

  const advanceStage = () => {
    setStageIdx((s) => Math.min(s + 1, ANALYSIS_STAGES.length - 1))
  }

  const handleFollowUpAsk = async () => {
    const question = followUp.trim()
    if (!question || !activeTenantId) return

    setFollowUpLoading(true)
    setFollowUpAnswer(null)
    try {
      const priorContext = result?.summary
        ? `Prior document review summary:\n${result.summary.slice(0, 1200)}`
        : undefined
      const research = await runLegalResearch(
        {
          query: question,
          countryCode: (countryCode || profileCountryCode || "IN") as CountryCode,
          priorContext,
          researchMode: "FAST",
        },
        activeTenantId ?? undefined,
      )
      setFollowUpAnswer(research.answer)
      setFollowUp("")
      if (research.creditsUsed !== undefined && research.creditsUsed > 0) {
        toast({ title: "Follow-up research complete", description: `${research.creditsUsed} credits used` })
      } else {
        toast({ title: "Follow-up research complete" })
      }
    } catch (err) {
      const isCredErr = isInsufficientCreditsError(err)
      handleApiError(err, err instanceof Error ? err.message : "Follow-up research failed.")
      if (!isCredErr) {
        const raw = err instanceof Error ? err.message : ""
        const description = raw.toLowerCase().includes("unavailable") || raw.toLowerCase().includes("try again")
          ? "The AI service is temporarily unavailable. Please try again in a moment."
          : (raw || "An error occurred. Try the Legal Research page for more options.")
        toast({ title: "Follow-up research failed", description, variant: "destructive" })
      }
    } finally {
      setFollowUpLoading(false)
    }
  }

  const scrollToHighlight = useCallback((id: string) => {
    setActiveHighlight(id)
    setTimeout(() => {
      const allMarks = Array.from(
        docPaneRef.current?.querySelectorAll("[data-highlight-id]") ?? [],
      ) as HTMLElement[]
      const el = allMarks.find((m) => m.getAttribute("data-highlight-id") === id)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 50)
  }, [])

  /** Cycle through all highlights of a given prefix (e.g. "pro:", "risk:") */
  const scrollToCategory = useCallback((
    prefix: string,
    tab: string,
    filter?: (id: string) => boolean,
  ) => {
    setActiveTab(tab)
    // Gather all marks in the doc pane that match the prefix via getAttribute scanning
    setTimeout(() => {
      const allMarks = Array.from(
        docPaneRef.current?.querySelectorAll("[data-highlight-id]") ?? [],
      ) as HTMLElement[]
      const marks = allMarks.filter((m) => {
        const hid = m.getAttribute("data-highlight-id") ?? ""
        return hid.startsWith(prefix)
      })
      if (marks.length === 0) return
      const cycleKey = prefix
      const prevIdx = highlightCycleRef.current[cycleKey] ?? -1
      const nextIdx = (prevIdx + 1) % marks.length
      highlightCycleRef.current[cycleKey] = nextIdx
      const el = marks[nextIdx]
      const id = el.getAttribute("data-highlight-id") ?? ""
      if (filter && !filter(id)) {
        // Try next one
        const altIdx = marks.findIndex((m, i) => i !== nextIdx && filter(m.getAttribute("data-highlight-id") ?? ""))
        if (altIdx >= 0) {
          highlightCycleRef.current[cycleKey] = altIdx
          setActiveHighlight(marks[altIdx].getAttribute("data-highlight-id"))
          marks[altIdx].scrollIntoView({ behavior: "smooth", block: "center" })
          return
        }
      }
      setActiveHighlight(id)
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
  }, [])

  const applyFix = useCallback((clauseRef: string, originalText: string, suggestedText: string) => {
    const found = documentText.includes(originalText) || findTextRange(documentText, originalText) !== null
    if (!found) {
      toast({
        title: "Cannot apply amendment",
        description: "The original text could not be located in the document. The document may have been edited.",
        variant: "destructive",
      })
      return
    }
    const newText = documentText.replace(originalText, suggestedText)
    setDocumentText(newText)
    setEditText(newText)
    setAppliedAmendments(prev => {
      const next = new Map(prev)
      next.set(clauseRef, { originalText, suggestedText })
      return next
    })
    toast({ title: "Amendment applied", description: "The clause has been replaced in the document pane." })
    setTimeout(() => {
      const targetId = `applied:${clauseRef}`
      const allMarks = Array.from(
        docPaneRef.current?.querySelectorAll("[data-highlight-id]") ?? [],
      ) as HTMLElement[]
      const el = allMarks.find((m) => m.getAttribute("data-highlight-id") === targetId)
      if (el) {
        setActiveHighlight(targetId)
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 80)
  }, [documentText, toast])

  const undoFix = useCallback((clauseRef: string) => {
    const entry = appliedAmendments.get(clauseRef)
    if (!entry) return
    const restoredText = documentText.replace(entry.suggestedText, entry.originalText)
    setDocumentText(restoredText)
    setEditText(restoredText)
    setAppliedAmendments(prev => {
      const next = new Map(prev)
      next.delete(clauseRef)
      return next
    })
    setActiveHighlight(null)
    toast({ title: "Amendment undone", description: "The original clause text has been restored." })
  }, [appliedAmendments, documentText, toast])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setInputMode("upload")
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setInputMode("upload")
    }
  }

  const handleAnalyze = async () => {
    const hasFile = inputMode === "upload" && selectedFile
    const hasText = inputMode === "paste" && pastedText.trim().length > 20

    if (!hasFile && !hasText) {
      toast({ title: "Upload a document or paste document text to continue.", variant: "destructive" })
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setStageIdx(0)

    const interval = setInterval(advanceStage, 3500)

    try {
      let res: DocumentReviewResult
      if (hasFile) {
        res = await runDocumentReviewFile(
          selectedFile!,
          { documentType, countryCode, aiModelMode, premiumModelId },
          activeTenantId ?? undefined,
        )
      } else {
        res = await runDocumentReview(
          { extractedText: pastedText, documentType, countryCode, aiModelMode, premiumModelId },
          activeTenantId ?? undefined,
        )
      }
      setResult(res)
      setDocumentText(res.extractedText ?? (inputMode === "paste" ? pastedText : ""))
      setEditText(res.extractedText ?? (inputMode === "paste" ? pastedText : ""))
    } catch (err: unknown) {
      const isCredErr = isInsufficientCreditsError(err)
      handleApiError(err, err instanceof Error ? err.message : "Document review failed. Please try again.")
      setIsCreditError(isCredErr)
      if (!isCredErr) {
        const msg = err instanceof Error ? err.message : "Document review failed. Please try again."
        setError(msg)
        toast({ title: "Review failed", description: msg, variant: "destructive" })
      }
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setSelectedFile(null)
    setPastedText("")
    setStageIdx(0)
    setFollowUp("")
    setDocumentText("")
    setEditText("")
    setEditMode(false)
    setActiveHighlight(null)
    setAppliedAmendments(new Map())
    setActiveTab("overview")
    highlightCycleRef.current = {}
    resultsTourStartedRef.current = false
  }

  const flaggedCount = result?.keyClauses.filter((c) => c.flagged).length ?? 0
  const highRisks = result?.risks.filter((r) => r.severity === "HIGH").length ?? 0

  // Auto-start results tour once after the first successful analysis
  useEffect(() => {
    if (!result || resultsTourStartedRef.current) return
    const resultsId = tour?.zone === "consumer" ? "consumer.documentReview.results" : "app.documentReview.results"
    if (tour?.isTourCompleted(resultsId)) return
    resultsTourStartedRef.current = true
    const timer = setTimeout(() => {
      tour?.startTour(resultsId)
    }, 1500)
    return () => clearTimeout(timer)
  }, [result, tour])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="border-b px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between gap-3 shrink-0">
        <div data-tour="document-review-header" className="flex items-center gap-2 lg:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileSearch className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm">Document Review</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">AI-powered legal document analysis &amp; amendment suggestions</p>
          </div>
        </div>
        {/* Mode switcher */}
        <div data-tour="document-review-mode" className="flex rounded-lg border p-0.5 bg-muted/30 gap-0.5">
          <button
            onClick={() => { setPageMode("single"); setTabResult(null); setTabError(null) }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              pageMode === "single" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileSearch className="h-3.5 w-3.5" />
            Single
          </button>
          <button
            onClick={handleSelectTabular}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              pageMode === "tabular" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            Tabular
            {!tabularSeen && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                N
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 text-xs text-muted-foreground"
            onClick={() => {
              const prefix = tour?.zone === "consumer" ? "consumer" : "app"
              tour?.startTour(
                result ? `${prefix}.documentReview.results` : `${prefix}.documentReview`,
                { force: true },
              )
            }}
            title="Take a tour of Document Review"
            data-tour="document-review-tour-btn"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </Button>
          {result && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-xs"
                data-tour="document-review-save"
                onClick={() => {
                  setSaveName(selectedFile?.name ?? "Document Review")
                  setSaveClientId("")
                  setSaveMatterId("")
                  setSaveReviewMeta(true)
                  setSaveDocument(!!documentText)
                  setSaveDialogOpen(true)
                }}
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Review</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1.5 text-xs" onClick={handleReset}>
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Review another</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Save Review Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Review &amp; Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="save-name" className="text-sm">File name</Label>
              <Input
                id="save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Document Review"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="save-client" className="text-sm">Link to client <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={saveClientId} onValueChange={(v) => { setSaveClientId(v); setSaveMatterId("") }}>
                <SelectTrigger id="save-client">
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="save-matter" className="text-sm">Link to matter <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={saveMatterId} onValueChange={setSaveMatterId}>
                <SelectTrigger id="save-matter">
                  <SelectValue placeholder="No matter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No matter</SelectItem>
                  {matters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg divide-y">
              <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  id="save-review-meta"
                  checked={saveReviewMeta}
                  onCheckedChange={(v) => setSaveReviewMeta(!!v)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Save review metadata</p>
                  <p className="text-xs text-muted-foreground">Stores the AI analysis JSON for future reference</p>
                </div>
              </label>
              {documentText && (
                <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40">
                  <Checkbox
                    id="save-document-file"
                    checked={saveDocument}
                    onCheckedChange={(v) => setSaveDocument(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">Save updated document</p>
                    <p className="text-xs text-muted-foreground">
                      Uploads the reviewed text{appliedAmendments.size > 0 ? ` (${appliedAmendments.size} amendment${appliedAmendments.size > 1 ? "s" : ""} applied)` : ""} as a .txt file in Documents
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving || !saveName.trim() || (!saveReviewMeta && !saveDocument)}
              onClick={async () => {
                if (!result) return
                setSaving(true)
                try {
                  const clientIdVal = saveClientId || undefined
                  const matterIdVal = saveMatterId || undefined

                  if (saveReviewMeta) {
                    await saveDocumentReview(
                      {
                        fileName: saveName.trim(),
                        documentType,
                        clientId: clientIdVal,
                        matterId: matterIdVal,
                        reviewJson: result,
                        extractedText: documentText || undefined,
                      },
                      activeTenantId ?? undefined,
                    )
                  }

                  if (saveDocument && documentText && activeTenantId) {
                    const baseName = saveName.trim().replace(/\.[^.]+$/, "") || "document-review"
                    const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" })
                    const file = new File([blob], `${baseName}-reviewed.txt`, { type: "text/plain" })
                    const { fileUrl } = await uploadFileViaPresignedUrl(activeTenantId, file)
                    await uploadTenantDocument(activeTenantId, {
                      fileName: file.name,
                      fileUrl,
                      mimeType: "text/plain",
                      clientId: clientIdVal,
                      matterId: matterIdVal,
                    })
                  }

                  const saved = [saveReviewMeta && "review", saveDocument && "document"].filter(Boolean).join(" & ")
                  toast({ title: `Saved ${saved}`, description: (clientIdVal || matterIdVal) ? "Linked to selected client/matter." : undefined })
                  setSaveDialogOpen(false)
                  setSaveName("")
                  setSaveClientId("")
                  setSaveMatterId("")
                  loadSavedReviews()
                } catch {
                  toast({ title: "Failed to save", variant: "destructive" })
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <BookmarkPlus className="w-4 h-4 mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tabular Review mode ──────────────────────────────────────── */}
      {pageMode === "tabular" && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {!tabResult ? (
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
              {tabLoading ? (
                <div className="flex flex-1 min-h-0 items-center justify-center">
                  <AnalysisProgress
                    stage={tabStageIdx}
                    stages={TABULAR_COMPARE_STAGES}
                    title="Comparing documents…"
                    subtitle={`${tabDocAName} vs ${tabDocBName}`}
                  />
                </div>
              ) : (
              /* Two-column document panels */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Document A */}
                <div className="flex flex-col min-h-0 rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b shrink-0">
                    <Input
                      value={tabDocAName}
                      onChange={(e) => setTabDocAName(e.target.value)}
                      placeholder="Document A name"
                      className="h-7 text-sm font-medium border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent"
                    />
                    <div className="flex shrink-0 rounded-md border overflow-hidden text-xs">
                      <button
                        className={cn("px-2.5 py-1 transition-colors", tabDocAInputMode === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => setTabDocAInputMode("paste")}
                      >Paste</button>
                      <button
                        className={cn("px-2.5 py-1 transition-colors", tabDocAInputMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => setTabDocAInputMode("upload")}
                      >Upload</button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    {tabDocAInputMode === "paste" ? (
                      <Textarea
                        placeholder="Paste the text of the first document here…"
                        value={tabDocAText}
                        onChange={(e) => setTabDocAText(e.target.value)}
                        className="flex-1 min-h-0 resize-none overflow-y-auto rounded-none border-0 font-mono text-xs focus-visible:ring-0"
                      />
                    ) : (
                      <div
                        className="flex-1 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer hover:bg-muted/30 transition-colors min-h-[200px]"
                        onClick={() => tabFileARef.current?.click()}
                      >
                        <input
                          ref={tabFileARef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.txt,.doc"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setTabDocAFile(f)
                            extractTextFromFile(f, setTabDocAText, setTabDocAName, setTabDocAExtracting, setTabDocAError)
                          }}
                        />
                        {tabDocAExtracting ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : tabDocAFile ? (
                          <>
                            <FileText className="h-8 w-8 text-primary" />
                            <p className="text-sm font-medium text-center truncate max-w-full">{tabDocAFile.name}</p>
                            <p className={cn(
                              "text-xs text-center",
                              tabDocAError ? "text-destructive" : "text-muted-foreground",
                            )}>
                              {tabDocAError
                                ? tabDocAError
                                : tabDocAText
                                  ? `${tabDocAText.length.toLocaleString()} chars extracted`
                                  : "Extracting text…"}
                              {" · "}Click to change
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="rounded-full border-2 border-dashed border-muted-foreground/30 p-4">
                              <Upload className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                              Click to upload Document A
                            </p>
                            <p className="text-xs text-muted-foreground/70">PDF, DOCX, TXT — up to 20 MB</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Document B */}
                <div className="flex flex-col min-h-0 rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b shrink-0">
                    <Input
                      value={tabDocBName}
                      onChange={(e) => setTabDocBName(e.target.value)}
                      placeholder="Document B name"
                      className="h-7 text-sm font-medium border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent"
                    />
                    <div className="flex shrink-0 rounded-md border overflow-hidden text-xs">
                      <button
                        className={cn("px-2.5 py-1 transition-colors", tabDocBInputMode === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => setTabDocBInputMode("paste")}
                      >Paste</button>
                      <button
                        className={cn("px-2.5 py-1 transition-colors", tabDocBInputMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => setTabDocBInputMode("upload")}
                      >Upload</button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    {tabDocBInputMode === "paste" ? (
                      <Textarea
                        placeholder="Paste the text of the second document here…"
                        value={tabDocBText}
                        onChange={(e) => setTabDocBText(e.target.value)}
                        className="flex-1 min-h-0 resize-none overflow-y-auto rounded-none border-0 font-mono text-xs focus-visible:ring-0"
                      />
                    ) : (
                      <div
                        className="flex-1 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer hover:bg-muted/30 transition-colors min-h-[200px]"
                        onClick={() => tabFileBRef.current?.click()}
                      >
                        <input
                          ref={tabFileBRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.txt,.doc"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setTabDocBFile(f)
                            extractTextFromFile(f, setTabDocBText, setTabDocBName, setTabDocBExtracting, setTabDocBError)
                          }}
                        />
                        {tabDocBExtracting ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : tabDocBFile ? (
                          <>
                            <FileText className="h-8 w-8 text-primary" />
                            <p className="text-sm font-medium text-center truncate max-w-full">{tabDocBFile.name}</p>
                            <p className={cn(
                              "text-xs text-center",
                              tabDocBError ? "text-destructive" : "text-muted-foreground",
                            )}>
                              {tabDocBError
                                ? tabDocBError
                                : tabDocBText
                                  ? `${tabDocBText.length.toLocaleString()} chars extracted`
                                  : "Extracting text…"}
                              {" · "}Click to change
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="rounded-full border-2 border-dashed border-muted-foreground/30 p-4">
                              <Upload className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                              Click to upload Document B
                            </p>
                            <p className="text-xs text-muted-foreground/70">PDF, DOCX, TXT — up to 20 MB</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Footer bar */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <Select value={tabCountry} onValueChange={handleTabCountryChange}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleTabularSubmit}
                  disabled={
                    tabLoading
                    || tabDocAExtracting
                    || tabDocBExtracting
                    || !tabDocAText.trim()
                    || !tabDocBText.trim()
                  }
                  className="gap-2"
                >
                  {tabLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {tabLoading ? "Comparing…" : "Compare documents"}
                </Button>
                {tabError && (
                  <span className="text-destructive text-sm flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {tabError}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTabResult(null)
                    setTabDocAText("")
                    setTabDocBText("")
                    setTabDocAFile(null)
                    setTabDocBFile(null)
                    setTabDocAError(null)
                    setTabDocBError(null)
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Compare another
                </Button>
              </div>
              <TabularReviewTable result={tabResult} docAName={tabDocAName} docBName={tabDocBName} />
            </div>
          )}
        </div>
      )}

      {/* ── Single Review mode ───────────────────────────────────────── */}
      {pageMode === "single" && (
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* Left panel — input (only visible before analysis) */}
        {!result && (
          <div className="w-full lg:max-w-md border-b lg:border-b-0 lg:border-r flex flex-col overflow-y-auto p-5 gap-5 lg:shrink-0">
            {/* Recent Reviews */}
            <Collapsible data-tour="document-review-recent" open={savedOpen} onOpenChange={setSavedOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground py-1 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Recent Reviews
                    {savedReviews.length > 0 && (
                      <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                        {savedReviews.length}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", savedOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {savedLoading && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!savedLoading && savedReviews.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No saved reviews yet.</p>
                )}
                {!savedLoading && savedReviews.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {savedReviews.slice(0, 8).map((r) => (
                      <button
                        key={r.id}
                        className="w-full flex items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/50 transition-colors group"
                        onClick={async () => {
                          try {
                            const full = await getSavedDocumentReview(r.id, activeTenantId ?? undefined)
                            setResult(full.reviewJson)
                            setDocumentText(full.extractedText ?? "")
                            setEditText(full.extractedText ?? "")
                            toast({ title: `Loaded "${r.fileName}"` })
                          } catch {
                            toast({ title: "Failed to load review", variant: "destructive" })
                          }
                        }}
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">
                            {r.fileName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {r.client ? r.client.name + " · " : ""}
                            {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Mode toggle */}
            <div data-tour="document-review-input-mode" className="flex rounded-lg border p-0.5 bg-muted/30 gap-0.5">
              <button
                onClick={() => setInputMode("upload")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  inputMode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="w-4 h-4" /> Upload File
              </button>
              <button
                onClick={() => setInputMode("paste")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  inputMode === "paste" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Pencil className="w-4 h-4" /> Paste Text
              </button>
            </div>

            {/* Upload zone */}
            {inputMode === "upload" && (
              <div
                ref={dropRef}
                data-tour="document-review-upload"
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all",
                  dragging
                    ? "border-primary bg-primary/5"
                    : selectedFile
                      ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.md"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedFile ? (
                  <>
                    <FileText className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop your document here</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, TXT, JPG — up to 20 MB</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Paste zone */}
            {inputMode === "paste" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Paste document text</Label>
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste the full text of your contract, legal notice, agreement, or any legal document here…"
                  className="min-h-[200px] font-mono text-xs resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{pastedText.length.toLocaleString()} chars</p>
              </div>
            )}

            {/* Options */}
            <div className="space-y-3">
              <div data-tour="document-review-options" className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Document Type</Label>
                  <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentReviewDocumentType)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value} className="text-xs">
                          {dt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Jurisdiction</Label>
                  <Select value={countryCode} onValueChange={handleCountryChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} className="text-xs">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div data-tour="document-review-ai-model">
                <AiModelPicker />
              </div>
            </div>

            <Button
              className="w-full gap-2"
              data-tour="document-review-analyze"
              onClick={handleAnalyze}
              loading={loading}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Analysing…" : "Analyse Document"}
            </Button>

            {error && !isCreditError && (
              <div className="flex flex-col gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                {(error.toLowerCase().includes('scanned') || error.toLowerCase().includes('could not extract')) && (
                  <button
                    onClick={() => { setInputMode("paste"); setError(null) }}
                    className="ml-6 text-xs underline text-destructive/80 hover:text-destructive text-left"
                  >
                    Switch to &quot;Paste Text&quot; mode →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main content area */}
        <div className={cn("flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col", !result && "")}>
          {loading && (
            <div className="flex-1 overflow-y-auto p-5">
              <AnalysisProgress
                stage={stageIdx}
                stages={ANALYSIS_STAGES}
                title="Reviewing your document…"
              />
            </div>
          )}

          {result && (
            <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              {/* Document pane — hidden on mobile unless toggled; left 40% on desktop */}
              <div className={cn(
                "lg:w-[40%] lg:min-w-0 lg:border-r lg:flex lg:flex-col lg:overflow-hidden lg:shrink-0",
                mobileShowDoc
                  ? "flex flex-col border-b"
                  : "hidden lg:flex",
              )}>
                {/* Pane header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate text-foreground">
                      {selectedFile?.name ?? "Document"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editMode && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs px-3"
                        disabled={loading}
                        onClick={async () => {
                          setDocumentText(editText)
                          setEditMode(false)
                          setLoading(true)
                          setError(null)
                          setResult(null)
                          setStageIdx(0)
                          const interval = setInterval(advanceStage, 3500)
                          try {
                            const res = await runDocumentReview(
                              { extractedText: editText, documentType, countryCode, aiModelMode, premiumModelId },
                              activeTenantId ?? undefined,
                            )
                            setResult(res)
                            setDocumentText(res.extractedText ?? editText)
                            setEditText(res.extractedText ?? editText)
                          } catch (err: unknown) {
                            const isCredErr = isInsufficientCreditsError(err)
                            handleApiError(err, err instanceof Error ? err.message : "Review failed.")
                            setIsCreditError(isCredErr)
                            if (!isCredErr) {
                              const msg = err instanceof Error ? err.message : "Review failed."
                              setError(msg)
                              toast({ title: "Review failed", description: msg, variant: "destructive" })
                            }
                          } finally {
                            clearInterval(interval)
                            setLoading(false)
                          }
                        }}
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Re-analyse"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={editMode ? "secondary" : "ghost"}
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setEditMode(!editMode)
                        if (!editMode) setEditText(documentText)
                      }}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      {editMode ? "Cancel" : "Edit"}
                    </Button>
                  </div>
                </div>

                {/* Legend */}
                {!editMode && documentText && (
                  <div data-tour="document-review-highlights" className="flex items-center gap-3 px-4 py-1.5 border-b bg-background text-xs text-muted-foreground shrink-0 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700/60" />
                      Strength
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm bg-rose-200 dark:bg-rose-800/60" />
                      Weakness
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm bg-red-200 dark:bg-red-800/60" />
                      High risk
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-800/60" />
                      Flagged clause
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-800/60" />
                      Amendment needed
                    </span>
                    {appliedAmendments.size > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-green-200 dark:bg-green-800/60" />
                        Applied
                      </span>
                    )}
                  </div>
                )}

                {/* Document body */}
                <div ref={docPaneRef} className="flex-1 overflow-y-auto p-4 max-h-[45vh] lg:max-h-none">
                  {editMode ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full h-[calc(100vh-220px)] font-mono text-xs resize-none border rounded-lg p-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {editText.length.toLocaleString()} chars · {editText.trim().split(/\s+/).length.toLocaleString()} words
                      </p>
                    </div>
                  ) : documentText ? (
                    <p className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {buildAnnotatedSegments(documentText, result, appliedAmendments).map((seg, i) =>
                        seg.color ? (
                          <mark
                            key={i}
                            data-highlight-id={seg.id}
                            onClick={() => setActiveHighlight(seg.id ?? null)}
                            className={cn(
                              "rounded-sm cursor-pointer transition-all px-0.5 dark:text-white",
                              seg.color === "amber"
                                ? "bg-amber-200/70 dark:bg-amber-700/60 hover:bg-amber-300 dark:hover:bg-amber-600"
                                : seg.color === "emerald"
                                  ? "bg-emerald-200/60 dark:bg-emerald-700/50 hover:bg-emerald-300 dark:hover:bg-emerald-600"
                                  : seg.color === "emerald-strong"
                                    ? "bg-emerald-300/70 dark:bg-emerald-600/60 hover:bg-emerald-400 dark:hover:bg-emerald-500"
                                    : seg.color === "rose"
                                      ? "bg-rose-200/70 dark:bg-rose-700/60 hover:bg-rose-300 dark:hover:bg-rose-600"
                                      : seg.color === "red"
                                        ? "bg-red-200/70 dark:bg-red-700/60 hover:bg-red-300 dark:hover:bg-red-600"
                                        : seg.color === "green"
                                          ? "bg-green-200/80 dark:bg-green-700/60 hover:bg-green-300 dark:hover:bg-green-600 border-b-2 border-green-500 dark:border-green-400"
                                          : "bg-blue-200/70 dark:bg-blue-700/60 hover:bg-blue-300 dark:hover:bg-blue-600",
                              activeHighlight === seg.id && "ring-2 ring-offset-1 ring-primary",
                            )}
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        )
                      )}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Document text not available.<br />
                        <span className="text-xs">Use &quot;Paste Text&quot; mode to enable annotations.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis pane — right 60% on desktop, full width on mobile */}
              <div className="flex-1 lg:min-h-0 lg:overflow-y-auto p-4 lg:p-5">
                <div className="max-w-3xl space-y-4">
                  {/* Mobile: document toggle */}
                  {documentText && (
                    <button
                      onClick={() => setMobileShowDoc((v) => !v)}
                      className="lg:hidden w-full flex items-center justify-between rounded-lg border px-4 py-3 min-h-[44px] text-sm font-medium bg-card hover:bg-muted/30 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {mobileShowDoc ? "Hide document" : "View annotated document"}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", mobileShowDoc && "rotate-180")} />
                    </button>
                  )}

                  {/* Quick stat bar */}
                  <div data-tour="document-review-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card
                      className="text-center cursor-pointer hover:ring-2 hover:ring-emerald-400/60 dark:hover:ring-emerald-600/60 transition-all"
                      aria-label="Jump to strengths in document"
                      onClick={() => scrollToCategory("pro:", "proscons")}
                    >
                      <CardContent className="p-3">
                        <div className="text-2xl font-bold text-foreground">{result.pros.length}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Strengths</div>
                      </CardContent>
                    </Card>
                    <Card
                      className="text-center cursor-pointer hover:ring-2 hover:ring-rose-400/60 dark:hover:ring-rose-600/60 transition-all"
                      aria-label="Jump to weaknesses in document"
                      onClick={() => scrollToCategory("con:", "proscons")}
                    >
                      <CardContent className="p-3">
                        <div className="text-2xl font-bold text-foreground">{result.cons.length}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Weaknesses</div>
                      </CardContent>
                    </Card>
                    <Card
                      className="text-center cursor-pointer hover:ring-2 hover:ring-red-400/60 dark:hover:ring-red-600/60 transition-all"
                      aria-label="Jump to high risks in document"
                      onClick={() => scrollToCategory("risk:", "risks")}
                    >
                      <CardContent className="p-3">
                        <div className={cn("text-2xl font-bold", highRisks > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                          {highRisks}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">High Risks</div>
                      </CardContent>
                    </Card>
                    <Card
                      className="text-center cursor-pointer hover:ring-2 hover:ring-amber-400/60 dark:hover:ring-amber-600/60 transition-all"
                      aria-label="Jump to flagged clauses in document"
                      onClick={() => scrollToCategory("clause:", "clauses")}
                    >
                      <CardContent className="p-3">
                        <div className={cn("text-2xl font-bold", flaggedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                          {flaggedCount}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">Flagged Clauses</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Analysis coverage badge */}
                  {result.analysisCoverage && (
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 w-fit",
                      result.analysisCoverage.fullCoverage
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                    )}>
                      {result.analysisCoverage.fullCoverage
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      }
                      {result.analysisCoverage.chunkCount === 1
                        ? "Full document analyzed"
                        : result.analysisCoverage.fullCoverage
                          ? `Analyzed in ${result.analysisCoverage.chunkCount} sections — full document covered`
                          : `Analyzed first ${Math.round(result.analysisCoverage.analyzedChars / 1000)}k of ${Math.round(result.analysisCoverage.totalChars / 1000)}k chars — document is very long`
                      }
                    </div>
                  )}

                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList data-tour="document-review-tabs" className="w-full overflow-x-auto justify-start border-b rounded-none h-auto p-0 bg-transparent gap-1 mb-4 flex-nowrap">
                      {[
                        { value: "overview", label: "Overview" },
                        { value: "proscons", label: `Pros & Cons (${result.pros.length + result.cons.length})` },
                        { value: "risks", label: `Risks (${result.risks.length})` },
                        { value: "clauses", label: `Key Clauses (${result.keyClauses.length})` },
                        { value: "amendments", label: `Amendments (${result.amendments.length})` },
                      ].map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          {...(tab.value === "amendments" ? { "data-tour": "document-review-amendments" } : {})}
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-3 py-2 text-sm whitespace-nowrap shrink-0"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent value="overview"><OverviewTab result={result} amendments={result.amendments} onHighlight={scrollToHighlight} onApplyFix={applyFix} onUndoFix={undoFix} appliedAmendments={appliedAmendments} /></TabsContent>
                    <TabsContent value="proscons"><ProConsTab pros={result.pros} cons={result.cons} onHighlight={scrollToHighlight} /></TabsContent>
                    <TabsContent value="risks"><RisksTab risks={result.risks} onHighlight={scrollToHighlight} /></TabsContent>
                    <TabsContent value="clauses">
                      <ClausesTab clauses={result.keyClauses} onHighlight={scrollToHighlight} />
                    </TabsContent>
                    <TabsContent value="amendments">
                      <AmendmentsTab amendments={result.amendments} onHighlight={scrollToHighlight} onApplyFix={applyFix} onUndoFix={undoFix} appliedAmendments={appliedAmendments} />
                    </TabsContent>
                  </Tabs>

                  {/* Follow-up questions */}
                  {result.suggestedFollowUpQuestions && result.suggestedFollowUpQuestions.length > 0 && (
                    <Card className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          Suggested follow-up questions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {result.suggestedFollowUpQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => setFollowUp(q)}
                            className="text-xs bg-muted hover:bg-muted/70 text-foreground border rounded-full px-3 py-1.5 transition-colors text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Ask follow-up */}
                  <Card data-tour="document-review-followup">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Ask a follow-up question</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Textarea
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        placeholder="e.g. What are my obligations under clause 5? Is the termination clause enforceable?"
                        className="resize-none min-h-[60px] text-sm"
                      />
                      <Button
                        className="shrink-0 self-end"
                        disabled={!followUp.trim() || followUpLoading}
                        onClick={handleFollowUpAsk}
                      >
                        {followUpLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Ask"
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {followUpAnswer && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Follow-up research</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                          {followUpAnswer}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <p className="text-xs text-muted-foreground text-center pb-4">
                    AI-generated analysis — verify all findings with a qualified lawyer before acting on any advice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && !result && (
            <div data-tour="document-review-empty" className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSearch className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Upload a legal document to begin</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  The AI will extract text, identify parties and key clauses, score risk, and suggest amendments.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      )} {/* end pageMode === "single" */}
      {creditsGate}
    </div>
  )
}
