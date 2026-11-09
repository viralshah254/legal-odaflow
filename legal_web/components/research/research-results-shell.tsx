"use client"

import { useTranslations } from "next-intl"
import { isResearchVerifiedForDisplay } from "@/lib/api/verification"
import { useMemo, useState, type ComponentProps } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ResearchVerificationCard } from "@/components/research/research-verification-card"
import { SimilarCasesPanel } from "@/components/research/similar-cases-panel"
import { ResearchMemoAnswer } from "@/components/research/research-memo-answer"
import type {
  LegalResearchResponse,
  LegalResearchUnansweredQuestion,
} from "@/lib/api/types"
import type { ManualReviewState } from "@/lib/api/verification"
import { cn } from "@/lib/utils"

type Citation = LegalResearchResponse["citations"][number]

export interface ResearchResultsShellProps {
  result: LegalResearchResponse
  query: string
  citations: Citation[]
  verificationCardProps: ComponentProps<typeof ResearchVerificationCard> & {
    manualReview?: ManualReviewState
  }
  onAnswerQuestion?: (question: LegalResearchUnansweredQuestion, index: number) => void
  onFindInMatter?: (question: LegalResearchUnansweredQuestion, index: number) => void
  onResearchSeparately?: (question: LegalResearchUnansweredQuestion, index: number) => void
  className?: string
}

function asBottomLineText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (value && typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text
    if (typeof text === "string") {
      const trimmed = text.trim()
      return trimmed || null
    }
  }
  return null
}

function bottomLineText(result: LegalResearchResponse): string | null {
  const draft = result.structuredDraft as
    | {
        shortAnswer?: unknown
        directAnswer?: unknown
        bottomLine?: unknown
      }
    | undefined
  const fromDraft =
    asBottomLineText(draft?.bottomLine) ||
    asBottomLineText(draft?.shortAnswer) ||
    asBottomLineText(draft?.directAnswer)
  if (fromDraft) return fromDraft
  const md = typeof result.answer === "string" ? result.answer : ""
  const match = md.match(
    /##\s*(?:Bottom Line|Short Answer)[^\n]*\n+([\s\S]*?)(?=\n##\s|$)/i,
  )
  return match?.[1]?.trim().slice(0, 800) ?? null
}

function authorityBadges(citation: Citation, result: LegalResearchResponse): string[] {
  const badges: string[] = []
  const tier = (citation.sourceTier || "").toLowerCase()
  if (tier === "primary" || tier === "seed") badges.push("Primary source")
  if (tier === "case_law") badges.push("Case law")
  const titleKey = (citation.title || "").toLowerCase().slice(0, 24)
  const tc = result.tripleCheck?.authorities?.find(
    (a) =>
      (titleKey && a.raw.toLowerCase().includes(titleKey)) ||
      (citation.citation && a.raw.toLowerCase().includes(citation.citation.toLowerCase())),
  )
  if (tc?.state === "verified") badges.push("Verified")
  if (tc?.state === "corrected") badges.push("Corrected")
  return badges
}

export function ResearchResultsShell({
  result,
  query,
  citations,
  verificationCardProps,
  onAnswerQuestion,
  onFindInMatter,
  onResearchSeparately,
  className,
}: ResearchResultsShellProps) {
  const tProgress = useTranslations("marketing.home.researchProgress")
  const [tab, setTab] = useState("answer")
  const [drawerCitation, setDrawerCitation] = useState<Citation | null>(null)
  const bottomLine = useMemo(() => bottomLineText(result), [result])
  // Retrieved candidates remain inspectable in the source tabs. Promote them
  // in the summary only when the answer passed the reliance gate.
  const keyAuthorities = isResearchVerifiedForDisplay(
    result.publicationState, undefined, result.citationAudit?.safeForReliance,
  ) && !result.analyticalMode && result.relianceMode !== "analytical-guidance"
    ? citations.slice(0, 5) : []

  return (
    <div className={cn("space-y-4", className)}>
      <header className="space-y-2 rounded-xl border bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Research question
        </p>
        <p className="text-sm font-medium leading-snug">{query}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {[result.countryCode, result.jurisdiction].filter(Boolean).join(" · ") ||
              "Jurisdiction n/a"}
          </span>
          <span>·</span>
          <span>{citations.length} authorities</span>
          <span>·</span>
          <span>
            {result.similarCasesSearchOutcome
              ? `Cases: ${result.similarCasesSearchOutcome.replace(/_/g, " ").toLowerCase()}`
              : `${result.similarCases?.length ?? 0} similar cases`}
          </span>
          {result.researchMode && (
            <>
              <span>·</span>
              <span>
                {result.researchMode === "DEEP" ? tProgress("modeVerified") : "Fast guidance"}
              </span>
            </>
          )}
        </div>
      </header>

      {bottomLine && (
        <section className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Bottom Line</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{bottomLine}</p>
        </section>
      )}

      {keyAuthorities.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Key authorities
          </p>
          <div className="flex flex-wrap gap-2">
            {keyAuthorities.map((c, i) => (
              <button
                key={`${c.title}-${i}`}
                type="button"
                onClick={() => setDrawerCitation(c)}
                className="rounded-lg border bg-card px-3 py-2 text-left text-xs hover:border-primary/40 hover:bg-primary/5 transition-colors max-w-full"
              >
                <span className="font-medium block truncate">{c.title}</span>
                <span className="text-muted-foreground truncate block">
                  {c.citation || c.source}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {authorityBadges(c, result).map((b) => (
                    <Badge key={b} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {b}
                    </Badge>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <ResearchVerificationCard {...verificationCardProps} />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="answer">Answer</TabsTrigger>
          <TabsTrigger value="authorities">Authorities ({citations.length})</TabsTrigger>
          <TabsTrigger value="similar">
            Similar Cases ({result.similarCases?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="trail">Research Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="answer" className="mt-3 space-y-3">
          <ResearchMemoAnswer
            result={result}
            onAnswerQuestion={onAnswerQuestion}
            onFindInMatter={onFindInMatter}
            onResearchSeparately={onResearchSeparately}
            lawyerDefault
          />
        </TabsContent>

        <TabsContent value="authorities" className="mt-3 space-y-2">
          {citations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No authorities cited yet.</p>
          ) : (
            citations.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDrawerCitation(c)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-left hover:border-primary/40 transition-colors"
              >
                <p className="text-sm font-medium">
                  [{i + 1}] {c.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.citation, c.source, c.judgmentDate].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {authorityBadges(c, result).map((b) => (
                    <Badge key={b} variant="outline" className="text-[10px]">
                      {b}
                    </Badge>
                  ))}
                </div>
              </button>
            ))
          )}
        </TabsContent>

        <TabsContent value="similar" className="mt-3 space-y-2">
          {result.similarCasesSearchOutcome &&
            result.similarCasesSearchOutcome !== "CASES_FOUND" &&
            (result.similarCases?.length ?? 0) === 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Similar cases status:{" "}
                <strong>{result.similarCasesSearchOutcome.replace(/_/g, " ")}</strong>.
                Provider failure or incomplete search is not the same as “no cases exist.”
              </p>
            )}
          <SimilarCasesPanel
            similarCases={result.similarCases}
            sectionChecks={result.sectionChecks}
            defaultOpen
          />
        </TabsContent>

        <TabsContent value="sources" className="mt-3 space-y-2">
          {citations.map((c, i) => (
            <div key={i} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">
                [{i + 1}] {c.title}
              </p>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline break-all"
                >
                  {c.url}
                </a>
              )}
              {(c.exactPassage || c.passageText || c.excerpt) && (
                <blockquote className="mt-1 border-l-2 border-primary/30 pl-2 text-xs">
                  “{c.exactPassage ?? c.passageText ?? c.excerpt}”
                </blockquote>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="trail" className="mt-3 space-y-3 text-xs">
          <ResearchMemoAnswer
            result={result}
            onAnswerQuestion={onAnswerQuestion}
            onFindInMatter={onFindInMatter}
            onResearchSeparately={onResearchSeparately}
            trailOnly
          />
          {result.intelligenceMap && (
            <div className="rounded-lg border px-3 py-2 space-y-1">
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                Intelligence map
              </p>
              <p>
                Issues:{" "}
                {result.intelligenceMap.issues?.map((i) => i.label).join("; ") || "n/a"}
              </p>
              <p>
                Candidate cases: {result.intelligenceMap.likelyCases?.length ?? 0} · statutes:{" "}
                {result.intelligenceMap.likelyStatutes?.length ?? 0}
                {result.intelligenceMap.degraded ? " · map degraded" : ""}
              </p>
            </div>
          )}
          {result.issueCoverageMatrix && (
            <div className="rounded-lg border px-3 py-2 space-y-1">
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                Coverage matrix
              </p>
              <p>
                Complete: {result.issueCoverageMatrix.complete ? "yes" : "no"} · loops:{" "}
                {result.issueCoverageMatrix.loopsRun} · red cells:{" "}
                {result.issueCoverageMatrix.redCells?.length ?? 0}
              </p>
            </div>
          )}
          {result.researchTrail && (
            <div className="rounded-lg border px-3 py-2 space-y-1">
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                Retrieval trail
              </p>
              <p>
                Live retrieval forced:{" "}
                {result.researchTrail.liveRetrievalForced ? "yes" : "no"}
              </p>
              <p>Coverage loops: {result.researchTrail.coverageLoops ?? 0}</p>
              {(result.researchTrail.candidateDiagnostics?.length ?? 0) > 0 && (
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.researchTrail.candidateDiagnostics!.slice(0, 12).map((d) => (
                    <li key={d.candidateId}>
                      {d.title}: {d.status} ({d.hitCount} hits)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {(result.sourceDiagnostics?.length ?? 0) > 0 && (
            <div className="rounded-lg border px-3 py-2 space-y-1">
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                Provider diagnostics
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {result.sourceDiagnostics!.slice(0, 20).map((d, i) => (
                  <li key={i}>
                    {d.provider}: {d.status}
                    {d.hitCount != null ? ` · hits ${d.hitCount}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!drawerCitation} onOpenChange={(open) => !open && setDrawerCitation(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drawerCitation?.title}</SheetTitle>
            <SheetDescription>
              {[drawerCitation?.citation, drawerCitation?.source].filter(Boolean).join(" · ")}
            </SheetDescription>
          </SheetHeader>
          {drawerCitation && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap gap-1">
                {authorityBadges(drawerCitation, result).map((b) => (
                  <Badge key={b} variant="secondary">
                    {b}
                  </Badge>
                ))}
              </div>
              {(drawerCitation.exactPassage ||
                drawerCitation.passageText ||
                drawerCitation.excerpt ||
                drawerCitation.summary) && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Relevant passage
                  </p>
                  <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">
                    {drawerCitation.exactPassage ??
                      drawerCitation.passageText ??
                      drawerCitation.excerpt ??
                      drawerCitation.summary}
                  </blockquote>
                </div>
              )}
              {drawerCitation.propositionActuallyDecided && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Proposition supported
                  </p>
                  <p>{drawerCitation.propositionActuallyDecided}</p>
                </div>
              )}
              {drawerCitation.pinpoint && (
                <p className="text-xs text-muted-foreground">
                  Pinpoint: {drawerCitation.pinpoint}
                </p>
              )}
              {drawerCitation.url && (
                <a
                  href={drawerCitation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline break-all"
                >
                  Open source
                </a>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
