"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  FileText,
  Loader2,
  Sparkles,
  Library,
  ArrowRight,
  Wand2,
  Upload,
  Info,
  MapPin,
  Scale,
  FileQuestion,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { extractDraftFieldHints, resolveDraftFieldHintContext } from "@/lib/india-drafting/extract-field-hints"
import {
  analyzeDraftIntent,
  resolveDraftIntent,
  defaultDraftBundleKinds,
  hasBlockingClarification,
  hasAnswer,
  type ClarifyingQuestion,
  type DraftAnalyzeResult,
  type DraftContext,
  type DraftIntentMatch,
  type DraftIntentCuratedDraftMatch,
  type DraftRouteDecision,
  type UnmappedExplicitPhrase,
} from "@/lib/api/draft-intent"
import type { ClarifyingQuestion as MatterClarifyingQuestion } from "@/lib/matter-intelligence"
import { appendReturnTo, buildDraftSetNavUrl, getDraftSet, initDraftSet, saveDraftSetPartyContext, saveDraftSetCaseDetails, DOCUMENT_DRAFTING_HREF, resolveBundleResearchMemoKind, remapDraftUrlKind } from "@/lib/drafting/draft-navigation"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { CreditErrorBanner } from "@/components/credits/CreditErrorBanner"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import { cn } from "@/lib/utils"
import { PromptLibraryModal } from "@/components/task-patterns/prompt-library-modal"
import { BilingualLanguagePicker } from "@/components/language/bilingual-language-picker"
import { buildSupplementalFromActionNotes } from "@/lib/drafting/action-context-prompts"
import { fetchLegalFormsPaginated, searchLegalFormsByIntent, type JurisdictionForm } from "@/lib/api/legal-forms"
import { legalFormDraftLink } from "@/lib/legal-forms/draft-links"
import {
  DEFAULT_KNOWLEDGE_SOURCES,
  KnowledgeSourcePicker,
  serializeKnowledgeSourcesParam,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import { usePromptRefinement } from "@/lib/hooks/use-prompt-refinement"
import { ActionContextRefineBlock } from "@/components/legal-forms/ActionContextRefineBlock"
import { DraftWizardSteps } from "@/components/legal-forms/draft-wizard-steps"
import { MatchCard } from "@/components/legal-forms/match-card"
import { RecommendedDocumentsList } from "@/components/legal-forms/recommended-documents-list"
import { Progress } from "@/components/ui/progress"
import {
  compactDraftingRequest,
  DRAFT_INTENT_MAX_LENGTH,
} from "@/lib/drafting/compact-drafting-request"

type PanelStep = "input" | "context_review" | "results"
type DraftEntryMode = "matter" | "specific_form"

const SEARCH_PHRASES = [
  "Scanning legal database…",
  "Cross-referencing case facts…",
  "Matching applicable statutes…",
  "Analysing jurisdiction & forum…",
  "Reviewing relevant precedents…",
  "Identifying document types…",
  "Ranking best-fit forms…",
  "Preparing recommendations…",
]

interface DraftIntentPanelProps {
  countryCode?: string
  jurisdiction?: string
  onJurisdictionInferred?: (code: string) => void
  onStepChange?: (step: PanelStep) => void
  className?: string
  returnToHref?: string
  rewriteDraftUrl?: (url: string) => string
}

function humanizeSlug(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function documentKindLabel(kind?: string) {
  return kind ? humanizeSlug(kind) : undefined
}

function matchDocumentKindLabel(match: DraftIntentMatch) {
  if (match.type === "curated_draft") return match.label
  if (match.type === "generate") {
    return documentKindLabel(match.documentKind) ?? documentKindLabel(match.suggestedKind)
  }
  if ("documentKind" in match && typeof match.documentKind === "string") {
    return documentKindLabel(match.documentKind)
  }
  return undefined
}

function matchIcon(type: DraftIntentMatch["type"]) {
  switch (type) {
    case "official_form": return FileText
    case "curated_draft": return Sparkles
    case "template": return Library
    case "import_edit": return Upload
    default: return Wand2
  }
}

function matchActionLabel(match: DraftIntentMatch): string {
  switch (match.type) {
    case "official_form": return "Draft form"
    case "template": return "Use template"
    case "import_edit": return "Upload & edit"
    default: return "Draft with AI"
  }
}

function matchHref(match: DraftIntentMatch): string {
  if (match.type === "template") return match.useUrl
  if (
    match.type === "official_form" ||
    match.type === "curated_draft" ||
    match.type === "generate" ||
    match.type === "import_edit"
  ) {
    return match.draftUrl
  }
  return "/app/legal-forms"
}

function getBundleMatches(matches: DraftIntentMatch[]): DraftIntentCuratedDraftMatch[] {
  return matches
    .filter(
      (m): m is DraftIntentCuratedDraftMatch =>
        m.type === "curated_draft" && Boolean(m.bundleRecommended),
    )
    .sort((a, b) => (a.bundleOrder ?? 0) - (b.bundleOrder ?? 0))
}

function getPrimaryBundleMatches(matches: DraftIntentMatch[]): DraftIntentCuratedDraftMatch[] {
  return getBundleMatches(matches).filter(
    (match) =>
      match.bundleRole !== "opposing_party" &&
      match.filingRole !== "opposing_party" &&
      match.filingRole !== "optional_supporting" &&
      match.filingRole !== "unrelated",
  )
}

function getOpposingPartyBundleMatches(matches: DraftIntentMatch[]): DraftIntentCuratedDraftMatch[] {
  return getBundleMatches(matches).filter(
    (match) => match.bundleRole === "opposing_party" || match.filingRole === "opposing_party",
  )
}

function BundleMatchList({
  matches,
  selectedBundleKinds,
  toggleBundleKind,
  tMi,
}: {
  matches: DraftIntentCuratedDraftMatch[]
  selectedBundleKinds: Set<string>
  toggleBundleKind: (kind: string, checked: boolean) => void
  tMi: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <label
          key={match.kind}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border bg-background/80 p-3 transition-colors",
            selectedBundleKinds.has(match.kind) ? "border-primary/50" : "border-border",
          )}
        >
          <Checkbox
            checked={selectedBundleKinds.has(match.kind)}
            onCheckedChange={(checked) => toggleBundleKind(match.kind, checked === true)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium leading-snug">{match.label}</p>
              {match.provisional ? (
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800 dark:text-amber-300">
                  {tMi("provisionalMatch")}
                </Badge>
              ) : null}
            </div>
            {match.reason ? (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">{match.reason}</p>
            ) : null}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{tMi("aiDraft")}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {tMi("matchPercent", { percent: Math.round(match.confidence * 100) })}
              </span>
            </div>
          </div>
        </label>
      ))}
    </div>
  )
}

function UnmappedExplicitBlock({
  items,
  onPickSuggestion,
  tMi,
}: {
  items: UnmappedExplicitPhrase[]
  onPickSuggestion: (kind: string, label: string) => void
  tMi: (key: string, values?: Record<string, string | number>) => string
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-3 dark:border-amber-800 dark:bg-amber-950/20">
      <div>
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">{tMi("unmappedRequestedDocs")}</p>
        <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">{tMi("unmappedRequestedDocsHint")}</p>
      </div>
      {items.map((item) => (
        <div key={item.phrase} className="space-y-2">
          <p className="text-sm font-medium leading-snug text-foreground">{item.phrase}</p>
          {item.suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.suggestions.map((s) => (
                <Button
                  key={s.kind}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onPickSuggestion(s.kind, s.label)}
                >
                  {tMi("pickAlternative")}: {s.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function forumLabel(forum?: string): string | undefined {
  if (!forum) return undefined
  return forum.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const COURT_LABELS: Record<string, string> = {
  family_court: "Family Court",
  magistrate: "Magistrate Court",
  high_court: "High Court",
  district_court: "District Court",
  sessions_court: "Sessions Court",
}

const STATUTE_LABELS: Record<string, string> = {
  hma_24: "HMA §24",
  bnss_144: "BNSS §144 / CrPC §125",
  dv_act: "Domestic Violence Act",
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  interim: "Interim Order",
  final: "Final Order",
}

const STATE_NAMES: Record<string, string> = {
  GJ: "Gujarat", MH: "Maharashtra", KA: "Karnataka", TN: "Tamil Nadu",
  TS: "Telangana", WB: "West Bengal", RJ: "Rajasthan", UP: "Uttar Pradesh",
  DL: "Delhi", CH: "Chandigarh", KL: "Kerala", PB: "Punjab",
  BR: "Bihar", MP: "Madhya Pradesh", OD: "Odisha", UK: "Uttarakhand",
}

/** Parse a user query as a regex if it's wrapped in /…/ — else treat as plain text. */
function parseSearchPattern(raw: string): { isRegex: boolean; pattern: string; flags: string } {
  const m = raw.match(/^\/(.+)\/([gimsuy]*)$/)
  if (m) return { isRegex: true, pattern: m[1], flags: m[2] || "i" }
  return { isRegex: false, pattern: raw, flags: "i" }
}

/** Client-side filter + relevance ranking — always applied on top of server results.
 *  For plain text: scores each form and returns them ranked (phrase match > all words > any word).
 *  For /regex/: applies the regex pattern directly.
 *  Forms with score 0 are excluded.
 */
function filterAndRankForms(forms: JurisdictionForm[], raw: string): JurisdictionForm[] {
  if (!raw.trim()) return forms
  const { isRegex, pattern, flags } = parseSearchPattern(raw)
  try {
    if (isRegex) {
      const re = new RegExp(pattern, flags)
      return forms.filter(
        (f) =>
          re.test(f.formName) ||
          re.test(f.authority) ||
          re.test(f.description ?? "") ||
          re.test(f.category ?? "") ||
          re.test(f.practiceArea) ||
          re.test(STATE_NAMES[f.jurisdiction ?? ""] ?? f.jurisdiction ?? ""),
      )
    }
    const query = pattern.toLowerCase().trim()
    const words = query.split(/\s+/).filter(Boolean)

    const scored = forms.map((f) => {
      const nameLower = f.formName.toLowerCase()
      // Resolve the human-readable state name (e.g. "BR" → "Bihar")
      const stateName = (STATE_NAMES[f.jurisdiction ?? ""] ?? f.jurisdiction ?? "").toLowerCase()
      const fullHaystack = [
        f.formName,
        f.authority,
        f.description ?? "",
        f.category ?? "",
        f.practiceArea,
        f.formNumber ?? "",
        f.jurisdiction ?? "",
        stateName,
      ]
        .join(" ")
        .toLowerCase()

      let score = 0
      // Exact full phrase in form name — strongest signal
      if (nameLower.includes(query)) score += 30
      // Full phrase match elsewhere (description, authority, etc.)
      else if (fullHaystack.includes(query)) score += 15
      // Each individual word: score separately to reward full matches
      let allWordsInName = true
      let allWordsAnywhere = true
      for (const w of words) {
        if (nameLower.includes(w)) {
          score += 5
        } else if (fullHaystack.includes(w)) {
          score += 2
          allWordsInName = false
        } else {
          allWordsInName = false
          allWordsAnywhere = false
        }
      }
      // Bonus: every searched word appears somewhere (strong relevance signal)
      if (allWordsAnywhere && words.length > 1) score += 5
      // Bonus: every searched word appears in the name (very high confidence)
      if (allWordsInName && words.length > 1) score += 10
      return { form: f, score }
    })

    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ form }) => form)
  } catch {
    return forms
  }
}

/** @deprecated use filterAndRankForms — kept for Quick Search compat */
const regexFilterForms = filterAndRankForms

function ContextChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-xs font-medium">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      {label}
    </span>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-rose-500"
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

function FilingRouteStatusCard({ route }: { route: DraftRouteDecision }) {
  const blockers = route.blockingIssues
  const confidence = route.confidence === "high" ? 0.95 : route.confidence === "medium" ? 0.7 : 0.4
  return (
    <section
      className={cn(
        "space-y-3 rounded-xl border p-4",
        blockers.length > 0
          ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20"
          : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
      )}
      aria-label="Resolved filing route"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Resolved filing route
          </p>
          <h3 className="mt-0.5 text-sm font-semibold">{route.primaryDocumentLabel}</h3>
        </div>
        <ConfidenceBar confidence={confidence} />
      </div>
      {route.reasons.length > 0 && (
        <div>
          <p className="text-xs font-medium">Why this route is maintainable</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {route.reasons.join(" ")}
          </p>
        </div>
      )}
      {route.forum && (
        <div className="flex items-start gap-2">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div>
            {route.forum && <p className="text-xs font-medium">{forumLabel(route.forum)}</p>}
            {route.territorialBasis.length > 0 && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {route.territorialBasis.join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}
      {blockers.length > 0 && (
        <div className="space-y-1.5" role="alert">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Drafting is blocked until these facts are confirmed
          </p>
          <ul className="space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">
            {blockers.map((blocker) => (
              <li key={blocker.id} className="list-disc">
                {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {route.mandatoryPreFilingSteps.length > 0 && (
        <div>
          <p className="text-xs font-medium">Mandatory pre-filing steps</p>
          <ul className="mt-1 space-y-1 pl-5 text-xs text-muted-foreground">
            {route.mandatoryPreFilingSteps.map((step) => (
              <li key={step} className="list-disc">{step}</li>
            ))}
          </ul>
        </div>
      )}
      {(route.nonBlockingBlanks?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium">Non-blocking blanks</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            These particulars can remain clearly marked blanks in the draft.
          </p>
          <ul className="mt-1 space-y-1 pl-5 text-xs text-muted-foreground">
            {route.nonBlockingBlanks?.map((blank) => (
              <li key={blank} className="list-disc">{blank}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function MatterClarifyingQuestionBlock({
  question,
  value,
  onChange,
}: {
  question: MatterClarifyingQuestion
  value?: string
  onChange: (value: string) => void
}) {
  const options = question.options ?? []
  if (options.length === 0) return null
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-medium">{question.text}</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              value === opt ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <input
              type="radio"
              name={question.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="mt-0.5 shrink-0 accent-primary"
            />
            <p className="text-sm font-medium leading-snug">{opt}</p>
          </label>
        ))}
      </div>
    </div>
  )
}

export function DraftIntentPanel({
  countryCode,
  jurisdiction,
  onJurisdictionInferred,
  onStepChange,
  className,
  returnToHref = DOCUMENT_DRAFTING_HREF,
  rewriteDraftUrl,
}: DraftIntentPanelProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations("drafting")
  const tMi = useTranslations("matterIntelligence")
  const tPromptRefine = useTranslations("promptRefine")
  const { activeTenantId } = useTenant()
  const { setContext } = useCopilotContext()

  const resolveDraftHref = (url: string) => {
    const withReturn = appendReturnTo(url, returnToHref)
    const rewritten = rewriteDraftUrl ? rewriteDraftUrl(withReturn) : withReturn
    try {
      const u = new URL(rewritten, "http://local")
      const urlDetails = u.searchParams.get("details") || ""
      // Always prefer the live panel query (full narrative) over truncated URL details.
      const details =
        query.trim().length >= urlDetails.trim().length
          ? query.trim() || urlDetails
          : urlDetails || query
      if (details.trim()) saveDraftSetCaseDetails(details)

      const hints = extractDraftFieldHints(
        details,
        resolveDraftFieldHintContext(
          u.searchParams.get("kind") ?? undefined,
          u.searchParams.get("category"),
        ),
      )
      const kind = u.searchParams.get("kind")
      const label = u.searchParams.get("label")
      const category =
        u.searchParams.get("category") ||
        (kind?.includes("research_memo") || kind?.includes("case_strategy")
          ? "Research"
          : kind?.includes("consumer") || kind?.includes("document_production")
            ? "Consumer"
            : null)
      const documentKind = u.searchParams.get("documentKind")
      const returnTo = u.searchParams.get("returnTo")
      const language = u.searchParams.get("language") || outputLanguage || undefined
      const next = new URL(u.pathname, "http://local")
      if (kind) next.searchParams.set("kind", kind)
      if (label) next.searchParams.set("label", label)
      if (category) next.searchParams.set("category", category)
      if (documentKind) next.searchParams.set("documentKind", documentKind)

      const clientName = hints.clientName || u.searchParams.get("clientName") || ""
      const opposingParty = hints.opposingParty || u.searchParams.get("opposingParty") || ""
      const rawCourt = hints.courtName || u.searchParams.get("courtName") || ""
      const courtName =
        rawCourt && !/\bscan\b/i.test(rawCourt) && !/\bwas\s+performed\b/i.test(rawCourt)
          ? rawCourt
          : ""
      if (clientName) next.searchParams.set("clientName", clientName.slice(0, 200))
      if (opposingParty) next.searchParams.set("opposingParty", opposingParty.slice(0, 500))
      if (courtName) next.searchParams.set("courtName", courtName.slice(0, 200))
      if (language) next.searchParams.set("language", language)
      if (returnTo) next.searchParams.set("returnTo", returnTo)
      // Keep a short stub only — full narrative lives in sessionStorage.
      if (details.trim()) {
        next.searchParams.set("details", details.trim().slice(0, 800))
      }
      if (knowledgeSources.length > 0) {
        next.searchParams.set("knowledgeSources", serializeKnowledgeSourcesParam(knowledgeSources))
      }
      return `${next.pathname}${next.search}`
    } catch {
      return rewritten
    }
  }

  // Inline form search on suggested-docs step (when AI misses the right form)
  const [inlineFormSearch, setInlineFormSearch] = useState("")
  const [inlineFormQuery, setInlineFormQuery] = useState("")
  const [inlineForms, setInlineForms] = useState<JurisdictionForm[]>([])
  const [inlineFormsLoading, setInlineFormsLoading] = useState(false)

  const [step, setStep] = useState<PanelStep>("input")
  const [query, setQuery] = useState("")
  const [entryMode, setEntryMode] = useState<DraftEntryMode>("matter")
  const [longRequestPreview, setLongRequestPreview] = useState<string | null>(null)
  const queryRef = useRef(query)
  queryRef.current = query
  const [outputLanguage, setOutputLanguage] = useState("en")
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestionsStuck, setSuggestionsStuck] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [searchPhaseIdx, setSearchPhaseIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<DraftAnalyzeResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [result, setResult] = useState<Awaited<ReturnType<typeof resolveDraftIntent>> | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedBundleKinds, setSelectedBundleKinds] = useState<Set<string>>(new Set())
  const [extraPickedDrafts, setExtraPickedDrafts] = useState<
    Record<string, { label: string; draftUrl: string }>
  >({})
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({})
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)
  const [lastCreditUsage, setLastCreditUsage] = useState<{
    used?: number
    remaining?: number
  } | null>(null)

  // Quick search mode (regex + jurisdiction catalog search)
  const [searchMode, setSearchMode] = useState<"ai" | "quick">("ai")
  const [quickInput, setQuickInput] = useState("")
  const [quickSearch, setQuickSearch] = useState("")
  const [quickCountry, setQuickCountry] = useState<string>("")
  const [quickJurisdiction, setQuickJurisdiction] = useState<string>("")
  const [quickForms, setQuickForms] = useState<JurisdictionForm[]>([])
  const [quickTotal, setQuickTotal] = useState(0)
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickSettled, setQuickSettled] = useState(false)

  // Inline form picker within AI Search mode
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerInput, setPickerInput] = useState("")
  const [pickerSearch, setPickerSearch] = useState("")
  const [pickerForms, setPickerForms] = useState<JurisdictionForm[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerSettled, setPickerSettled] = useState(false)

  const [refineFlash, setRefineFlash] = useState(false)

  // Tracks supplemental context sent in the last analyzeDraftIntent call
  const lastAnalyzedSupplementalRef = useRef<string>("")
  const resolveInFlightRef = useRef(false)
  const resolveGenerationRef = useRef(0)
  const pendingResolveRef = useRef<{
    q: string
    answersMap: Record<string, string | string[]>
    ctx: DraftContext | null
    supplemental?: string
    opts?: { skipClarification?: boolean }
  } | null>(null)
  const suggestedDocsRef = useRef<HTMLDivElement>(null)
  const prevLoadingRef = useRef(false)

  const supplementalContext = buildSupplementalFromActionNotes(actionNotes)
  const notesDirty = supplementalContext !== lastAnalyzedSupplementalRef.current
  const hasNotes = Object.values(actionNotes).some((v) => v.trim())

  const setPanelStep = (next: PanelStep) => {
    setStep(next)
    onStepChange?.(next)
  }

  // Sync quick search country/jurisdiction when props change
  useEffect(() => {
    setQuickCountry(countryCode && countryCode !== "ALL" ? countryCode : "")
  }, [countryCode])

  useEffect(() => {
    setQuickJurisdiction(jurisdiction ?? "")
  }, [jurisdiction])

  // Cycle through search phrases while loading suggested documents
  useEffect(() => {
    if (!loading) {
      setSearchPhaseIdx(0)
      return
    }
    const id = setInterval(() => {
      setSearchPhaseIdx((i) => (i + 1) % SEARCH_PHRASES.length)
    }, 1800)
    return () => clearInterval(id)
  }, [loading])

  // After 12s of resolve loading, surface a stuck state with manual refresh.
  useEffect(() => {
    if (!loading) {
      setSuggestionsStuck(false)
      return
    }
    setSuggestionsStuck(false)
    const timer = setTimeout(() => setSuggestionsStuck(true), 12_000)
    return () => clearTimeout(timer)
  }, [loading])

  // Debounce quick search input
  useEffect(() => {
    setQuickSettled(false)
    const t = setTimeout(() => setQuickSearch(quickInput.trim()), 350)
    return () => clearTimeout(t)
  }, [quickInput])

  // Debounce inline picker input
  useEffect(() => {
    setPickerSettled(false)
    const t = setTimeout(() => setPickerSearch(pickerInput.trim()), 350)
    return () => clearTimeout(t)
  }, [pickerInput])

  // Fetch inline picker results (AI Search mode)
  useEffect(() => {
    if (!pickerOpen || !pickerSearch) {
      setPickerForms([])
      setPickerSettled(true)
      return
    }
    let cancelled = false
    setPickerLoading(true)
    setPickerSettled(false)
    const { isRegex, pattern } = parseSearchPattern(pickerSearch)
    // Do NOT pass search to server — fetch all forms for country and rank client-side.
    // Do NOT restrict by jurisdiction either — the user's query (e.g. "bihar maintenance")
    // will target the right state via filterAndRankForms; restricting here would exclude
    // forms from states not matching the current workspace state filter.
    // Use quickCountry state (which respects the country dropdown) so the picker
    // and the expanded search always query the same country scope.
    const pickerCountry = quickCountry || (countryCode && countryCode !== "ALL" ? countryCode : undefined)
    fetchLegalFormsPaginated({
      search: isRegex ? pattern : undefined,
      countryCode: pickerCountry,
      jurisdiction: undefined,
      limit: 1500,
    })
      .then((res) => {
        if (cancelled) return
        setPickerForms(filterAndRankForms(res.items, pickerSearch))
      })
      .catch(() => { if (!cancelled) setPickerForms([]) })
      .finally(() => { if (!cancelled) { setPickerLoading(false); setPickerSettled(true) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSearch, pickerOpen, countryCode, jurisdiction])

  // Fetch quick search results
  useEffect(() => {
    if (searchMode !== "quick") return
    if (!quickSearch) {
      setQuickForms([])
      setQuickTotal(0)
      setQuickSettled(true)
      return
    }
    let cancelled = false
    setQuickLoading(true)
    setQuickSettled(false)
    // Fetch all forms for the given country/jurisdiction without a server-side search
    // term so client-side ranking has the full dataset to work with.
    // For regex patterns we still pass the stripped pattern as a hint to the server.
    const { isRegex, pattern } = parseSearchPattern(quickSearch)
    fetchLegalFormsPaginated({
      search: isRegex ? pattern : undefined,
      countryCode: quickCountry || undefined,
      jurisdiction: quickJurisdiction || undefined,
      limit: 1500,
    })
      .then((res) => {
        if (cancelled) return
        const filtered = filterAndRankForms(res.items, quickSearch)
        setQuickForms(filtered)
        setQuickTotal(filtered.length)
      })
      .catch(() => {
        if (!cancelled) { setQuickForms([]); setQuickTotal(0) }
      })
      .finally(() => {
        if (!cancelled) { setQuickLoading(false); setQuickSettled(true) }
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSearch, quickCountry, quickJurisdiction, searchMode])

  const { gate: creditsGate, handleApiError, openGate } = useInsufficientCreditsGate({
    feature: "drafting",
    tenantId: activeTenantId ?? undefined,
    countryCode: countryCode && countryCode !== "ALL" ? countryCode : "IN",
  })

  const promptRefine = usePromptRefinement({
    purpose: "drafting",
    tenantId: activeTenantId ?? undefined,
    getContext: useCallback(
      () => ({
        countryCode: countryCode && countryCode !== "ALL" ? countryCode : undefined,
        jurisdiction: jurisdiction || undefined,
      }),
      [countryCode, jurisdiction],
    ),
  })

  useEffect(() => () => promptRefine.cancelPendingProceed(), [promptRefine.cancelPendingProceed])

  const handleAnalyze = async (options?: { supplemental?: string; query?: string }) => {
    const trimmed = (options?.query ?? query).trim()
    if (!trimmed) return
    if (trimmed.length > DRAFT_INTENT_MAX_LENGTH) {
      setLongRequestPreview(compactDraftingRequest(trimmed))
      setError(null)
      setPanelStep("input")
      return
    }
    const supplemental = options?.supplemental ?? supplementalContext
    setAnalyzing(true)
    setError(null)
    try {
      const res = await analyzeDraftIntent(activeTenantId ?? undefined, trimmed, {
        supplementalContext: supplemental || undefined,
      })
      setAnalysisResult(res)
      lastAnalyzedSupplementalRef.current = supplemental

      if (res.context.jurisdiction && !jurisdiction) {
        onJurisdictionInferred?.(res.context.jurisdiction)
      }

      setAnswers((prev) => {
        const next: Record<string, string | string[]> = {}
        for (const q of res.questions) {
          if (prev[q.id]) next[q.id] = prev[q.id]
        }
        return next
      })
      setPanelStep("context_review")
      if (res.questions.length === 0) {
        // No facts need confirming, so continue directly to the recommendation step.
        void runResolve(trimmed, {}, res.context, supplemental)
      }
    } catch (err) {
      // Do not submit the same invalid request to resolve after analysis fails.
      // That previously created a 400 → 400 cascade and an empty results step.
      setError(err instanceof Error ? err.message : t("errors.searchFailed"))
      setPanelStep("input")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRefineAnalysis = async () => {
    const trimmed = query.trim()
    if (!trimmed || !supplementalContext.trim()) return
    setAnalyzing(true)
    setError(null)
    setRefineFlash(false)
    try {
      const res = await analyzeDraftIntent(activeTenantId ?? undefined, trimmed, {
        supplementalContext,
      })
      setAnalysisResult(res)
      lastAnalyzedSupplementalRef.current = supplementalContext
      // Clear stale form results then refresh suggestions with preserved answers
      setResult(null)

      if (res.context.jurisdiction && !jurisdiction) {
        onJurisdictionInferred?.(res.context.jurisdiction)
      }

      setAnswers((prev) => {
        const next: Record<string, string | string[]> = {}
        for (const q of res.questions) {
          if (prev[q.id]) next[q.id] = prev[q.id]
        }
        return next
      })

      // Stay on context_review and show success flash
      setRefineFlash(true)
      setTimeout(() => setRefineFlash(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.searchFailed"))
    } finally {
      setAnalyzing(false)
    }
  }

  const runResolve = async (
    q: string,
    answersMap: Record<string, string | string[]>,
    ctx: DraftContext | null,
    supplemental?: string,
    opts?: { skipClarification?: boolean },
  ) => {
    if (q.trim().length > DRAFT_INTENT_MAX_LENGTH) {
      setLongRequestPreview(compactDraftingRequest(q))
      setPanelStep("input")
      return
    }
    if (resolveInFlightRef.current) {
      // Queue the latest request so answer changes during flight are not dropped.
      pendingResolveRef.current = { q, answersMap, ctx, supplemental, opts }
      return
    }
    const supplementalBlock = supplemental ?? supplementalContext
    const generation = ++resolveGenerationRef.current
    resolveInFlightRef.current = true
    setSuggestionsStuck(false)
    setPanelStep("results")
    setLoading(true)
    setError(null)
    try {
      const res = await resolveDraftIntent(activeTenantId ?? undefined, {
        query: q,
        countryCode: countryCode && countryCode !== "ALL" ? countryCode : undefined,
        jurisdiction: ctx?.jurisdiction ?? jurisdiction ?? undefined,
        answers: Object.keys(answersMap).length > 0 ? answersMap : undefined,
        context: ctx ?? undefined,
        supplementalContext: supplementalBlock || undefined,
        skipClarification: opts?.skipClarification,
        language: outputLanguage || undefined,
      })
      // Ignore stale responses after a forced refresh / newer resolve.
      if (generation !== resolveGenerationRef.current) return
      setResult(res)
      setLastCreditUsage({
        used: res.creditsUsed,
        remaining: res.balanceRemaining,
      })
      setPanelStep("results")
      if (activeTenantId) invalidateCreditWalletQueries(queryClient, activeTenantId)
      // Prefill inline form search from cited statute / stalking keywords
      if (!inlineFormSearch) {
        const statutePrefill = /\b(?:section|sec\.?|s\.?|§)\s*78\b.{0,12}\bbns\b|\bbns\b.{0,12}(?:section|sec\.?|s\.?|§)?\s*78\b/i.test(q)
          ? "78 BNS stalking"
          : /\bstalk/i.test(q)
            ? "stalking FIR"
            : ""
        if (statutePrefill) {
          setInlineFormSearch(statutePrefill)
          setInlineFormQuery(statutePrefill)
        }
      }
      setContext({
        page: "document-drafting-studio",
        draftQuery: q,
        countryCode: countryCode && countryCode !== "ALL" ? countryCode : undefined,
        jurisdiction: ctx?.jurisdiction ?? jurisdiction,
        intent: "DOCUMENT_DRAFT",
      })
    } catch (err) {
      if (generation !== resolveGenerationRef.current) return
      const message = handleApiError(err, err instanceof Error ? err.message : t("errors.searchFailed"))
      setIsCreditError(isInsufficientCreditsError(err))
      setError(message)
      setResult(null)
    } finally {
      if (generation !== resolveGenerationRef.current) return
      resolveInFlightRef.current = false
      const pending = pendingResolveRef.current
      pendingResolveRef.current = null
      if (pending) {
        // Flush the latest queued resolve without clearing the loading spinner mid-flight.
        void runResolve(
          pending.q,
          pending.answersMap,
          pending.ctx,
          pending.supplemental,
          pending.opts,
        )
      } else {
        setLoading(false)
      }
    }
  }

  const handleRefreshSuggestions = () => {
    setSuggestionsStuck(false)
    resolveInFlightRef.current = false
    pendingResolveRef.current = null
    void runResolve(
      query.trim(),
      answers,
      analysisResult?.context ?? null,
      supplementalContext,
    )
  }

  const handleFindForms = (overrideQuery?: string) => {
    const target = (overrideQuery ?? query).trim()
    if (!target || promptRefine.loading || promptRefine.pendingProceed) return
    if (target.length > DRAFT_INTENT_MAX_LENGTH) {
      setLongRequestPreview(compactDraftingRequest(target))
      setError(null)
      return
    }
    void promptRefine.runWithRefinement(target, {
      onAutoFill: setQuery,
      getCurrentText: () => queryRef.current,
      onProceed: (accepted) => handleAnalyze({ query: accepted }),
    })
  }

  const handleContinueToSearch = () => {
    void runResolve(query.trim(), answers, analysisResult?.context ?? null, supplementalContext)
  }

  const handleSkipClarification = () => {
    void runResolve(query.trim(), answers, analysisResult?.context ?? null, supplementalContext, {
      skipClarification: true,
    })
  }

  const bundleMatches = result ? getBundleMatches(result.matches) : []
  const primaryBundleMatches = result ? getPrimaryBundleMatches(result.matches) : []
  const opposingPartyBundleMatches = result ? getOpposingPartyBundleMatches(result.matches) : []

  useEffect(() => {
    if (!result?.documentBundle?.length) {
      setSelectedBundleKinds(new Set())
      setExtraPickedDrafts({})
      return
    }
    setSelectedBundleKinds(
      defaultDraftBundleKinds(result.documentBundle, result.matches, result.routeDecision),
    )
    setExtraPickedDrafts({})
  }, [result])

  // Debounce inline form search on context_review
  useEffect(() => {
    const t = setTimeout(() => setInlineFormQuery(inlineFormSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [inlineFormSearch])

  useEffect(() => {
    if (step !== "context_review" || !inlineFormQuery) {
      setInlineForms([])
      return
    }
    let cancelled = false
    setInlineFormsLoading(true)
    const { isRegex, pattern } = parseSearchPattern(inlineFormQuery)
    const searchCountry = countryCode && countryCode !== "ALL" ? countryCode : undefined

    const run = async () => {
      try {
        if (!isRegex) {
          // Prefer hybrid intent-search for natural-language queries (e.g. "stalking").
          const intentHits = await searchLegalFormsByIntent(inlineFormQuery, {
            countryCode: searchCountry,
            limit: 20,
          })
          if (cancelled) return
          if (intentHits.length > 0) {
            setInlineForms(intentHits.slice(0, 8))
            return
          }
        }
        // Fallback: server lexical search with expanded tokens + larger page.
        const res = await fetchLegalFormsPaginated({
          search: isRegex ? pattern : inlineFormQuery,
          countryCode: searchCountry,
          jurisdiction: undefined,
          limit: 200,
        })
        if (cancelled) return
        setInlineForms(filterAndRankForms(res.items, inlineFormQuery).slice(0, 8))
      } catch {
        if (!cancelled) setInlineForms([])
      } finally {
        if (!cancelled) setInlineFormsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [inlineFormQuery, step, countryCode])

  const toggleBundleKind = (kind: string, checked: boolean) => {
    setSelectedBundleKinds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(kind)
      else next.delete(kind)
      return next
    })
  }

  const handlePickUnmappedSuggestion = (kind: string, label: string) => {
    const fromMatches = result?.matches.find(
      (m): m is DraftIntentCuratedDraftMatch =>
        m.type === "curated_draft" && m.kind === kind,
    )
    const draftUrl =
      fromMatches?.draftUrl ??
      resolveDraftHref(
        `/app/india-drafting/draft?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}&details=${encodeURIComponent(query.slice(0, 2000))}`,
      )
    setExtraPickedDrafts((prev) => ({ ...prev, [kind]: { label, draftUrl } }))
    toggleBundleKind(kind, true)
  }

  const handleDraftSelectedBundle = () => {
    if (
      hasBlockingClarification(
        result?.routeDecision,
        analysisResult?.questions ?? [],
        answers,
        result?.draftingBlocked,
      ) ||
      (result?.recommendationMode === "clarification_required" &&
        (result.clarifyingQuestions ?? []).some((question) => !hasAnswer(answers[question.id])))
    ) {
      return
    }
    const fromBundle = bundleMatches.filter((m) => selectedBundleKinds.has(m.kind))
    const fromExtra = Object.entries(extraPickedDrafts)
      .filter(
        ([kind]) =>
          selectedBundleKinds.has(kind) && !fromBundle.some((m) => m.kind === kind),
      )
      .map(([kind, { label, draftUrl }]) => ({
        type: "curated_draft" as const,
        kind,
        label,
        draftUrl,
        confidence: 0.7,
        summary: label,
        countryCode: "IN" as const,
      }))
    const selected = [...fromBundle, ...fromExtra]
    if (selected.length === 0) return
    setNavigating(true)
    const fullQuery = query.trim()
    const firstKind = selected[0]?.kind
    let category: string | null = null
    try {
      category = new URL(resolveDraftHref(selected[0].draftUrl), "http://local").searchParams.get(
        "category",
      )
    } catch {
      category = null
    }
    const hints = extractDraftFieldHints(
      fullQuery,
      resolveDraftFieldHintContext(firstKind, category),
    )
    saveDraftSetPartyContext({
      clientName: hints.clientName,
      opposingParty: hints.opposingParty,
      courtName: hints.courtName,
      parties: hints.parties,
    })
    if (fullQuery) saveDraftSetCaseDetails(fullQuery)
    initDraftSet(
      selected.map((m) => {
        const kind = resolveBundleResearchMemoKind(m.kind, fullQuery)
        const baseUrl = resolveDraftHref(m.draftUrl)
        return {
          draftUrl: kind !== m.kind ? remapDraftUrlKind(baseUrl, kind) : baseUrl,
          label: m.label,
          kind,
        }
      }),
    )
    const set = getDraftSet()
    const first = set?.items[0]
    if (!first) return
    const href = buildDraftSetNavUrl(first, {
      // Full narrative is in sessionStorage; keep URL short so party params are never truncated.
      details: fullQuery ? fullQuery.slice(0, 800) : undefined,
      clientName: hints.clientName,
      opposingParty: hints.opposingParty,
      courtName:
        hints.courtName &&
        !/\bscan\b/i.test(hints.courtName) &&
        !/\bwas\s+performed\b/i.test(hints.courtName)
          ? hints.courtName
          : undefined,
      autoGenerate: fullQuery.length >= 10,
      knowledgeSources: serializeKnowledgeSourcesParam(knowledgeSources),
    })
    router.push(href)
  }

  // Derived display data from current analysis
  const ctx = analysisResult?.context
  const contextChips: Array<{ icon: React.ElementType; label: string }> = []
  if (ctx?.jurisdiction)
    contextChips.push({ icon: MapPin, label: STATE_NAMES[ctx.jurisdiction] ?? ctx.jurisdiction })
  if (ctx?.court)
    contextChips.push({ icon: Scale, label: COURT_LABELS[ctx.court] ?? ctx.court })
  if (ctx?.statute)
    contextChips.push({ icon: FileText, label: STATUTE_LABELS[ctx.statute] ?? ctx.statute })
  const inferredDocumentKind = ctx?.documentKind ?? result?.classification.documentKind
  const isSelfDefenseContext = Boolean(analysisResult?.extractedFacts?.isSelfDefenseHomicideContext)
  const inferredDocumentKindLabel = documentKindLabel(inferredDocumentKind)
  if (isSelfDefenseContext && (ctx?.documentKindConfidence === "low" || !ctx?.documentKindConfidence)) {
    contextChips.push({
      icon: FileQuestion,
      label: "Posture ambiguous — answer questions below",
    })
  } else if (inferredDocumentKindLabel) {
    const suffix = ctx?.documentKindConfidence ? ` (${ctx.documentKindConfidence})` : ""
    contextChips.push({ icon: FileText, label: `${inferredDocumentKindLabel}${suffix}` })
  }
  if (ctx?.orderType)
    contextChips.push({ icon: FileQuestion, label: ORDER_TYPE_LABELS[ctx.orderType] ?? ctx.orderType })

  const nextBestAction = analysisResult?.nextBestAction ?? result?.nextBestAction
  const allActions = [
    ...(analysisResult?.recommendedActions ?? result?.recommendedActions ?? []),
  ]
  const otherActions = allActions.filter((a) => a !== nextBestAction)

  // Self-defence homicide: hide misleading DV / family / maintenance practice chips from MI.
  const practiceChips = analysisResult?.matterProfile
    ? [
        analysisResult.matterProfile.practiceArea,
        analysisResult.matterProfile.subPracticeArea,
        analysisResult.matterProfile.forum,
      ]
        .filter((v): v is string => Boolean(v))
        .filter((v) => {
          if (!isSelfDefenseContext) return true
          return (
            v !== "family_matrimonial" &&
            v !== "domestic_violence" &&
            v !== "maintenance" &&
            v !== "family_court" &&
            v !== "alimony" &&
            !/domestic.?violence|spousal|family.?matrimonial|maintenance|alimony|family.?court/i.test(
              v,
            )
          )
        })
        .map((v) => COURT_LABELS[v] ?? humanizeSlug(v))
    : []

  // Prefer fact chips for self-defence so Maintenance/Family Court never dominate.
  const selfDefenseFactChips: string[] = []
  if (isSelfDefenseContext) {
    selfDefenseFactChips.push("Criminal defence")
    if (analysisResult?.extractedFacts?.accusedName) {
      selfDefenseFactChips.push(analysisResult.extractedFacts.accusedName)
    }
    selfDefenseFactChips.push("Sessions Court")
    if (analysisResult?.extractedFacts?.hasChargesheetFiled) {
      selfDefenseFactChips.push("Chargesheet filed")
    }
    if (analysisResult?.extractedFacts?.seeksDischarge) {
      selfDefenseFactChips.push("Discharge sought")
    }
  }
  const displayPracticeChips = isSelfDefenseContext
    ? [
        ...selfDefenseFactChips,
        ...practiceChips.filter(
          (c) =>
            !selfDefenseFactChips.includes(c) &&
            !/litigation|criminal fir|criminal complaint/i.test(c),
        ),
      ]
    : practiceChips
  const confidence = analysisResult?.matterProfile?.confidence

  const stageContradiction =
    isSelfDefenseContext &&
    Boolean(analysisResult?.extractedFacts?.hasChargesheetFiled) &&
    answers.self_defense_custody_stage === "pre_complaint"

  const miClarifyingQuestions = result?.clarifyingQuestions ?? []
  // Analyze already shows the contextual pack — don't repeat those IDs from resolve.
  const analyzeQuestionIds = new Set(analysisResult?.questions.map((q) => q.id) ?? [])
  const unresolvedMiQuestions = miClarifyingQuestions.filter((q) => !analyzeQuestionIds.has(q.id))
  const needsMiClarification =
    result?.recommendationMode === "clarification_required" && unresolvedMiQuestions.length > 0
  const activeFilingRoute = result?.routeDecision ?? analysisResult?.routeDecision
  const hasBlockingAnalyzeQuestions = Boolean(
    analysisResult?.draftingBlocked ||
      analysisResult?.questions.some((question) => question.blocking === true),
  )
  const draftingBlocked =
    hasBlockingClarification(
      result?.routeDecision,
      analysisResult?.questions ?? [],
      answers,
      result?.draftingBlocked,
    ) ||
    needsMiClarification
  // On context_review, Path A (analysisResult.questions) is the single questionnaire.
  const showMiBlockOnReview =
    Boolean(result) &&
    needsMiClarification &&
    (analysisResult?.questions.length ?? 0) === 0

  // Auto-scroll to suggested documents when resolve finishes and matches are below the fold.
  useEffect(() => {
    const wasLoading = prevLoadingRef.current
    prevLoadingRef.current = loading

    if (!wasLoading || loading) return
    if (step !== "results") return
    if (!result?.matches?.length || draftingBlocked) return

    const el = suggestedDocsRef.current
    if (!el) return

    // Only scroll if results are still below the visible area (avoids jank on background refreshes)
    const rect = el.getBoundingClientRect()
    if (rect.top <= window.innerHeight * 0.45) return

    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [loading, result, step, draftingBlocked])

  return (
    <div className={cn("rounded-xl border bg-card p-4 sm:p-6 space-y-4 shadow-sm", className)}>

      {/* ─── Step: Input ─────────────────────────────────────────────────── */}
      <DraftWizardSteps currentStep={step} />

      {step === "input" && (
        <>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <Wand2 className="h-4 w-4 shrink-0 text-primary" />
              Choose how you want to start
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Describe a matter for AI guidance, or search for a form you already know.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setEntryMode("matter")}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                entryMode === "matter"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-muted/30",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Draft from a matter
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Describe the facts and we’ll recommend the right documents.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode("specific_form")
                setPickerOpen(true)
                setPickerInput("")
              }}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                entryMode === "specific_form"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-muted/30",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Draft a specific form
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Search by the form name, number, authority, or court.
              </span>
            </button>
          </div>

          {/* ── Mode toggle: AI Search / Quick Search ── */}
          {entryMode === "matter" && <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
            <button
              type="button"
              onClick={() => setSearchMode("ai")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                searchMode === "ai"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3 w-3" />
              AI Search
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("quick")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                searchMode === "quick"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Search className="h-3 w-3" />
              Quick Search
            </button>
          </div>}

          {entryMode === "specific_form" && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <h3 className="text-sm font-semibold">Find your form</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecting a match opens its drafting workspace directly; no extra AI-routing step is required.
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={pickerInput}
                  onChange={(e) => setPickerInput(e.target.value)}
                  placeholder="e.g. Form I-485, GST REG-01, bail application"
                  className="pl-9"
                  autoFocus
                />
              </div>
              {pickerLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              )}
              {!pickerLoading && pickerForms.length > 0 && (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {pickerForms.slice(0, 8).map((form) => {
                    const href = legalFormDraftLink(form)
                    return (
                      <div key={form.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{form.formName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {form.formNumber ? `${form.formNumber} · ` : ""}{form.authority}
                          </p>
                        </div>
                        {href && (
                          <Button size="sm" onClick={() => router.push(href)}>
                            Draft form
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {!pickerLoading && pickerSettled && pickerSearch && pickerForms.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No exact form found. You can describe what you need and let AI create the appropriate draft.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setEntryMode("matter")}>
                  Describe a matter instead
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => router.push("/app/document-drafting/edit")}
                >
                  <Upload className="h-4 w-4" />
                  Upload existing document
                </Button>
              </div>
            </div>
          )}

          {/* ── AI Search mode ── */}
          {entryMode === "matter" && searchMode === "ai" && (
            <>
              <Textarea
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLongRequestPreview(null)
                }}
                rows={6}
                placeholder="e.g. Appeal against interim maintenance order in Karnataka between Ravi Kumar and Priya Sharma — I already have a draft agreement dated Jan 2025; the dispute concerns non-payment of ₹3.5L…"
                className="min-h-[160px] resize-y text-sm leading-relaxed sm:min-h-[200px]"
              />

              {longRequestPreview && (
                <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                  <div>
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                      This request is too long to analyze in one pass
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                      We prepared a shorter analysis version that preserves the document requests and key facts. Review it before continuing, or upload the source document to work from the full text.
                    </p>
                  </div>
                  <Textarea
                    value={longRequestPreview}
                    onChange={(e) => setLongRequestPreview(e.target.value)}
                    rows={6}
                    className="bg-background text-sm"
                    aria-label="Compacted drafting request"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const compacted = longRequestPreview.trim()
                        if (compacted.length > DRAFT_INTENT_MAX_LENGTH) return
                        setQuery(compacted)
                        setLongRequestPreview(null)
                        handleFindForms(compacted)
                      }}
                    >
                      Use compacted request
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => router.push("/app/document-drafting/edit")}
                    >
                      <Upload className="h-4 w-4" />
                      Upload source document
                    </Button>
                  </div>
                </div>
              )}

              <BilingualLanguagePicker
                value={outputLanguage}
                onChange={setOutputLanguage}
                countryCode={countryCode && countryCode !== "ALL" ? countryCode : "IN"}
                label="Output language"
              />

              {/* ── Inline form picker ── */}
              <div className="rounded-xl border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setPickerOpen((v) => !v); if (!pickerOpen) setPickerInput("") }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Pick a specific form from the catalog
                  </span>
                  {pickerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {pickerOpen && (
                  <div className="border-t bg-muted/10 p-3 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={pickerInput}
                        onChange={(e) => setPickerInput(e.target.value)}
                        placeholder="Search by name, number or /regex/…"
                        className="pl-8 h-8 text-xs"
                        autoFocus
                      />
                    </div>

                    {pickerLoading && (
                      <div className="space-y-1.5">
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                      </div>
                    )}

                    {!pickerLoading && pickerForms.length > 0 && (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                        {pickerForms.map((form) => {
                          const href = legalFormDraftLink(form)
                          return (
                            <div
                              key={form.id}
                              className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 hover:border-primary/40 hover:bg-muted/20 transition-colors group"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium leading-snug truncate">{form.formName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground truncate">{form.authority}</span>
                                  {form.jurisdiction && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      · {STATE_NAMES[form.jurisdiction] ?? form.jurisdiction}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {href ? (
                                <button
                                  type="button"
                                  onClick={() => router.push(href)}
                                  className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/5"
                                >
                                  Draft →
                                </button>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!pickerLoading && pickerSettled && pickerSearch && pickerForms.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-2">
                        No catalog match — use <span className="font-medium">Find &amp; Draft</span> above to let AI draft it.
                      </p>
                    )}

                    {!pickerLoading && !pickerSearch && (
                      <p className="text-center text-xs text-muted-foreground py-1">
                        Start typing to search 10,800+ official forms.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="w-full gap-2 sm:w-auto"
                  loading={analyzing || loading || promptRefine.loading || promptRefine.pendingProceed}
                  disabled={analyzing || loading || promptRefine.loading || promptRefine.pendingProceed || query.trim().length < 3}
                  onClick={() => handleFindForms()}
                >
                  {analyzing || loading || promptRefine.loading || promptRefine.pendingProceed
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Sparkles className="h-4 w-4" />}
                  {analyzing || loading
                    ? "Finding forms…"
                    : promptRefine.loading
                      ? tPromptRefine("preparing")
                      : promptRefine.pendingProceed
                        ? tPromptRefine("startingDrafting", { seconds: promptRefine.countdownSeconds })
                        : "Find & Draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => setLibraryOpen(true)}
                >
                  <Library className="h-4 w-4" />
                  Browse patterns
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => router.push("/app/document-drafting/edit")}
                >
                  <Upload className="h-4 w-4" />
                  Upload &amp; edit
                </Button>
              </div>

              {error && (
                isCreditError ? (
                  <CreditErrorBanner message={error} onGetCredits={openGate} />
                ) : (
                  <p className="text-sm text-destructive">{error}</p>
                )
              )}

              {analyzing && (
                <div
                  className="min-h-[200px] space-y-3 rounded-lg border bg-muted/20 p-4"
                  aria-busy="true"
                  aria-label={tMi("loading")}
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Quick Search mode ── */}
          {entryMode === "matter" && searchMode === "quick" && (
            <div className="space-y-4">
              {/* Search input + jurisdiction selects */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    placeholder='Search by keyword or /regex/ e.g. /maintenance.*order/i'
                    className="pl-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={quickCountry}
                    onChange={(e) => { setQuickCountry(e.target.value); setQuickJurisdiction("") }}
                    className="rounded-md border bg-background px-2 py-1.5 text-xs text-foreground"
                  >
                    <option value="">All countries</option>
                    <option value="IN">India</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="KE">Kenya</option>
                  </select>
                  {(quickCountry === "IN" || quickCountry === "US") && (
                    <select
                      value={quickJurisdiction}
                      onChange={(e) => setQuickJurisdiction(e.target.value)}
                      className="rounded-md border bg-background px-2 py-1.5 text-xs text-foreground"
                    >
                      <option value="">All states</option>
                      {quickCountry === "IN"
                        ? Object.entries(STATE_NAMES).map(([code, name]) => (
                            <option key={code} value={code}>{name}</option>
                          ))
                        : ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                    </select>
                  )}
                  {parseSearchPattern(quickInput).isRegex && quickInput.trim() && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      Regex active
                    </Badge>
                  )}
                  {quickTotal > 0 && !quickLoading && (
                    <span className="text-xs text-muted-foreground self-center">
                      {quickTotal} result{quickTotal !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Loading skeleton */}
              {quickLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              )}

              {/* Results */}
              {!quickLoading && quickForms.length > 0 && (
                <div className="space-y-2">
                  {quickForms.map((form) => {
                    const href = legalFormDraftLink(form)
                    return (
                      <div
                        key={form.id}
                        className="rounded-xl border p-3 flex items-start gap-3 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                      >
                        <div className="shrink-0 rounded-lg bg-primary/10 p-2 mt-0.5">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{form.formName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{form.authority}</span>
                            {form.jurisdiction && (
                              <Badge variant="secondary" className="text-[10px]">
                                <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                {STATE_NAMES[form.jurisdiction] ?? form.jurisdiction}
                              </Badge>
                            )}
                            {form.practiceArea && (
                              <Badge variant="outline" className="text-[10px]">
                                {humanizeSlug(form.practiceArea)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {href ? (
                          <button
                            type="button"
                            onClick={() => router.push(href)}
                            className="shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted/40 transition-colors"
                          >
                            Draft
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* No results fallback */}
              {!quickLoading && quickSettled && quickSearch && quickForms.length === 0 && (
                <div className="rounded-xl border border-dashed p-5 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No catalog matches for{" "}
                    <span className="font-medium text-foreground">
                      &ldquo;{quickSearch.length > 50 ? quickSearch.slice(0, 50) + "…" : quickSearch}&rdquo;
                    </span>
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Can&apos;t find what you need?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Describe it and we&apos;ll draft it with AI.
                    </p>
                  </div>
                  <Button
                    className="gap-2 mx-auto"
                    size="sm"
                    onClick={() => {
                      const { pattern, isRegex } = parseSearchPattern(quickSearch)
                      const aiQuery = isRegex ? pattern : quickSearch
                      setSearchMode("ai")
                      handleFindForms(aiQuery)
                    }}
                  >
                    <Wand2 className="h-4 w-4" />
                    Draft with AI
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Empty state — no query yet */}
              {!quickLoading && !quickSearch && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  Type a keyword or <code className="text-xs">/regex/</code> to search 10,800+ official forms.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Step: Context Review — Understanding Panel ───────────────────── */}
      {(step === "context_review" || step === "results") && analysisResult && (
        <div className="space-y-4 pb-20 sm:pb-6">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (step === "results") {
                  setPanelStep("context_review")
                } else {
                  setPanelStep("input")
                  // Keep answers so the user can refine the query and return without re-answering.
                  setResult(null)
                }
              }}
              className="flex shrink-0 items-center justify-center rounded-md p-1 transition-colors hover:bg-muted"
              aria-label={step === "results" ? "Refine facts" : "Back to description"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {step === "results" ? "Recommended documents" : "Matter understood"}
              </p>
              <p className="truncate text-sm leading-snug text-muted-foreground/80">
                {query.length > 72 ? `${query.slice(0, 72)}…` : query}
              </p>
            </div>
          </div>

          {step === "context_review" && (
            <div className="rounded-xl border bg-background px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Knowledge sources</p>
              <KnowledgeSourcePicker
                selected={knowledgeSources}
                onChange={setKnowledgeSources}
                countryCode={countryCode}
                compact
              />
            </div>
          )}

          {activeFilingRoute && <FilingRouteStatusCard route={activeFilingRoute} />}

          {/* Understanding card */}
          <div
            className={cn(
              "rounded-xl border overflow-hidden transition-opacity",
              analyzing && "pointer-events-none opacity-60",
            )}
          >
            {/* ── Extracted facts + context chips + confidence ── */}
            {((analysisResult.extractedFacts?.summaryLines?.length ?? 0) > 0 ||
              contextChips.length > 0 ||
              displayPracticeChips.length > 0 ||
              confidence !== undefined) && (
              <div className="space-y-3 px-4 py-4 border-b border-border/50">
                {analysisResult.extractedFacts?.summaryLines &&
                  analysisResult.extractedFacts.summaryLines.length > 0 && (
                    <ul className="space-y-1.5">
                      {analysisResult.extractedFacts.summaryLines.map((line) => (
                        <li key={line} className="flex items-start gap-2 text-sm leading-snug">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                {(contextChips.length > 0 || displayPracticeChips.length > 0 || confidence !== undefined) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {contextChips.map((chip) => (
                      <ContextChip key={chip.label} icon={chip.icon} label={chip.label} />
                    ))}
                    {displayPracticeChips.map((label) => (
                      <Badge key={label} variant="secondary" className="text-[10px] font-normal">
                        {label}
                      </Badge>
                    ))}
                    {confidence !== undefined && (
                      <span className="ml-auto">
                        <ConfidenceBar confidence={confidence} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {allActions.length > 0 && (
              <div className="px-4 py-3">
                <ActionContextRefineBlock
                  nextBestAction={nextBestAction}
                  recommendedActions={allActions}
                  actionNotes={actionNotes}
                  onActionNotesChange={setActionNotes}
                />
              </div>
            )}
          </div>

          {/* Clarifying questions — above suggested documents */}
          {step === "context_review" && analysisResult.questions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confirm the facts before recommending a filing route
              </p>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Your answers are saved locally. Confirm them once to generate recommendations.
              </p>
              {analysisResult.questions.map((q: ClarifyingQuestion) => {
                const isMulti = Boolean(q.multiSelect)
                const questionIsBlocking =
                  q.blocking === true ||
                  Boolean(
                    analysisResult.draftingBlocked &&
                      analysisResult.routeDecision?.blockingIssues.some(
                        (issue) => issue.id === q.id || issue.field === q.id,
                      ),
                  )
                const selectedValues = isMulti
                  ? ((answers[q.id] as string[] | undefined) ?? [])
                  : []
                const singleValue = isMulti ? undefined : (answers[q.id] as string | undefined)
                return (
                  <div key={q.id} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{q.prompt}</p>
                        {questionIsBlocking && (
                          <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800 dark:text-amber-300">
                            Required before drafting
                          </Badge>
                        )}
                      </div>
                      {isMulti && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Select all that apply</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const checked = isMulti
                          ? selectedValues.includes(opt.value)
                          : singleValue === opt.value
                        return (
                          <label
                            key={opt.value}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                              checked
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <input
                              type={isMulti ? "checkbox" : "radio"}
                              name={q.id}
                              value={opt.value}
                              checked={checked}
                              onChange={() => {
                                if (isMulti) {
                                  setAnswers((prev) => {
                                    const current = (prev[q.id] as string[] | undefined) ?? []
                                    const updated = checked
                                      ? current.filter((v) => v !== opt.value)
                                      : [...current, opt.value]
                                    return { ...prev, [q.id]: updated }
                                  })
                                } else {
                                  setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                                }
                              }}
                              className="mt-0.5 shrink-0 accent-primary"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-snug">{opt.label}</p>
                              {opt.hint && (
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                  {opt.hint}
                                </p>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    {q.id === "self_defense_custody_stage" && stageContradiction && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Your facts mention a chargesheet, but Pre-complaint is selected — confirm the
                        stage to refine ranking.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Inline form matches — load below action plan, no page transition ── */}
          {step === "results" && (loading || result) && (
            <div ref={suggestedDocsRef} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
                  {result?.documentBundle?.length
                    ? tMi("recommendedDocuments")
                    : "Suggested documents"}
                </p>
                {loading && !suggestionsStuck && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {tMi("updatingSuggestions")}
                  </span>
                )}
                {loading && suggestionsStuck && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">
                      {tMi("suggestionsStuck")}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={handleRefreshSuggestions}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {tMi("refreshSuggestions")}
                    </Button>
                  </div>
                )}
                {!loading && result && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground"
                    onClick={handleRefreshSuggestions}
                    title={tMi("refreshSuggestions")}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {tMi("refreshSuggestions")}
                  </Button>
                )}
              </div>

              {/* Manual form search when AI misses the right form/statute */}
              <div className="rounded-lg border bg-background p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Search forms yourself (e.g. 78 BNS, stalking, FIR)
                </p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={inlineFormSearch}
                    onChange={(e) => setInlineFormSearch(e.target.value)}
                    placeholder="Search official forms…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                {inlineFormsLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                  </p>
                )}
                {!inlineFormsLoading && inlineForms.length === 0 && inlineFormQuery && (
                  <p className="text-xs text-muted-foreground">
                    No forms matched “{inlineFormQuery}”. Try FIR, BNS 78, or clear search to see AI suggestions.
                  </p>
                )}
                {!inlineFormsLoading && inlineForms.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {inlineForms.map((form) => {
                      const href = resolveDraftHref(
                        `/app/india-drafting/draft?kind=india_form_catalog&label=${encodeURIComponent(form.formName)}&formId=${form.id}&details=${encodeURIComponent(query.slice(0, 2000))}`,
                      )
                      return (
                        <button
                          key={form.id}
                          type="button"
                          className="flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm hover:bg-muted/40"
                          disabled={draftingBlocked}
                          onClick={() => {
                            if (draftingBlocked) return
                            setNavigating(true)
                            router.push(href)
                          }}
                        >
                          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="font-medium block truncate">{form.formName}</span>
                            <span className="text-xs text-muted-foreground">
                              {form.authority}
                              {form.formNumber ? ` · ${form.formNumber}` : ""}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {(result?.clarificationSkipped || result?.provisionalSuggestions) && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {result.clarificationSkipped
                    ? "Questions were skipped — suggestions are provisional until facts are confirmed."
                    : "Suggestions based on your facts; refine answers above to sharpen ranking."}
                </p>
              )}

              {/* Animated search state while first load */}
              {loading && !result && (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-5 space-y-4">
                  {/* Cycling phrase */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Search className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p
                        key={searchPhaseIdx}
                        className="text-sm font-medium text-foreground truncate animate-fade-up"
                      >
                        {SEARCH_PHRASES[searchPhaseIdx]}
                      </p>
                      <Progress value={55} className="mt-2 h-1" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        We&apos;ll show your recommended documents when this is complete.
                      </p>
                    </div>
                  </div>
                  {suggestionsStuck && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                      <p className="text-xs text-amber-800 dark:text-amber-300 flex-1">
                        {tMi("suggestionsStuck")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleRefreshSuggestions}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {tMi("refreshSuggestions")}
                      </Button>
                    </div>
                  )}
                  {/* Skeleton cards */}
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-lg opacity-80" />
                    <Skeleton className="h-12 w-4/5 rounded-lg opacity-60" />
                  </div>
                </div>
              )}

              {/* MI needs more info — only when analyze did not already show the same pack */}
              {showMiBlockOnReview && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{tMi("clarificationRequired")}</p>
                  {unresolvedMiQuestions.map((q) => (
                    <MatterClarifyingQuestionBlock
                      key={q.id}
                      question={q}
                      value={answers[q.id] as string | undefined}
                      onChange={(value) => {
                        setAnswers((prev) => ({ ...prev, [q.id]: value }))
                      }}
                    />
                  ))}
                  <div className="flex justify-end">
                    <Button
                      className="gap-2"
                      loading={loading}
                      disabled={loading || unresolvedMiQuestions.some((q) => !answers[q.id])}
                      onClick={handleContinueToSearch}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Find matching forms
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Form matches — keep previous list visible (dimmed) while refreshing */}
              {result && !needsMiClarification && (result.matches.length > 0 || (result.unmappedExplicitPhrases?.length ?? 0) > 0) && !inlineFormQuery && (
                <div className="relative space-y-3">
                  {lastCreditUsage && (lastCreditUsage.used !== undefined || lastCreditUsage.remaining !== undefined) && (
                    <p className="text-xs text-muted-foreground">
                      {lastCreditUsage.used !== undefined && `Used ${lastCreditUsage.used} credits`}
                      {lastCreditUsage.used !== undefined && lastCreditUsage.remaining !== undefined && " · "}
                      {lastCreditUsage.remaining !== undefined && `${lastCreditUsage.remaining} credits remaining`}
                    </p>
                  )}
                  {loading && (
                    <div className="absolute inset-0 z-10 flex items-start justify-center pt-3 pointer-events-none">
                      <span className="rounded-full border bg-background/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {tMi("refreshingOverlay")}
                      </span>
                    </div>
                  )}
                  <div className={cn("space-y-3", loading && "opacity-50 pointer-events-none")}>
                  {(primaryBundleMatches.length > 0 || (result.unmappedExplicitPhrases?.length ?? 0) > 0) && (
                    <RecommendedDocumentsList
                      title={result.bundleSource === "explicit" ? tMi("documentsYouRequested") : tMi("recommendedFilingSet")}
                      description={result.bundleSource === "explicit" ? tMi("documentsYouRequestedHint") : tMi("recommendedFilingSetHint")}
                    >
                      {result.matterProfile?.forum ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {tMi("suggestedForum")}: {forumLabel(result.matterProfile.forum)}
                        </Badge>
                      ) : null}
                      {primaryBundleMatches.length > 0 ? (
                        <BundleMatchList
                          matches={primaryBundleMatches}
                          selectedBundleKinds={selectedBundleKinds}
                          toggleBundleKind={toggleBundleKind}
                          tMi={tMi}
                        />
                      ) : null}
                      <UnmappedExplicitBlock
                        items={result.unmappedExplicitPhrases ?? []}
                        onPickSuggestion={handlePickUnmappedSuggestion}
                        tMi={tMi}
                      />
                      {opposingPartyBundleMatches.length > 0 && (
                        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-background/60 p-3 space-y-2">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {tMi("opposingPartyFilingSet")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {tMi("opposingPartyFilingSetHint")}
                            </p>
                          </div>
                          <BundleMatchList
                            matches={opposingPartyBundleMatches}
                            selectedBundleKinds={selectedBundleKinds}
                            toggleBundleKind={toggleBundleKind}
                            tMi={tMi}
                          />
                        </div>
                      )}
                      <div className="sticky bottom-0 z-[1] -mx-1 bg-primary/5 pt-2 pb-1 backdrop-blur-sm">
                        <Button
                          type="button"
                          size="lg"
                          className="w-full gap-2 justify-center shadow-sm"
                          disabled={draftingBlocked || navigating || selectedBundleKinds.size === 0}
                          loading={navigating}
                          onClick={handleDraftSelectedBundle}
                        >
                          <Wand2 className="h-4 w-4 shrink-0" />
                          {tMi("draftSelected", { count: selectedBundleKinds.size })}
                        </Button>
                      </div>
                    </RecommendedDocumentsList>
                  )}

                  {/* Flat ranked match list — every match gets the same card treatment */}
                  {(() => {
                    const bundleKindSet = new Set(
                      [...primaryBundleMatches, ...opposingPartyBundleMatches].map((match) => match.kind),
                    )
                    const rankedMatches = result.matches.filter(
                      (m) =>
                        !(m.type === "curated_draft" && m.bundleRecommended) &&
                        !(m.type === "curated_draft" && bundleKindSet.has(m.kind)),
                    )
                    if (rankedMatches.length === 0) return null
                    return (
                      <>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {bundleMatches.length > 0 ? tMi("otherMatches") : tMi("documentMatches")}
                        </p>
                        <div className="space-y-2">
                          {rankedMatches.map((match, index) => {
                            const isCurated = match.type === "curated_draft"
                            const Icon = matchIcon(match.type)
                            const href = resolveDraftHref(matchHref(match))
                            const confidencePct = Math.round(match.confidence * 100)
                            const typeBadgeLabel = isCurated
                              ? tMi("aiDraft")
                              : match.type === "official_form"
                                ? "Official Form"
                                : match.type.replace(/_/g, " ")
                            const kindBadgeLabel = matchDocumentKindLabel(match)
                            return (
                              <MatchCard
                                key={`${match.type}-${index}`}
                                featured={index === 0 && isCurated}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "shrink-0 rounded-lg p-2.5",
                                    index === 0 && isCurated ? "bg-primary/15" : "bg-primary/10",
                                  )}>
                                    <Icon className={cn(
                                      "h-4 w-4",
                                      index === 0 && isCurated ? "h-5 w-5 text-primary" : "text-primary",
                                    )} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold leading-snug">
                                      {("label" in match ? match.label : null) ??
                                        ("name" in match ? (match as { name?: string }).name : null) ??
                                        match.summary}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                      <Badge variant="secondary" className="text-[10px] capitalize">
                                        {typeBadgeLabel}
                                      </Badge>
                                      {kindBadgeLabel && (
                                        <Badge variant="outline" className="text-[10px]">
                                          {kindBadgeLabel}
                                        </Badge>
                                      )}
                                      <span className={cn(
                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                        confidencePct >= 90
                                          ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                          : confidencePct >= 75
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                                            : "bg-muted text-muted-foreground",
                                      )}>
                                        {tMi("matchPercent", { percent: confidencePct })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {(match as { reason?: string }).reason && (
                                  <p className="text-[11px] leading-snug text-muted-foreground">
                                    {(match as { reason?: string }).reason}
                                  </p>
                                )}

                                {(match as { proceduralNote?: string }).proceduralNote && (
                                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
                                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                    <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
                                      {(match as { proceduralNote?: string }).proceduralNote}
                                    </p>
                                  </div>
                                )}

                                {isCurated ? (
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Button
                                      className="flex-1 gap-2"
                                      size={index === 0 ? "default" : "sm"}
                                      disabled={draftingBlocked || navigating}
                                      loading={navigating}
                                      onClick={() => {
                                        if (draftingBlocked) return
                                        setNavigating(true)
                                        router.push(href)
                                      }}
                                    >
                                      <Wand2 className="h-4 w-4" />
                                      {tMi("draftNow")}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="shrink-0 text-xs text-muted-foreground"
                                      title={tMi("generateNowTitle")}
                                      disabled={draftingBlocked || navigating}
                                      onClick={() => {
                                        if (draftingBlocked) return
                                        setNavigating(true)
                                        const url = href.includes("?")
                                          ? `${href}&autoGenerate=1`
                                          : `${href}?autoGenerate=1`
                                        router.push(url)
                                      }}
                                    >
                                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                                      {tMi("generateNow")}
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={draftingBlocked}
                                    onClick={() => {
                                      if (!draftingBlocked) router.push(href)
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-muted/40"
                                  >
                                    <span>{matchActionLabel(match)}</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </MatchCard>
                            )
                          })}
                        </div>

                        {result.matches.every((m) => m.type === "generate") &&
                          (result.matches[0]?.confidence ?? 0) < 0.85 && (
                          <p className="text-xs text-muted-foreground">
                            No exact catalog hit — try{" "}
                            <Link href="/app/templates" className="text-primary underline">
                              User Templates
                            </Link>{" "}
                            or add more details above.
                          </p>
                        )}
                        {result.matches.every((m) => m.type === "generate") &&
                          (result.matches[0]?.confidence ?? 0) >= 0.85 && (
                          <p className="text-xs text-muted-foreground">
                            AI draft available — no pre-built court form in catalog for this route.
                          </p>
                        )}
                      </>
                    )
                  })()}
                  </div>
                </div>
              )}

              {/* No matches — hide while loading so empty state doesn't flash over a refresh */}
              {result && !needsMiClarification && !loading && result.matches.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No matches found — try adding more details above.
                </p>
              )}
            </div>
          )}

          {/* Refine success flash */}
          {refineFlash && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Analysis updated — understanding refreshed with your context.
            </div>
          )}

          {/* Error */}
          {error && (
            isCreditError ? (
              <CreditErrorBanner message={error} onGetCredits={openGate} />
            ) : (
              <p className="text-sm text-destructive">{error}</p>
            )
          )}

          {/* CTA row — answer questions or skip to provisional suggestions */}
          {step === "context_review" && analysisResult.questions.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {hasNotes && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-2",
                      notesDirty &&
                        "border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20",
                    )}
                    disabled={analyzing || !notesDirty}
                    onClick={() => void handleRefineAnalysis()}
                  >
                    {analyzing
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Re-analyze
                  </Button>
                )}
                {!hasBlockingAnalyzeQuestions && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={loading || analyzing}
                    onClick={handleSkipClarification}
                  >
                    Skip for now
                  </Button>
                )}
                <Button
                  className="gap-2"
                  loading={loading || analyzing}
                  disabled={loading || analyzing || analysisResult.questions.some((q) => {
                    const ans = answers[q.id]
                    if (!ans) return true
                    return Array.isArray(ans) ? ans.length === 0 : false
                  })}
                  onClick={handleContinueToSearch}
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Sparkles className="h-4 w-4" />}
                  Confirm & find documents
                  <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
          )}
        </div>
      )}

      {creditsGate}

      <PromptLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        defaultFeature="draft"
        defaultJurisdiction={countryCode && countryCode !== "ALL" ? countryCode : undefined}
      />

    </div>
  )
}
