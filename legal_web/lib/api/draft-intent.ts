import type {
  ClarifyingQuestion as MatterClarifyingQuestion,
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
  RecommendationMode,
} from "@/lib/matter-intelligence"
import { apiFetch } from "./client"

export type DraftIntentMatchType =
  | "official_form"
  | "curated_draft"
  | "template"
  | "generate"
  | "import_edit"

export interface DraftIntentOfficialFormMatch {
  type: "official_form"
  confidence: number
  summary: string
  formId: string
  formName: string
  formNumber: string | null
  countryCode: string
  authority: string
  draftUrl: string
}

export interface DraftIntentCuratedDraftMatch {
  type: "curated_draft"
  confidence: number
  summary: string
  kind: string
  label: string
  countryCode: string
  draftUrl: string
  /** Procedural explanation when legal routing differs from stated intent (e.g. appeal → revision). */
  proceduralNote?: string
  /** Fact-grounded reason explaining why this document is relevant to the case. */
  reason?: string
  bundleRecommended?: boolean
  bundleOrder?: number
  provisional?: boolean
  bundleRole?: "primary" | "opposing_party"
  /** Procedural role supplied by newer routing responses. */
  filingRole?: DraftIntentFilingRole
  advocateReviewStatus?: "pending" | "reviewed"
  requiredAuthorityFields?: string[]
}

export interface DraftIntentTemplateMatch {
  type: "template"
  confidence: number
  summary: string
  templateId: string
  name: string
  source: "system" | "firm" | "user"
  documentKind: string | null
  countryCode: string | null
  editUrl: string
  useUrl: string
}

export interface DraftIntentGenerateMatch {
  type: "generate"
  confidence: number
  summary: string
  suggestedKind: string
  countryCode: string
  documentKind?: string
  reason: string
  draftUrl: string
}

export interface DraftIntentImportEditMatch {
  type: "import_edit"
  confidence: number
  summary: string
  documentKind: string
  draftUrl: string
}

export type DraftIntentMatch =
  | DraftIntentOfficialFormMatch
  | DraftIntentCuratedDraftMatch
  | DraftIntentTemplateMatch
  | DraftIntentGenerateMatch
  | DraftIntentImportEditMatch

export interface DraftIntentBundleItem {
  kind: string
  label: string
  documentKind: string
  order: number
  selectedByDefault: boolean
  bundleRole?: "primary" | "opposing_party"
  /** Procedural role supplied by newer routing responses. */
  filingRole?: DraftIntentFilingRole
}

export type DraftIntentFilingRole =
  | "primary"
  | "required_supporting"
  | "optional_supporting"
  | "opposing_party"
  | "unrelated"

export interface DraftRouteBlockingIssue {
  id: string
  field: string
  message: string
}

export interface DraftRouteDecision {
  jurisdiction: string
  practiceArea: string
  subPracticeArea: string
  partyRole: "claimant" | "respondent" | "petitioner" | "accused" | "unknown"
  causeOfAction: string
  claimBasis: string
  proceedingType: string
  documentKind: string
  draftKind: string
  forum: string
  courtLevel: string
  territorialBasis: string[]
  mandatoryPreFilingSteps: string[]
  confidence: "high" | "medium" | "low"
  reasons: string[]
  blockingIssues: DraftRouteBlockingIssue[]
  primaryDocumentLabel: string
  supportingDocumentLabels: string[]
  /** Missing particulars that may remain descriptive blanks in the draft. */
  nonBlockingBlanks?: string[]
}

export interface DraftIntentResolveResult {
  query: string
  classification: {
    intent: "filing" | "contract" | "letter" | "unknown"
    documentKind?: string
    countryCode?: string
    jurisdiction?: string
  }
  matches: DraftIntentMatch[]
  creditsUsed?: number
  balanceRemaining?: number
  matterProfile?: MatterProfile
  matterGraph?: MatterGraph
  taskGraph?: MatterTaskGraph
  recommendedActions?: string[]
  issues?: string[]
  clarifyingQuestions?: MatterClarifyingQuestion[]
  recommendationMode?: RecommendationMode
  nextBestAction?: string
  outcomeHint?: string
  documentBundle?: DraftIntentBundleItem[]
  /** Whether the filing set came from an explicit user document list or a playbook. */
  bundleSource?: "explicit" | "playbook"
  clarificationSkipped?: boolean
  playbookId?: string
  provisionalSuggestions?: boolean
  explicitDocumentResolutions?: ExplicitDocumentResolution[]
  unmappedExplicitPhrases?: UnmappedExplicitPhrase[]
  /** Deterministic procedural route metadata. Optional for older backends. */
  routeDecision?: DraftRouteDecision
  draftingBlocked?: boolean
}

export interface ExplicitDocumentSuggestion {
  kind: string
  label: string
  confidence: number
}

export interface ExplicitDocumentResolution {
  phrase: string
  kind: string
  label: string
  documentKind: string
  confidence: number
  source: "regex" | "catalog" | "llm"
  provisional?: boolean
  alternatives?: ExplicitDocumentSuggestion[]
}

export interface UnmappedExplicitPhrase {
  phrase: string
  suggestions: ExplicitDocumentSuggestion[]
}

export async function resolveDraftIntent(
  tenantId: string | undefined,
  body: {
    query: string
    countryCode?: string
    jurisdiction?: string
    answers?: Record<string, string | string[]>
    context?: DraftContext
    supplementalContext?: string
    skipClarification?: boolean
    language?: string
  },
): Promise<DraftIntentResolveResult> {
  return apiFetch<DraftIntentResolveResult>("/ai/draft-intent/resolve", {
    method: "POST",
    tenantId,
    body,
  })
}

// ─── Pre-analysis types ───────────────────────────────────────────────────────

export interface ClarifyingQuestionOption {
  value: string
  label: string
  hint?: string
  routes_to?: string
}

export interface ClarifyingQuestion {
  id: string
  prompt: string
  options: ClarifyingQuestionOption[]
  /** When true, the user may select more than one option (rendered as checkboxes). */
  multiSelect?: boolean
  /** Blocking questions cannot be skipped before drafting. */
  blocking?: boolean
}

export interface DraftContext {
  jurisdiction?: string
  statute?: string
  court?: string
  orderType?: string
  documentIntent?: string
  statuteConfidence: "high" | "medium" | "low" | "none"
  documentKind?: string
  documentKindConfidence?: "high" | "medium" | "low"
  documentKindAlternatives?: string[]
  documentKindReason?: string
}

export interface ExtractedMatterFacts {
  parties: {
    petitioner?: string
    respondent?: string
    label?: string
  }
  proceedingType?: "dv" | "maintenance" | "matrimonial" | "criminal" | "civil"
  posture?: "challenge" | "apply" | "defend"
  orderType?: "interim" | "final"
  orderAmount?: string
  hasDvCase: boolean
  hasMaintenanceContext: boolean
  hasInterimOrder: boolean
  hasMarriageValidityChallenge: boolean
  hasEarningCapacityDefence: boolean
  hasDowryDenial: boolean
  hasStalkingAllegation?: boolean
  hasOnlineConduct?: boolean
  hasPhysicalFollowConduct?: boolean
  hasThreatOrViolenceSignals?: boolean
  hasDeathOutcome?: boolean
  hasSelfDefenseSignals?: boolean
  isSelfDefenseHomicideContext?: boolean
  accusedName?: string
  hasChargesheetFiled?: boolean
  seeksDischarge?: boolean
  inferredCustodyStage?: "pre_complaint" | "investigation" | "arrest_feared" | "in_custody_or_chargesheet"
  isSparseAllegation?: boolean
  summaryLines: string[]
}

export interface DraftAnalyzeResult {
  context: DraftContext
  questions: ClarifyingQuestion[]
  extractedFacts?: ExtractedMatterFacts
  matterProfile?: MatterProfile
  matterGraph?: MatterGraph
  taskGraph?: MatterTaskGraph
  recommendedActions?: string[]
  issues?: string[]
  recommendationMode?: RecommendationMode
  nextBestAction?: string
  /** Deterministic procedural route metadata. Optional for older backends. */
  routeDecision?: DraftRouteDecision
  draftingBlocked?: boolean
}

export function hasAnswer(value: string | string[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

export function unresolvedRouteBlockers(
  route: DraftRouteDecision | undefined,
): DraftRouteBlockingIssue[] {
  return route?.blockingIssues ?? []
}

export function hasBlockingClarification(
  route: DraftRouteDecision | undefined,
  questions: Array<{ id: string; blocking?: boolean }>,
  answers: Record<string, string | string[]>,
  draftingBlocked = false,
): boolean {
  if (draftingBlocked) return true
  if (unresolvedRouteBlockers(route).length > 0) return true
  return questions.some((question) => question.blocking === true && !hasAnswer(answers[question.id]))
}

export function defaultDraftBundleKinds(
  bundle: DraftIntentBundleItem[] | undefined,
  matches: DraftIntentMatch[],
  route?: DraftRouteDecision,
): Set<string> {
  if (!bundle?.length) return new Set()

  const matchesByKind = new Map(
    matches
      .filter((match): match is DraftIntentCuratedDraftMatch => match.type === "curated_draft")
      .map((match) => [match.kind, match]),
  )

  return new Set(
    bundle
      .filter((item) => {
        if (!item.selectedByDefault || item.bundleRole === "opposing_party") return false
        if (
          item.filingRole === "optional_supporting" ||
          item.filingRole === "opposing_party" ||
          item.filingRole === "unrelated"
        ) {
          return false
        }
        const match = matchesByKind.get(item.kind)
        if (!match) return false
        if (match.provisional || match.bundleRole === "opposing_party") return false
        if (route) {
          const allowedLabels = [
            route.primaryDocumentLabel,
            ...route.supportingDocumentLabels,
          ].map((label) => label.trim().toLowerCase())
          if (
            item.kind !== route.draftKind &&
            !allowedLabels.includes(item.label.trim().toLowerCase()) &&
            !allowedLabels.includes(match.label.trim().toLowerCase())
          ) {
            return false
          }
        }
        return (
          match.filingRole !== "optional_supporting" &&
          match.filingRole !== "opposing_party" &&
          match.filingRole !== "unrelated"
        )
      })
      .map((item) => item.kind),
  )
}

export async function analyzeDraftIntent(
  tenantId: string | undefined,
  query: string,
  options?: { supplementalContext?: string },
): Promise<DraftAnalyzeResult> {
  return apiFetch<DraftAnalyzeResult>("/ai/draft-intent/analyze", {
    method: "POST",
    tenantId,
    body: {
      query,
      supplementalContext: options?.supplementalContext,
    },
  })
}
