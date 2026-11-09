"use client"

import { useEffect, useState } from "react"
import { ExternalLink, ChevronDown, Scale, Copy, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { SimilarCase, SectionChecksAudit } from "@/lib/api/types"

// ── Binding weight badge ────────────────────────────────────────────────────

function BindingBadge({ weight }: { weight: SimilarCase["bindingWeight"] }) {
  if (!weight) return null
  const meta: Record<string, { cls: string; label: string }> = {
    binding: {
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300",
      label: "BINDING",
    },
    persuasive: {
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300",
      label: "PERSUASIVE",
    },
    informational: {
      cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300",
      label: "INFORMATIONAL",
    },
  }
  const m = meta[weight]
  if (!m) return null
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border", m.cls)}>
      {m.label}
    </span>
  )
}

// ── Verification status badge ───────────────────────────────────────────────

function VerifiedBadge({ status }: { status: SimilarCase["verificationStatus"] }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Source identity confirmed
      </span>
    )
  }
  if (status === "needs_verification") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Identity needs review
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">Identity not checked</span>
  )
}

// ── Citation copy button ────────────────────────────────────────────────────

function CopyCitation({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      title="Copy citation"
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
    >
      <Copy className="h-3 w-3" />
      {copied && <span className="text-xs ml-1 text-primary">Copied</span>}
    </button>
  )
}

// ── Single case card ────────────────────────────────────────────────────────

function CaseCard({ c, index }: { c: SimilarCase; index: number }) {
  const sourceName = c.court ?? (c.sourceUrl ? "View judgment" : null)

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <BindingBadge weight={c.bindingWeight} />
          {c.sourceName.includes("Supreme Court") && (
            <Badge variant="outline" className="text-[10px]">Curated authority</Badge>
          )}
          {(c.court || c.year) && (
            <span className="text-xs text-muted-foreground">
              {[c.court, c.year].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <VerifiedBadge status={c.verificationStatus} />
          {c.sourceUrl && sourceName && (
            <a
              href={c.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
            >
              {sourceName}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <CardContent className="pt-3 pb-4 space-y-2.5 text-sm">
        <h3 className="font-semibold leading-snug">{c.title ?? `Case ${index + 1}`}</h3>

        {c.citation && (
          <div className="font-mono text-xs text-muted-foreground flex items-center gap-1">
            <Scale className="h-3 w-3 shrink-0" />
            <span>{c.citation}</span>
            <CopyCitation text={c.citation} />
          </div>
        )}
        {c.neutralCitation && c.neutralCitation !== c.citation && (
          <div className="font-mono text-xs text-muted-foreground flex items-center gap-1">
            <Scale className="h-3 w-3 shrink-0" />
            <span>{c.neutralCitation}</span>
            <CopyCitation text={c.neutralCitation} />
          </div>
        )}

        {c.relevantSections.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.relevantSections.slice(0, 6).map((s) => (
              <Badge key={s} variant="outline" className="text-xs font-mono">
                {s}
              </Badge>
            ))}
          </div>
        )}

        {c.summary && (
          <p className="text-muted-foreground leading-relaxed text-xs">{c.summary.slice(0, 280)}{c.summary.length > 280 ? "…" : ""}</p>
        )}

        {c.keyHolding && (
          <div className="rounded-md border bg-muted/20 p-2.5 text-xs">
            <p className="mb-1 font-semibold">Holding passage</p>
            <p className="whitespace-pre-wrap leading-relaxed">{c.keyHolding}</p>
          </div>
        )}
        <div className="text-xs leading-relaxed">
          <span className="font-semibold">Outcome: </span>
          {c.outcome || "Not established by the retrieved material. Open the judgment to confirm."}
          {c.proceduralStage && <span className="text-muted-foreground"> · {c.proceduralStage.replaceAll("_", " ").toLowerCase()}</span>}
        </div>

        {c.relevance && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5">
            <p className="text-xs font-semibold mb-1">Why this matters</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{c.relevance}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Section cross-check status ──────────────────────────────────────────────

function SectionCrossCheck({ audit }: { audit: SectionChecksAudit }) {
  if (!audit.anyCorrections && !audit.anyUnconfirmedMismatches) return null

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 space-y-1 text-sm",
        audit.anyCorrections
          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
          : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
      )}
    >
      <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wide">
        <ShieldCheck className="h-3.5 w-3.5" />
        Section cross-check
      </div>
      {audit.entries
        .filter((e) => e.corrected || e.warnings.length > 0)
        .map((e, i) => (
          <div key={i} className="text-xs text-muted-foreground">
            {e.corrected ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                ✓ {e.originalSection} corrected to {e.confirmedSections.join(", ")} after similar-case cross-check + primary-law confirmation.
              </span>
            ) : (
              e.warnings.map((w, j) => (
                <span key={j} className="text-amber-700 dark:text-amber-400 block">⚠ {w}</span>
              ))
            )}
          </div>
        ))}
    </div>
  )
}

// ── Main panel exported ─────────────────────────────────────────────────────

interface SimilarCasesPanelProps {
  similarCases?: SimilarCase[]
  sectionChecks?: SectionChecksAudit | null
  /** When true, expand the similar-cases list (e.g. after Enrich adds cases). */
  defaultOpen?: boolean
}

export function SimilarCasesPanel({
  similarCases,
  sectionChecks,
  defaultOpen = false,
}: SimilarCasesPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const cases = Array.isArray(similarCases) ? similarCases : []
  const hasSectionAudit =
    !!sectionChecks?.anyCorrections || !!sectionChecks?.anyUnconfirmedMismatches

  useEffect(() => {
    if (defaultOpen && cases.length > 0) setOpen(true)
  }, [defaultOpen, cases.length])

  if (cases.length === 0 && !hasSectionAudit) {
    return (
      <div className="rounded-lg border px-4 py-3 space-y-1">
        <p className="text-sm font-semibold">Similar cases</p>
        <p className="text-xs text-muted-foreground">
          No similar judgments were found for this fact pattern. Use{" "}
          <span className="font-medium text-foreground">Add Case Laws</span> to search published
          case law and update this memo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sectionChecks && <SectionCrossCheck audit={sectionChecks} />}

      {cases.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-muted/30 transition-colors">
              <span className="text-sm font-semibold">
                Similar cases ({cases.length})
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-b-lg border border-t-0 px-4 pb-4 pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Retrieved from legal corpus and case-law sources. Similarity and source identity do not prove passage support or current-law treatment.
                Review before relying on any case in court or client advice.
              </p>
              {cases.map((c, i) => (
                <CaseCard key={c.authorityId ?? i} c={c} index={i} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
