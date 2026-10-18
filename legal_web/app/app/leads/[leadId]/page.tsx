"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { LeadStatusBadge } from "@/components/leads/lead-status-badge"
import { ConvertToMatterDialog } from "@/components/leads/convert-to-matter-dialog"
import { PlanGate } from "@/components/plan/plan-gate"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { LeadContextSection } from "@/components/leads/lead-context-section"
import { LeadAnalysisPanel } from "@/components/leads/lead-analysis-panel"
import { LegalAnalysisView } from "@/components/leads/legal-analysis-view"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getLead } from "@/lib/api/marketplace"
import { getLeadDisplayTitle, isLeadSlaBreached } from "@/lib/leads/lead-display-title"
import { resolveLeadNextCta } from "@/lib/leads/lead-next-cta"
import {
  ArrowLeft,
  FolderOpen,
  Loader2,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react"

export default function LeadDetailPage() {
  const t = useTranslations("lawyer")
  const params = useParams()
  const leadId = params.leadId as string
  const queryClient = useQueryClient()
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(true)

  const { data, isLoading, error } = useApiData(
    ["lead-detail", leadId],
    {
      apiFn: () => getLead(leadId),
      enabled: !!leadId,
    },
  )

  const refetchLead = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-destructive">
        Failed to load lead: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  const {
    lead,
    previewReport,
    quotaStatus,
    convertedMatter,
    consumerCase,
    documents = [],
    leadDocuments = [],
    analysisRuns = [],
    intakeIntent,
    intakeCaseBrief,
    recommendedNextTool,
  } = data

  const jurisdictionLabel = [lead.countryCode, lead.jurisdiction].filter(Boolean).join(" · ")
  const previewRun = analysisRuns.find((r) => r.runType === "PREVIEW")
  const isConverted = !!convertedMatter || lead.status === "CONVERTED"
  const isAccepted = lead.status === "ACCEPTED" || isConverted
  const isDraftingLead = intakeIntent === "TRANSACTIONAL_DRAFT"
  const displayTitle = getLeadDisplayTitle(lead, consumerCase)
  const slaBreached = isLeadSlaBreached(lead)
  const nextCta = resolveLeadNextCta({
    recommendedNextTool: recommendedNextTool ?? intakeCaseBrief?.recommendedNextTool,
    toolPlan: intakeCaseBrief?.toolPlan,
    missingSlots: intakeCaseBrief?.missingSlots,
    facts: lead.summary ?? consumerCase?.facts,
    issueType: lead.issueType,
    countryCode: lead.countryCode,
    convertedMatterId: convertedMatter?.id ?? lead.convertedMatterId,
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* ── Back nav ──────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to leads
          </Link>
        </Button>
      </div>

      {/* ── Header ────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">
              {displayTitle}
            </h1>
            <LeadStatusBadge status={lead.status} />
            {slaBreached && (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                SLA breached
              </Badge>
            )}
            {lead.intakeStage && lead.intakeStage !== "NEW" && (
              <Badge variant="outline">{lead.intakeStage}</Badge>
            )}
            {isDraftingLead && (
              <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-400">
                Drafting
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {lead.issueType}
            {jurisdictionLabel ? ` · ${jurisdictionLabel}` : ""}
          </p>
        </div>
      </div>

      {/* ── Engagement panel ──────────────────────── */}
      {isConverted ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {isDraftingLead ? "Matter opened — document ready to finalize" : "Converted to matter"}
                  {convertedMatter?.title ? `: ${convertedMatter.title}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isDraftingLead
                    ? "Open the matter to review and finalize the drafted document."
                    : "This lead has been accepted and a matter was created."}
                </p>
              </div>
            </div>
            {convertedMatter && (
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link href={nextCta.href}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {nextCta.label}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={isDraftingLead ? `/app/matters/${convertedMatter.id}/draft` : `/app/matters/${convertedMatter.id}`}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {isDraftingLead ? "Open document" : "Open matter"}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {isDraftingLead ? "Ready to draft" : t("ready_to_engage")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isDraftingLead
                    ? "Review the clause outline and missing fields below, then open a matter to finalize the document."
                    : "Review the AI intake analysis below, then decide whether to open a matter. This is entirely optional — leads can stay in the pipeline without conversion."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button asChild>
                  <Link href={nextCta.href}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {nextCta.label}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConvertDialogOpen(true)}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {isDraftingLead ? "Finalize draft & open matter" : "Accept \u0026 open matter"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {!isAccepted && (
            <CardContent className="pt-0">
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {isDraftingLead
                    ? "This intake has not been converted yet. Open a matter to proceed with the document."
                    : "This lead has not yet been accepted. Accepting commits it to your active pipeline."}
                </span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── AI intake preview / drafting workspace ─── */}
      {previewReport && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none py-3"
            onClick={() => setPreviewExpanded((v) => !v)}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {isDraftingLead ? "Drafting workspace" : "AI intake analysis"}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {isDraftingLead
                    ? "Clause outline, gaps, and smart next steps — auto-generated at intake"
                    : "Auto-generated at intake · verify before client reliance"}
                </CardDescription>
              </div>
              {previewExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {previewExpanded && (
            <CardContent className="pt-0">
              <LegalAnalysisView
                runType="PREVIEW"
                contentMarkdown={previewReport.contentMarkdown}
                structuredOutput={previewRun?.structuredOutput ?? undefined}
                jurisdictionLabel={jurisdictionLabel}
                leadId={leadId}
                lawyerContextMarkdown={lead.lawyerContextMarkdown}
                onContextSaved={refetchLead}
                compact
              />
            </CardContent>
          )}
        </Card>
      )}

      <Separator />

      {/* ── Case context ──────────────────────────── */}
      <LeadContextSection
        leadId={leadId}
        lead={lead}
        consumerCase={consumerCase}
        leadDocuments={leadDocuments}
        consumerDocuments={documents}
        onUpdated={refetchLead}
      />

      {/* ── Deep analysis — hidden for drafting leads (not relevant) ── */}
      {!isDraftingLead && (
        <PlanGate
          requiredPlan="PROFESSIONAL"
          feature="Deep case analysis"
          description={t("deep_case_analysis_requires_professional")}
        >
          <LeadAnalysisPanel
            leadId={leadId}
            lead={lead}
            quotaStatus={quotaStatus}
            analysisRuns={analysisRuns}
            leadDocuments={leadDocuments}
            consumerDocuments={documents}
          />
        </PlanGate>
      )}

      <LegalDisclaimer variant="compact" />

      <ConvertToMatterDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        lead={lead}
        consumerCase={consumerCase}
        onConverted={refetchLead}
      />
    </div>
  )
}
