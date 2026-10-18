"use client"

import { useState, useMemo, useEffect } from "react"
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  QUESTIONNAIRE,
  type QuestionnaireField,
} from "@/lib/india-drafting/questionnaire-data"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedField {
  id: string
  label: string
  hint?: string
  type: "text" | "textarea" | "date"
}

interface Props {
  /** The raw blockedReason / error string from the backend. */
  blockedReason: string
  /** Document kind — when a questionnaire exists, all required fields are shown at once. */
  documentKind?: string
  /** Current case details text (so we can append the answers). */
  caseDetails: string
  onRegenerate: (updatedDetails: string) => void
  loading?: boolean
}

const ADDENDUM_HEADER = "\n\nAdditional information provided:\n"

// ── Parsing ───────────────────────────────────────────────────────────────────

function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

function canonicalFieldLabel(raw: string): string {
  const lower = raw.toLowerCase();
  if (/petitioner|accused|applicant|unclear whether.*petitioner/i.test(lower)) {
    return "Petitioner/accused name";
  }
  if (/fir/i.test(lower)) return "FIR number";
  if (/police station/i.test(lower)) return "Police station";
  if (/order date/i.test(lower)) return "Order date";
  if (/respondent|state name/i.test(lower)) return "Respondent/State name";
  if (/arrest/i.test(lower)) return "Date of arrest";
  if (/section/i.test(lower)) return "Sections charged";
  return raw
    .replace(/^Required input missing:\s*/i, "")
    .replace(/\s+(not specified|not provided|not given)\.?$/i, "")
    .replace(/\s*(appears|is|needs|needs confirmation|unclear).*$/i, "")
    .trim();
}

/**
 * Parses the semicolon-separated blockedReason string into individual field
 * descriptors so they can be rendered as labeled inputs.
 */
function parseBlockedReason(reason: string): ParsedField[] {
  const parts = reason
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const fields: ParsedField[] = []

  for (const part of parts) {
    let label = part
      .replace(/^Required input missing:\s*/i, "")
      .replace(/\s+(not specified|not provided|not given)\.?$/i, "")
      .trim()

    label = canonicalFieldLabel(label.charAt(0).toUpperCase() + label.slice(1))

    const dashIdx = label.indexOf(" — ")
    let hint: string | undefined
    if (dashIdx !== -1) {
      hint = label.slice(dashIdx + 3).trim()
      label = label.slice(0, dashIdx).trim()
    }

    const id = slugifyLabel(label)
    if (seen.has(id)) continue
    seen.add(id)

    const multilineKeywords =
      /names?.*address|address.*names?|contributions?|partners?|description|background|details|facts|grounds?/i
    const type: ParsedField["type"] = multilineKeywords.test(label) ? "textarea" : "text"

    fields.push({ id, label, hint, type })
  }

  return fields
}

function questionnaireToFields(fields: QuestionnaireField[]): ParsedField[] {
  return fields
    .filter((f) => f.required)
    .map((f) => ({
      id: f.id,
      label: f.label,
      hint: f.hint,
      type: f.type === "textarea" ? "textarea" : f.type === "date" ? "date" : "text",
    }))
}

function mergeFieldLists(primary: ParsedField[], secondary: ParsedField[]): ParsedField[] {
  const merged = new Map<string, ParsedField>()
  for (const field of [...primary, ...secondary]) {
    if (!merged.has(field.id)) merged.set(field.id, field)
  }
  return [...merged.values()]
}

function stripAddendum(details: string): string {
  return details.replace(/\n\nAdditional information provided:\n[\s\S]*/gi, "").trimEnd()
}

function parseAddendumValues(details: string): Record<string, string> {
  const values: Record<string, string> = {}
  const blocks = details.split(/\n\nAdditional information provided:\n/i)
  for (let i = 1; i < blocks.length; i++) {
    for (const line of blocks[i].split("\n")) {
      const match = line.match(/^([^:]+):\s*(.+)$/)
      if (!match) continue
      const key = slugifyLabel(canonicalFieldLabel(match[1].trim()))
      values[key] = match[2].trim()
    }
  }
  return values
}

function fieldLooksFilled(label: string, haystack: string): boolean {
  const slug = slugifyLabel(label)
  if (new RegExp(`${slug.replace(/_/g, "[\\s_]+")}\\s*:`, "i").test(haystack)) return true
  if (new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(haystack)) {
    return true
  }
  return false
}

/**
 * Compiles the filled answers into a structured addendum that replaces any
 * previous addendum before re-generating.
 */
function compileAnswers(baseDetails: string, fields: ParsedField[], values: Record<string, string>): string {
  const lines = fields
    .filter((f) => values[f.id]?.trim())
    .map((f) => `${canonicalFieldLabel(f.label)}: ${values[f.id].trim()}`)
  const stripped = stripAddendum(baseDetails)
  if (!lines.length) return stripped
  return stripped + ADDENDUM_HEADER + lines.join("\n")
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DraftMissingFieldsForm({
  blockedReason,
  documentKind,
  caseDetails,
  onRegenerate,
  loading = false,
}: Props) {
  const questionnaireFields = documentKind ? QUESTIONNAIRE[documentKind] : undefined

  const fields = useMemo(() => {
    const fromBlocked = parseBlockedReason(blockedReason)
    // Prefer the backend's pending-only list so we never re-ask fields the
    // resolver already extracted from context. Only fall back to the full
    // questionnaire when the error string doesn't parse into discrete fields
    // (e.g. generic party-not-found messages).
    if (fromBlocked.length > 0) return fromBlocked
    const fromQuestionnaire = questionnaireFields
      ? questionnaireToFields(questionnaireFields)
      : []
    return fromQuestionnaire
  }, [blockedReason, questionnaireFields])

  const [values, setValues] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const prefilled = parseAddendumValues(caseDetails)
    const next: Record<string, string> = {}
    for (const field of fields) {
      if (prefilled[field.id]) {
        next[field.id] = prefilled[field.id]
      } else if (!fieldLooksFilled(field.label, caseDetails)) {
        next[field.id] = ""
      } else {
        next[field.id] = values[field.id] ?? ""
      }
    }
    setValues(next)
    // Re-seed when the required field set changes (new block reason / kind).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => f.id).join("|"), caseDetails])

  const filledCount = fields.filter((f) => values[f.id]?.trim()).length
  const allFilled = fields.length > 0 && filledCount === fields.length

  const handleSubmit = () => {
    const updatedDetails = compileAnswers(caseDetails, fields, values)
    onRegenerate(updatedDetails)
  }

  const setValue = (id: string, val: string) =>
    setValues((prev) => ({ ...prev, [id]: val }))

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 leading-snug">
            Additional information needed
          </span>
          <span className="shrink-0 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-1.5 py-0.5 leading-none">
            {filledCount}/{fields.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed -mt-1">
            Fill in all details below in one go so we can generate an accurate draft. Every field
            is required.
          </p>

          {fields.map((field) => {
            const val = values[field.id] ?? ""
            const empty = !val.trim()
            return (
              <div key={field.id} className="space-y-1">
                <label
                  htmlFor={field.id}
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 leading-snug"
                >
                  {canonicalFieldLabel(field.label)}
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                {field.hint && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-0.5">
                    {field.hint}
                  </p>
                )}
                {field.type === "textarea" ? (
                  <textarea
                    id={field.id}
                    rows={3}
                    value={val}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={cn(
                      "w-full rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed transition-colors",
                      empty
                        ? "border-gray-200 dark:border-gray-700"
                        : "border-green-300 dark:border-green-700",
                    )}
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                  />
                ) : (
                  <input
                    id={field.id}
                    type={field.type === "date" ? "date" : "text"}
                    value={val}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={cn(
                      "w-full rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors",
                      empty
                        ? "border-gray-200 dark:border-gray-700"
                        : "border-green-300 dark:border-green-700",
                    )}
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                  />
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !allFilled}
            className={cn(
              "mt-1 w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-sm px-4 py-2.5 transition-colors",
              allFilled && !loading
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed",
            )}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating draft…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {allFilled
                  ? "Fix & Re-generate Draft"
                  : `Fill all ${fields.length - filledCount} remaining fields`}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
