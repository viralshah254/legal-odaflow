"use client"

import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import { AlertTriangle, FileSearch, FileText, MessageSquareText, Search } from "lucide-react"
import { linkResearchCitations, sanitizeResearchAnswer } from "@/lib/legal/research-answer"
import {
  buildEvidenceCitationMap,
  citationIndexesForEvidenceIds,
  findCitationForEvidenceId,
  resolveEvidenceCitationLabel,
} from "@/lib/legal/research-evidence-citations"
import type {
  LegalResearchCalibratedConclusion,
  LegalResearchDraft,
  LegalResearchPracticalStep,
  LegalResearchResponse,
  LegalResearchUnansweredQuestion,
  ResearchFactSummary,
  ResearchPropositionSummary,
  ResearchTaskProfile,
} from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import {
  normalizePracticalSteps,
  normalizeUnansweredQuestions,
  questionAction,
  type PracticalStepGroup,
} from "@/components/research/research-follow-on"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  researchSectionVisibility,
  researchTaskLabel,
} from "@/lib/research/research-task-sections"

type Citation = LegalResearchResponse["citations"][number]

export interface ResearchMemoAnswerProps {
  result: LegalResearchResponse
  title?: string
  onAnswerQuestion?: (question: LegalResearchUnansweredQuestion, index: number) => void
  onFindInMatter?: (question: LegalResearchUnansweredQuestion, index: number) => void
  onResearchSeparately?: (question: LegalResearchUnansweredQuestion, index: number) => void
  /** Lawyer default: hide process/reviewer/debug panels (moved to Research Trail). */
  lawyerDefault?: boolean
  /** Research Trail only: show process/reviewer/coverage diagnostics without the memo body. */
  trailOnly?: boolean
}

const caseLawSearchLabels = {
  not_configured: "Source unavailable",
  searched: "Searched",
  no_hits: "No relevant cases found",
  error: "Search error",
  timeout: "Search timed out",
  rate_limited: "Rate limited — retry shortly",
  unauthorized: "Connector unauthorized",
  circuit_open: "Connector cooling down",
} as const

function publicationDecision(result: LegalResearchResponse): string | undefined {
  return typeof result.publicationDecision === "string"
    ? result.publicationDecision
    : result.publicationDecision?.decision
}

function statusText(value?: string): string | undefined {
  if (!value) return undefined
  return value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase())
}

function ResearchContractStatus({ result }: { result: LegalResearchResponse }) {
  const task = researchTaskLabel(result.taskProfile)
  const asOfDate =
    result.researchPlan?.asOfDate ??
    result.researchPlan?.request?.asOfDate ??
    result.taskProfile?.asOfDate ??
    result.generatedAt
  const confidence = result.confidenceAssessment?.level ?? result.confidence
  const decision = publicationDecision(result)
  const integrity = result.sourceIntegrity?.status
  const kenyaVerification =
    result.jurisdiction?.toUpperCase() === "KE"
      ? result.citationAudit?.kenyaVerified === true
        ? "Verified"
        : "Draft — verification incomplete"
      : undefined
  const blockers = [...new Set([
    ...(result.confidenceAssessment?.blockers ?? []),
    ...(result.publicationDecision != null && typeof result.publicationDecision === "object"
      ? [
          ...(("blockers" in result.publicationDecision ? result.publicationDecision.blockers : undefined) ?? []),
          ...(("issues" in result.publicationDecision ? result.publicationDecision.issues : undefined) ?? [])
            .filter((issue) => issue.blocking)
            .map((issue) => issue.message),
        ]
      : []),
  ])].slice(0, 5)
  const evidence = result.adaptiveEvidenceSummary
  const availableCapabilities = result.capabilitySnapshot?.availableCapabilities
  const treatmentUnavailable =
    result.taskProfile?.evidenceBundle?.requireTreatment === false &&
    Array.isArray(availableCapabilities) &&
    !availableCapabilities.includes("TREATMENT")
  const parsedDate = asOfDate ? new Date(asOfDate) : undefined
  const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString()
    : asOfDate

  if (!task && !dateLabel && !confidence && !decision && !integrity && !kenyaVerification && blockers.length === 0) return null

  return (
    <aside
      className="not-prose mb-5 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs"
      aria-label="Research confidence and publication status"
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {task && <span><strong>Task:</strong> {task}</span>}
        {dateLabel && <span><strong>Law as of:</strong> {dateLabel}</span>}
        {confidence && <span><strong>Confidence:</strong> {statusText(confidence)}</span>}
        {decision && <span><strong>Publication:</strong> {statusText(decision)}</span>}
        {integrity && <span><strong>Source integrity:</strong> {statusText(integrity)}</span>}
        {kenyaVerification && <span><strong>Kenya Verified:</strong> {kenyaVerification}</span>}
        {result.sourceProvenance && (
          <span><strong>Provenance:</strong> {result.sourceProvenance.length} source record{result.sourceProvenance.length === 1 ? "" : "s"}</span>
        )}
      </div>
      {evidence && (
        <p className="mt-2 text-muted-foreground">
          {evidence.casesAdded} case{evidence.casesAdded === 1 ? "" : "s"} found;{" "}
          {evidence.verifiedCases} source-verified; {evidence.sectionsAdded} governing section
          {evidence.sectionsAdded === 1 ? "" : "s"} added
          {treatmentUnavailable ? "; later treatment unavailable" : ""}. Automatic evidence add-on:{" "}
          {evidence.automaticEnrichmentCredits} credit
          {evidence.automaticEnrichmentCredits === 1 ? "" : "s"}.
        </p>
      )}
      {blockers.length > 0 && (
        <details className="mt-2 text-amber-700 dark:text-amber-400">
          <summary className="cursor-pointer font-semibold">
            {blockers.length} confidence blocker{blockers.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {blockers.map((blocker, index) => <li key={`${blocker}-${index}`}>{blocker}</li>)}
          </ul>
        </details>
      )}
    </aside>
  )
}

function CaseEvidenceLayers({ result }: { result: LegalResearchResponse }) {
  const layers = result.caseEvidenceLayers
  if (!layers) return null
  const groups = [
    {
      title: "Verified cases",
      description: "Source identity and supporting judgment text were located.",
      cases: layers.verifiedCases,
    },
    {
      title: "Partially verified cases",
      description: "A source was located, but one or more requested fields remain unsupported.",
      cases: layers.partiallyVerifiedCases,
    },
  ]
  if (
    groups.every((group) => group.cases.length === 0) &&
    layers.researchLeads.length === 0
  ) return null

  return (
    <section className="not-prose mb-5 rounded-lg border bg-card px-3 py-3 text-xs">
      <h2 className="font-semibold">Case-survey evidence</h2>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="rounded-md border bg-muted/20 p-2.5">
            <h3 className="font-semibold">{group.title} ({group.cases.length})</h3>
            <p className="mt-0.5 text-muted-foreground">{group.description}</p>
            <ul className="mt-2 space-y-1.5">
              {group.cases.map((item) => (
                <li key={item.authorityId}>
                  {item.sourceUrl ? (
                    <a className="font-medium text-primary underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : <span className="font-medium">{item.title}</span>}
                  {item.citation && ` — ${item.citation}`}
                  {item.relevance && <span className="block text-muted-foreground">{item.relevance}</span>}
                </li>
              ))}
              {group.cases.length === 0 && <li className="text-muted-foreground">None.</li>}
            </ul>
          </div>
        ))}
      </div>
      {layers.researchLeads.length > 0 && (
        <details className="mt-3 rounded-md border border-dashed px-2.5 py-2">
          <summary className="cursor-pointer font-semibold">
            Research leads ({layers.researchLeads.length}) — holdings not asserted
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {layers.researchLeads.map((lead, index) => (
              <li key={`${lead.title}-${index}`}>
                {lead.title}{lead.citation ? ` — ${lead.citation}` : ""}
                {lead.searchPhrase ? ` · Search: ${lead.searchPhrase}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function ResearchProcessPanel({ result }: { result: LegalResearchResponse }) {
  const plan = result.researchPlan
  const sources = result.capabilitySnapshot?.sources ?? []
  const issues = plan?.issues ?? []
  if (!plan && sources.length === 0 && !result.auditMetadata) return null

  const stages = [
    {
      label: "Scope",
      detail: researchTaskLabel(result.taskProfile) ?? "Research task normalized",
      complete: Boolean(result.taskProfile),
    },
    {
      label: "Plan",
      detail: `${issues.length} issue${issues.length === 1 ? "" : "s"}`,
      complete: plan?.executable !== false,
    },
    {
      label: "Sources",
      detail: `${sources.filter((source) => source.available).length}/${sources.length || 0} available`,
      complete: sources.some((source) => source.available),
    },
    {
      label: "Evidence",
      detail: `${result.propositionSummaries?.length ?? result.propositions?.length ?? 0} proposition records`,
      complete: (result.propositionSummaries?.length ?? result.propositions?.length ?? 0) > 0,
    },
    {
      label: "Conflicts / gaps",
      detail: `${(result.conflicts?.length ?? 0) + (result.issueGaps?.length ?? 0)} open`,
      complete: (result.conflicts?.length ?? 0) + (result.issueGaps?.length ?? 0) === 0,
    },
    {
      label: "Audit",
      detail: result.auditMetadata?.packetHash
        ? `${result.auditMetadata.packetHash.slice(0, 10)}…`
        : "Unavailable",
      complete: Boolean(result.auditMetadata?.packetHash),
    },
  ]

  return (
    <details className="not-prose mb-5 rounded-lg border bg-card px-3 py-2.5 text-xs">
      <summary className="cursor-pointer font-semibold">Research process and audit trail</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => (
          <div key={stage.label} className="rounded-md border bg-muted/20 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{stage.label}</span>
              <span className={stage.complete ? "text-emerald-600" : "text-amber-600"}>
                {stage.complete ? "Complete" : "Limited"}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{stage.detail}</p>
          </div>
        ))}
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {issues.map((issue) => (
            <li key={issue.id}>
              <strong className="text-foreground">{statusText(issue.status) ?? "Planned"}:</strong>{" "}
              {issue.question}
              {(issue.dependsOn?.length ?? 0) > 0 && ` — depends on ${issue.dependsOn!.join(", ")}`}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

function ReviewerMode({ result }: { result: LegalResearchResponse }) {
  const claims = result.propositionSummaries ?? []
  const passages = (result.citations ?? [])
    .filter((citation) => citation.exactPassage || citation.passageText || citation.excerpt)
    .map((citation) => ({
      label: citation.citation ?? citation.title,
      text: citation.exactPassage ?? citation.passageText ?? citation.excerpt ?? "",
      pinpoint: citation.pinpoint,
    }))
  const rejected = result.rejectedCandidates ?? []
  const conflicts = result.conflicts ?? []
  const userAuthorities = result.userAuthorityChecks ?? []
  const sourceRecords = result.sourceProvenance ?? []
  if (
    claims.length === 0 &&
    passages.length === 0 &&
    rejected.length === 0 &&
    conflicts.length === 0 &&
    userAuthorities.length === 0 &&
    sourceRecords.length === 0
  ) {
    return null
  }

  return (
    <details className="not-prose mb-5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
      <summary className="cursor-pointer font-semibold">Reviewer mode</summary>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="font-semibold">Dispositive and material claims</h3>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {claims.map((claim) => (
              <li key={claim.id ?? claim.statement}>
                <span className="text-foreground">{claim.statement}</span>{" "}
                ({statusText(claim.supportStatus) ?? "Support unknown"})
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-semibold">Cited passages</h3>
          <ul className="mt-1 space-y-2 text-muted-foreground">
            {passages.map((passage, index) => (
              <li key={`${passage.label}-${index}`}>
                <strong className="text-foreground">{passage.label}</strong>
                {passage.pinpoint && ` — ${passage.pinpoint}`}
                <blockquote className="mt-0.5 border-l pl-2">{passage.text}</blockquote>
              </li>
            ))}
          </ul>
        </section>
        {(conflicts.length > 0 || rejected.length > 0) && (
          <section className="md:col-span-2">
            <h3 className="font-semibold">Contrary, conflicted, and rejected material</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {conflicts.map((conflict, index) => (
                <li key={`conflict-${index}`}>
                  {typeof conflict === "string"
                    ? conflict
                    : conflict.description ?? conflict.issue ?? conflict.resolution ?? "Unresolved conflict"}
                </li>
              ))}
              {rejected.map((candidate) => (
                <li key={candidate.authorityId}>
                  {candidate.authorityId}: {candidate.reason}
                </li>
              ))}
            </ul>
          </section>
        )}
        {userAuthorities.length > 0 && (
          <section className="md:col-span-2">
            <h3 className="font-semibold">User-supplied authorities</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {userAuthorities.map((authority) => (
                <li key={authority.suppliedCitation}>
                  {authority.suppliedCitation}: {statusText(authority.status)}
                  {authority.resolvedCitation && ` — ${authority.resolvedCitation}`}
                </li>
              ))}
            </ul>
          </section>
        )}
        {sourceRecords.length > 0 && (
          <section className="md:col-span-2">
            <h3 className="font-semibold">Source provenance and integrity</h3>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {sourceRecords.map((source, index) => (
                <li key={source.sourceId ?? `${source.provider}-${index}`}>
                  <strong className="text-foreground">
                    {source.authorityIdentity ?? source.sourceName ?? source.provider ?? source.sourceId}
                  </strong>
                  {" — "}
                  {[
                    statusText(source.authoritativeStatus),
                    statusText(source.completeness),
                    statusText(source.extractionMethod),
                    source.documentHash ? `hash ${source.documentHash.slice(0, 10)}…` : "hash unavailable",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  )
}

function propositionText(item: ResearchPropositionSummary): string {
  return item.statement
}

function factText(item: ResearchFactSummary): string {
  return item.statement
}

function SummarySection({
  title,
  items,
  tone = "default",
}: {
  title: string
  items: string[]
  tone?: "default" | "caution"
}) {
  if (items.length === 0) return null
  return (
    <section className={`not-prose rounded-lg border px-4 py-3 ${tone === "caution" ? "border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20" : "bg-card"}`}>
      <h2 className="font-serif text-base font-semibold">{title}</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-foreground/90">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  )
}

function TaskAwareResearchSections({ result }: { result: LegalResearchResponse }) {
  const visibility = researchSectionVisibility(result.taskProfile)
  const propositions = result.propositionSummaries ?? []
  const facts = result.factSummaries ?? []
  const verifiedLaw = propositions
    .filter((item) => {
      const kind = item.kind?.toUpperCase()
      const support = item.supportStatus?.toUpperCase()
      const confidence = item.confidence?.level?.toUpperCase()
      return ["LEGAL_RULE", "RULE", "HOLDING", "PROCEDURE", "STATUTORY_TEXT"].includes(
        kind ?? "",
      ) && (
        support === "VERIFIED" ||
        support === "SUPPORTED" ||
        confidence === "VERIFIED" ||
        confidence === "CORROBORATED"
      )
    })
    .map(propositionText)
  const factApplication = [
    ...(result.applicationSummaries ?? []),
    ...facts.filter((item) => item.status === "VERIFIED").map((item) => `Verified fact: ${factText(item)}`),
    ...propositions.filter((item) => item.kind?.toUpperCase() === "APPLICATION").map(propositionText),
  ]
  const assumptions = [
    ...(result.assumptions ?? []),
    ...facts.filter((item) => item.status === "ASSUMED").map(factText),
  ]
  const unresolvedFacts = [
    ...(result.unresolvedFacts ?? []),
    ...facts
      .filter((item) => item.status === "DISPUTED" || item.status === "UNVERIFIED")
      .map((item) => `${statusText(item.status) ?? "Unresolved"}: ${factText(item)}`),
  ]
  const conflicts = (result.conflicts ?? []).map((conflict) =>
    typeof conflict === "string"
      ? conflict
      : conflict.description ?? conflict.issue ?? conflict.resolution ?? "Unresolved authority conflict",
  )
  const hasSections =
    verifiedLaw.length > 0 ||
    (result.authoritySummaries?.length ?? 0) > 0 ||
    factApplication.length > 0 ||
    assumptions.length > 0 ||
    unresolvedFacts.length > 0 ||
    (result.strategyGuidance?.length ?? 0) > 0 ||
    conflicts.length > 0

  if (!hasSections) return null

  return (
    <div className="not-prose mb-6 grid gap-3">
      {visibility.verifiedLaw && <SummarySection title="Verified law" items={verifiedLaw} />}
      {visibility.authoritySummary && <SummarySection title="Authority summary" items={result.authoritySummaries ?? []} />}
      {visibility.factApplication && <SummarySection title="Fact application" items={factApplication} />}
      {visibility.assumptions && <SummarySection title="Assumptions" items={assumptions} tone="caution" />}
      {visibility.unresolvedFacts && <SummarySection title="Unresolved facts" items={unresolvedFacts} tone="caution" />}
      <SummarySection title="Conflicts and adverse authority" items={conflicts} tone="caution" />
      {visibility.strategyGuidance && (
        <SummarySection
          title="Strategy / non-authoritative guidance"
          items={result.strategyGuidance ?? []}
          tone="caution"
        />
      )}
    </div>
  )
}

function PublicationCoverageNotice({ result }: { result: LegalResearchResponse }) {
  const diagnostics = [...(result.sourceDiagnostics ?? []), ...(result.connectorDiagnostics ?? [])]
    .filter((diagnostic, index, all) => {
      const key = JSON.stringify(diagnostic)
      return all.findIndex((candidate) => JSON.stringify(candidate) === key) === index
    })
  const problemDiagnostics = diagnostics.filter(
    (diagnostic) =>
      diagnostic.status === "error" ||
      diagnostic.status === "skipped" ||
      diagnostic.status === "timeout" ||
      diagnostic.status === "rate_limited" ||
      diagnostic.status === "unauthorized" ||
      diagnostic.status === "circuit_open" ||
      diagnostic.status === "degraded" ||
      diagnostic.hitCount === 0,
  )
  const totalHits = diagnostics.reduce((sum, diagnostic) => sum + (diagnostic.hitCount ?? 0), 0)
  const issueGaps = result.issueGaps ?? []
  const rejectedCandidates = result.rejectedCandidates ?? []
  const rejectedCount = rejectedCandidates.length
  const gapCount = issueGaps.length + problemDiagnostics.length + rejectedCandidates.length
  const broadening =
    diagnostics.some((diagnostic) => String(diagnostic.provider ?? "").includes("relaxation")) ||
    diagnostics.some((diagnostic) => diagnostic.provider === "case-candidate-discovery")
  const status = result.caseLawSearchStatus
  const providerUrl = (provider: string): string | undefined => {
    if (/india-kanoon/i.test(provider)) return "https://indiankanoon.org/"
    if (/e-?scr|supreme-court/i.test(provider)) return "https://www.sci.gov.in/judgements-case-no/"
    return undefined
  }

  if (!status && gapCount === 0) return null

  const gapDetails = [
    ...issueGaps.map((gap) =>
      typeof gap === "string"
        ? gap
        : gap.description ??
          gap.reason ??
          gap.expectedAuthority ??
          gap.issue ??
          gap.gapType ??
          "An issue needs additional authority.",
    ),
    ...problemDiagnostics.map((diagnostic) => {
      const source = diagnostic.provider ?? diagnostic.source ?? "Source connector"
      const detail =
        diagnostic.error ??
        diagnostic.message ??
        (diagnostic.hitCount === 0 ? "No admissible sources returned." : "Retrieval was unavailable.")
      return `${source}: ${detail}`
    }),
    ...rejectedCandidates.map((candidate) => `${candidate.authorityId}: ${candidate.reason}`),
  ]

  return (
    <div className="mb-5 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs print:border-gray-300">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <FileSearch className="h-3.5 w-3.5 text-primary" />
          Case-law search: {status ? caseLawSearchLabels[status as keyof typeof caseLawSearchLabels] ?? statusText(status) : "Status unavailable"}
        </span>
        {totalHits > 0 && rejectedCount > 0 && (
          <span className="text-muted-foreground">
            {totalHits} hit{totalHits === 1 ? "" : "s"}, {rejectedCount} rejected
          </span>
        )}
        {broadening && (
          <span className="text-muted-foreground">Broadening search…</span>
        )}
        {result.creditWaived && (
          <span className="text-emerald-700 dark:text-emerald-400">No research credit charged</span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {gapCount} source/retrieval gap{gapCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {diagnostics.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          <span className="font-medium text-foreground">Actually searched:</span>
          {diagnostics.slice(0, 8).map((diagnostic, index) => {
            const provider = String(diagnostic.provider ?? diagnostic.source ?? "source")
            const label = `${provider} · ${diagnostic.status ?? "unknown"} · ${
              diagnostic.admittedCount ?? diagnostic.hitCount ?? 0
            } admitted/hits${
              diagnostic.rejectedCount != null ? ` · ${diagnostic.rejectedCount} rejected` : ""
            }`
            const url = providerUrl(provider)
            return url ? (
              <a
                key={`${provider}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {label}
              </a>
            ) : (
              <span key={`${provider}-${index}`}>{label}</span>
            )
          })}
        </div>
      )}
      {gapDetails.length > 0 && (
        <details className="mt-1.5 text-muted-foreground">
          <summary className="cursor-pointer font-medium">Review retrieval details</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {gapDetails.slice(0, 6).map((detail, index) => (
              <li key={`${detail}-${index}`}>{detail}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function citationField(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || undefined
  return value?.trim() || undefined
}

function exactCitationPassage(citation: Citation): string | undefined {
  return citation.exactPassage?.trim() ||
    citation.passageText?.trim() ||
    citation.excerpt?.trim() ||
    undefined
}

function citationIndexesForEvidence(evidenceIds: string[], citations: Citation[]): number[] {
  return citationIndexesForEvidenceIds(evidenceIds, citations)
}

function citationDetailText(citation: Citation | undefined): string | undefined {
  if (!citation) return undefined
  return (
    citation.summary?.trim() ||
    citation.exactPassage?.trim() ||
    citation.passageText?.trim() ||
    citation.excerpt?.trim() ||
    undefined
  )
}

function CitationRefs({ indexes }: { indexes: number[] }) {
  if (indexes.length === 0) return null
  return (
    <span className="ml-1 inline-flex gap-1 align-super text-[10px] font-semibold print:text-black">
      {indexes.map((index) => (
        <a key={index} href={`#source-${index}`} className="text-primary underline print:text-black">
          [{index}]
        </a>
      ))}
    </span>
  )
}

function linkAuthorityCitationText(markdown: string, citations: Citation[]): string {
  return citations.reduce((text, citation, index) => {
    const label = (citation.citation ?? citation.title).trim()
    if (label.length < 5) return text
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return text.replace(new RegExp(`(?<!\\[)${escaped}(?!\\]\\()`, "g"), (match) =>
      `[${match}](#source-${index + 1})`,
    )
  }, markdown)
}

function CitationAnchor({
  href,
  citations,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"a"> & { citations: Citation[] }) {
  const match = href?.match(/^#source-(\d+)$/)
  const citation = match ? citations[Number(match[1]) - 1] : undefined
  if (!citation) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          className="rounded-sm font-semibold text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Go to source ${match?.[1]}: ${citation.title}`}
          {...props}
        >
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 p-3" side="top">
        <p className="font-medium leading-snug">{citation.title}</p>
        <p className="text-xs text-muted-foreground">{citation.citation ?? citation.source}</p>
        {exactCitationPassage(citation) && (
          <p className="border-l-2 pl-2 text-xs leading-relaxed">
            “{exactCitationPassage(citation)}”
          </p>
        )}
        {!exactCitationPassage(citation) && citation.summary && (
          <p className="text-xs leading-relaxed">{citation.summary}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function MemoMarkdown({ text, citations }: { text: string; citations: Citation[] }) {
  const markdown = linkAuthorityCitationText(
    linkResearchCitations(sanitizeResearchAnswer(text), citations.length),
    citations,
  )
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ href, children, ...props }) => (
          <CitationAnchor href={href} citations={citations} {...props}>
            {children}
          </CitationAnchor>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}

const practicalStepGroups: Array<{ id: PracticalStepGroup; label: string }> = [
  { id: "NOW", label: "Now" },
  { id: "BEFORE_FILING_OR_ADVISING", label: "Before filing or advising" },
  { id: "IF_FACTS_SUPPORT", label: "If facts support it" },
]

function PracticalSteps({ steps }: { steps: LegalResearchPracticalStep[] }) {
  const normalized = normalizePracticalSteps(steps)

  if (normalized.length === 0) return null

  return (
    <section id="memo-practical-steps" className="scroll-mt-24">
      <h2>Practical steps</h2>
      <div className="not-prose space-y-4">
        {practicalStepGroups.map((group) => {
          const groupedSteps = normalized.filter((step) => step.timing === group.id)
          if (groupedSteps.length === 0) return null

          return (
            <section key={group.id} aria-labelledby={`practical-steps-${group.id}`}>
              <h3
                id={`practical-steps-${group.id}`}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {group.label}
              </h3>
              <ol className="space-y-2">
                {groupedSteps.map(({ original, index, text, purpose, evidence, dependencies }) => (
                  <li
                    key={typeof original === "string" ? `${text}-${index}` : original.id ?? `${text}-${index}`}
                    className="rounded-lg border bg-muted/15 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium leading-5 text-foreground">{text}</p>
                    {purpose && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        <span className="font-medium text-foreground/80">Purpose:</span>{" "}
                        {purpose}
                      </p>
                    )}
                    {evidence.length > 0 && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        <span className="font-medium text-foreground/80">Evidence:</span>{" "}
                        {evidence.join(" · ")}
                      </p>
                    )}
                    {dependencies.length > 0 && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        <span className="font-medium text-foreground/80">Depends on:</span>{" "}
                        {dependencies.join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function QuestionsToResolve({
  questions,
  onAnswerQuestion,
  onFindInMatter,
  onResearchSeparately,
}: {
  questions: LegalResearchUnansweredQuestion[]
  onAnswerQuestion?: ResearchMemoAnswerProps["onAnswerQuestion"]
  onFindInMatter?: ResearchMemoAnswerProps["onFindInMatter"]
  onResearchSeparately?: ResearchMemoAnswerProps["onResearchSeparately"]
}) {
  const normalized = normalizeUnansweredQuestions(questions)

  if (normalized.length === 0) return null

  return (
    <section>
      <h2>Questions to resolve</h2>
      <ul className="not-prose space-y-3">
        {normalized.map(({ original, index, text, id, whyItMatters }) => (
          <li
            key={id ?? `${text}-${index}`}
            className="rounded-lg border bg-muted/15 p-3"
          >
            <p className="text-sm font-medium leading-5 text-foreground">{text}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground/80">Why it matters:</span>{" "}
              {whyItMatters}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Actions for: ${text}`}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={!onAnswerQuestion}
                onClick={questionAction(onAnswerQuestion, original, index)}
                aria-label={`Answer question: ${text}`}
              >
                <MessageSquareText className="mr-1 h-3 w-3" aria-hidden="true" />
                Answer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={!onFindInMatter}
                onClick={questionAction(onFindInMatter, original, index)}
                aria-label={`Find in matter: ${text}`}
              >
                <FileSearch className="mr-1 h-3 w-3" aria-hidden="true" />
                Find in matter
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={!onResearchSeparately}
                onClick={questionAction(onResearchSeparately, original, index)}
                aria-label={`Research separately: ${text}`}
              >
                <Search className="mr-1 h-3 w-3" aria-hidden="true" />
                Research separately
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function conclusionText(
  conclusion: string | LegalResearchCalibratedConclusion,
): string {
  return typeof conclusion === "string" ? conclusion : conclusion.text
}

function normalizeMemoText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function memoTextOverlap(left: string, right: string): number {
  const a = normalizeMemoText(left)
  const b = normalizeMemoText(right)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length)
  }
  const aWords = new Set(a.split(" ").filter(Boolean))
  const bWords = new Set(b.split(" ").filter(Boolean))
  let inter = 0
  for (const word of aWords) {
    if (bWords.has(word)) inter += 1
  }
  return inter / Math.max(aWords.size, bWords.size)
}

function looksLikeQuestionDump(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.length > 400) return true
  return /\b(SOFTWARE IMPLEMENTATION|THIS AGREEMENT|WITNESSETH|IN WITNESS WHEREOF)\b/i.test(
    trimmed,
  )
}

function isClonedIssue(
  issue: LegalResearchDraft["issues"][number],
  shortAnswerText: string,
): boolean {
  const ruleText = (issue.rule ?? issue.propositions ?? [])
    .filter((claim) => claim.type !== "APPLICATION")
    .map((claim) => claim.text)
    .join(" ")
  const conclusion = conclusionText(issue.conclusion)
  const ruleCloned = !ruleText.trim() || memoTextOverlap(ruleText, shortAnswerText) >= 0.9
  const conclusionCloned =
    !conclusion.trim() || memoTextOverlap(conclusion, shortAnswerText) >= 0.9
  return ruleCloned && conclusionCloned
}

function hasUsableStructuredIssues(draft: LegalResearchDraft): boolean {
  const shortAnswer = draft.shortAnswer ?? draft.directAnswer
  const shortAnswerText = typeof shortAnswer?.text === "string" ? shortAnswer.text : ""
  return (draft.issues ?? []).some((issue) => !isClonedIssue(issue, shortAnswerText))
}

function IssueConclusion({
  conclusion,
}: {
  conclusion: string | LegalResearchCalibratedConclusion
}) {
  const text = conclusionText(conclusion)
  if (typeof conclusion === "string") {
    return <p className="font-medium">{text}</p>
  }

  return (
    <div className="space-y-2">
      <p className="font-medium">{text}</p>
      <p className="text-xs leading-5 text-muted-foreground">
        <span className="font-medium text-foreground/80">Evidence-bounded assessment:</span>{" "}
        {conclusion.strength.toLowerCase()}
      </p>
      {conclusion.controllingReasons?.length ? (
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground/80">Controlling reasons:</span>{" "}
          {conclusion.controllingReasons.join("; ")}
        </p>
      ) : null}
      {conclusion.factualDependencies?.length ? (
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground/80">Fact dependencies:</span>{" "}
          {conclusion.factualDependencies.join("; ")}
        </p>
      ) : null}
      {conclusion.adverseConsiderations?.length ? (
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground/80">Adverse considerations:</span>{" "}
          {conclusion.adverseConsiderations.join("; ")}
        </p>
      ) : null}
    </div>
  )
}

function RevisionNotice({
  metadata,
}: {
  metadata: NonNullable<LegalResearchDraft["revisionMetadata"]>
}) {
  const detail = metadata.summary?.trim() || metadata.reason?.trim()
  const timestamp = metadata.revisedAt ?? metadata.createdAt
  const parsedTimestamp = timestamp ? new Date(timestamp) : undefined
  const formattedTimestamp = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
    ? parsedTimestamp.toLocaleString()
    : undefined

  if (!metadata.revisionNumber && !detail && !formattedTimestamp) return null

  return (
    <aside
      className="not-prose mb-5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
      aria-label="Memo revision information"
    >
      <span className="font-semibold text-foreground">
        {metadata.revisionNumber ? `Revision ${metadata.revisionNumber}` : "Revised memorandum"}
      </span>
      {formattedTimestamp && <span>{` · ${formattedTimestamp}`}</span>}
      {detail && <p className="mt-1 leading-5">{detail}</p>}
    </aside>
  )
}

function StructuredMemo({
  draft,
  citations,
  taskProfile,
  onAnswerQuestion,
  onFindInMatter,
  onResearchSeparately,
}: {
  draft: LegalResearchDraft
  citations: Citation[]
  taskProfile?: ResearchTaskProfile
  onAnswerQuestion?: ResearchMemoAnswerProps["onAnswerQuestion"]
  onFindInMatter?: ResearchMemoAnswerProps["onFindInMatter"]
  onResearchSeparately?: ResearchMemoAnswerProps["onResearchSeparately"]
}) {
  const shortAnswer = draft.shortAnswer ?? draft.directAnswer
  const shortAnswerText = typeof shortAnswer?.text === "string" ? shortAnswer.text : ""
  const issues = (Array.isArray(draft.issues) ? draft.issues : []).filter(
    (issue) => !isClonedIssue(issue, shortAnswerText),
  )
  const limitations = Array.isArray(draft.limitations) ? draft.limitations : []
  const claims = new Map(
    issues.flatMap((issue) => issue.propositions ?? []).map((claim) => [claim.claimId, claim]),
  )
  const citationMap = buildEvidenceCitationMap(citations)
  const visibility = researchSectionVisibility(taskProfile)
  const hasPracticalSteps =
    visibility.practicalSteps && normalizePracticalSteps(draft.practicalSteps ?? []).length > 0

  if (!shortAnswerText) {
    return null
  }

  return (
    <>
      <nav
        aria-label="Memo sections"
        className="mb-6 flex gap-2 overflow-x-auto border-b pb-3 print:hidden"
      >
        <a className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70" href="#memo-answer">
          Short answer
        </a>
        {visibility.verifiedLaw && (draft.legalFramework?.length ?? 0) > 0 && (
          <a className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70" href="#memo-framework">
            Legal framework
          </a>
        )}
        {issues.map((issue) => (
          <a
            key={issue.issueId}
            className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70"
            href={`#memo-${issue.issueId}`}
          >
            {issue.heading}
          </a>
        ))}
        {hasPracticalSteps && (
          <a className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70" href="#memo-practical-steps">
            Practical steps
          </a>
        )}
      </nav>

      {draft.revisionMetadata && <RevisionNotice metadata={draft.revisionMetadata} />}

      <section id="memo-answer" className="scroll-mt-24">
        <h2>Short Answer</h2>
        <MemoMarkdown text={shortAnswerText} citations={citations} />
      </section>

      {visibility.verifiedLaw && (draft.legalFramework?.length ?? 0) > 0 && (
        <section id="memo-framework" className="scroll-mt-24 text-foreground">
          <h2>Verified Law and Authorities</h2>
          <ul className="text-foreground">
            {draft.legalFramework!
              .map((authority) => {
                const supportingClaims = authority.claimIds
                  .map((claimId) => claims.get(claimId)?.text)
                  .filter((text): text is string => Boolean(text))
                const citationLabel = resolveEvidenceCitationLabel(authority.evidenceId, citationMap)
                const matchedCitation = findCitationForEvidenceId(authority.evidenceId, citations)
                const detail =
                  supportingClaims.join(" ") ||
                  citationDetailText(matchedCitation)
                if (!citationLabel && !detail) return null

                const indexes = citationIndexesForEvidence([authority.evidenceId], citations)
                return (
                  <li key={`${authority.evidenceId}-${authority.authorityType}`} className="text-foreground">
                    {citationLabel ? (
                      <strong className="font-semibold text-foreground">{citationLabel}</strong>
                    ) : (
                      <span className="font-semibold text-foreground capitalize">
                        {authority.authorityType.toLowerCase()}
                      </span>
                    )}
                    {detail && (
                      <span className="text-foreground/90">{` — ${detail}`}</span>
                    )}
                    <CitationRefs indexes={indexes} />
                  </li>
                )
              })
              .filter(Boolean)}
          </ul>
        </section>
      )}

      {issues.map((issue) => {
        const ruleClaims =
          issue.rule ?? (issue.propositions ?? []).filter((claim) => claim.type !== "APPLICATION")
        const applicationClaims =
          issue.application ?? (issue.propositions ?? []).filter((claim) => claim.type === "APPLICATION")
        const visibleRule = ruleClaims.filter(
          (proposition) => memoTextOverlap(proposition.text, shortAnswerText) < 0.9,
        )
        const conclusion = issue.conclusion
        const conclusionBody = conclusionText(conclusion)
        const showConclusion =
          Boolean(conclusionBody.trim()) && memoTextOverlap(conclusionBody, shortAnswerText) < 0.9
        const heading =
          issue.heading?.trim() &&
          !(issue.heading === "Primary research question" && visibleRule.length === 0 && !showConclusion)
            ? issue.heading
            : visibleRule.length > 0 || showConclusion || applicationClaims.length > 0
              ? "Analysis"
              : ""
        if (!heading && visibleRule.length === 0 && applicationClaims.length === 0 && !showConclusion) {
          return null
        }
        return (
        <section key={issue.issueId} id={`memo-${issue.issueId}`} className="scroll-mt-24">
          {heading ? <h2>{heading}</h2> : null}
          {visibility.verifiedLaw && visibleRule.length > 0 && (
            <>
              <h3>Legal rule</h3>
              {visibleRule.map((proposition) => (
                <div key={proposition.claimId}>
                  <MemoMarkdown text={proposition.text} citations={citations} />
                  <CitationRefs indexes={citationIndexesForEvidence(proposition.evidenceIds ?? [], citations)} />
                </div>
              ))}
            </>
          )}
          {visibility.factApplication && applicationClaims.length > 0 && (
            <>
              <h3>Fact application</h3>
              {applicationClaims.map((proposition) => (
                <div key={proposition.claimId}>
                  <MemoMarkdown text={proposition.text} citations={citations} />
                  <CitationRefs indexes={citationIndexesForEvidence(proposition.evidenceIds ?? [], citations)} />
                </div>
              ))}
            </>
          )}
          {showConclusion && (
            <>
              <h3>Conclusion</h3>
              <IssueConclusion conclusion={conclusion} />
            </>
          )}
        </section>
        )
      })}

      {visibility.strategyGuidance && (draft.risksAndDefences?.length ?? 0) > 0 && (
        <section>
          <h2>Strategy and risk (non-authoritative guidance)</h2>
          <ul>
            {draft.risksAndDefences!.map((item, index) => (
              <li key={`${item.risk}-${index}`}>
                <strong>Risk:</strong> {item.risk}
                {item.defence && <> <strong>Defence:</strong> {item.defence}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {visibility.practicalSteps && <PracticalSteps steps={draft.practicalSteps} />}

      {visibility.unresolvedFacts && (
        <QuestionsToResolve
          questions={draft.unansweredQuestions}
          onAnswerQuestion={onAnswerQuestion}
          onFindInMatter={onFindInMatter}
          onResearchSeparately={onResearchSeparately}
        />
      )}

      {((draft.verificationNotes?.length ?? 0) > 0 || limitations.length > 0 || draft.scopeNote) && (
        <details className="mt-8 rounded-lg border bg-muted/20 px-4 py-3 print:block">
          <summary className="cursor-pointer text-sm font-semibold">Appendix: Verification Notes</summary>
          <ul>
            {draft.scopeNote && <li>{draft.scopeNote}</li>}
            {[...(draft.verificationNotes ?? []), ...limitations].map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

export function ResearchMemoAnswer({
  result,
  title = "Research memorandum",
  onAnswerQuestion,
  onFindInMatter,
  onResearchSeparately,
  lawyerDefault = false,
  trailOnly = false,
}: ResearchMemoAnswerProps) {
  if (trailOnly) {
    return (
      <TooltipProvider delayDuration={250}>
        <div className="space-y-3 rounded-xl border bg-card px-4 py-4">
          <ResearchContractStatus result={result} />
          <CaseEvidenceLayers result={result} />
          <ResearchProcessPanel result={result} />
          <ReviewerMode result={result} />
          <PublicationCoverageNotice result={result} />
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
      <article className="rounded-xl border bg-card px-5 py-6 shadow-sm print:border-0 print:bg-white print:px-0 print:py-0 print:text-black print:shadow-none">
        <header className="mb-5 flex items-center gap-2 border-b pb-4 print:mb-8">
          <FileText className="h-4 w-4 text-primary print:hidden" />
          <h1 className="font-serif text-lg font-semibold tracking-tight print:text-2xl">{title}</h1>
        </header>
        {!lawyerDefault && (
          <>
            <ResearchContractStatus result={result} />
            <CaseEvidenceLayers result={result} />
            <ResearchProcessPanel result={result} />
            <ReviewerMode result={result} />
            <PublicationCoverageNotice result={result} />
          </>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:scroll-mt-24 prose-headings:font-serif prose-headings:text-foreground prose-p:leading-7 prose-p:text-foreground/90 prose-li:leading-7 prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary print:prose-base print:prose-headings:text-black print:prose-p:text-black print:prose-li:text-black">
          <TaskAwareResearchSections result={result} />
          {result.structuredDraft && hasUsableStructuredIssues(result.structuredDraft) ? (
            <StructuredMemo
              draft={result.structuredDraft}
              citations={result.citations ?? []}
              taskProfile={result.taskProfile}
              onAnswerQuestion={onAnswerQuestion}
              onFindInMatter={onFindInMatter}
              onResearchSeparately={onResearchSeparately}
            />
          ) : (
            <MemoMarkdown text={result.answer} citations={result.citations ?? []} />
          )}
        </div>
        {(result.citations?.length ?? 0) > 0 && (
          <footer className="mt-8 border-t pt-5">
            <h2 className="mb-3 font-serif text-base font-semibold">Sources</h2>
            <ol className="space-y-2">
              {(result.citations ?? []).map((citation, index) => (
                <li key={`${citation.authorityId ?? citation.title}-${index}`} id={`source-${index + 1}`} className="scroll-mt-24 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    [{index + 1}] {citation.caseName ?? citationField(citation.parties) ?? citation.title}
                  </span>
                  {" — "}
                  {[citation.judgmentDate, citation.neutralCitation, citation.citation ?? citation.source]
                    .filter(Boolean)
                    .join(" · ")}
                  {(citation.deepLinkUrl || citation.url) && (
                    <>
                      {" "}
                      <a className="text-primary underline print:text-black" href={citation.deepLinkUrl ?? citation.url} target="_blank" rel="noopener noreferrer">
                        {citation.deepLinkUrl ? "Open cited passage" : "Open source"}
                      </a>
                    </>
                  )}
                  {citationField(citation.relevantParagraphs) && (
                    <span className="mt-0.5 block">
                      Relevant paragraphs: {citationField(citation.relevantParagraphs)}
                    </span>
                  )}
                  {citation.propositionActuallyDecided && (
                    <span className="mt-0.5 block text-foreground">
                      Proposition decided: {citation.propositionActuallyDecided}
                    </span>
                  )}
                  {(citation.sourceName || citation.authorityId || citation.sourceTier || citation.retrievedAt ||
                    citation.sourceHash || citation.pinpoint || citation.provenance || citation.integrity) && (
                    <span className="mt-0.5 block">
                      Provenance: {[citation.provenance?.sourceName ?? citation.sourceName ?? citation.source,
                        citation.provenance?.sourceTier ?? citation.sourceTier,
                        citation.provenance?.sourceId ?? citation.authorityId,
                        citation.pinpoint,
                        (citation.provenance?.retrievedAt ?? citation.retrievedAt)
                          ? `retrieved ${new Date(citation.provenance?.retrievedAt ?? citation.retrievedAt!).toLocaleString()}`
                          : undefined,
                        (citation.provenance?.contentHash ?? citation.sourceHash)
                          ? `hash ${(citation.provenance?.contentHash ?? citation.sourceHash)!.slice(0, 12)}…`
                          : undefined,
                        citation.integrity?.status ? `integrity ${statusText(citation.integrity.status)}` : undefined]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {exactCitationPassage(citation) && (
                    <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-foreground">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Retrieved passage
                      </span>
                      “{exactCitationPassage(citation)}”
                    </blockquote>
                  )}
                </li>
              ))}
            </ol>
          </footer>
        )}
      </article>
    </TooltipProvider>
  )
}
