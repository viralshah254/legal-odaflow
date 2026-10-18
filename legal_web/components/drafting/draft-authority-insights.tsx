"use client"

import type { ReactNode } from "react"
import { BookOpen } from "lucide-react"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { ResearchVerificationCard } from "@/components/research/research-verification-card"
import { SimilarCasesPanel } from "@/components/research/similar-cases-panel"

interface DraftAuthorityInsightsProps {
  verification: DraftVerificationAudit | null | undefined
  className?: string
  /** When true and no similar cases, show actionable empty state */
  caseLawSelected?: boolean
  hasDraft?: boolean
  emptyStateActions?: ReactNode
}

/** Prominent citation audit + similar cases — matches Legal Research output order. */
export function DraftAuthorityInsights({
  verification,
  className,
  caseLawSelected = false,
  hasDraft = false,
  emptyStateActions,
}: DraftAuthorityInsightsProps) {
  const similarCases = verification?.similarCases ?? []
  const showCaseLawEmptyState =
    hasDraft &&
    caseLawSelected &&
    similarCases.length === 0 &&
    !verification?.sectionChecks

  if (!verification && !showCaseLawEmptyState) return null

  const verifiedCitationCount =
    verification?.citationAudit?.verified ??
    Math.max(
      0,
      similarCases.filter((c) => c.verificationStatus === "verified").length,
    )
  const totalCitations =
    verification?.citationAudit?.total ??
    similarCases.length + (verification?.corrections.length ?? 0)

  const showSimilarCases =
    similarCases.length > 0 || verification?.sectionChecks || showCaseLawEmptyState

  const showVerification =
    verification &&
    (verification.citationAudit ||
      verification.requiresLawyerReview ||
      verification.findings?.length ||
      verification.propositions?.length ||
      verifiedCitationCount > 0)

  if (!showVerification && !showSimilarCases) return null

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {showVerification && verification && (
        <ResearchVerificationCard
          totalCitations={totalCitations}
          requiresLawyerReview={verification.requiresLawyerReview}
          citationAudit={{
            verifiedCitationCount,
            verifiedCitations: verifiedCitationCount,
            totalCitations: totalCitations || 1,
            unsupportedClaims: verification.citationWarnings.slice(0, 5).map((warning) => ({
              claim: warning,
              citations: [],
            })),
            warnings: verification.citationWarnings.slice(0, 5),
            sourceQuality:
              verification.verificationStatus === "verified"
                ? "MIXED_PRIMARY_SECONDARY"
                : verification.verificationStatus === "limited_sources"
                  ? "SECONDARY_ONLY"
                  : "INSUFFICIENT",
          }}
          findings={verification.findings}
          propositions={verification.propositions}
          dimensions={verification.dimensions}
          publicationState={verification.publicationState}
          outputHash={verification.outputHash}
        />
      )}
      {showCaseLawEmptyState && (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium">No case law retrieved</p>
              <p className="text-xs text-muted-foreground">
                Retrieval found no matching authorities for these facts. Try adding authorities
                manually or refine the fact summary and regenerate.
              </p>
            </div>
          </div>
          {emptyStateActions}
        </div>
      )}
      {similarCases.length > 0 || verification?.sectionChecks ? (
        <SimilarCasesPanel
          similarCases={similarCases}
          sectionChecks={verification?.sectionChecks}
          defaultOpen={similarCases.length > 0}
        />
      ) : null}
    </div>
  )
}
