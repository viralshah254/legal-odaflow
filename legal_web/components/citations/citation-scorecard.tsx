"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Shield, Info } from "lucide-react"

export interface CitationScore {
  citation: string
  /** Whether the case exists in the database */
  caseExists: boolean | null
  /** Whether the paragraph/holding quoted was matched */
  paragraphMatched: boolean | null
  /** Whether the quoted text was verified verbatim */
  quoteVerified: boolean | null
  /** Whether any section reference aligns with verified statute */
  sectionAligned: boolean | null
  /** Overall confidence 0-1 */
  confidence: number
  verified: boolean
  warnings?: string[]
  sourceUrl?: string
  sourceName?: string
}

export interface CitationScorecardProps {
  citations: CitationScore[]
  unverifiableCitations?: string[]
  overallVerified: boolean
  warnings?: string[]
  /** Compact mode for inline display */
  compact?: boolean
  className?: string
}

function ScoreItem({
  label,
  value,
  compact,
}: {
  label: string
  value: boolean | null
  compact?: boolean
}) {
  if (value === null) return null
  return (
    <div className={cn("flex items-center gap-1.5", compact ? "text-xs" : "text-sm")}>
      {value ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
      )}
      <span className={cn("text-gray-600 dark:text-gray-400", !value && "text-red-600 dark:text-red-400")}>
        {label}
      </span>
    </div>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

function FilingConfidenceBadge({ citations }: { citations: CitationScore[] }) {
  if (citations.length === 0) return null
  const avgConf = citations.reduce((s, c) => s + c.confidence, 0) / citations.length
  const allVerified = citations.every(c => c.verified)
  const someUnverified = citations.some(c => !c.verified)

  if (allVerified && avgConf >= 0.8) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">High filing confidence</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">All citations verified</p>
        </div>
      </div>
    )
  }
  if (someUnverified) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Review before filing</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">Some citations could not be verified</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <div>
        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Proceed with caution</p>
        <p className="text-xs text-orange-600 dark:text-orange-400">Verification incomplete — lawyer review recommended</p>
      </div>
    </div>
  )
}

export function CitationScorecard({
  citations,
  unverifiableCitations = [],
  overallVerified,
  warnings = [],
  compact = false,
  className,
}: CitationScorecardProps) {
  if (citations.length === 0 && unverifiableCitations.length === 0) return null

  return (
    <div className={cn("rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden", className)}>
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className={cn("h-4 w-4", overallVerified ? "text-emerald-500" : "text-amber-500")} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Citation Trust Score</span>
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          overallVerified
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        )}>
          {overallVerified ? "Verified" : "Unverified"}
        </span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Filing confidence summary */}
        <FilingConfidenceBadge citations={citations} />

        {/* Individual citations */}
        {citations.map((cit, i) => (
          <div key={i} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {cit.verified ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{cit.citation}</span>
                </div>
                {cit.sourceName && (
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">{cit.sourceName}</p>
                )}
              </div>
              {cit.sourceUrl && (
                <a
                  href={cit.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <ConfidenceBar confidence={cit.confidence} />

            {!compact && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                <ScoreItem label="Case exists" value={cit.caseExists} />
                <ScoreItem label="Paragraph matched" value={cit.paragraphMatched} />
                <ScoreItem label="Quote verified" value={cit.quoteVerified} />
                <ScoreItem label="Section aligned" value={cit.sectionAligned} />
              </div>
            )}

            {cit.warnings && cit.warnings.length > 0 && (
              <div className="mt-1">
                {cit.warnings.map((w, j) => (
                  <p key={j} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Unverifiable citations */}
        {unverifiableCitations.length > 0 && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Citations not found in database ({unverifiableCitations.length})
            </p>
            {unverifiableCitations.map((c, i) => (
              <p key={i} className="text-xs text-red-700 dark:text-red-300 font-mono mb-0.5">{c}</p>
            ))}
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              These may be hallucinated, misspelled, or from an unlicensed corpus. Verify manually before using.
            </p>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                {w}
              </p>
            ))}
          </div>
        )}

        {!compact && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Citation verification uses indexed authorities and India Kanoon. Results are indicative — always verify citations manually before filing.
          </p>
        )}
      </div>
    </div>
  )
}

/** Build a CitationScore array from backend VerifiedCitation data */
export function buildCitationScores(
  verified: Array<{
    citation: string
    confidence: number
    verified: boolean
    sourceName?: string
  }>,
  unverifiable?: string[],
): { citations: CitationScore[]; unverifiableCitations: string[]; overallVerified: boolean } {
  const citations: CitationScore[] = verified.map(v => ({
    citation: v.citation,
    caseExists: v.verified,
    paragraphMatched: null,
    quoteVerified: null,
    sectionAligned: null,
    confidence: v.confidence,
    verified: v.verified,
    sourceName: v.sourceName,
  }))

  return {
    citations,
    unverifiableCitations: unverifiable ?? [],
    overallVerified: citations.length > 0 && citations.every(c => c.verified),
  }
}
