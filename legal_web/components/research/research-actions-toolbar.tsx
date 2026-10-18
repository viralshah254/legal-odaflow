"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  BookMarked,
  Check,
  Copy,
  FolderPlus,
  FileUp,
  Loader2,
  PlusCircle,
  Scale,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ResearchExportMenu } from "@/components/export/pdf-export-button"
import { SaveResearchDialog } from "@/components/research/save-research-dialog"
import {
  enrichLegalResearch,
  ensureResearchOutput,
  type ResearchEnrichMode,
} from "@/lib/api/ai"
import type { LegalResearchResponse } from "@/lib/api/types"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { useToast } from "@/hooks/use-toast"
import { getMatter } from "@/lib/api/matters"
import {
  buildNewMatterResearchHref,
  buildResearchMatterPrefill,
} from "@/lib/research/research-filing"
import {
  buildResearchVerificationAppendix,
  getResearchRelianceState,
} from "@/lib/api/verification"
import { AnalyticsEvents } from "@/lib/analytics/events"
import { trackResearchEvent } from "@/lib/analytics/research-events"
import { approveAiOutput } from "@/lib/api/ai-review"

interface ResearchActionsToolbarProps {
  result: LegalResearchResponse
  query: string
  countryCode: string
  tenantId?: string | null
  aiOutputId?: string
  matterId?: string
  onEnriched: (next: LegalResearchResponse) => void
  onPersisted?: (aiOutputId?: string) => void | Promise<void>
  showExport?: boolean
}

export function ResearchActionsToolbar({
  result,
  query,
  countryCode,
  tenantId,
  aiOutputId,
  matterId,
  onEnriched,
  onPersisted,
  showExport = true,
}: ResearchActionsToolbarProps) {
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [saveMode, setSaveMode] = useState<"client" | "matter" | "document" | null>(null)
  const [enriching, setEnriching] = useState<ResearchEnrichMode | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)

  const outputId = aiOutputId || result.aiOutputId
  const canEnrich = Boolean(tenantId && (result.answer?.trim() || outputId))
  const relianceState = getResearchRelianceState({
    audit: result.citationAudit,
    findings: result.findings,
    publicationState: result.publicationState,
    researchMode: result.researchMode,
    analyticalMode: result.analyticalMode,
    relianceMode: result.relianceMode,
  })
  const draftOnly = relianceState !== "source-verified"
  const verificationAppendix = buildResearchVerificationAppendix({
    audit: result.citationAudit,
    findings: result.findings,
    publicationState: result.publicationState,
    researchMode: result.researchMode,
    analyticalMode: result.analyticalMode,
    relianceMode: result.relianceMode,
  })

  const handleCreateMatter = async () => {
    let clientId: string | undefined
    if (tenantId && matterId) {
      try {
        clientId = (await getMatter(tenantId, matterId)).clientId ?? undefined
      } catch {
        // The form remains usable without a client preselection.
      }
    }
    router.push(buildNewMatterResearchHref(buildResearchMatterPrefill({
      query,
      result,
      countryCode,
      sourceResearchId: outputId,
      clientId,
    })))
  }

  const handleCopy = async () => {
    if (draftOnly) {
      trackResearchEvent(AnalyticsEvents.RESEARCH_UNSAFE_EXPORT_ATTEMPT, {
        aiOutputId: outputId,
        action: "copy",
        outcome: "watermarked",
        safeForReliance: false,
      })
    }
    const citations = (result.citations ?? [])
      .map((c) => `- ${c.title}${c.source ? ` — ${c.source}` : ""}`)
      .join("\n")
    const text = [
      draftOnly ? `# UNVERIFIED DRAFT — NOT FOR RELIANCE` : `# Legal Research`,
      ``,
      `Query: ${query}`,
      ``,
      result.answer ?? "",
      citations ? `\n## Citations\n${citations}` : "",
      draftOnly ? `\n---\n\n${verificationAppendix}` : "",
    ].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
      toast({
        title: draftOnly ? "Watermarked review draft copied" : "Copied to clipboard",
        description: draftOnly
          ? "Clean copy is blocked until verification passes; the verification appendix is included."
          : undefined,
      })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const handleApprove = async () => {
    if (!tenantId || !outputId || approving || approved) return
    setApproving(true)
    try {
      await approveAiOutput(outputId, tenantId)
      setApproved(true)
      await onPersisted?.(outputId)
      toast({
        title: "Research approved",
        description: "This result is now eligible for reuse and appears in Saved Research.",
      })
    } catch (error) {
      toast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Could not approve this research.",
        variant: "destructive",
      })
    } finally {
      setApproving(false)
    }
  }

  const handleEnrich = async (mode: ResearchEnrichMode) => {
    if (!tenantId) {
      toast({ title: "Tenant required", variant: "destructive" })
      return
    }
    if (!result.answer?.trim() && !outputId) {
      toast({
        title: "Cannot enrich",
        description: "No research memo to enrich yet.",
        variant: "destructive",
      })
      return
    }
    setEnriching(mode)
    try {
      let resolvedId = outputId
      if (!resolvedId) {
        const ensured = await ensureResearchOutput(
          {
            query,
            answer: result.answer ?? "",
            countryCode,
            jurisdiction: result.jurisdiction,
            aiOutputId: outputId,
          },
          tenantId,
        )
        resolvedId = ensured.aiOutputId
      }
      const enriched = await enrichLegalResearch(
        resolvedId,
        { mode, query, countryCode },
        tenantId,
      )
      onEnriched({
        ...result,
        answer: enriched.answer,
        similarCases: enriched.similarCases,
        sectionChecks: enriched.sectionChecks ?? result.sectionChecks,
        creditsUsed: (result.creditsUsed ?? 0) + enriched.creditsCharged,
        aiOutputId: enriched.aiOutputId,
        fromCache: false,
        citations: enriched.citations?.length
          ? enriched.citations.map((c) => ({
              title: c.title ?? "Source",
              source: c.source ?? c.citation ?? "",
              url: c.url ?? c.sourceUrl ?? undefined,
            }))
          : result.citations,
        findings: enriched.findings ?? result.findings,
        propositions: enriched.propositions ?? result.propositions,
        dimensions: enriched.dimensions ?? result.dimensions,
        publicationState: enriched.publicationState ?? result.publicationState,
        outputHash: enriched.outputHash ?? result.outputHash,
        requiresLawyerReview:
          enriched.requiresLawyerReview ?? result.requiresLawyerReview,
      })
      if (enriched.creditsCharged > 0) {
        invalidateCreditWalletQueries(queryClient, tenantId)
      }
      const wantCases = mode === "case_laws" || mode === "both"
      const wantSections = mode === "sections" || mode === "both"
      if (enriched.warning === "ALREADY_SUFFICIENTLY_GROUNDED") {
        toast({
          title: "No new evidence found",
          description: "The retrieved authorities were already in this research. No credits were charged.",
        })
      } else if (enriched.warning || (wantCases && enriched.casesAdded === 0) || (wantSections && enriched.sectionsAdded.length === 0 && !wantCases)) {
        toast({
          title: "Enrichment incomplete",
          description:
            enriched.warning === "NO_CASE_LAW_RETRIEVED" || (wantCases && enriched.casesAdded === 0)
              ? "No case laws were retrieved. Try a more specific query or check that live case-law search is configured."
              : "No sections were retrieved. Try Add Case Laws, or refine the query.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Research updated",
          description: `${enriched.creditsCharged} credit${enriched.creditsCharged === 1 ? "" : "s"} · ${
            mode === "case_laws"
              ? `${enriched.casesAdded} case(s)`
              : mode === "sections"
                ? `${enriched.sectionsAdded.length} section(s)`
                : `${enriched.casesAdded} case(s), ${enriched.sectionsAdded.length} section(s)`
          }`,
        })
      }
    } catch (err) {
      toast({
        title: "Enrichment failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setEnriching(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => void handleCopy()}
          title={draftOnly ? "Copy watermarked review draft with verification appendix" : "Copy research"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : draftOnly ? "Copy draft" : "Copy"}
        </Button>

        {tenantId && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!outputId || approving || approved}
            onClick={() => void handleApprove()}
          >
            {approving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {approved ? "Approved" : "Approve research"}
          </Button>
        )}

        {tenantId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FolderPlus className="h-3.5 w-3.5" />
                File research
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuItem className="gap-2" onSelect={() => setSaveMode("client")}>
                <FolderPlus className="h-4 w-4" />
                Save to client
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => setSaveMode("matter")}>
                <BookMarked className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>Add to matter research</span>
                  <span className="text-[10px] text-muted-foreground">Shows on Research canvas</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => void handleCreateMatter()}>
                <PlusCircle className="h-4 w-4" />
                Create matter from research
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => setSaveMode("document")}>
                <FileUp className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>File as matter document</span>
                  <span className="text-[10px] text-muted-foreground">Shows in Documents tab</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {showExport && (
          <ResearchExportMenu
            title={`Legal Research: ${query.slice(0, 60)}${query.length > 60 ? "…" : ""}`}
            content={result.answer ?? ""}
            meta={{
              query,
              countryCode,
              date: new Date().toLocaleDateString(),
              citations: result.citations
                ?.map((c) =>
                  typeof c === "string" ? c : `${c.title} — ${c.source}`,
                )
                .filter(Boolean),
            }}
            draftOnly={draftOnly}
            verificationAppendix={verificationAppendix}
            onUnsafeAttempt={(action) =>
              trackResearchEvent(
                AnalyticsEvents.RESEARCH_UNSAFE_EXPORT_ATTEMPT,
                {
                  aiOutputId: outputId,
                  action,
                  outcome: "watermarked",
                  safeForReliance: false,
                },
              )
            }
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!!enriching || !canEnrich}
              title={
                !tenantId
                  ? "Select a firm/tenant to enrich"
                  : !result.answer?.trim() && !outputId
                    ? "Run research before enriching"
                    : undefined
              }
            >
              {enriching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Find more
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem
              disabled={!!enriching || !canEnrich}
              onClick={() => void handleEnrich("case_laws")}
              className="gap-2"
            >
              <Scale className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span>Find more cases</span>
                <span className="text-[10px] text-muted-foreground">
                  Up to 5 net-new cases · ~{FEATURE_CREDIT_COSTS.RESEARCH_ENRICH}+ credits
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!!enriching || !canEnrich}
              onClick={() => void handleEnrich("sections")}
              className="gap-2"
            >
              <BookMarked className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span>Add more sections</span>
                <span className="text-[10px] text-muted-foreground">
                  Up to 5 net-new sections · ~{FEATURE_CREDIT_COSTS.RESEARCH_ENRICH}+ credits
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!!enriching || !canEnrich}
              onClick={() => void handleEnrich("both")}
              className="gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span>Find more cases & sections</span>
                <span className="text-[10px] text-muted-foreground">
                  Combined enrich · charged once
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tenantId && (
        <SaveResearchDialog
          open={saveMode !== null}
          onClose={() => setSaveMode(null)}
          tenantId={tenantId}
          title={`Legal Research: ${query.slice(0, 80)}`}
          query={query}
          countryCode={countryCode}
          aiOutputId={outputId}
          result={result}
          initialMatterId={matterId}
          mode={saveMode ?? "client"}
          onSaved={onPersisted}
          researchJson={{
            answer: result.answer,
            citations: result.citations,
            similarCases: result.similarCases,
            sectionChecks: result.sectionChecks,
            citationAudit: result.citationAudit,
            researchMode: result.researchMode,
            jurisdiction: result.jurisdiction,
            findings: result.findings,
            propositions: result.propositions,
            dimensions: result.dimensions,
            publicationState: result.publicationState,
            structuredDraft: result.structuredDraft,
            outputHash: result.outputHash,
            generatedAt: result.generatedAt,
          }}
        />
      )}
    </>
  )
}
