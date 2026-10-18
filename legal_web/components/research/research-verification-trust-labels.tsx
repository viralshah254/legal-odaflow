/** @jsxRuntime automatic */
"use client"

import { AlertTriangle, Bot, Clock3, Database, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getResearchRelianceState,
  researchRelianceLabel,
  summarizeCitationChecks,
  type CitationVerificationAudit,
  type ManualReviewState,
  type PublicationState,
  type VerificationFinding,
} from "@/lib/api/verification"

interface ResearchVerificationTrustLabelsProps {
  audit?: CitationVerificationAudit | null
  findings?: VerificationFinding[]
  publicationState?: PublicationState
  researchMode?: string
  analyticalMode?: boolean
  relianceMode?: "source-grounded" | "analytical-guidance"
  tripleCheckVerifiedCount?: number
  tripleCheckCorrectedCount?: number
  manualReview?: ManualReviewState
  requiresLawyerReview?: boolean
  fromCache?: boolean
  generatedAt?: string
}

function manualReviewLabel(review?: ManualReviewState, required?: boolean): string {
  switch (review?.status) {
    case "APPROVED":
      return review.reviewerName ? `Approved by ${review.reviewerName}` : "Human approved"
    case "IN_REVIEW":
      return "Human review in progress"
    case "CHANGES_REQUESTED":
      return "Human changes requested"
    case "NOT_REVIEWED":
    default:
      return required ? "Lawyer review required" : "Not human approved"
  }
}

export function ResearchVerificationTrustLabels({
  audit,
  findings,
  publicationState,
  researchMode,
  analyticalMode,
  relianceMode,
  tripleCheckVerifiedCount,
  tripleCheckCorrectedCount,
  manualReview,
  requiresLawyerReview,
  fromCache,
  generatedAt,
}: ResearchVerificationTrustLabelsProps) {
  const reliance = getResearchRelianceState({
    audit,
    findings,
    publicationState,
    researchMode,
    analyticalMode,
    relianceMode,
    hasCorrectedAuthorities: (tripleCheckCorrectedCount ?? 0) > 0,
    tripleCheckVerifiedCount,
  })
  const currentLaw = audit ? summarizeCitationChecks(audit).currentLaw : "INDETERMINATE"
  const cacheLabel = fromCache === true
    ? "Cached result"
    : fromCache === false
      ? "Current response"
      : "Cache status unknown"
  const generatedLabel = generatedAt && Number.isFinite(new Date(generatedAt).getTime())
    ? ` · generated ${new Date(generatedAt).toLocaleDateString()}`
    : ""
  const items = [
    {
      label: "Automated verification",
      value: researchRelianceLabel(reliance),
      detail:
        reliance === "analytical-guidance"
          ? "Doctrine/comparative analysis with thin local retrieval — confirm primary sources locally."
          : reliance === "corrected"
            ? "Model text was repaired toward corpus/connector after multi-pass checks."
            : tripleCheckVerifiedCount != null
              ? `${tripleCheckVerifiedCount} authority(ies) passed ≥2 of corpus/connector/web checks.`
              : "Source checks only; not human approval.",
      icon: Bot,
      warning: reliance !== "source-verified",
    },
    {
      label: "Human approval",
      value: manualReviewLabel(manualReview, requiresLawyerReview),
      detail: manualReview?.reviewedAt ? `Recorded ${new Date(manualReview.reviewedAt).toLocaleDateString()}.` : "Tracked separately from automation.",
      icon: UserCheck,
      warning: manualReview?.status !== "APPROVED",
    },
    {
      label: "Current-law check",
      value: currentLaw === "PASS" ? "Automated check passed" : currentLaw === "FAIL" ? "Check failed" : "Not established",
      detail: "Confirm later authorities and amendments.",
      icon: Clock3,
      warning: currentLaw !== "PASS",
    },
    {
      label: "Result freshness",
      value: `${cacheLabel}${generatedLabel}`,
      detail: fromCache ? "Re-check before relying on saved research." : "Freshness does not prove current law.",
      icon: Database,
      warning: fromCache !== false,
    },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="Verification trust states">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className="rounded-lg border bg-background/60 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </p>
            <p className={cn("mt-0.5 text-xs font-semibold", item.warning && "text-amber-700 dark:text-amber-300")}>
              {item.warning && <AlertTriangle className="mr-1 inline h-3 w-3" />}
              {item.value}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.detail}</p>
          </div>
        )
      })}
    </div>
  )
}
