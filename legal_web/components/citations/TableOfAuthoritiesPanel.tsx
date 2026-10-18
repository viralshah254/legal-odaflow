"use client"

import { useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Scale, ChevronDown, ChevronUp, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CitationAppendixEntry } from "@/lib/api/india-drafting"
import { VerificationDimensionChips } from "@/components/verification/verification-ui"
import { fallbackDimensions } from "@/lib/api/verification"

// Extended entry with richer metadata from the backend CitationAppendixBuilder
export interface RichCitationAppendixEntry extends CitationAppendixEntry {
  treatmentStatus?: "good_law" | "overruled" | "distinguished" | "superseded" | "repealed"
  sourceUrl?: string
  neutralCitation?: string
  decisionYear?: number
  holding?: string
  dimensions?: import("@/lib/api/verification").VerificationDimensions
  verificationFindings?: import("@/lib/api/verification").VerificationFinding[]
}

interface TableOfAuthoritiesPanelProps {
  entries: RichCitationAppendixEntry[]
  engineVersion?: "v1" | "v2" | "v3"
  className?: string
  /** Show in compact mode (ToA preview, not full display) */
  compact?: boolean
}

const TREATMENT_CONFIG = {
  good_law: {
    label: "Good Law",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
  },
  overruled: {
    label: "Overruled",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    dotClassName: "bg-red-500",
  },
  distinguished: {
    label: "Distinguished",
    icon: AlertTriangle,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    dotClassName: "bg-blue-500",
  },
  superseded: {
    label: "Superseded",
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },
  repealed: {
    label: "Repealed",
    icon: XCircle,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dotClassName: "bg-gray-400",
  },
  unverified: {
    label: "Unverified",
    icon: AlertTriangle,
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    dotClassName: "bg-gray-400",
  },
}

function dimState(
  status?: "pass" | "fail" | "indeterminate",
): "PASS" | "FAIL" | "INDETERMINATE" | "NOT_APPLICABLE" {
  if (status === "pass") return "PASS"
  if (status === "fail") return "FAIL"
  if (status === "indeterminate") return "INDETERMINATE"
  return "NOT_APPLICABLE"
}

function TreatmentBadge({ status }: { status?: string }) {
  const key = status && status in TREATMENT_CONFIG ? status : "unverified"
  const config = TREATMENT_CONFIG[key as keyof typeof TREATMENT_CONFIG]
  const Icon = config.icon
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full", config.className)}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {config.label}
    </span>
  )
}

function CaseLawRow({ entry }: { entry: RichCitationAppendixEntry }) {
  const relevanceFail = entry.relevanceStatus === "fail"
  const identityFail = entry.identityStatus === "fail"
  const isSafe =
    !relevanceFail &&
    !identityFail &&
    (!entry.treatmentStatus || entry.treatmentStatus === "good_law" || entry.treatmentStatus === "distinguished")

  const dims = entry.dimensions
  const identityState = dims?.identity.state ?? (entry.identityStatus
    ? dimState(entry.identityStatus)
    : entry.verified
      ? "PASS"
      : "FAIL")

  const relevanceState = dims?.relevance.state ?? dimState(entry.relevanceStatus)

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-1.5",
      entry.treatmentStatus === "overruled" || entry.treatmentStatus === "repealed" || relevanceFail || identityFail
        ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
        : entry.treatmentStatus === "superseded"
        ? "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20"
        : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.verified && entry.relevanceStatus !== "fail" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.citation}</span>
            {entry.neutralCitation && (
              <span className="text-xs text-gray-400 truncate">[{entry.neutralCitation}]</span>
            )}
          </div>
          {entry.sectionTitle && (
            <p className="text-xs text-gray-400 mt-0.5 ml-5">
              {entry.authorityType === "statute" || entry.type === "statute"
                ? "Cited for: "
                : "Cited in: "}
              {entry.sectionTitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <VerificationDimensionChips
            compact
            dimensions={
              dims ?? {
              ...fallbackDimensions(),
              identity: {
                state: identityState,
                pass: identityState === "PASS" ? 1 : 0,
                fail: identityState === "FAIL" ? 1 : 0,
                indeterminate: identityState === "INDETERMINATE" ? 1 : 0,
                notApplicable: identityState === "NOT_APPLICABLE" ? 1 : 0,
              },
              relevance: {
                state: relevanceState,
                pass: relevanceState === "PASS" ? 1 : 0,
                fail: relevanceState === "FAIL" ? 1 : 0,
                indeterminate: relevanceState === "INDETERMINATE" ? 1 : 0,
                notApplicable: relevanceState === "NOT_APPLICABLE" ? 1 : 0,
              },
              quotation: { state: "NOT_APPLICABLE", pass: 0, fail: 0, indeterminate: 0, notApplicable: 1 },
              currentLaw: {
                state: entry.treatmentStatus && entry.treatmentStatus !== "good_law" ? "FAIL" : entry.treatmentStatus === "good_law" && entry.relevanceStatus === "pass" ? "PASS" : "INDETERMINATE",
                pass: entry.treatmentStatus === "good_law" && entry.relevanceStatus === "pass" ? 1 : 0,
                fail: entry.treatmentStatus && entry.treatmentStatus !== "good_law" ? 1 : 0,
                indeterminate: !entry.treatmentStatus || entry.relevanceStatus !== "pass" ? 1 : 0,
                notApplicable: 0,
              },
              treatment: {
                state: entry.treatmentStatus === "good_law" && entry.relevanceStatus === "pass" ? "PASS" : entry.treatmentStatus ? "PASS" : "NOT_APPLICABLE",
                pass: entry.treatmentStatus ? 1 : 0,
                fail: 0,
                indeterminate: 0,
                notApplicable: entry.treatmentStatus ? 0 : 1,
              },
              hierarchy: { state: "NOT_APPLICABLE", pass: 0, fail: 0, indeterminate: 0, notApplicable: 1 },
            }}
          />
          <TreatmentBadge
            status={
              entry.relevanceStatus === "pass" &&
              entry.identityStatus === "pass" &&
              entry.treatmentStatus === "good_law"
                ? "good_law"
                : entry.relevanceStatus === "fail" || entry.identityStatus === "fail"
                  ? "unverified"
                  : entry.treatmentStatus && entry.treatmentStatus !== "good_law"
                    ? entry.treatmentStatus
                    : "unverified"
            }
          />
          {entry.sourceUrl && (
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              title="View source"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {entry.holding && (
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-5 line-clamp-2 italic">
          &ldquo;{entry.holding}&rdquo;
        </p>
      )}

      {(relevanceFail || identityFail) && (
        <p className="text-xs text-red-600 dark:text-red-400 ml-5 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {entry.exclusionReason ??
            "Authority exists, but identity or relevance verification failed — exclude from final authorities."}
        </p>
      )}

      {!isSafe && !relevanceFail && !identityFail && (
        <p className="text-xs text-red-600 dark:text-red-400 ml-5 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {entry.treatmentStatus === "overruled"
            ? "This authority has been overruled — verify before citing."
            : entry.treatmentStatus === "superseded"
            ? "Superseded — cite the successor authority alongside."
            : "Review this authority before filing."}
        </p>
      )}
    </div>
  )
}

export function TableOfAuthoritiesPanel({
  entries,
  engineVersion,
  className,
  compact = false,
}: TableOfAuthoritiesPanelProps) {
  const [expanded, setExpanded] = useState(!compact)

  const visible = entries.filter((e) => !e.excluded)
  const cases = visible.filter((e) => e.type === "case_law" || e.type === "case")
  const statutes = visible.filter((e) => e.type === "statute")

  const verifiedCases = cases.filter((c) => c.verified && c.relevanceStatus !== "fail")
  const unverifiedCases = cases.filter((c) => !c.verified || c.relevanceStatus === "fail")
  const overruledCases = cases.filter((c) => c.treatmentStatus === "overruled")
  const allSafe = overruledCases.length === 0 && unverifiedCases.length === 0

  if (visible.length === 0) return null

  return (
    <div className={cn("rounded-xl border overflow-hidden", allSafe ? "border-gray-200 dark:border-gray-700" : "border-amber-300 dark:border-amber-700", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Scale className={cn("h-4 w-4 shrink-0", allSafe ? "text-indigo-500" : "text-amber-500")} />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Table of Authorities</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {cases.length} case{cases.length !== 1 ? "s" : ""} · {statutes.length} statute{statutes.length !== 1 ? "s" : ""}
              {verifiedCases.length > 0 && ` · ${verifiedCases.length} verified for proposition`}
              {overruledCases.length > 0 && ` · ⚠ ${overruledCases.length} flagged`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {engineVersion && (
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              engineVersion === "v2"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}>
              {engineVersion.toUpperCase()}
            </span>
          )}
          {!allSafe && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Review needed
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Export note */}
          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <BookOpen className="h-3 w-3 shrink-0" />
            This table is included in PDF and Word exports only when authority verification passes.
          </p>

          {/* Case Law */}
          {cases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Cases ({cases.length})
              </h3>
              {cases.map((entry, i) => (
                <CaseLawRow key={`${entry.citation}-${i}`} entry={entry} />
              ))}
            </div>
          )}

          {/* Statutes */}
          {statutes.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Statutes &amp; Rules ({statutes.length})
              </h3>
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {statutes.map((entry, i) => (
                  <div key={i} className="px-3 py-2 flex items-start gap-2">
                    {entry.relevanceStatus === "pass" && entry.verified ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="text-xs text-gray-700 dark:text-gray-300">{entry.citation}</span>
                      {entry.sectionTitle && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Cited for: {entry.sectionTitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unverified warning */}
          {unverifiedCases.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                {unverifiedCases.length} citation{unverifiedCases.length !== 1 ? "s" : ""} failed identity or relevance verification
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Do not export with these authorities. Rerun proposition-based enrichment after review.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
