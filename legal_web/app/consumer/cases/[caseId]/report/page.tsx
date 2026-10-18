"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useCallback, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { IntakeAnalysisProgress } from "@/components/issue-checker/intake-analysis-progress"
import { CreditBalanceWidget } from "@/components/consumer/credit-balance-widget"
import { ConsumerUpgradeModal } from "@/components/consumer/consumer-upgrade-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import {
  generateFullReport,
  generateReportSection,
  getCase,
} from "@/lib/api/consumers"
import {
  buildReportSectionsFromPreview,
  countPopulatedSections,
} from "@/lib/legal/report-sections"
import {
  CONSUMER_FULL_REPORT_BUNDLE_CREDITS,
  getReportSectionCreditCost,
} from "@/lib/legal/report-section-credits"
import type { ConsumerLegalReport } from "@/lib/api/types"
import type { LegalReportSectionTitle } from "@/lib/legal/report-sections"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { ApiClientError } from "@/lib/api/client"
import { Download, Loader2, Plus, Scale, Share2, Sparkles } from "lucide-react"
import { STANDARD_DISCLAIMER, AI_OUTPUT_DISCLAIMER } from "@/lib/legal/disclaimers"

function pickDisplayReport(reports: ConsumerLegalReport[] | undefined): ConsumerLegalReport | null {
  if (!reports?.length) return null
  const full = reports.find((r) => !r.isPreview)
  return full ?? reports[0]
}

function isCreditError(msg: string) {
  return (
    msg.toLowerCase().includes("credit") ||
    msg.toLowerCase().includes("subscribe") ||
    msg.toLowerCase().includes("insufficient")
  )
}

export default function ConsumerReportPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const printRef = useRef<HTMLDivElement>(null)

  const [generatingFull, setGeneratingFull] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [sectionLoading, setSectionLoading] = useState<string | null>(null)
  const [confirmSection, setConfirmSection] = useState<LegalReportSectionTitle | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)

  const { data: caseData, isLoading, error } = useApiData(
    ["consumer-case-report", params.caseId],
    {
      apiFn: () => getCase(params.caseId),
      enabled: isAuthenticated,
    },
  )

  const report = pickDisplayReport(caseData?.reports)
  const isFirstReport = !caseData?.reports?.some((r) => !r.isPreview)

  const sections = useMemo(
    () =>
      buildReportSectionsFromPreview(report?.contentMarkdown ?? "", null, {
        issueType: caseData?.issueType,
        countryCode: caseData?.countryCode,
        jurisdiction: caseData?.jurisdiction ?? undefined,
        facts: caseData?.facts ?? undefined,
      }),
    [
      report?.contentMarkdown,
      caseData?.issueType,
      caseData?.countryCode,
      caseData?.jurisdiction,
      caseData?.facts,
    ],
  )

  const populatedCount = countPopulatedSections(sections)
  const missingCount = sections.length - populatedCount
  const showFullReportCta = missingCount > 0

  const invalidateReport = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["consumer-case-report", params.caseId],
      }),
    [queryClient, params.caseId],
  )

  const handleGenerateFull = async () => {
    setGeneratingFull(true)
    setGenerateError(null)
    try {
      await generateFullReport(params.caseId)
      await invalidateReport()
      void queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Failed to generate full report. Please try again."
      if (isCreditError(msg)) {
        setShowUpgradeModal(true)
      } else {
        setGenerateError(msg)
      }
    } finally {
      setGeneratingFull(false)
    }
  }

  const handleAddSection = async (title: LegalReportSectionTitle) => {
    setSectionLoading(title)
    setSectionError(null)
    setConfirmSection(null)
    try {
      await generateReportSection(params.caseId, title)
      await invalidateReport()
      void queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Failed to add section. Please try again."
      if (isCreditError(msg)) {
        setShowUpgradeModal(true)
      } else {
        setSectionError(msg)
      }
    } finally {
      setSectionLoading(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = report?.title ?? "Legal Report"
    if (navigator.share) {
      await navigator.share({ title, url })
    } else {
      await navigator.clipboard.writeText(url)
      alert("Report link copied to clipboard.")
    }
  }

  const confirmCost = confirmSection ? getReportSectionCreditCost(confirmSection) : 0

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto w-full print-report-root" ref={printRef}>
        {isLoading && (
          <div className="flex justify-center py-24 print:hidden">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-destructive">{t("failed_to_load_report")}</p>}

        {generatingFull && (
          <IntakeAnalysisProgress active variant="fullReport" hasDocuments />
        )}

        {report && !generatingFull && (
          <>
            {/* ── Report header ── */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={report.isPreview ? "secondary" : "default"}>
                  {report.isPreview ? "Preview" : "Full report"}
                </Badge>
                {report.riskLevel && (
                  <Badge variant="outline">Risk: {report.riskLevel}</Badge>
                )}
                <Badge variant="outline">
                  {populatedCount} / {sections.length} sections
                </Badge>
                <CreditBalanceWidget compact />

                {/* PDF / Share buttons — hidden when printing */}
                <div className="ml-auto flex items-center gap-2 print-hide">
                  <Button size="sm" variant="outline" onClick={() => void handleShare()}>
                    <Share2 className="h-4 w-4 mr-1.5" />
                    Share
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download PDF
                  </Button>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold print-report-title">{report.title}</h1>
              <p className="text-muted-foreground mt-1">
                {caseData?.issueType} · {caseData?.countryCode}
              </p>
            </div>

            {/* ── Disclaimer banner — always at the top ── */}
            <div className="rounded-lg border border-yellow-300/60 bg-yellow-50/60 dark:bg-yellow-950/20 dark:border-yellow-800/60 p-4 print-disclaimer-banner">
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 uppercase tracking-wide mb-1">
                Important Notice
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                {STANDARD_DISCLAIMER}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1.5 opacity-80">
                {AI_OUTPUT_DISCLAIMER}
              </p>
            </div>

            {/* ── Complete report CTA ── */}
            {showFullReportCta && (
              <Card className="border-primary/30 bg-primary/5 print-hide">
                <CardContent className="py-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {isFirstReport ? (
                          <>Complete your first full report — <span className="text-primary font-semibold">free</span></>
                        ) : (
                          <>Complete all missing ({missingCount} sections · {CONSUMER_FULL_REPORT_BUNDLE_CREDITS} credits)</>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isFirstReport
                          ? "Your first complete legal report is on us. Get executive summary, applicable laws, strategy options, and more."
                          : "Best value vs adding sections one at a time. Already-added sections are not charged again."}
                      </p>
                    </div>
                  </div>
                  {generateError && (
                    <p className="text-sm text-destructive">{generateError}</p>
                  )}
                  <Button onClick={() => void handleGenerateFull()} disabled={generatingFull}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isFirstReport ? "Generate my free full report" : "Generate complete report"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {sectionError && (
              <p className="text-sm text-destructive print-hide">{sectionError}</p>
            )}

            {/* ── Report sections ── */}
            <div className="space-y-4">
              {sections.map((section) => {
                const creditCost = getReportSectionCreditCost(section.title)
                const isEmpty = !section.content.trim()
                const isGenerating = sectionLoading === section.title

                return (
                  <Card key={section.title} id={`section-${section.index}`} className="print-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">
                          {section.index + 1}.
                        </span>
                        {section.title}
                      </CardTitle>
                      {isEmpty && (
                        <CardDescription>
                          Not included yet. Add this section to expand your report.
                        </CardDescription>
                      )}
                    </CardHeader>
                    {section.content ? (
                      <CardContent>
                        <LegalMarkdown content={section.content} className="text-sm" />
                      </CardContent>
                    ) : (
                      <CardContent className="pt-0 print-hide">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isGenerating}
                          onClick={() => {
                            if (creditCost === 0) {
                              void handleAddSection(section.title as LegalReportSectionTitle)
                            } else {
                              setConfirmSection(section.title as LegalReportSectionTitle)
                            }
                          }}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating…
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              {creditCost === 0
                                ? "Add section (free)"
                                : `Add section · ${creditCost} credit${creditCost === 1 ? "" : "s"}`}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>

            <LegalDisclaimer />

            <Card className="border-primary/30 bg-primary/5 print-hide">
              <CardContent className="py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{t("get_this_reviewed_by_a_lawyer")}</p>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to a verified lawyer-reviewed report for advice specific to your
                    situation.
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/consumer/cases/${params.caseId}/lawyer-review`}>
                    <Scale className="h-4 w-4 mr-2" />
                    Request lawyer review
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {!isLoading && !report && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>{t("no_report_available_for_this_case_yet")}</p>
              <Button asChild className="mt-4">
                <Link href="/legal-issue-checker">{t("run_legal_issue_checker")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Confirm per-section credit dialog ── */}
        <Dialog open={!!confirmSection} onOpenChange={(open) => !open && setConfirmSection(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {confirmSection}?</DialogTitle>
              <DialogDescription>
                This will use {confirmCost} AI credit{confirmCost === 1 ? "" : "s"} from your
                balance. Sections bought individually cost more than the complete-report bundle.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmSection(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  confirmSection && void handleAddSection(confirmSection)
                }
                disabled={!!sectionLoading}
              >
                Confirm · {confirmCost} credits
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Subscription upsell modal ── */}
      <ConsumerUpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        reason="You've used your free full report. Subscribe to continue generating complete legal reports."
      />
    </>
  )
}
