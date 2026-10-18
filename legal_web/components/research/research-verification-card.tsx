/** @jsxRuntime automatic */
"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ShieldCheck, ShieldAlert, AlertTriangle, FileSearch, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CitationAuditSummary, SourceQuality } from "@/lib/api/ai"
import type {
  PublicationState,
  ManualReviewState,
  CitationReviewTask,
  UnsupportedPropositionTask,
  VerificationDimensions,
  VerificationFinding,
  VerifiedPropositionSummary,
} from "@/lib/api/verification"
import { ResearchVerificationActions } from "@/components/research/research-verification-actions"
import { ResearchVerificationTrustLabels } from "@/components/research/research-verification-trust-labels"
import {
  PropositionSupportList,
  CitationRelianceWarning,
  CitationVerificationChecks,
  PerCitationVerificationChecks,
  VerificationDimensionChips,
  VerificationIncompleteBanner,
  VerificationStatusBar,
} from "@/components/verification/verification-ui"
import {
  fullyVerifiedCitationCount,
  buildResearchVerificationTasks,
  getResearchRelianceState,
  humanizeResearchFinding,
  isCitationAuditSafe,
  researchRelianceLabel,
} from "@/lib/api/verification"

const SOURCE_QUALITY_META: Record<
  SourceQuality,
  { label: string; className: string; icon: typeof ShieldCheck; borderColor: string; bgColor: string }
> = {
  OFFICIAL_PRIMARY: {
    label: "Official / primary sources",
    className: "text-green-700 dark:text-green-400",
    icon: ShieldCheck,
    borderColor: "border-l-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  MIXED_PRIMARY_SECONDARY: {
    label: "Mixed primary & secondary",
    className: "text-blue-700 dark:text-blue-400",
    icon: ShieldCheck,
    borderColor: "border-l-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  SECONDARY_ONLY: {
    label: "Secondary sources only",
    className: "text-amber-700 dark:text-amber-400",
    icon: ShieldAlert,
    borderColor: "border-l-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
  },
  INSUFFICIENT: {
    label: "Insufficient sources",
    className: "text-red-700 dark:text-red-400",
    icon: ShieldAlert,
    borderColor: "border-l-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
  },
}

interface ResearchVerificationCardProps {
  citationAudit?: CitationAuditSummary | null
  totalCitations: number
  requiresLawyerReview?: boolean
  researchMode?: string
  analyticalMode?: boolean
  relianceMode?: "source-grounded" | "analytical-guidance"
  tripleCheckVerifiedCount?: number
  tripleCheckCorrectedCount?: number
  fromCache?: boolean
  findings?: VerificationFinding[]
  propositions?: VerifiedPropositionSummary[]
  dimensions?: VerificationDimensions
  publicationState?: PublicationState
  outputHash?: string
  generatedAt?: string
  manualReview?: ManualReviewState
  onResolveCitationTask?: (task: CitationReviewTask) => void
  onReviewUnsupportedProposition?: (task: UnsupportedPropositionTask) => void
}

/**
 * Shows the citation verification status for a research result: verified/total
 * citations, claims labelled for review, and overall source quality. Replaces the
 * old blanket "AI-generated" disclaimer with honest verification reporting.
 */
export function ResearchVerificationCard({
  citationAudit,
  totalCitations,
  requiresLawyerReview,
  researchMode,
  analyticalMode,
  relianceMode,
  tripleCheckVerifiedCount,
  tripleCheckCorrectedCount,
  fromCache,
  findings,
  propositions,
  dimensions,
  publicationState,
  outputHash,
  generatedAt,
  manualReview,
  onResolveCitationTask,
  onReviewUnsupportedProposition,
}: ResearchVerificationCardProps) {
  const relianceState = getResearchRelianceState({
    audit: citationAudit,
    findings,
    publicationState,
    researchMode,
    analyticalMode,
    relianceMode,
    hasCorrectedAuthorities: (tripleCheckCorrectedCount ?? 0) > 0,
    tripleCheckVerifiedCount,
  })
  const [detailsOpen, setDetailsOpen] = useState(false)
  const cacheAge = useMemo(() => {
    if (!generatedAt) return null
    const timestamp = new Date(generatedAt).getTime()
    if (!Number.isFinite(timestamp)) return null
    const days = Math.floor((Date.now() - timestamp) / 86_400_000)
    return days >= 1 ? days : null
  }, [generatedAt])
  const noLiveCitations = totalCitations === 0 && !(citationAudit?.citations?.length)
  if (noLiveCitations) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
        {researchMode === "DEEP"
          ? "AI self-check — no live retrieval or citation audit ran. Lawyer review required."
          : "Unverified AI guidance — model knowledge only. Lawyer review required."}
      </div>
    )
  }
  if (totalCitations === 0 && !citationAudit && !findings?.length && !fromCache && !generatedAt) return null

  const sourceQuality = citationAudit?.sourceQuality ?? null
  const sqMeta = sourceQuality ? SOURCE_QUALITY_META[sourceQuality] : null
  const SqIcon = sqMeta?.icon ?? ShieldCheck
  const verifiedCount = fullyVerifiedCitationCount(citationAudit)
  const totalForDisplay = citationAudit?.totalCitations ?? totalCitations
  const foundCount = citationAudit?.foundCitationCount
  const propositionCount = propositions?.length ?? 0
  const tasks = buildResearchVerificationTasks({ audit: citationAudit, propositions })
  const blockerFindings = (findings ?? []).filter((f) => f.severity === "BLOCKER" && f.state !== "PASS")
  const safeForReliance =
    relianceState === "source-verified" && isCitationAuditSafe(citationAudit)
  const explicitlyUnsafe = relianceState === "unsafe"
  const analyticalGuidance = relianceState === "analytical-guidance"
  const summaryLabel =
    analyticalGuidance
      ? "Useful doctrinal analysis — confirm local primary sources before filing or advice"
      : explicitlyUnsafe
      ? `Not safe for reliance · ${verifiedCount} of ${totalForDisplay} citations fully verified`
      : !safeForReliance && citationAudit
        ? `Reliance not established · ${verifiedCount} of ${totalForDisplay} citations fully verified`
        : verifiedCount > 0
          ? `${verifiedCount} of ${totalForDisplay} citations fully verified`
        : researchMode === "DEEP"
          ? "Verification details available"
          : "Limited citation checks"

  return (
    <div className="rounded-xl border bg-card text-sm">
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          {!safeForReliance
            ? <AlertTriangle className={cn("h-4 w-4", explicitlyUnsafe ? "text-red-600" : "text-amber-600")} />
            : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{researchRelianceLabel(relianceState)}</span>
          <span className="block text-xs text-muted-foreground">{summaryLabel}</span>
        </span>
      </div>

      <div className="space-y-3 border-t px-4 py-4">
        <ResearchVerificationTrustLabels
          audit={citationAudit}
          findings={findings}
          publicationState={publicationState}
          researchMode={researchMode}
          analyticalMode={analyticalMode}
          relianceMode={relianceMode}
          tripleCheckVerifiedCount={tripleCheckVerifiedCount}
          tripleCheckCorrectedCount={tripleCheckCorrectedCount}
          manualReview={manualReview}
          requiresLawyerReview={requiresLawyerReview}
          fromCache={fromCache}
          generatedAt={generatedAt}
        />
        <ResearchVerificationActions
          tasks={tasks}
          onResolveCitationTask={onResolveCitationTask}
          onReviewUnsupportedProposition={onReviewUnsupportedProposition}
        />
        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={detailsOpen}
        >
          Raw verification diagnostics
          <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
        </button>
      </div>

      {detailsOpen && (
        <div className="space-y-3 border-t px-4 py-4">
          {(findings?.length || publicationState) && (
            <VerificationStatusBar
              publicationState={publicationState}
              findings={findings}
              safeForReliance={citationAudit ? safeForReliance : undefined}
            />
          )}
          <CitationRelianceWarning audit={citationAudit} />
          {cacheAge != null && (
            <p className="text-xs text-muted-foreground">
              Cached or saved diagnostic snapshot: {cacheAge} day{cacheAge === 1 ? "" : "s"} old.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5">
              <FileSearch className="h-3.5 w-3.5 text-primary" />
              {verifiedCount}/{totalForDisplay} citations fully verified
            </span>
            {typeof foundCount === "number" && (
              <span className="text-muted-foreground">{foundCount} found (identity match only)</span>
            )}
            {propositionCount > 0 && <span className="text-muted-foreground">{propositionCount} propositions checked</span>}
            {sqMeta && (
              <span className={cn("flex items-center gap-1.5", sqMeta.className)}>
                <SqIcon className="h-3.5 w-3.5" /> {sqMeta.label}
              </span>
            )}
            {!citationAudit && (
              <span className="text-muted-foreground">
                {researchMode === "DEEP" ? "Limited checks only" : "Citations not fully audited"}
                {fromCache ? " (cached result)" : ""}
              </span>
            )}
          </div>
          {citationAudit
            ? <CitationVerificationChecks audit={citationAudit} />
            : <VerificationDimensionChips dimensions={dimensions} />}
          <PerCitationVerificationChecks audit={citationAudit} />
          {(citationAudit?.unsupportedClaims?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
              <p className="font-semibold">
                Unsupported claims ({citationAudit!.unsupportedClaims.length})
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {citationAudit!.unsupportedClaims.slice(0, 12).map((item, index) => (
                  <li key={`${item.claim}-${index}`}>
                    {item.claim}
                    {item.citations?.length ? (
                      <span className="text-red-800/80 dark:text-red-200/80">
                        {" "}Citations claimed: {item.citations.join(", ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <VerificationIncompleteBanner findings={findings} />
          <PropositionSupportList propositions={propositions} findings={findings} />
          {blockerFindings.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {blockerFindings.slice(0, 4).map((finding) => (
                <p key={finding.checkId}>• {humanizeResearchFinding(finding.explanation ?? "")}</p>
              ))}
            </div>
          )}
          {outputHash && <p className="text-[11px] text-muted-foreground">Audited output hash: {outputHash.slice(0, 12)}…</p>}
        </div>
      )}
    </div>
  )
}
