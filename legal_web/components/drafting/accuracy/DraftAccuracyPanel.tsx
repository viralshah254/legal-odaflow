"use client"

import { useState } from "react"
import { ChevronDown, FileSearch } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { ResearchVerificationCard } from "@/components/research/research-verification-card"
import { SimilarCasesPanel } from "@/components/research/similar-cases-panel"
import { DraftAccuracyHeader } from "./DraftAccuracyHeader"
import { DraftStrippedCitationsBanner } from "./DraftStrippedCitationsBanner"
import { DraftAccuracyStepper } from "./DraftAccuracyStepper"
import {
  ExportBlockedDialog,
  PropositionSupportList,
  VerificationDimensionChips,
  VerificationIncompleteBanner,
  VerificationStatusBar,
} from "@/components/verification/verification-ui"

interface DraftAccuracyPanelProps {
  verification: DraftVerificationAudit | null | undefined
  className?: string
  onFixTopBlockers?: () => void
  onReverify?: () => void
  fixLoading?: boolean
  /** Hide similar cases — shown separately via DraftAuthorityInsights */
  hideSimilarCases?: boolean
  /** Hide citation verification card — shown separately via DraftAuthorityInsights */
  hideVerificationCard?: boolean
}

export function DraftAccuracyPanel({
  verification,
  className,
  onFixTopBlockers,
  onReverify,
  fixLoading = false,
  hideSimilarCases = false,
  hideVerificationCard = false,
}: DraftAccuracyPanelProps) {
  const t = useTranslations("drafting.accuracy")
  const [open, setOpen] = useState(true)
  const [blockedOpen, setBlockedOpen] = useState(false)

  if (!verification) return null

  const hasContent =
    verification.corrections.length > 0 ||
    verification.similarCases.length > 0 ||
    verification.citationWarnings.length > 0 ||
    verification.strippedCitations.length > 0 ||
    verification.proceduralWarnings.length > 0 ||
    verification.completenessGaps.length > 0 ||
    verification.requiresLawyerReview

  if (!hasContent && verification.verificationStatus === "verified") {
    return (
      <div className={cn("mt-3 space-y-2", className)}>
        <DraftAccuracyHeader verification={verification} />
        {(verification.findings?.length || verification.publicationState) && (
          <>
            <VerificationStatusBar
              publicationState={verification.publicationState}
              findings={verification.findings}
            />
            <VerificationDimensionChips dimensions={verification.dimensions} />
          </>
        )}
      </div>
    )
  }

  const verifiedCitationCount =
    verification.citationAudit?.verified ??
    Math.max(
      0,
      verification.similarCases.filter((c) => c.verificationStatus === "verified").length,
    )
  const totalCitations =
    verification.citationAudit?.total ??
    verification.similarCases.length + verification.corrections.length
  const canCertify = verification.canCertify === true

  return (
    <div className={cn("mt-3 space-y-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileSearch className="h-4 w-4 text-primary" />
          {t("auditTitle")}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
          <DraftAccuracyHeader verification={verification} />
          <VerificationStatusBar
            publicationState={verification.publicationState}
            findings={verification.findings}
          />
          <VerificationDimensionChips dimensions={verification.dimensions} />
          <VerificationIncompleteBanner findings={verification.findings} />
          <DraftStrippedCitationsBanner verification={verification} />
          <DraftAccuracyStepper verification={verification} />
          {!canCertify && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <button
                type="button"
                onClick={() => setBlockedOpen(true)}
                className="block text-left"
              >
                Filing export unavailable until blockers are resolved. Draft export remains available with a watermark.
              </button>
              {(onFixTopBlockers || onReverify) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {onFixTopBlockers && (
                    <button
                      type="button"
                      onClick={onFixTopBlockers}
                      disabled={fixLoading}
                      className="rounded-md bg-amber-700 px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
                    >
                      {fixLoading ? "Fixing…" : "Fix top blockers"}
                    </button>
                  )}
                  {onReverify && (
                    <button
                      type="button"
                      onClick={onReverify}
                      disabled={fixLoading}
                      className="rounded-md border border-amber-300 px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-60"
                    >
                      Re-verify current draft
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {verification.corrections.length > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                {t("autoCorrected", { count: verification.corrections.length })}
              </p>
              <ul className="text-muted-foreground space-y-0.5">
                {verification.corrections.slice(0, 4).map((c, i) => (
                  <li key={i} className="line-clamp-2">
                    {c.from.slice(0, 50)}… → {c.to.slice(0, 50)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          {typeof verification.factCoverageRate === "number" && (
            <div className="rounded-md border px-3 py-2 text-xs space-y-1">
              <p className="font-medium">
                {t("factCoverage", {
                  percent: Math.round(verification.factCoverageRate * 100),
                })}
              </p>
              {(verification.missingDefenceFacts?.length ?? 0) > 0 && (
                <>
                  <p className="text-amber-800 dark:text-amber-300 font-medium">
                    {t("missingDefenceFacts")}
                  </p>
                  <ul className="text-muted-foreground space-y-0.5">
                    {verification.missingDefenceFacts!.slice(0, 5).map((f, i) => (
                      <li key={i} className="line-clamp-2">
                        • {f}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {(verification.autoAppliedFixes?.length ?? 0) > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs space-y-1 dark:border-emerald-800 dark:bg-emerald-950/20">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                {t("autoAppliedFixes")} ({verification.autoAppliedFixes!.length})
              </p>
              <ul className="text-muted-foreground space-y-0.5">
                {verification.autoAppliedFixes!.slice(0, 5).map((fix, i) => (
                  <li key={i} className="line-clamp-2">
                    {fix.reason}
                    {fix.originalText
                      ? `: “${fix.originalText.slice(0, 40)}” → “${fix.suggestedText.slice(0, 40)}”`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(verification.findings ?? [])
            .filter((f) => f.checkId.startsWith("procedural_timeline:"))
            .slice(0, 4).length > 0 && (
            <div className="text-xs space-y-1 text-amber-800 dark:text-amber-300">
              <p className="font-medium">{t("timelineWarnings")}</p>
              {(verification.findings ?? [])
                .filter((f) => f.checkId.startsWith("procedural_timeline:"))
                .slice(0, 4)
                .map((f, i) => (
                  <p key={i} className="leading-snug break-words line-clamp-3">
                    • {f.explanation}
                  </p>
                ))}
            </div>
          )}

          {(verification.proceduralWarnings.length > 0 ||
            verification.completenessGaps.length > 0) && (
            <div className="text-xs space-y-1 text-amber-800 dark:text-amber-300">
              {[...verification.proceduralWarnings, ...verification.completenessGaps]
                .slice(0, 4)
                .map((w, i) => (
                  <p key={i} className="leading-snug break-words line-clamp-3">• {w}</p>
                ))}
            </div>
          )}

          {!hideVerificationCard && (
            <ResearchVerificationCard
              totalCitations={totalCitations}
              requiresLawyerReview={verification.requiresLawyerReview}
              citationAudit={{
                verifiedCitationCount: verifiedCitationCount,
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

          <PropositionSupportList
            propositions={verification.propositions}
            findings={verification.findings}
          />

          {!hideSimilarCases && (
            <SimilarCasesPanel
              similarCases={verification.similarCases}
              sectionChecks={verification.sectionChecks}
            />
          )}
          <ExportBlockedDialog
            open={blockedOpen}
            findings={verification.findings}
            onClose={() => setBlockedOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
