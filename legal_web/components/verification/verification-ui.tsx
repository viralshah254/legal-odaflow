"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, FileSearch, ShieldAlert, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  checkStateLabel,
  fallbackDimensions,
  humanizeResearchFinding,
  publicationStateLabel,
  summarizeCitationChecks,
  REQUIRED_CITATION_CHECKS,
  type CitationVerificationAudit,
  type CheckState,
  type PublicationState,
  type VerificationDimensions,
  type VerificationFinding,
  type VerifiedPropositionSummary,
} from "@/lib/api/verification"
import { labelForAccuracyBlocker } from "@/lib/drafting/accuracy-blocker-labels"

const DIMENSION_LABELS: Record<keyof VerificationDimensions, string> = {
  identity: "Identity",
  relevance: "Relevance",
  passage: "Passage",
  pinpoint: "Pinpoint",
  quotation: "Quotation",
  currentLaw: "Current law",
  treatment: "Treatment",
  hierarchy: "Hierarchy",
  coverage: "Coverage",
}

const CITATION_CHECK_LABELS: Record<(typeof REQUIRED_CITATION_CHECKS)[number], string> = {
  identity: "Identity",
  relevance: "Relevance",
  passage: "Passage",
  pinpoint: "Pinpoint",
  jurisdiction: "Jurisdiction",
  currentLaw: "Current law",
  hierarchy: "Hierarchy",
}

function stateClass(state: CheckState) {
  switch (state) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    case "FAIL":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
    case "INDETERMINATE":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
    case "NOT_APPLICABLE":
      return "border-border bg-muted/30 text-muted-foreground"
  }
}

function publicationMeta(state?: PublicationState) {
  switch (state) {
    case "READY_FOR_LAWYER_REVIEW":
      return { icon: CheckCircle2, cls: stateClass("PASS"), subtitle: "Mandatory Phase 1 checks passed; good-law graph not run." }
    case "VERIFIED_WITH_LIMITATIONS":
      return { icon: AlertTriangle, cls: stateClass("INDETERMINATE"), subtitle: "Some checks need review before filing." }
    case "VERIFICATION_UNAVAILABLE":
      return { icon: ShieldAlert, cls: stateClass("INDETERMINATE"), subtitle: "Verification incomplete. Do not treat as court-ready." }
    case "DRAFT_NOT_VERIFIED":
      return { icon: XCircle, cls: stateClass("FAIL"), subtitle: "Blockers were found in the retrieved support." }
    case "RESEARCH_BACKED":
      return { icon: FileSearch, cls: stateClass("PASS"), subtitle: "Research-backed, with advanced checks shown below." }
    default:
      return { icon: ShieldAlert, cls: stateClass("INDETERMINATE"), subtitle: "Older result format. Limited checks only." }
  }
}

export function VerificationStatusBar({
  publicationState,
  findings,
  safeForReliance,
  className,
}: {
  publicationState?: PublicationState
  findings?: VerificationFinding[]
  safeForReliance?: boolean
  className?: string
}) {
  const meta = safeForReliance === false
    ? { icon: XCircle, cls: stateClass("FAIL"), subtitle: "Citation verification has unresolved failures or gaps." }
    : publicationMeta(publicationState)
  const Icon = meta.icon
  const blockers = (findings ?? []).filter((f) => f.severity === "BLOCKER" && f.state !== "PASS").length
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs", meta.cls, className)} aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-semibold">{publicationStateLabel(publicationState)}</span>
        <span className="opacity-80">{meta.subtitle}</span>
        {blockers > 0 && <span className="font-medium">{blockers} blocker{blockers === 1 ? "" : "s"}</span>}
      </div>
    </div>
  )
}

export function CitationVerificationChecks({
  audit,
}: {
  audit?: CitationVerificationAudit | null
}) {
  const checks = summarizeCitationChecks(audit)
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">Required citation checks</p>
      <div className="flex flex-wrap gap-1.5">
        {REQUIRED_CITATION_CHECKS.map((dimension) => (
          <span
            key={dimension}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              stateClass(checks[dimension]),
            )}
            title={`${CITATION_CHECK_LABELS[dimension]}: ${checkStateLabel(checks[dimension])}`}
          >
            {CITATION_CHECK_LABELS[dimension]}
            <span className="opacity-80">{checkStateLabel(checks[dimension])}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function PerCitationVerificationChecks({
  audit,
}: {
  audit?: CitationVerificationAudit | null
}) {
  const entries = [...(audit?.citations ?? []), ...(audit?.rejectedCitations ?? [])]
  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Checks by citation</p>
      {entries.map((entry, index) => (
        <details
          key={`${entry.authorityId ?? entry.citation}-${index}`}
          className="rounded-md border bg-background/50 px-3 py-2 text-xs"
          open={!entry.verified || entry.missingReasons.length > 0}
        >
          <summary className="cursor-pointer font-medium">
            {entry.citation} — {entry.verified ? "verified" : entry.found ? "found, checks incomplete" : "not verified"}
          </summary>
          <div className="mt-2 space-y-1.5">
            {(entry.checks ?? []).map((check) => (
              <div key={`${entry.citation}-${check.dimension}`} className="flex gap-2">
                <span className={cn("shrink-0 rounded border px-1.5 py-0.5", stateClass(check.state))}>
                  {CITATION_CHECK_LABELS[check.dimension as keyof typeof CITATION_CHECK_LABELS] ??
                    check.dimension}{" "}
                  {checkStateLabel(check.state)}
                </span>
                <span className="text-muted-foreground">{check.reason}</span>
              </div>
            ))}
            {entry.missingReasons.map((reason, reasonIndex) => (
              <p key={`${entry.citation}-missing-${reasonIndex}`} className="text-amber-700 dark:text-amber-300">
                Missing: {reason}
              </p>
            ))}
            {(entry.exactPassage || entry.passageText || entry.excerpt) && (
              <blockquote className="border-l-2 border-primary/30 pl-2 leading-relaxed">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Retrieved passage
                </span>
                “{entry.exactPassage ?? entry.passageText ?? entry.excerpt}”
              </blockquote>
            )}
            {(entry.sourceName || entry.sourceTier || entry.sourceUrl || entry.authorityId ||
              entry.pinpoint || entry.retrievedAt || entry.sourceHash) && (
              <p className="text-[11px] text-muted-foreground">
                Provenance: {[entry.sourceName, entry.sourceTier, entry.authorityId, entry.pinpoint,
                  entry.retrievedAt ? `retrieved ${new Date(entry.retrievedAt).toLocaleString()}` : undefined,
                  entry.sourceHash ? `hash ${entry.sourceHash.slice(0, 12)}…` : undefined,
                  entry.sourceUrl]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}

export function CitationRelianceWarning({
  audit,
}: {
  audit?: CitationVerificationAudit | null
}) {
  const gaps = new Map<string, string[]>()
  for (const gap of audit?.verificationGaps ?? []) {
    gaps.set(gap.citation, gap.reasons)
  }
  for (const rejected of audit?.rejectedCitations ?? []) {
    if (!gaps.has(rejected.citation)) {
      gaps.set(rejected.citation, rejected.missingReasons ?? ["Citation failed verification."])
    }
  }
  if (audit?.safeForReliance !== false && gaps.size === 0) return null

  return (
    <div
      className="rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-xs text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
      role="alert"
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <XCircle className="h-4 w-4 shrink-0" />
        Not safe for reliance
      </p>
      <p className="mt-1 text-red-800 dark:text-red-200">
        Do not cite or advise from this result until every retrieval and verification gap is resolved.
      </p>
      {gaps.size > 0 && (
        <div className="mt-2">
          <p className="font-semibold">Retrieval and verification gaps</p>
          <ul className="mt-1 space-y-1.5">
            {[...gaps.entries()].map(([citation, reasons]) => (
              <li key={citation}>
                <span className="font-medium">{citation}</span>
                <ul className="ml-4 list-disc">
                  {reasons.map((reason, index) => (
                    <li key={`${citation}-${index}`}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function VerificationDimensionChips({
  dimensions,
  compact = false,
}: {
  dimensions?: VerificationDimensions
  compact?: boolean
}) {
  const data = dimensions ?? fallbackDimensions()
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(DIMENSION_LABELS) as Array<keyof VerificationDimensions>).map((key) => {
        const item = data[key]
        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
              compact ? "text-[10px]" : "text-xs",
              stateClass(item.state),
            )}
            title={`${DIMENSION_LABELS[key]}: ${checkStateLabel(item.state)}`}
          >
            {DIMENSION_LABELS[key]}
            <span className="opacity-80">{checkStateLabel(item.state)}</span>
          </span>
        )
      })}
    </div>
  )
}

export function VerificationIncompleteBanner({ findings }: { findings?: VerificationFinding[] }) {
  const incomplete = (findings ?? []).filter((f) => f.severity === "BLOCKER" && f.state === "INDETERMINATE")
  if (incomplete.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="flex items-center gap-1.5 font-medium">
        <ShieldAlert className="h-3.5 w-3.5" />
        Verification incomplete — do not treat as court-ready.
      </p>
      <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">
        {humanizeResearchFinding(incomplete[0]?.explanation ?? "")}
      </p>
    </div>
  )
}

export function PropositionSupportList({
  propositions,
  findings,
}: {
  propositions?: VerifiedPropositionSummary[]
  findings?: VerificationFinding[]
}) {
  const [open, setOpen] = useState(false)
  const material = (propositions ?? []).filter((p) => p.materiality === "MATERIAL").slice(0, 12)
  if (material.length === 0) return null

  return (
    <div className="rounded-lg border bg-background/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
        aria-expanded={open}
      >
        <span>Material propositions ({material.length})</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2">
          {material.map((proposition) => {
            const related = (findings ?? []).filter((f) => f.propositionId === proposition.id && f.state !== "PASS")
            return (
              <div key={proposition.id} className="space-y-1 rounded-md bg-muted/20 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full border px-1.5 py-0.5", stateClass(toCheckState(proposition.supportState)))}>
                    {supportLabel(proposition.supportState)}
                  </span>
                  <span className="text-muted-foreground">{proposition.type}</span>
                </div>
                <p className="line-clamp-3 leading-relaxed">{proposition.text}</p>
                {related[0] && (
                  <p className="text-muted-foreground">{humanizeResearchFinding(related[0].explanation ?? "")}</p>
                )}
                <PassageEvidencePreview evidenceIds={proposition.evidenceIds} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PassageEvidencePreview({ evidenceIds }: { evidenceIds: string[] }) {
  if (evidenceIds.length === 0) return null
  return (
    <p className="text-[11px] text-muted-foreground">
      Evidence: {evidenceIds.slice(0, 3).join(", ")}
      {evidenceIds.length > 3 ? "…" : ""}
    </p>
  )
}

export function ExportBlockedDialog({
  open,
  findings,
  accuracyWarnings,
  confirmationQuestions,
  finalResolutionStatus,
  onClose,
  onExportDraft,
  onAnswerConfirmations,
}: {
  open: boolean
  findings?: VerificationFinding[]
  /** Citation / accuracy warning strings e.g. "Accuracy: [WRONG_SECTION] ..." */
  accuracyWarnings?: string[]
  confirmationQuestions?: Array<{
    findingCode: string
    field: string
    question: string
  }>
  finalResolutionStatus?: string | null
  onClose: () => void
  onExportDraft?: () => void
  onAnswerConfirmations?: () => void
}) {
  if (!open) return null
  const blockers = (findings ?? []).filter((f) => f.severity === "BLOCKER" && f.state !== "PASS").slice(0, 3)
  const accuracyItems = (accuracyWarnings ?? [])
    .filter((w) => /Accuracy:|WRONG_|KNOWN_VALUE|INVENTED_|PARTY_|FORUM|SECTION/i.test(w))
    .slice(0, 5)
  const needsConfirmation =
    finalResolutionStatus === "needs_user_confirmation" ||
    (confirmationQuestions?.length ?? 0) > 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border bg-background p-4 shadow-lg">
        <h2 className="text-sm font-semibold">
          {needsConfirmation
            ? "Confirm a few facts to finish automated repair"
            : "Filing export unavailable until blockers are resolved"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {needsConfirmation
            ? "Automated repair paused where the correct answer cannot be determined safely."
            : "You can still export a watermarked draft for lawyer review."}
        </p>
        <div className="mt-3 space-y-2">
          {(confirmationQuestions ?? []).slice(0, 4).map((q) => (
            <div
              key={`${q.findingCode}-${q.field}`}
              className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p className="font-semibold">{q.findingCode}</p>
              <p className="mt-0.5 opacity-80">{q.question}</p>
            </div>
          ))}
          {accuracyItems.map((w) => (
            <div
              key={w}
              className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p className="font-semibold">{labelForAccuracyBlocker(w)}</p>
              <p className="mt-0.5 opacity-80">{w.replace(/^Accuracy:\s*/i, "")}</p>
            </div>
          ))}
          {blockers.length > 0 ? blockers.map((finding) => (
            <div key={finding.checkId} className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">
                {labelForAccuracyBlocker(humanizeResearchFinding(finding.explanation ?? finding.checkId))}
              </p>
              <p className="mt-0.5 opacity-80">{humanizeResearchFinding(finding.explanation ?? "")}</p>
            </div>
          )) : accuracyItems.length === 0 && (confirmationQuestions?.length ?? 0) === 0 ? (
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Certification is unavailable for this result format.
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-xs">
            Cancel
          </button>
          {needsConfirmation && onAnswerConfirmations && (
            <button
              type="button"
              onClick={onAnswerConfirmations}
              className="rounded-md border border-amber-600 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200"
            >
              Answer confirmations
            </button>
          )}
          {onExportDraft && (
            <button type="button" onClick={onExportDraft} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              Export draft
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function toCheckState(state: VerifiedPropositionSummary["supportState"]): CheckState {
  if (state === "SUPPORTED") return "PASS"
  if (state === "PARTIAL") return "INDETERMINATE"
  if (state === "UNSUPPORTED" || state === "CONTRADICTED") return "FAIL"
  return state
}

function supportLabel(state: VerifiedPropositionSummary["supportState"]) {
  switch (state) {
    case "SUPPORTED":
      return "Passage supports this claim"
    case "PARTIAL":
      return "Partially supported — review wording"
    case "UNSUPPORTED":
      return "Not supported by retrieved passages"
    case "CONTRADICTED":
      return "Contradicted by linked passage"
    case "INDETERMINATE":
      return "Verification incomplete"
    case "PASS":
      return "Passage supports this claim"
    case "FAIL":
      return "Not supported by retrieved passages"
    case "NOT_APPLICABLE":
      return "N/A"
  }
}
