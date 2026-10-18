"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { formatUserDateTimeLong } from "@/lib/datetime/format-in-user-timezone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import { AnalysisChart, type AnalysisVisualization } from "./analysis-chart"
import { updateLeadContext, type CaseAnalysisRun } from "@/lib/api/marketplace"
import { Check, ChevronDown, ChevronUp, Copy, Crown, ExternalLink, Loader2, MessageSquarePlus, Save, Scale } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  ClauseOutlinePanel,
  DocumentOverviewPanel,
} from "@/components/matters/drafting-workspace-panels"

export interface LegalAnalysisViewProps {
  runType?: string
  runId?: string
  contentMarkdown?: string | null
  structuredOutput?: Record<string, unknown> | null
  citations?: unknown
  createdAt?: string
  jurisdictionLabel?: string
  compact?: boolean
  /** Lead this analysis belongs to — enables saving missing-field answers to the case file. */
  leadId?: string
  /** Existing firm-private context, used to merge in provided intake details. */
  lawyerContextMarkdown?: string | null
  /** Called after missing-field answers are saved to the lead context. */
  onContextSaved?: () => void
}

interface CitationRow {
  authorityId?: string
  citation?: string
  sourceName?: string
  sourceUrl?: string
  summary?: string
}

function parseVisualizations(raw: unknown): AnalysisVisualization[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw.filter(
    (v): v is AnalysisVisualization =>
      typeof v === "object" &&
      v !== null &&
      "type" in v &&
      "title" in v &&
      "data" in v,
  )
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === "string") return item
    if (item == null) return ""
    // Object shape: extract the most descriptive field
    if (typeof item === "object") {
      const obj = item as Record<string, unknown>
      const text =
        obj.title ??
        obj.action ??
        obj.step ??
        obj.text ??
        obj.description ??
        obj.content ??
        obj.label ??
        obj.item
      if (typeof text === "string" && text.trim()) {
        const detail =
          obj.description ??
          obj.action ??
          obj.rationale ??
          obj.notes
        return detail && typeof detail === "string" && detail !== text
          ? `${text}: ${detail}`
          : text
      }
      // Last resort: join all string values
      const values = Object.values(obj)
        .filter((v) => typeof v === "string" && v.trim())
        .join(" — ")
      return values || ""
    }
    return String(item)
  }).filter(Boolean)
}

function PathToVictoryCard({ steps, themes }: { steps: string[]; themes?: string[] }) {
  const tCommon = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const tMatters = useTranslations("matters")
  if (!steps.length && !themes?.length) return null
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-bold">{tCommon("path_to_victory")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {steps.length > 0 && (
          <ol className="list-decimal pl-5 text-sm space-y-1.5">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        {themes && themes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {themes.map((theme) => (
              <Badge key={theme} variant="secondary" className="text-xs">
                {theme}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExecutiveSummaryCard({ summary }: { summary?: string }) {
  const tCommon = useTranslations("lawyer")
  if (!summary?.trim()) return null
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-bold">{tCommon("executive_summary")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm">
        <LegalMarkdown content={summary} />
      </CardContent>
    </Card>
  )
}

function CitationLinks({ citations }: { citations: CitationRow[] }) {
  const tCommon = useTranslations("lawyer")
  if (!citations.length) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{tCommon("sources_used")}</p>
      <div className="flex flex-wrap gap-2">
        {citations.map((c, i) =>
          c.sourceUrl ? (
            <a
              key={c.authorityId ?? i}
              href={c.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {c.citation ?? c.sourceName ?? "Source"}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <Badge key={c.authorityId ?? i} variant="secondary" className="text-xs">
              {c.citation ?? c.sourceName}
            </Badge>
          ),
        )}
      </div>
    </div>
  )
}

function cleanStep(raw: string): string {
  return raw
    .replace(/^#{1,3}\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^[\d]+\.\s*/, "")
    .replace(/^[-–—]\s*/, "")
    .trim()
}

type StepKind = "yesno" | "multichoice" | "input" | "action"

function classifyStep(text: string): StepKind {
  const t = text.toLowerCase()
  if (/^(did|has|have|is|was|were|do|does|can|will|confirm|verify|check whether)\b/.test(t)) return "yesno"
  if (/\bone of\b|choose|select from|which of|either\b/.test(t)) return "multichoice"
  if (/\bprovide\b|\bstate\b|\bdescribe\b|\bexplain\b|\blist\b|\bdraft\b|\bspecify\b|\bnote\b|\brecord\b/.test(t)) return "input"
  return "action"
}

const STEP_KIND_META: Record<StepKind, { label: string; badge: string; badgeClass: string }> = {
  yesno:       { label: "Yes / No",   badge: "YES/NO",  badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  multichoice: { label: "Choose one", badge: "CHOOSE",  badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  input:       { label: "Answer",     badge: "ANSWER",  badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  action:      { label: "Action",     badge: "ACTION",  badgeClass: "bg-muted text-muted-foreground" },
}

interface StepItemState {
  done: boolean
  answer: string | boolean | null
  context: string
  contextOpen: boolean
}

function ActionableStepsCard({ steps, runId }: { steps: string[]; runId?: string }) {
  const tCommon = useTranslations("lawyer")
  const storageKey = `actionable-steps-v2-${runId ?? "default"}`
  const loadState = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, StepItemState>
    } catch { return {} }
  }
  const [itemState, setItemState] = useState<Record<string, StepItemState>>(loadState)

  const updateItem = (key: string, patch: Partial<StepItemState>) => {
    setItemState((prev) => {
      const existing: StepItemState = prev[key] ?? { done: false, answer: null, context: "", contextOpen: false }
      const next = { ...prev, [key]: { ...existing, ...patch } }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  if (!steps.length) return null

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-bold">{tCommon("recommended_next_steps")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {steps.map((step, i) => {
          const key = `step-${i}`
          const state: StepItemState = itemState[key] ?? { done: false, answer: null, context: "", contextOpen: false }
          const kind = classifyStep(step)
          const meta = STEP_KIND_META[kind]

          // Parse bold prefix e.g. "**Title:** description"
          const boldMatch = step.match(/^\*\*(.+?)\*\*[:\s]*(.*)/)
          const title = boldMatch ? boldMatch[1] : null
          const body = boldMatch ? boldMatch[2].trim() : step

          const isResolved =
            kind === "yesno"       ? state.answer !== null :
            kind === "multichoice" ? !!state.answer :
            kind === "input"       ? (typeof state.answer === "string" && state.answer.trim().length > 0) :
            state.done

          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border px-3 py-3 transition-all space-y-2",
                isResolved ? "bg-muted/30 border-border/50 opacity-70" : "bg-background",
              )}
            >
              {/* Header row */}
              <div className="flex items-start gap-2">
                <span className={cn(
                  "mt-0.5 shrink-0 text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-widest leading-tight",
                  meta.badgeClass,
                )}>
                  {meta.badge}
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  {title && <p className="text-sm font-semibold leading-tight">{title}</p>}
                  <p className={cn("text-sm leading-relaxed", isResolved && kind === "action" && "line-through text-muted-foreground")}>
                    {body}
                  </p>
                </div>
                {kind !== "yesno" && kind !== "multichoice" && (
                  <button
                    type="button"
                    onClick={() => updateItem(key, { contextOpen: !state.contextOpen })}
                    title={tCommon("add_context_or_notes")}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                  >
                    <MessageSquarePlus className={cn("h-4 w-4", state.contextOpen && "text-primary")} />
                  </button>
                )}
              </div>

              {/* Interaction area */}
              {kind === "yesno" && (
                <div className="flex gap-2 pl-1">
                  {(["Yes", "No"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateItem(key, { answer: opt === "Yes" })}
                      className={cn(
                        "rounded-full px-4 py-1 text-xs font-semibold border transition-all",
                        state.answer === (opt === "Yes")
                          ? opt === "Yes"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-destructive text-destructive-foreground border-destructive"
                          : "bg-background text-muted-foreground border-border hover:border-foreground/40",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                  {state.answer !== null && (
                    <button
                      type="button"
                      onClick={() => updateItem(key, { answer: null })}
                      className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {kind === "multichoice" && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {/* Extract options from text if present, else show generic buttons */}
                  {(step.match(/\b([A-Z][^,;]+(?:,|;|\bor\b)[^,;]+)/)?.[0]?.split(/,|;|\bor\b/).map(s => s.trim()).filter(Boolean) ?? ["Option A", "Option B", "Option C"]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateItem(key, { answer: opt })}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                        state.answer === opt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-foreground/40",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {kind === "input" && (
                <div className="pl-1">
                  <Textarea
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="Your answer…"
                    value={typeof state.answer === "string" ? state.answer : ""}
                    onChange={(e) => updateItem(key, { answer: e.target.value })}
                  />
                </div>
              )}

              {kind === "action" && (
                <div className="flex items-center gap-2 pl-1">
                  <Checkbox
                    checked={state.done}
                    onCheckedChange={(v) => updateItem(key, { done: !!v })}
                    id={`check-${key}`}
                  />
                  <label htmlFor={`check-${key}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                    Mark as done
                  </label>
                </div>
              )}

              {state.contextOpen && kind !== "yesno" && kind !== "multichoice" && (
                <div className="pl-1">
                  <Textarea
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="Add context, evidence, or instructions…"
                    value={state.context}
                    onChange={(e) => updateItem(key, { context: e.target.value })}
                  />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

interface SmartStep {
  type: "confirm" | "question" | "multiselect" | "gather_info" | "generate_section" | "open_draft"
  label: string
  detail?: string
  options?: string[]
  fieldId?: string
}

function SmartStepsCard({ steps }: { steps: SmartStep[] }) {
  if (!steps.length) return null
  return (
    <Card className="border-primary/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-bold">Smart next steps</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border px-3 py-2.5 bg-background space-y-1">
            <div className="flex items-start gap-2">
              <span className={cn(
                "mt-0.5 shrink-0 text-[10px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wide",
                step.type === "gather_info" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                step.type === "confirm" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                step.type === "generate_section" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                step.type === "open_draft" && "bg-primary/10 text-primary",
                !["gather_info","confirm","generate_section","open_draft"].includes(step.type) && "bg-muted text-muted-foreground",
              )}>
                {step.type.replace("_", " ")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{step.label}</p>
                {step.detail && <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

interface MissingField {
  field: string
  question: string
  options?: string[]
}

const PROVIDED_DETAILS_START = "<!-- PROVIDED_INTAKE_DETAILS_START -->"
const PROVIDED_DETAILS_END = "<!-- PROVIDED_INTAKE_DETAILS_END -->"

function formatFieldLabel(field: string): string {
  const spaced = field.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Merge provided answers into the lawyer context, replacing any prior block idempotently. */
function mergeProvidedDetails(
  existing: string | null | undefined,
  fields: MissingField[],
  answers: Record<string, string>,
): string {
  const base = (existing ?? "").replace(
    new RegExp(`${PROVIDED_DETAILS_START}[\\s\\S]*?${PROVIDED_DETAILS_END}\\n*`, "g"),
    "",
  ).trimEnd()

  const lines = fields
    .filter((f) => answers[f.field]?.trim())
    .map((f) => `- **${formatFieldLabel(f.field)}:** ${answers[f.field].trim()}`)

  if (lines.length === 0) return base

  const block = [
    PROVIDED_DETAILS_START,
    "**Provided details (from intake follow-up)**",
    "",
    ...lines,
    PROVIDED_DETAILS_END,
  ].join("\n")

  return base ? `${base}\n\n${block}` : block
}

/** Recover previously-saved answers from the lawyer context block so inputs repopulate. */
function parseProvidedDetails(
  existing: string | null | undefined,
  fields: MissingField[],
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!existing) return result
  const match = existing.match(
    new RegExp(`${PROVIDED_DETAILS_START}([\\s\\S]*?)${PROVIDED_DETAILS_END}`),
  )
  if (!match) return result
  const block = match[1]
  for (const f of fields) {
    const label = formatFieldLabel(f.field)
    const lineMatch = block.match(
      new RegExp(`-\\s*\\*\\*${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}:\\*\\*\\s*(.+)`),
    )
    if (lineMatch) result[f.field] = lineMatch[1].trim()
  }
  return result
}

function MissingFieldsCard({
  fields,
  leadId,
  lawyerContextMarkdown,
  onContextSaved,
  cardPadding,
}: {
  fields: MissingField[]
  leadId?: string
  lawyerContextMarkdown?: string | null
  onContextSaved?: () => void
  cardPadding: string
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    parseProvidedDetails(lawyerContextMarkdown, fields),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const editable = !!leadId
  const answeredCount = fields.filter((f) => answers[f.field]?.trim()).length

  const handleSave = async () => {
    if (!leadId) return
    setSaving(true)
    setError(null)
    try {
      const merged = mergeProvidedDetails(lawyerContextMarkdown, fields, answers)
      await updateLeadContext(leadId, merged)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast({ title: "Details saved to case file" })
      onContextSaved?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save details"
      setError(msg)
      toast({ title: "Save failed", description: msg, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className={cardPadding}>
        <CardTitle className="text-sm font-bold text-amber-700 dark:text-amber-400">
          Information still needed
        </CardTitle>
        {editable && (
          <p className="text-xs text-muted-foreground font-normal mt-0.5">
            Fill in what you know — it&apos;s saved to the case file and used when drafting.
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {fields.map((f, i) => {
          const label = formatFieldLabel(f.field)
          if (!editable) {
            return (
              <div key={i} className="text-sm">
                <span className="font-medium">{label}:</span>{" "}
                <span className="text-muted-foreground">{f.question}</span>
              </div>
            )
          }
          return (
            <div key={i} className="space-y-1.5">
              <Label htmlFor={`missing-${f.field}`} className="text-sm font-medium">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{f.question}</p>
              {f.options && f.options.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {f.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((p) => ({ ...p, [f.field]: opt }))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        answers[f.field] === opt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <Textarea
                  id={`missing-${f.field}`}
                  rows={2}
                  className="resize-none text-sm"
                  placeholder="Add the answer…"
                  value={answers[f.field] ?? ""}
                  onChange={(e) =>
                    setAnswers((p) => ({ ...p, [f.field]: e.target.value }))
                  }
                />
              )}
            </div>
          )
        })}

        {editable && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : saved ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saved ? "Saved to case file" : "Save details"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {answeredCount} of {fields.length} provided
            </span>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DraftingWorkspacePreview({
  structured,
  markdown,
  compact,
  leadId,
  lawyerContextMarkdown,
  onContextSaved,
}: {
  structured: Record<string, unknown>
  markdown?: string | null
  compact?: boolean
  leadId?: string
  lawyerContextMarkdown?: string | null
  onContextSaved?: () => void
}) {
  const documentType = typeof structured.documentType === "string" ? structured.documentType : undefined
  const documentTitle = typeof structured.documentTitle === "string" ? structured.documentTitle : undefined
  const situation = typeof structured.situation === "string" ? structured.situation : undefined
  const clauseOutline = Array.isArray(structured.clauseOutline)
    ? (structured.clauseOutline as { title: string; summary: string }[]).map(
        (c) => (typeof c === "string" ? c : `${c.title}${c.summary ? ` — ${c.summary}` : ""}`)
      )
    : []
  const missingFields = Array.isArray(structured.missingFields)
    ? (structured.missingFields as MissingField[])
    : []
  const smartNextSteps = Array.isArray(structured.smartNextSteps)
    ? (structured.smartNextSteps as SmartStep[])
    : []
  const sourcesCited = asStringArray(structured.sourcesCited)
  const cardPadding = compact ? "py-2" : "py-3"

  return (
    <div className="space-y-3">
      <DocumentOverviewPanel
        documentTitle={documentTitle}
        documentType={documentType}
        situation={situation}
      />
      <ClauseOutlinePanel clauses={clauseOutline} />

      {missingFields.length > 0 && (
        <MissingFieldsCard
          fields={missingFields}
          leadId={leadId}
          lawyerContextMarkdown={lawyerContextMarkdown}
          onContextSaved={onContextSaved}
          cardPadding={cardPadding}
        />
      )}

      {smartNextSteps.length > 0 && <SmartStepsCard steps={smartNextSteps} />}

      {clauseOutline.length === 0 && missingFields.length === 0 && markdown && (
        <LegalMarkdown content={markdown} />
      )}

      {sourcesCited.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium">Sources cited:</p>
          {sourcesCited.map((s, i) => <p key={i}>{s}</p>)}
        </div>
      )}
    </div>
  )
}

function IntakePreviewSections({
  structured,
  markdown,
  compact,
  runId,
  leadId,
  lawyerContextMarkdown,
  onContextSaved,
}: {
  structured?: Record<string, unknown> | null
  markdown?: string | null
  compact?: boolean
  runId?: string
  leadId?: string
  lawyerContextMarkdown?: string | null
  onContextSaved?: () => void
}) {
  // Detect drafting output by presence of `documentType` or `clauseOutline`
  if (structured && (structured.documentType || Array.isArray(structured.clauseOutline))) {
    return (
      <DraftingWorkspacePreview
        structured={structured}
        markdown={markdown}
        compact={compact}
        leadId={leadId}
        lawyerContextMarkdown={lawyerContextMarkdown}
        onContextSaved={onContextSaved}
      />
    )
  }

  const situation =
    typeof structured?.situation === "string" ? structured.situation : undefined
  const legalIssues = asStringArray(structured?.legalIssues)
  const strengths = asStringArray(structured?.strengths)
  const risks = asStringArray(structured?.risksAndGaps)
  const steps = asStringArray(structured?.recommendedNextSteps)
    .map(cleanStep)
    .filter((s) => s.length > 3 && !s.toLowerCase().startsWith("for-counsel") && !s.toLowerCase().startsWith("for counsel"))

  const infoSections = [
    { id: "situation", title: "Situation", body: situation, items: [] as string[] },
    { id: "issues", title: "Legal issues", body: "", items: legalIssues },
    { id: "strengths", title: "Strengths", body: "", items: strengths },
    { id: "risks", title: "Risks & gaps", body: "", items: risks },
  ].filter((s) => s.body || s.items.length)

  if (infoSections.length === 0 && steps.length === 0 && markdown) {
    return <LegalMarkdown content={markdown} />
  }

  const cardPadding = compact ? "py-2" : "py-3"

  return (
    <div className="space-y-2">
      {infoSections.map((section) => (
        <Card key={section.id}>
          <CardHeader className={cardPadding}>
            <CardTitle className="text-sm font-bold">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {section.body ? (
              <LegalMarkdown content={section.body} />
            ) : (
              <ul className="list-disc pl-5 text-sm space-y-1">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
      {steps.length > 0 && <ActionableStepsCard steps={steps} runId={runId} />}
    </div>
  )
}

interface CaseLawEntry {
  authorityId?: string
  title?: string
  citation?: string
  citationFormats?: { primary?: string; alternative?: string }
  court?: string
  year?: string
  judges?: string[]
  bindingWeight?: string
  sourceUrl?: string
  summary?: string
  outcome?: string
  favoredSide?: string
  relevance?: string
  keyQuote?: string
  winningArguments?: string[]
  lessonForClient?: string
  excerpt?: string
}

function LegallyBindingBadge({ isLegallyBinding }: { isLegallyBinding?: boolean }) {
  if (isLegallyBinding == null) return null
  const cls = isLegallyBinding
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300"
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold shrink-0", cls)}>
      {isLegallyBinding ? "Legally binding" : "Not legally binding"}
    </Badge>
  )
}

function BindingWeightBadge({ weight }: { weight?: string }) {
  if (!weight) return null
  const w = weight.toLowerCase()
  const cls =
    w === "binding"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300"
      : w === "persuasive"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>
      {weight.toUpperCase()}
    </span>
  )
}

function FavoredSideBadge({ side }: { side?: string }) {
  if (!side) return null
  const s = side.toLowerCase()
  const cls =
    s === "plaintiff"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : s === "defendant"
        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {side}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const tCommon = useTranslations("lawyer")
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title={tCommon("copy_citation")}
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
    >
      <Copy className="h-3 w-3" />
      {copied && <span className="text-xs ml-1 text-primary">{tCommon("copied")}</span>}
    </button>
  )
}

function CaseLawCard({ c, index }: { c: CaseLawEntry; index: number }) {
  const tAdmin = useTranslations("lawyer")
  const tCommon = useTranslations("lawyer")
  const title = c.title ?? `Case ${index + 1}`
  const primaryCitation = c.citationFormats?.primary ?? c.citation
  const altCitation = c.citationFormats?.alternative
  const judges = Array.isArray(c.judges) ? c.judges.filter(Boolean) : []
  const winningArgs = Array.isArray(c.winningArguments) ? c.winningArguments.filter(Boolean) : []

  const sourceName = c.court ?? (c.sourceUrl ? "View judgment" : null)

  return (
    <Card className="overflow-hidden">
      {/* Header band */}
      <div className="px-4 py-3 bg-muted/30 border-b flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <BindingWeightBadge weight={c.bindingWeight} />
          {(c.court || c.year) && (
            <span className="text-xs text-muted-foreground">
              {[c.court, c.year].filter(Boolean).join(" · ")}
            </span>
          )}
          <FavoredSideBadge side={c.favoredSide} />
        </div>
        {c.sourceUrl && sourceName && (
          <a
            href={c.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
              {sourceName}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <CardContent className="pt-3 pb-4 space-y-3 text-sm">
        {/* Title */}
        <h3 className="font-semibold text-base leading-snug">{title}</h3>

        {/* Citations */}
        {(primaryCitation || altCitation) && (
          <div className="font-mono text-xs text-muted-foreground space-y-0.5">
            {primaryCitation && (
              <div className="flex items-center gap-1">
                <span>{primaryCitation}</span>
                <CopyButton text={primaryCitation} />
              </div>
            )}
            {altCitation && altCitation !== primaryCitation && (
              <div className="flex items-center gap-1 opacity-75">
                <span>{altCitation}</span>
                <CopyButton text={altCitation} />
              </div>
            )}
          </div>
        )}

        {/* Bench */}
        {judges.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="leading-relaxed">{judges.join(" · ")}</span>
          </div>
        )}

        {/* Key quote */}
        {c.keyQuote && (
          <blockquote className="border-l-4 border-primary/40 pl-3 italic text-muted-foreground leading-relaxed">
            ❝ {c.keyQuote} ❞
          </blockquote>
        )}

        {/* Summary */}
        {c.summary && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{tAdmin("summary")}</p>
            <p className="leading-relaxed">{c.summary}</p>
          </div>
        )}

        {/* Relevance */}
        {c.relevance && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{tCommon("why_this_matters")}</p>
            <p className="leading-relaxed">{c.relevance}</p>
          </div>
        )}

        {/* Winning arguments */}
        {winningArgs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{tCommon("how_it_was_won")}</p>
            <ul className="list-disc pl-5 space-y-1">
              {winningArgs.map((arg, i) => (
                <li key={i}>{arg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Outcome */}
        {c.outcome && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{tCommon("outcome")}</span>
            <Badge variant="outline" className="text-xs">{c.outcome}</Badge>
          </div>
        )}

        {/* Lesson for client */}
        {c.lessonForClient && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
            <p className="text-xs font-semibold mb-1">{tCommon("lesson_for_our_client")}</p>
            <p className="text-muted-foreground leading-relaxed">{c.lessonForClient}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SimilarCasesView({
  structured,
  citations,
}: {
  structured: Record<string, unknown>
  citations: CitationRow[]
}) {
  const tCommon = useTranslations("lawyer")
  const tMatters = useTranslations("lawyer")
  const cases = Array.isArray(structured.cases)
    ? (structured.cases as CaseLawEntry[])
    : []
  const caseSummary = structured.caseSummary as Record<string, unknown> | undefined

  return (
    <div className="space-y-3">
      {caseSummary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span>{tCommon("case_brief_phase_1_summary")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {typeof caseSummary.summaryMarkdown === "string" && caseSummary.summaryMarkdown.length > 0 ? (
              <p className="text-sm text-muted-foreground">{caseSummary.summaryMarkdown}</p>
            ) : null}
            {typeof caseSummary.practiceArea === "string" && caseSummary.practiceArea.length > 0 ? (
              <p className="text-xs text-muted-foreground">{tMatters("practice_area")}<span className="font-medium text-foreground">{caseSummary.practiceArea}</span>
                {typeof caseSummary.proceduralPosture === "string" && caseSummary.proceduralPosture.length > 0
                  ? ` · ${caseSummary.proceduralPosture}`
                  : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
      <ExecutiveSummaryCard summary={structured.executiveSummary as string | undefined} />
      <PathToVictoryCard
        steps={asStringArray(structured.pathToVictory)}
        themes={asStringArray(structured.winThemes)}
      />
      {cases.map((c, i) => (
        <CaseLawCard key={c.authorityId ?? i} c={c} index={i} />
      ))}
      <CitationLinks citations={citations} />
    </div>
  )
}

function OpponentView({
  structured,
  citations,
}: {
  structured: Record<string, unknown>
  citations: CitationRow[]
}) {
  const tCommon = useTranslations("lawyer")
  const rawClaims = structured.opponentClaims
  const claims = Array.isArray(rawClaims)
    ? rawClaims.map((item) => {
        if (typeof item === "string") {
          return { claim: item, counter: "", evidenceNeeded: [] as string[], likelihood: 50, impact: 50 }
        }
        const row = item as Record<string, unknown>
        return {
          claim: String(row.claim ?? ""),
          counter: String(row.counter ?? ""),
          evidenceNeeded: asStringArray(row.evidenceNeeded),
          likelihood: Number(row.likelihood ?? 50),
          impact: Number(row.impact ?? 50),
        }
      })
    : []

  const weaknesses = Array.isArray(structured.weaknesses)
    ? (structured.weaknesses as unknown[]).map((w) => {
        if (typeof w === "string") return { weakness: w, mitigation: "" }
        const row = w as Record<string, unknown>
        return {
          weakness: String(row.weakness ?? ""),
          mitigation: String(row.mitigation ?? ""),
        }
      })
    : []

  return (
    <div className="space-y-3">
      <ExecutiveSummaryCard summary={structured.executiveSummary as string | undefined} />
      <PathToVictoryCard steps={asStringArray(structured.pathToVictory)} />
      {claims.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{tCommon("claim_vs_counter")}</p>
          {claims.map((claim, i) => (
            <Card key={i}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{claim.claim}</CardTitle>
                  <Badge variant="outline">
                    L{claim.likelihood} / I{claim.impact}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm space-y-2">
                {claim.counter && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{tCommon("counter")}</p>
                    <p>{claim.counter}</p>
                  </div>
                )}
                {claim.evidenceNeeded.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{tCommon("evidence_needed")}</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {claim.evidenceNeeded.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {weaknesses.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {weaknesses.map((w, i) => (
            <Card key={i}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-destructive">{w.weakness}</CardTitle>
              </CardHeader>
              {w.mitigation && (
                <CardContent className="pt-0 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">{tCommon("mitigation")}</p>
                  <p>{w.mitigation}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      <CitationLinks citations={citations} />
    </div>
  )
}

function StrategyView({
  structured,
  citations,
}: {
  structured: Record<string, unknown>
  citations: CitationRow[]
}) {
  const tCommon = useTranslations("lawyer")
  const options = Array.isArray(structured.options)
    ? (structured.options as Record<string, unknown>[])
    : []
  const adrPathways = Array.isArray(structured.adrPathways)
    ? (structured.adrPathways as Record<string, unknown>[])
    : []
  const deadlines = Array.isArray(structured.deadlines)
    ? (structured.deadlines as Record<string, unknown>[])
    : []
  const evidence = Array.isArray(structured.evidenceToGather)
    ? (structured.evidenceToGather as Record<string, unknown>[])
    : []

  return (
    <div className="space-y-3">
      <ExecutiveSummaryCard summary={structured.executiveSummary as string | undefined} />
      {structured.shortAnswer != null && String(structured.shortAnswer).trim() !== "" && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{tCommon("short_answer")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm">{String(structured.shortAnswer)}</CardContent>
        </Card>
      )}
      {structured.recommendedPath != null && String(structured.recommendedPath).trim() !== "" && (
        <Card className="border-primary/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{tCommon("recommended_path")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm">{String(structured.recommendedPath)}</CardContent>
        </Card>
      )}
      <PathToVictoryCard steps={asStringArray(structured.pathToVictory)} />
      {adrPathways.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{tCommon("adr_pathways")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {adrPathways.map((pathway, i) => (
              <div
                key={i}
                className="flex flex-wrap items-start gap-2 rounded-md border p-3 text-sm"
              >
                <span className="font-medium capitalize">
                  {String(pathway.mechanism ?? "Pathway").replace(/_/g, " ")}
                </span>
                <LegallyBindingBadge
                  isLegallyBinding={
                    typeof pathway.isLegallyBinding === "boolean"
                      ? pathway.isLegallyBinding
                      : undefined
                  }
                />
                {pathway.applicable === false && (
                  <Badge variant="secondary" className="text-xs">
                    Not applicable
                  </Badge>
                )}
                {pathway.rationale != null && String(pathway.rationale).trim() !== "" && (
                  <p className="w-full text-muted-foreground">{String(pathway.rationale)}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {options.map((opt, i) => (
        <Card key={i}>
          <CardHeader className="py-3 flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">
              {String(opt.label ?? opt.title ?? `Option ${i + 1}`)}
              {opt.title ? `: ${String(opt.title)}` : ""}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <LegallyBindingBadge
                isLegallyBinding={
                  typeof opt.isLegallyBinding === "boolean" ? opt.isLegallyBinding : undefined
                }
              />
              {opt.feasibilityScore != null && (
                <Badge>{String(opt.feasibilityScore)}% feasible</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-sm space-y-2">
            {opt.description != null && <p>{String(opt.description)}</p>}
            {Array.isArray(opt.steps) && (opt.steps as unknown[]).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{tCommon("steps")}</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  {(opt.steps as unknown[]).map((s) => (
                    <li key={String(s)}>{String(s)}</li>
                  ))}
                </ol>
              </div>
            )}
            {Array.isArray(opt.risks) && (opt.risks as unknown[]).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{tCommon("risks")}</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {(opt.risks as unknown[]).map((r) => (
                    <li key={String(r)}>{String(r)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {deadlines.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{tCommon("deadlines")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm">
              {deadlines.map((d, i) => (
                <li key={i} className="flex gap-2">
                  <Badge variant="outline" className="shrink-0">
                    {String(d.dateHint ?? "TBD")}
                  </Badge>
                  <span>
                    <span className="font-medium">{String(d.label ?? "")}</span>
                    {d.action != null && `: ${String(d.action)}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {evidence.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{tCommon("evidence_to_gather")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm">
              {evidence.map((e, i) => (
                <li key={i} className="flex gap-2 items-start">
                  {e.priority != null && (
                    <Badge
                      variant={
                        e.priority === "high"
                          ? "destructive"
                          : e.priority === "medium"
                            ? "default"
                            : "secondary"
                      }
                      className="shrink-0 text-xs"
                    >
                      {String(e.priority)}
                    </Badge>
                  )}
                  <span>
                    <span className="font-medium">{String(e.item ?? "")}</span>
                    {e.why != null && (
                      <span className="text-muted-foreground"> — {String(e.why)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <CitationLinks citations={citations} />
    </div>
  )
}

export function LegalAnalysisView({
  runType,
  runId,
  contentMarkdown,
  structuredOutput,
  citations,
  createdAt,
  jurisdictionLabel,
  compact = false,
  leadId,
  lawyerContextMarkdown,
  onContextSaved,
}: LegalAnalysisViewProps) {
  const [showFullMemo, setShowFullMemo] = useState(false)
  const structured = structuredOutput ?? {}
  const visualizations = parseVisualizations(structured.visualizations)

  const citationList: CitationRow[] = Array.isArray(citations)
    ? (citations as CitationRow[])
    : []

  return (
    <div className="space-y-4">
      {(jurisdictionLabel || createdAt) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {jurisdictionLabel && <Badge variant="outline">{jurisdictionLabel}</Badge>}
          {createdAt && <span>Ran {formatUserDateTimeLong(createdAt)}</span>}
          {runType && <Badge variant="secondary">{runType.replace(/_/g, " ")}</Badge>}
          {citationList.length > 0 && (
            <span>{citationList.length} source{citationList.length === 1 ? "" : "s"}</span>
          )}
        </div>
      )}

      {runType === "PREVIEW" || !runType ? (
        <IntakePreviewSections
          structured={structured}
          markdown={contentMarkdown}
          compact={compact}
          runId={runId ?? createdAt}
          leadId={leadId}
          lawyerContextMarkdown={lawyerContextMarkdown}
          onContextSaved={onContextSaved}
        />
      ) : runType === "SIMILAR_CASES" ? (
        <SimilarCasesView structured={structured} citations={citationList} />
      ) : runType === "OPPONENT" ? (
        <OpponentView structured={structured} citations={citationList} />
      ) : runType === "STRATEGY" ? (
        <StrategyView structured={structured} citations={citationList} />
      ) : null}

      {visualizations.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {visualizations.map((viz) => (
            <AnalysisChart key={viz.title} viz={viz} />
          ))}
        </div>
      )}

      {contentMarkdown && !compact && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2"
            onClick={() => setShowFullMemo((v) => !v)}
          >
            {showFullMemo ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" /> Hide full memo
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" /> Show full memo
              </>
            )}
          </Button>
          {showFullMemo && <LegalMarkdown content={contentMarkdown} />}
        </div>
      )}

      {contentMarkdown && compact && !structured?.situation && (
        <LegalMarkdown content={contentMarkdown} />
      )}
    </div>
  )
}

export function AnalysisRunCard({
  run,
  jurisdictionLabel,
}: {
  run: CaseAnalysisRun
  jurisdictionLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const pathSteps = asStringArray(
    (run.structuredOutput as Record<string, unknown> | null)?.pathToVictory,
  )

  return (
    <Card>
      <CardHeader className="py-3 flex-row items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-bold">{run.runType.replace(/_/g, " ")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatUserDateTimeLong(run.createdAt)}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
            <Crown className="h-3 w-3" />
            Premium analysis
          </p>
          {!open && pathSteps.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Win path: {pathSteps[0]}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse" : "Expand"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <LegalAnalysisView
            runType={run.runType}
            contentMarkdown={run.contentMarkdown}
            structuredOutput={run.structuredOutput}
            citations={run.citations}
            createdAt={run.createdAt}
            jurisdictionLabel={jurisdictionLabel}
          />
        </CardContent>
      )}
    </Card>
  )
}

/** Best available win-path from analysis history (Strategy preferred, then any run). */
export function pickBestPathToVictory(
  runs: CaseAnalysisRun[],
): { steps: string[]; source: string } | null {
  const deep = runs.filter((r) =>
    ["STRATEGY", "SIMILAR_CASES", "OPPONENT"].includes(r.runType),
  )
  const strategy = deep.find((r) => r.runType === "STRATEGY")
  const ordered = strategy ? [strategy, ...deep.filter((r) => r !== strategy)] : deep
  for (const run of ordered) {
    const steps = asStringArray(
      (run.structuredOutput as Record<string, unknown> | null)?.pathToVictory,
    )
    if (steps.length) {
      return { steps, source: run.runType.replace(/_/g, " ") }
    }
  }
  return null
}
