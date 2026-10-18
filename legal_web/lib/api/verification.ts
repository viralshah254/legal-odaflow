export type CheckState = "PASS" | "FAIL" | "INDETERMINATE" | "NOT_APPLICABLE"

export type FindingSeverity = "BLOCKER" | "HIGH" | "MEDIUM" | "LOW"

export type PublicationState =
  | "DRAFT_NOT_VERIFIED"
  | "RESEARCH_BACKED"
  | "VERIFIED_WITH_LIMITATIONS"
  | "READY_FOR_LAWYER_REVIEW"
  | "VERIFICATION_UNAVAILABLE"

/**
 * Human review is deliberately independent from automated verification.
 * A missing state must be rendered as not reviewed, never inferred from citation checks.
 */
export type ManualReviewStatus =
  | "NOT_REVIEWED"
  | "IN_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"

export interface ManualReviewState {
  status: ManualReviewStatus
  reviewerName?: string
  reviewedAt?: string
  note?: string
}

export type VerificationDimension =
  | "identity"
  | "relevance"
  | "passage"
  | "pinpoint"
  | "quotation"
  | "jurisdiction"
  | "hierarchy"
  | "treatment"
  | "currentLaw"
  | "application"
  | "citation"
  | "coverage"
  | "system"

export interface VerificationFinding {
  checkId: string
  state: CheckState
  severity: FindingSeverity
  dimension: VerificationDimension
  propositionId?: string
  authorityId?: string
  evidenceIds: string[]
  explanation: string
  repairAction?: "RETRIEVE" | "NARROW" | "RECITE" | "REMOVE" | "QUALIFY" | "ABSTAIN"
  verifierVersion: string
}

export interface VerificationDimensionSummary {
  state: CheckState
  pass: number
  fail: number
  indeterminate: number
  notApplicable: number
}

export type VerificationDimensions = Record<
  | "identity"
  | "relevance"
  | "passage"
  | "pinpoint"
  | "quotation"
  | "currentLaw"
  | "treatment"
  | "hierarchy"
  | "coverage",
  VerificationDimensionSummary
>

export interface VerifiedPropositionSummary {
  id: string
  text: string
  type: string
  materiality: "MATERIAL" | "SUPPORTING"
  evidenceIds: string[]
  supportState: CheckState | "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "CONTRADICTED"
}

export const REQUIRED_CITATION_CHECKS = [
  "identity",
  "relevance",
  "passage",
  "pinpoint",
  "jurisdiction",
  "currentLaw",
  "hierarchy",
] as const

export type CitationVerificationDimension = (typeof REQUIRED_CITATION_CHECKS)[number]

export interface CitationVerificationCheck {
  dimension: CitationVerificationDimension | "contract"
  state: Exclude<CheckState, "NOT_APPLICABLE">
  reason: string
}

export interface CitationAuditEntry {
  citation: string
  authorityId?: string
  found: boolean
  verified: boolean
  checks: CitationVerificationCheck[]
  missingReasons: string[]
  caseName?: string
  parties?: string | string[]
  judgmentDate?: string
  neutralCitation?: string
  relevantParagraphs?: string | string[]
  propositionActuallyDecided?: string
  /** Verbatim passage retrieved from the authority, when supplied by the backend. */
  exactPassage?: string
  passageText?: string
  excerpt?: string
  sourceUrl?: string
  sourceName?: string
  sourceTier?: string
  retrievedAt?: string
  sourceHash?: string
  pinpoint?: string
}

export type CitationPassageSupportState =
  | "PASSAGE_SUPPORTED"
  | "IDENTITY_ONLY"
  | "CHECKS_INCOMPLETE"
  | "NOT_FOUND"

/**
 * Describes what an individual citation proves. An identity match alone never
 * upgrades to passage support, even if a legacy payload sets `verified`.
 */
export function citationPassageSupportState(
  entry: CitationAuditEntry,
): CitationPassageSupportState {
  if (!entry.found) return "NOT_FOUND"
  const identityPassed = entry.checks?.some(
    (check) => check.dimension === "identity" && check.state === "PASS",
  )
  const passagePassed = entry.checks?.some(
    (check) => check.dimension === "passage" && check.state === "PASS",
  )
  if (identityPassed && !passagePassed) return "IDENTITY_ONLY"
  if (passagePassed && entryFullyVerified(entry)) return "PASSAGE_SUPPORTED"
  return "CHECKS_INCOMPLETE"
}

export interface CitationVerificationGap {
  citation: string
  reasons: string[]
}

export interface CitationVerificationAudit {
  verifiedCitationCount: number
  verifiedCitations?: number
  totalCitations?: number
  foundCitationCount?: number
  citations?: CitationAuditEntry[]
  rejectedCitations?: CitationAuditEntry[]
  verificationGaps?: CitationVerificationGap[]
  safeForReliance?: boolean
}

export type CitationCheckSummary = Record<CitationVerificationDimension, CheckState>

function entryFullyVerified(entry: CitationAuditEntry): boolean {
  if (!entry.verified) return false
  return REQUIRED_CITATION_CHECKS.every((dimension) =>
    entry.checks?.some((check) => check.dimension === dimension && check.state === "PASS"),
  )
}

export interface CitationReviewTask {
  id: string
  citation: string
  authorityId?: string
  supportState: CitationPassageSupportState
  reasons: string[]
}

export interface UnsupportedPropositionTask {
  id: string
  propositionId?: string
  proposition: string
  citations: string[]
}

export interface ResearchVerificationTasks {
  citationTasks: CitationReviewTask[]
  unsupportedPropositions: UnsupportedPropositionTask[]
}

export function isBoilerplateResearchProposition(text: string): boolean {
  const value = text.trim().toLowerCase()
  if (!value) return true
  return (
    /unverified ai guidance|legal research note|attorney-client|lawyer review required|typical next steps|confirm the governing contract|limitation period|do not rely on case names|model knowledge only|first-pass|exceeded the mode deadline|timed out|ai-assisted work product|ai self-check/.test(
      value,
    ) ||
    value.startsWith("question:") ||
    value.startsWith("jurisdiction:") ||
    value.startsWith("unsupported proposition:")
  )
}

/** Build the user-facing repair queue without weakening the reliance decision. */
export function buildResearchVerificationTasks(input: {
  audit?: (CitationVerificationAudit & {
    unsupportedClaims?: Array<{ claim: string; citations: string[] }>
  }) | null
  propositions?: VerifiedPropositionSummary[]
}): ResearchVerificationTasks {
  const entries = [
    ...(input.audit?.citations ?? []),
    ...(input.audit?.rejectedCitations ?? []),
  ]
  const gapReasons = new Map(
    (input.audit?.verificationGaps ?? []).map((gap) => [gap.citation, gap.reasons]),
  )
  const citationTasks = entries
    .filter((entry) => citationPassageSupportState(entry) !== "PASSAGE_SUPPORTED")
    .map((entry, index) => {
      const failedChecks = (entry.checks ?? [])
        .filter((check) => check.state !== "PASS")
        .map((check) => check.reason)
      return {
        id: entry.authorityId ?? `${entry.citation}-${index}`,
        citation: entry.citation,
        authorityId: entry.authorityId,
        supportState: citationPassageSupportState(entry),
        reasons: [
          ...(gapReasons.get(entry.citation) ?? []),
          ...(entry.missingReasons ?? []),
          ...failedChecks,
        ].filter((reason, reasonIndex, all) => all.indexOf(reason) === reasonIndex),
      }
    })

  const unsupportedFromAudit = (input.audit?.unsupportedClaims ?? [])
    .filter((item) => !isBoilerplateResearchProposition(item.claim))
    .map(
    (item, index): UnsupportedPropositionTask => ({
      id: `audit-${index}`,
      proposition: item.claim,
      citations: item.citations,
    }),
  )
  const unsupportedFromPlan = (input.propositions ?? [])
    .filter((proposition) =>
      proposition.supportState === "UNSUPPORTED" ||
      proposition.supportState === "CONTRADICTED" ||
      proposition.supportState === "FAIL",
    )
    .filter((proposition) => !isBoilerplateResearchProposition(proposition.text))
    .filter((proposition) =>
      !unsupportedFromAudit.some((task) => task.proposition === proposition.text),
    )
    .map((proposition): UnsupportedPropositionTask => ({
      id: proposition.id,
      propositionId: proposition.id,
      proposition: proposition.text,
      citations: proposition.evidenceIds,
    }))

  return {
    citationTasks,
    unsupportedPropositions: [...unsupportedFromAudit, ...unsupportedFromPlan],
  }
}

/** Count only citations that the backend marks verified with all seven required checks. */
export function fullyVerifiedCitationCount(audit?: CitationVerificationAudit | null): number {
  if (!audit) return 0
  if (audit.citations?.length) return audit.citations.filter(entryFullyVerified).length
  if (audit.safeForReliance === true) {
    return audit.verifiedCitations ?? audit.verifiedCitationCount ?? 0
  }
  return 0
}

/**
 * Aggregate the seven required citation checks. Missing checks are incomplete.
 * Unsafe results never receive a green/pass state.
 */
export function summarizeCitationChecks(audit?: CitationVerificationAudit | null): CitationCheckSummary {
  const entries = [...(audit?.citations ?? []), ...(audit?.rejectedCitations ?? [])]
  const summary = Object.fromEntries(
    REQUIRED_CITATION_CHECKS.map((dimension) => {
      const states = entries.flatMap((entry) =>
        (entry.checks ?? []).filter((check) => check.dimension === dimension).map((check) => check.state),
      )
      let state: CheckState
      if (states.includes("FAIL")) state = "FAIL"
      else if (entries.length === 0 || states.length !== entries.length || states.includes("INDETERMINATE")) {
        state = "INDETERMINATE"
      } else {
        state = "PASS"
      }
      return [dimension, state]
    }),
  ) as CitationCheckSummary
  const globallyVerified =
    audit?.safeForReliance === true &&
    (audit.rejectedCitations?.length ?? 0) === 0 &&
    (audit.verificationGaps?.length ?? 0) === 0 &&
    REQUIRED_CITATION_CHECKS.every((dimension) => summary[dimension] === "PASS")
  if (globallyVerified) return summary
  return Object.fromEntries(
    REQUIRED_CITATION_CHECKS.map((dimension) => [
      dimension,
      summary[dimension] === "PASS" ? "INDETERMINATE" : summary[dimension],
    ]),
  ) as CitationCheckSummary
}

export function isCitationAuditSafe(audit?: CitationVerificationAudit | null): boolean {
  if (audit?.safeForReliance !== true) return false
  if ((audit.rejectedCitations?.length ?? 0) > 0 || (audit.verificationGaps?.length ?? 0) > 0) return false
  return REQUIRED_CITATION_CHECKS.every(
    (dimension) => summarizeCitationChecks(audit)[dimension] === "PASS",
  )
}

export type ResearchRelianceState =
  | "source-verified"
  | "corrected"
  | "analytical-guidance"
  | "ai-suggested"
  | "limited"
  | "unsafe"
  | "unavailable"

export type TripleCheckPassBadges = {
  corpus?: boolean
  connector?: boolean
  web?: boolean
}

/**
 * One conservative status for all research surfaces. Missing legacy fields never
 * become a positive verification claim.
 */
export function getResearchRelianceState(input: {
  audit?: (CitationVerificationAudit & {
    unsupportedClaims?: Array<{ claim: string; citations: string[] }>
  }) | null
  findings?: VerificationFinding[]
  publicationState?: PublicationState
  researchMode?: string
  /** Backend thin-RAG / best-effort doctrine mode. */
  analyticalMode?: boolean
  relianceMode?: "source-grounded" | "analytical-guidance"
  /** ≥1 authority corrected by triple-check toward corpus/connector. */
  hasCorrectedAuthorities?: boolean
  /** Section Finder / other AI suggestions only. */
  aiSuggestedOnly?: boolean
  /** Triple-check verified count (≥2-pass agreement). */
  tripleCheckVerifiedCount?: number
}): ResearchRelianceState {
  const {
    audit,
    findings = [],
    publicationState,
    researchMode,
    analyticalMode,
    relianceMode,
    hasCorrectedAuthorities,
    aiSuggestedOnly,
    tripleCheckVerifiedCount,
  } = input
  const unresolvedBlocker = findings.some(
    (finding) => finding.severity === "BLOCKER" && finding.state !== "PASS",
  )
  const failedFinding = findings.some((finding) => finding.state === "FAIL")

  if (aiSuggestedOnly) return "ai-suggested"
  if (publicationState === "VERIFICATION_UNAVAILABLE") return "unavailable"
  if (
    audit?.safeForReliance === false ||
    (audit?.unsupportedClaims?.length ?? 0) > 0 ||
    unresolvedBlocker ||
    failedFinding ||
    publicationState === "DRAFT_NOT_VERIFIED"
  ) {
    if (hasCorrectedAuthorities) return "corrected"
    if (analyticalMode || relianceMode === "analytical-guidance") {
      return "analytical-guidance"
    }
    return "unsafe"
  }
  if (
    isCitationAuditSafe(audit) &&
    (tripleCheckVerifiedCount === undefined || tripleCheckVerifiedCount > 0)
  ) {
    return hasCorrectedAuthorities ? "corrected" : "source-verified"
  }
  if (hasCorrectedAuthorities) return "corrected"
  if (analyticalMode || relianceMode === "analytical-guidance") {
    return "analytical-guidance"
  }
  if (!audit && !findings.length) {
    return researchMode === "FAST" || researchMode === "GUIDANCE" ? "limited" : "unavailable"
  }
  return "limited"
}

export function researchRelianceLabel(state: ResearchRelianceState): string {
  switch (state) {
    case "source-verified":
      return "Source verified (2–3 checks)"
    case "corrected":
      return "Corrected toward corpus/connector"
    case "analytical-guidance":
      return "Analytical guidance (confirm locally)"
    case "ai-suggested":
      return "AI-suggested — not verified"
    case "limited":
      return "Verification limited"
    case "unsafe":
      return "Unsafe for reliance"
    case "unavailable":
      return "Verification unavailable"
  }
}

export function tripleCheckPassLabel(checks?: TripleCheckPassBadges): string {
  if (!checks) return ""
  const parts = [
    checks.corpus ? "Corpus" : null,
    checks.connector ? "Connector" : null,
    checks.web ? "Web" : null,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "No passes"
}

export function buildResearchVerificationAppendix(input: {
  audit?: (CitationVerificationAudit & {
    unsupportedClaims?: Array<{ claim: string; citations: string[] }>
  }) | null
  findings?: VerificationFinding[]
  publicationState?: PublicationState
  researchMode?: string
  analyticalMode?: boolean
  relianceMode?: "source-grounded" | "analytical-guidance"
}): string {
  const state = getResearchRelianceState(input)
  const lines = [
    "## Verification appendix",
    "",
    `Reliance status: ${researchRelianceLabel(state)}.`,
  ]
  const unsupported = input.audit?.unsupportedClaims ?? []
  if (unsupported.length > 0) {
    lines.push("", "### Unsupported claims")
    unsupported.forEach((item) => {
      lines.push(`- ${item.claim}${item.citations.length ? ` (claimed citations: ${item.citations.join(", ")})` : ""}`)
    })
  }
  const entries = [...(input.audit?.citations ?? []), ...(input.audit?.rejectedCitations ?? [])]
  if (entries.length > 0) {
    lines.push("", "### Per-citation checks")
    entries.forEach((entry) => {
      lines.push(`- ${entry.citation}: ${entry.verified ? "verified" : entry.found ? "checks incomplete" : "not verified"}`)
      entry.checks.forEach((check) => {
        lines.push(`  - ${check.dimension}: ${check.state} — ${check.reason}`)
      })
      entry.missingReasons.forEach((reason) => lines.push(`  - Missing: ${reason}`))
    })
  }
  const unresolved = (input.findings ?? []).filter((finding) => finding.state !== "PASS")
  if (unresolved.length > 0) {
    lines.push("", "### Unresolved findings")
    unresolved.forEach((finding) => {
      lines.push(`- ${finding.severity} ${finding.dimension}: ${humanizeResearchFinding(finding.explanation)}`)
    })
  }
  lines.push("", "This draft must be independently verified before filing, citation, or client advice.")
  return lines.join("\n")
}

export function fallbackDimensions(): VerificationDimensions {
  const na = (): VerificationDimensionSummary => ({
    state: "NOT_APPLICABLE",
    pass: 0,
    fail: 0,
    indeterminate: 0,
    notApplicable: 1,
  })
  return {
    identity: na(),
    relevance: na(),
    passage: na(),
    pinpoint: na(),
    quotation: na(),
    currentLaw: na(),
    treatment: na(),
    hierarchy: na(),
    coverage: na(),
  }
}

export function publicationStateLabel(state?: PublicationState): string {
  switch (state) {
    case "READY_FOR_LAWYER_REVIEW":
      return "Ready for lawyer review"
    case "VERIFIED_WITH_LIMITATIONS":
      return "Verified with limitations"
    case "RESEARCH_BACKED":
      return "Research-backed"
    case "VERIFICATION_UNAVAILABLE":
      return "Verification incomplete"
    case "DRAFT_NOT_VERIFIED":
      return "Draft — not verified"
    default:
      return "Limited checks only"
  }
}

export function checkStateLabel(state: CheckState): string {
  switch (state) {
    case "PASS":
      return "Pass"
    case "FAIL":
      return "Fail"
    case "INDETERMINATE":
      return "Incomplete"
    case "NOT_APPLICABLE":
      return "N/A"
  }
}

/** True when the research result may show a green "Verified" badge in lists. */
export function isResearchVerifiedForDisplay(
  publicationState?: PublicationState,
  verified?: boolean,
  safeForReliance?: boolean,
): boolean {
  if (safeForReliance !== true) return false
  if (publicationState === "VERIFICATION_UNAVAILABLE" || publicationState === "DRAFT_NOT_VERIFIED") {
    return false
  }
  if (
    publicationState === "READY_FOR_LAWYER_REVIEW" ||
    publicationState === "VERIFIED_WITH_LIMITATIONS" ||
    publicationState === "RESEARCH_BACKED"
  ) {
    return true
  }
  return verified === true && safeForReliance === true
}

/** Plain-language labels for research verification findings shown in the UI. */
export function humanizeResearchFinding(explanation: string): string {
  if (/factIds and basedOnClaimIds/i.test(explanation)) {
    return "Application to your facts needs review — link the legal rule to the stated facts."
  }
  if (/identity could not be confirmed/i.test(explanation)) {
    return "Citation could not be matched to retrieved sources."
  }
  if (/No meaningful overlap/i.test(explanation)) {
    return "Retrieved passage may not fully support this statement."
  }
  if (/does not sufficiently support/i.test(explanation)) {
    return "Retrieved passage may not fully support this statement."
  }
  if (/structured proposition plan could not be parsed/i.test(explanation)) {
    return "Structured verification plan could not be built — treat as draft only."
  }
  return explanation
}
