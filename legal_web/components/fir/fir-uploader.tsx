"use client"

import { useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  ArrowRight,
  Shield,
  Info,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadFirFile, type FirExtractionResult, type FirExtractedField, type FirNextStep } from "@/lib/api/fir"
import { validateUploadFile } from "@/lib/security/validate-upload-file"
import { PdfExportButton, ShareButton } from "@/components/export/pdf-export-button"

const PRIORITY_COLORS: Record<FirNextStep["priority"], string> = {
  urgent: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
  high: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200",
  medium: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
  low: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
}

const CATEGORY_LABELS: Record<FirNextStep["category"], string> = {
  bail: "Bail",
  documents: "Documents",
  procedure: "Procedure",
  research: "Research",
  draft: "Draft",
  timeline: "Timeline",
  defect: "Procedural Defect",
}

function ConfidenceBadge({ confidence }: { confidence: FirExtractedField["confidence"] }) {
  const map = {
    high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    low: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    missing: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  }
  return (
    <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", map[confidence])}>
      {confidence}
    </span>
  )
}

function FieldRow<T extends string | string[] | null>({
  label,
  field,
}: {
  label: string
  field: FirExtractedField<T>
}) {
  const displayValue = Array.isArray(field.value)
    ? field.value.join(", ")
    : field.value ?? "—"

  if (field.confidence === "missing") return null

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 flex items-start gap-2">
        <span className={cn("text-sm", field.confidence === "low" && "italic text-gray-400 dark:text-gray-500")}>
          {displayValue}
        </span>
        {field.confidence !== "high" && <ConfidenceBadge confidence={field.confidence} />}
        {field.confidence === "low" && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">(needs confirmation)</span>
        )}
      </div>
    </div>
  )
}

interface FirUploaderProps {
  /** Consumed page context: affects action button routing */
  context?: "consumer" | "lawyer" | "firm"
  countryCode?: string
  onResultReady?: (result: FirExtractionResult) => void
}

export function FirUploader({ context = "consumer", countryCode = "IN", onResultReady }: FirUploaderProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FirExtractionResult | null>(null)
  const [expandedFacts, setExpandedFacts] = useState(true)

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      setResult(null)
      try {
        await validateUploadFile(file, "firDocument")
        const r = await uploadFirFile(file, countryCode)
        setResult(r)
        onResultReady?.(r)
      } catch (e) {
        setError(e instanceof Error ? e.message : "FIR extraction failed")
      } finally {
        setLoading(false)
      }
    },
    [countryCode, onResultReady],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const getResearchRoute = () =>
    context === "consumer" ? "/consumer/research" : "/app/research"
  const getIssueCheckerRoute = () => "/legal-issue-checker"

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">Extracting FIR facts…</p>
        <p className="text-sm text-gray-400">This may take 10-30 seconds depending on document quality.</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="space-y-6">
        {/* Dropzone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 py-14 px-6",
            dragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
              : "border-gray-300 dark:border-gray-700 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
          )}
        >
          <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <Upload className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">Upload FIR</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              PDF, image (photo/scan), or Word document
            </p>
            <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse · Max 20MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.webp,.tif,.tiff"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        {/* Info banner */}
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3 flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p className="font-semibold">India FIR Intelligence — what you get:</p>
            <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-700 dark:text-blue-300">
              <li>Structured extraction: FIR number, station, accused, sections, arrest status</li>
              <li>Confidence rating per extracted field</li>
              <li>Next legal steps for your defence</li>
              <li>Bail posture based on extracted offences</li>
              <li>Procedural defect flags</li>
              <li>Suggested research queries and draft types</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>
    )
  }

  const { extractedFacts: f, nextSteps, bailPostureSummary, suggestedResearchQuery, suggestedDraftTypes, riskFlags, disclaimer } = result

  return (
    <div className="space-y-6">
      {/* Reset button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="font-semibold text-gray-900 dark:text-white">FIR Extracted</span>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            f.documentQuality === "clear" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
            f.documentQuality === "partial" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
            "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
          )}>
            Document quality: {f.documentQuality}
          </span>
        </div>
        <button
          onClick={() => { setResult(null); setError(null) }}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
        >
          Upload another FIR
        </button>
      </div>

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Risk Flags
          </p>
          <ul className="space-y-1">
            {riskFlags.map((flag, i) => (
              <li key={i} className="text-sm text-red-800 dark:text-red-200 flex items-start gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Extracted Facts */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <button
          onClick={() => setExpandedFacts(e => !e)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50"
        >
          <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" /> Extracted Facts
            {f.missingFields.length > 0 && (
              <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                ({f.missingFields.length} field{f.missingFields.length !== 1 ? "s" : ""} missing)
              </span>
            )}
          </span>
          {expandedFacts ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </button>
        {expandedFacts && (
          <div className="px-5 py-3">
            <FieldRow label="FIR Number" field={f.firNumber} />
            <FieldRow label="Police Station" field={f.policeStation} />
            <FieldRow label="District" field={f.district} />
            <FieldRow label="State" field={f.state} />
            <FieldRow label="Date of Occurrence" field={f.dateOfOccurrence} />
            <FieldRow label="Date of Filing" field={f.dateOfFiling} />
            <FieldRow label="Complainant" field={f.complainant} />
            <FieldRow label="Accused" field={f.accused as FirExtractedField<string[]>} />
            <FieldRow label="Sections" field={f.sections as FirExtractedField<string[]>} />
            <FieldRow label="Alleged Offences" field={f.allegedOffences as FirExtractedField<string[]>} />
            <FieldRow label="Arrest Status" field={f.arrestStatus} />
            <FieldRow label="Property Involved" field={f.propertyInvolved} />
            <FieldRow label="Amount Involved" field={f.amountInvolved} />
            <FieldRow label="Witnesses" field={f.witnesses as FirExtractedField<string[]>} />
            {f.factsNarrative.value && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Facts Narrative</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{f.factsNarrative.value}</p>
                {f.factsNarrative.confidence !== "high" && <ConfidenceBadge confidence={f.factsNarrative.confidence} />}
              </div>
            )}
            {f.missingFields.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Missing fields: {f.missingFields.join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bail posture */}
      {bailPostureSummary && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> Bail Posture
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200">{bailPostureSummary}</p>
        </div>
      )}

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Next Legal Steps</p>
          {nextSteps.map((step, i) => (
            <div key={i} className={cn("rounded-lg border px-4 py-3 flex gap-3", PRIORITY_COLORS[step.priority])}>
              <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                <span className="text-xs font-bold">{i + 1}</span>
                <span className={cn(
                  "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded",
                  step.priority === "urgent" ? "bg-red-200 text-red-800" :
                  step.priority === "high" ? "bg-orange-200 text-orange-800" :
                  step.priority === "medium" ? "bg-amber-200 text-amber-800" :
                  "bg-gray-200 text-gray-600",
                )}>
                  {step.priority}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.step}</p>
                <p className="text-xs mt-0.5 opacity-80">{step.details}</p>
                <span className="inline-block mt-1 text-[9px] font-semibold uppercase opacity-60 border border-current/20 rounded px-1 py-0.5">
                  {CATEGORY_LABELS[step.category]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Draft types */}
      {suggestedDraftTypes.length > 0 && (
        <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-4 py-3">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-2">Suggested Applications / Drafts</p>
          <ul className="space-y-1">
            {suggestedDraftTypes.map((d, i) => (
              <li key={i} className="text-sm text-violet-900 dark:text-violet-200 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {suggestedResearchQuery && (
          <button
            onClick={() =>
              router.push(`${getResearchRoute()}?q=${encodeURIComponent(suggestedResearchQuery)}`)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:hover:bg-indigo-900 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 transition-colors"
          >
            <Search className="h-4 w-4" /> Run Research
          </button>
        )}
        {(f.sections?.value?.length ?? 0) > 0 && (
          <button
            onClick={() =>
              router.push(`/app/section-finder?q=${encodeURIComponent((f.sections.value as string[])?.[0] ?? "")}`)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950 dark:hover:bg-orange-900 px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-300 transition-colors"
          >
            <ArrowRight className="h-4 w-4" /> Look Up Section
          </button>
        )}
        <button
          onClick={() => {
            const q = [
              f.sections?.value?.[0],
              f.allegedOffences?.value?.[0],
            ].filter(Boolean).join(" ")
            router.push(`${getIssueCheckerRoute()}?q=${encodeURIComponent(q)}`)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" /> Check Issue
        </button>
        <PdfExportButton
          title={`FIR Analysis — ${f.firNumber?.value ?? "Document"}`}
          content={[
            f.firNumber?.value ? `**FIR No.:** ${f.firNumber.value}` : "",
            f.policeStation?.value ? `**Police Station:** ${f.policeStation.value}` : "",
            f.sections?.value ? `**Sections:** ${(f.sections.value as string[]).join(", ")}` : "",
            f.accused?.value ? `**Accused:** ${(f.accused.value as string[]).join(", ")}` : "",
            f.factsNarrative?.value ? `**Facts:** ${f.factsNarrative.value}` : "",
            `\n**Bail Posture:** ${bailPostureSummary ?? "Unknown"}`,
            nextSteps?.length
              ? `\n**Next Steps:**\n${nextSteps.map((s) => `- ${s.step}`).join("\n")}`
              : "",
          ].filter(Boolean).join("\n")}
          meta={{ countryCode: "IN" }}
          label="Export PDF"
        />
        <ShareButton
          title={`FIR Analysis — ${f.firNumber?.value ?? "Document"}`}
          text={`FIR ${f.firNumber?.value ?? ""} — ${f.sections?.value ? `Sections: ${(f.sections.value as string[]).join(", ")}` : ""} — Bail: ${bailPostureSummary ?? "Unknown"}`}
          label="Share"
        />
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 dark:text-gray-500">{disclaimer}</p>
    </div>
  )
}
