"use client"
import { useTranslations } from "next-intl"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import { WinProbabilityBar } from "./win-probability-bar"
import type { IssueCheckerPreviewResponse } from "@/lib/api/types"
import type { IssueCheckerMode } from "./constants"
import { JoinPlatformCta } from "./join-platform-cta"
import { AlertTriangle, BookOpen, Scale } from "lucide-react"
import { MatterIntelligencePanel } from "@/components/matter-intelligence/matter-intelligence-panel"

interface FullPreviewProps {
  preview: IssueCheckerPreviewResponse
  mode?: IssueCheckerMode
  onStartOver?: () => void
}

const RISK_BADGE_CLASS: Record<string, string> = {
  LOW: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  MEDIUM: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  HIGH: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICAL: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
}

export function FullPreview({ preview, mode, onStartOver }: FullPreviewProps) {
  const t = useTranslations("issueChecker")
  const contentRef = useRef<HTMLDivElement>(null)
  const [showJoinCta, setShowJoinCta] = useState(false)

  useEffect(() => {
    const node = contentRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShowJoinCta(true) },
      { threshold: 0.75 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const riskLevel = (preview.riskLevel ?? preview.report?.riskLevel ?? "MEDIUM").toUpperCase()
  const riskClass = RISK_BADGE_CLASS[riskLevel] ?? RISK_BADGE_CLASS.MEDIUM
  const riskLabelKey = `risk${riskLevel.charAt(0)}${riskLevel.slice(1).toLowerCase()}` as
    | "riskLow"
    | "riskMedium"
    | "riskHigh"
    | "riskCritical"

  return (
    <Card className="border-2 shadow-lg shadow-primary/5">
      <CardHeader className="pb-4 border-b">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="secondary">{t("full_preview")}</Badge>
          <Badge variant="outline" className={riskClass}>
            <AlertTriangle className="mr-1 h-3 w-3" />
            {t(riskLabelKey)}
          </Badge>
          {mode === "FIRM_INTAKE" && <Badge variant="outline">{t("firm_intake")}</Badge>}
          {(preview.documentsIncluded ?? 0) > 0 && (
            <Badge variant="outline">
              {t("docsAnalyzed", { count: preview.documentsIncluded ?? 0 })}
            </Badge>
          )}
        </div>
        <CardTitle className="text-xl leading-tight">
          {preview.report.title.replace(/^Preview:\s*/i, "")}
        </CardTitle>
        <CardDescription>
          {t("creditsRemaining", { count: preview.creditsRemaining })}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {(preview.matterProfile || preview.taskGraph) && (
          <MatterIntelligencePanel
            matterProfile={preview.matterProfile}
            taskGraph={preview.taskGraph}
            recommendedActions={preview.recommendedActions}
            issues={preview.issues}
            nextBestAction={preview.nextBestAction}
          />
        )}

        {preview.nextBestAction && (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/app/legal-forms">{preview.nextBestAction}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/auth/sign-up?intent=lawyer">Connect with a lawyer</Link>
            </Button>
          </div>
        )}

        {preview.winProbability && (
          <div className="p-4 rounded-xl border bg-muted/30">
            <WinProbabilityBar winProbability={preview.winProbability} />
          </div>
        )}

        {Array.isArray(preview.report.citations) && preview.report.citations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <BookOpen className="h-3.5 w-3.5" />
              {t("sourcesReferenced")}
            </div>
            <div className="flex flex-wrap gap-2">
              {(preview.report.citations as Array<{ citation?: string; sourceName?: string }>).map(
                (citation, index) => (
                  <Badge key={index} variant="secondary" className="text-xs font-normal">
                    {citation.citation ?? citation.sourceName ?? t("legalAuthority")}
                  </Badge>
                ),
              )}
            </div>
          </div>
        )}

        <div ref={contentRef} className="rounded-xl border bg-muted/10 p-4">
          <LegalMarkdown content={preview.report.contentMarkdown} />
        </div>

        {preview.report.requiresLawyer && mode !== "FIRM_INTAKE" && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <Scale className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">{t("lawyer_review_recommended")}</p>
              <p className="text-sm text-muted-foreground">{t("lawyerReviewBenefit")}</p>
              <Link href="/lawyers" className="text-sm text-primary hover:underline mt-2 inline-block">
                {t("findLawyerInJurisdiction")}
              </Link>
            </div>
          </div>
        )}
        {preview.report.requiresLawyer && mode === "FIRM_INTAKE" && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <Scale className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">{t("complex_matter")}</p>
              <p className="text-sm text-muted-foreground">{t("complexMatterFirmGuidance")}</p>
            </div>
          </div>
        )}

        <LegalDisclaimer variant="compact" className="border-t pt-4">
          {preview.disclaimer}
        </LegalDisclaimer>

        {showJoinCta && (
          <JoinPlatformCta variant="full" caseId={preview.caseId} leadId={preview.leadId} mode={mode} />
        )}

        <div className="flex flex-wrap gap-3">
          {mode === "FIRM_INTAKE" ? (
            <Link href={preview.leadId ? `/app/leads/${preview.leadId}` : "/app/leads"}>
              <Button size="lg" className="shadow-md shadow-primary/20">
                {preview.leadId ? t("open_case_workspace") : t("viewFirmLeads")}
              </Button>
            </Link>
          ) : (
            <>
              <Link href={`/consumer/cases/${preview.caseId}/report`}>
                <Button size="lg" className="shadow-md shadow-primary/20">{t("view_structured_report")}</Button>
              </Link>
              <Link href={`/consumer/cases/${preview.caseId}`}>
                <Button variant="outline" size="lg">{t("case_overview")}</Button>
              </Link>
            </>
          )}
          {mode !== "FIRM_INTAKE" && (
            <Link href={`/consumer/cases/${preview.caseId}/documents`}>
              <Button variant="outline" size="lg">{t("attach_documents")}</Button>
            </Link>
          )}
          {onStartOver && (
            <Button variant="ghost" onClick={onStartOver} className="text-muted-foreground">
              {t("startAnotherIssue")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
