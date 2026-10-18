"use client"

import { useState } from "react"
import {
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart2,
  BookOpen,
  Gavel,
  RefreshCw,
  ShieldCheck,
  Info,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  SectionResult,
  ConfidenceReport,
  VerificationReport,
  CitationAppendixEntry,
  SectionVerificationStatus,
  SectionType,
} from "@/lib/api/india-drafting"
import { SectionFeedbackWidget } from "@/components/drafting/SectionFeedbackWidget"

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ score, grade }: { score: number; grade: string }) {
  const colors: Record<string, string> = {
    high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    low: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    unverified: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        colors[grade] ?? colors.unverified,
      )}
    >
      <BarChart2 className="h-3 w-3" />
      {score}%
    </span>
  )
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SectionVerificationStatus }) {
  switch (status) {
    case "verified":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
    case "needs_review":
    case "limited_sources":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    case "repair_needed":
    case "repair_failed":
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
    default:
      return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  }
}

// ── Section type label ────────────────────────────────────────────────────────

const SECTION_LABELS: Partial<Record<SectionType, string>> = {
  heading: "Cause Title",
  parties: "Parties",
  maintainability: "Maintainability",
  facts: "Facts",
  grounds: "Grounds",
  law: "Applicable Law",
  arguments: "Arguments",
  prayer: "Prayer",
  verification: "Verification",
  annexures: "Annexures",
}

// ── Evidence chain row ────────────────────────────────────────────────────────

function EvidenceChainRow({ chain }: { chain: SectionResult["evidenceChains"][0] }) {
  const [open, setOpen] = useState(false)
  const hasItems =
    chain.statutes.length > 0 || chain.caseLaw.length > 0 || chain.missingEvidence.length > 0

  if (!hasItems) return null

  return (
    <div className="border rounded-md text-xs">
      <button
        type="button"
        className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-muted-foreground line-clamp-2 flex-1">
          {chain.paragraphText.slice(0, 120)}…
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t">
          {chain.whyIncluded && (
            <p className="text-muted-foreground pt-2">
              <span className="font-medium">Why included:</span> {chain.whyIncluded}
            </p>
          )}

          {chain.statutes.length > 0 && (
            <div className="space-y-0.5">
              <p className="font-medium text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Statutes
              </p>
              {chain.statutes.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 pl-4">
                  {s.verified ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  )}
                  <span>{s.ref}</span>
                </div>
              ))}
            </div>
          )}

          {chain.caseLaw.length > 0 && (
            <div className="space-y-0.5">
              <p className="font-medium text-muted-foreground flex items-center gap-1">
                <Gavel className="h-3 w-3" /> Case Law
              </p>
              {chain.caseLaw.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 pl-4">
                  {c.verified ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span className="break-all">{c.ref}</span>
                </div>
              ))}
            </div>
          )}

          {chain.missingEvidence.length > 0 && (
            <div className="space-y-0.5">
              <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Missing Evidence
              </p>
              {chain.missingEvidence.map((m, i) => (
                <p key={i} className="pl-4 text-amber-700 dark:text-amber-400">{m}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Single section row ────────────────────────────────────────────────────────

interface SectionRowProps {
  section: SectionResult
  onRegenerate?: (sectionId: string) => void
  isRegenerating?: boolean
  documentKind?: string
  caseDetails?: string
  courtDraftRecordId?: string
  draftJobSectionId?: string
  jurisdiction?: string
}

function SectionRow({
  section,
  onRegenerate,
  isRegenerating,
  documentKind = "",
  caseDetails,
  courtDraftRecordId,
  draftJobSectionId,
  jurisdiction,
}: SectionRowProps) {
  const [open, setOpen] = useState(false)
  const label = SECTION_LABELS[section.type] ?? section.title
  const hasWarnings = section.citationWarnings.length > 0 || section.verificationWarnings.length > 0

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <StatusIcon status={section.verificationStatus} />
        <span className="flex-1 text-sm font-medium">{label}</span>

        <div className="flex items-center gap-2">
          {section.repairAttempts > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <RefreshCw className="h-3 w-3" />
              {section.repairAttempts}
            </span>
          )}
          <ConfidenceBadge score={section.confidence.score} grade={section.confidence.grade} />
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-3 bg-muted/5">
          {/* Explainability */}
          {(section.explainability.applicableLaw.length > 0 ||
            section.explainability.applicableCases.length > 0) && (
            <div className="space-y-1.5 text-xs">
              <p className="font-medium text-muted-foreground">Reasoning</p>
              <p className="text-muted-foreground">{section.explainability.whyIncluded}</p>
              {section.explainability.applicableLaw.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Law: </span>
                  {section.explainability.applicableLaw.slice(0, 3).join(" · ")}
                </p>
              )}
              {section.explainability.applicableCases.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Cases: </span>
                  {section.explainability.applicableCases.slice(0, 3).join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* Confidence signals */}
          {section.confidence.signals.length > 0 && (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {section.confidence.signals.map((s, i) => (
                <p key={i}>• {s}</p>
              ))}
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
              {[...section.citationWarnings, ...section.verificationWarnings].slice(0, 4).map((w, i) => (
                <p key={i} className="leading-snug">• {w}</p>
              ))}
            </div>
          )}

          {/* Evidence chains */}
          {section.evidenceChains.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Evidence Chains</p>
              {section.evidenceChains.slice(0, 5).map((chain, i) => (
                <EvidenceChainRow key={i} chain={chain} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {/* Section-level regenerate */}
            {onRegenerate && section.verificationStatus !== "verified" ? (
              <button
                type="button"
                disabled={isRegenerating}
                onClick={() => onRegenerate(section.sectionId)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", isRegenerating && "animate-spin")} />
                {isRegenerating ? "Regenerating…" : "Regenerate this section"}
              </button>
            ) : (
              <span />
            )}

            {section.content && (
              <SectionFeedbackWidget
                sectionType={section.type}
                documentKind={documentKind}
                aiText={section.content}
                caseDetails={caseDetails}
                courtDraftRecordId={courtDraftRecordId}
                draftJobSectionId={draftJobSectionId ?? section.sectionId}
                jurisdiction={jurisdiction}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Overall confidence summary bar ────────────────────────────────────────────

function ConfidenceSummaryBar({ report }: { report: ConfidenceReport }) {
  const barColor =
    report.overallGrade === "high"
      ? "bg-emerald-500"
      : report.overallGrade === "medium"
        ? "bg-amber-400"
        : "bg-red-400"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Overall confidence</span>
        <span className="font-bold">{report.overallScore}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${report.overallScore}%` }}
        />
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          {report.verifiedSections} verified
        </span>
        {report.needsReviewSections > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            {report.needsReviewSections} needs review
          </span>
        )}
        {report.repairTriggered && (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 text-blue-500" />
            {report.totalRepairs} repair{report.totalRepairs !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Treatment badge ────────────────────────────────────────────────────────────

type TreatmentStatus = "good_law" | "overruled" | "distinguished" | "superseded" | "repealed"

function TreatmentBadge({ status }: { status?: string }) {
  if (!status || status === "good_law") return null
  const cfg: Record<string, { label: string; cls: string }> = {
    overruled: { label: "Overruled", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
    distinguished: { label: "Distinguished", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    superseded: { label: "Superseded", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    repealed: { label: "Repealed", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  }
  const c = cfg[status] ?? cfg.distinguished
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide", c.cls)}>
      {c.label}
    </span>
  )
}

// Extended type for rich appendix entries
interface RichCitationAppendixEntry extends CitationAppendixEntry {
  treatmentStatus?: TreatmentStatus
  sourceUrl?: string
  neutralCitation?: string
  holding?: string
}

// ── Citation appendix ─────────────────────────────────────────────────────────

function CitationAppendix({ entries }: { entries: RichCitationAppendixEntry[] }) {
  const [open, setOpen] = useState(false)
  if (entries.length === 0) return null

  const verified = entries.filter((e) => e.verified).length
  const flagged = entries.filter((e) => e.treatmentStatus === "overruled" || e.treatmentStatus === "superseded").length

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="flex-1 text-sm font-medium">Citation Appendix</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {verified}/{entries.length} verified
          </span>
          {flagged > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {flagged} flagged
            </span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t px-3 py-2 space-y-1.5 max-h-72 overflow-y-auto">
          {entries.map((entry, i) => (
            <div key={i} className={cn(
              "flex items-start gap-2 text-xs py-1.5 px-2 rounded-md",
              entry.treatmentStatus === "overruled" ? "bg-red-50 dark:bg-red-950/30" :
              entry.treatmentStatus === "superseded" ? "bg-amber-50 dark:bg-amber-950/30" : ""
            )}>
              {entry.verified ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold truncate">{entry.citation}</p>
                  <TreatmentBadge status={entry.treatmentStatus} />
                  {entry.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-500 hover:text-indigo-700 shrink-0"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {entry.sectionTitle} · {entry.type === "case_law" ? "Case" : "Statute"}
                  {entry.source ? ` · ${entry.source}` : ""}
                </p>
                {entry.holding && (
                  <p className="text-muted-foreground italic mt-0.5 line-clamp-1">&ldquo;{entry.holding}&rdquo;</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface DraftV2SectionPanelProps {
  sections: SectionResult[]
  confidenceReport: ConfidenceReport
  verificationReport: VerificationReport
  citationAppendix?: CitationAppendixEntry[]
  onRegenerateSection?: (sectionId: string) => void
  regeneratingSectionId?: string | null
  className?: string
  documentKind?: string
  caseDetails?: string
  courtDraftRecordId?: string
  draftJobSectionId?: string
  jurisdiction?: string
}

export function DraftV2SectionPanel({
  sections,
  confidenceReport,
  verificationReport,
  citationAppendix = [],
  onRegenerateSection,
  regeneratingSectionId,
  className,
  documentKind,
  caseDetails,
  courtDraftRecordId,
  draftJobSectionId,
  jurisdiction,
}: DraftV2SectionPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Document Accuracy · v2 Engine
        </span>
        <div className="flex items-center gap-2">
          <ConfidenceBadge
            score={confidenceReport.overallScore}
            grade={confidenceReport.overallGrade}
          />
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
          {/* Confidence summary */}
          <ConfidenceSummaryBar report={confidenceReport} />

          {/* Certification status */}
          {verificationReport.canCertify ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Verified for filing — all sections passed
            </div>
          ) : verificationReport.requiresLawyerReview ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Requires lawyer review before filing
            </div>
          ) : null}

          {/* Per-section rows */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Section Analysis</p>
            {sections.map((section) => (
              <SectionRow
                key={section.sectionId}
                section={section}
                onRegenerate={onRegenerateSection}
                isRegenerating={regeneratingSectionId === section.sectionId}
                documentKind={documentKind}
                caseDetails={caseDetails}
                courtDraftRecordId={courtDraftRecordId}
                draftJobSectionId={draftJobSectionId}
                jurisdiction={jurisdiction}
              />
            ))}
          </div>

          {/* Citation appendix with treatment badges */}
          {citationAppendix.length > 0 && (
            <CitationAppendix entries={citationAppendix as RichCitationAppendixEntry[]} />
          )}
        </div>
      )}
    </div>
  )
}
