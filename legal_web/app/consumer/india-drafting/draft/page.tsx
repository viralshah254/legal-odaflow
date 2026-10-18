"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Loader2, Copy, Check, RotateCcw, AlertCircle } from "lucide-react"
import Link from "next/link"
import { generateIndiaDraft } from "@/lib/api/india-drafting"
import { PdfExportButton } from "@/components/export/pdf-export-button"
import { SmartDraftRenderer } from "@/components/india-drafting/SmartDraftRenderer"
import { BlankQuickFillPanel } from "@/components/india-drafting/BlankQuickFillPanel"
import { DraftMissingFieldsForm } from "@/components/india-drafting/DraftMissingFieldsForm"
import { cn } from "@/lib/utils"

function isBlockedMissingInputError(err: string): boolean {
  return (
    err.includes("Required input missing") ||
    err.includes("petitioner / applicant identified") ||
    err.includes("Additional information is required to continue")
  )
}

type Language = "en" | "hi" | "hinglish"

function ConsumerDraftEditor() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const kind = searchParams.get("kind") ?? ""
  const label = searchParams.get("label") ?? kind
  const subtitle = searchParams.get("subtitle") ?? ""

  const [caseDetails, setCaseDetails] = useState("")
  const [clientName, setClientName] = useState("")
  const [courtName, setCourtName] = useState("")
  const [opposingParty, setOpposingParty] = useState("")
  const [language, setLanguage] = useState<Language>("en")

  const [draft, setDraft] = useState("")
  const [blanks, setBlanks] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!kind) {
    router.replace("/consumer/india-drafting")
    return null
  }

  /** Returns draft text with all filled-in blank values substituted. */
  const getResolvedDraft = () => {
    let i = 0
    return draft.replace(/\[BLANK\]/g, () => blanks[i++]?.trim() || "[BLANK]")
  }

  const handleGenerate = async (detailsOverride?: string) => {
    const effectiveDetails = detailsOverride ?? caseDetails
    if (effectiveDetails.trim().length < 10) {
      setError("Please provide at least 10 characters of case details.")
      return
    }
    setError(null)
    setLoading(true)
    setDraft("")
    setBlanks([])
    try {
      const res = await generateIndiaDraft({
        kind,
        caseDetails: effectiveDetails.trim(),
        clientName: clientName.trim() || undefined,
        courtName: courtName.trim() || undefined,
        opposingParty: opposingParty.trim() || undefined,
        language,
      })
      setDraft(res.draft)
      setBlanks(new Array((res.draft.match(/\[BLANK\]/g) ?? []).length).fill(""))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft generation failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getResolvedDraft())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Consumer header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/consumer/india-drafting"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-950 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
              India
            </span>
            {subtitle && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Disclaimer banner */}
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3 mb-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-0.5">For information only</p>
            <p className="text-xs">
              This draft is a starting point — not legal advice. You must take this to a qualified advocate who will review, adapt, and file it on your behalf.
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{label}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Describe your situation in plain language. The AI will produce a draft document referencing Indian law.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Input form ── */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Your situation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={caseDetails}
                onChange={e => setCaseDetails(e.target.value)}
                rows={8}
                placeholder="Describe what happened: when, where, who was involved, any relevant dates or amounts, what outcome you want…"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Your name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Other party / Opponent
                </label>
                <input
                  type="text"
                  value={opposingParty}
                  onChange={e => setOpposingParty(e.target.value)}
                  placeholder="Person or company name"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Court / Commission name (optional)
              </label>
              <input
                type="text"
                value={courtName}
                onChange={e => setCourtName(e.target.value)}
                placeholder="e.g. District Consumer Commission, Bengaluru"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Language
              </label>
              <div className="flex gap-2">
                {(["en", "hi", "hinglish"] as Language[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      language === lang
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
                    )}
                  >
                    {lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : "Hinglish"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              isBlockedMissingInputError(error) ? (
                <DraftMissingFieldsForm
                  blockedReason={error}
                  documentKind={kind}
                  caseDetails={caseDetails}
                  loading={loading}
                  onRegenerate={(updatedDetails) => {
                    setCaseDetails(updatedDetails)
                    void handleGenerate(updatedDetails)
                  }}
                />
              ) : (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )
            )}

            <button
              onClick={() => void handleGenerate()}
              disabled={loading || caseDetails.trim().length < 10}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-3 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Draft
                </>
              )}
            </button>
          </div>

          {/* ── Draft output ── */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your Draft</h2>
              {draft && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setDraft(""); setBlanks([]); setError(null) }}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <PdfExportButton
                    title={label}
                    content={getResolvedDraft()}
                    meta={{
                      countryCode: "IN",
                      date: new Date().toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }),
                      disclaimer:
                        "This draft is for information only and is not legal advice. Have it reviewed by a qualified advocate before use.",
                    }}
                    variant="button"
                    label="Export PDF"
                  />
                </div>
              )}
            </div>

            {/* Draft panel */}
            <div
              className={cn(
                "flex-1 min-h-[360px] rounded-xl border bg-white dark:bg-gray-900 overflow-y-auto",
                draft
                  ? "border-gray-200 dark:border-gray-700"
                  : "border-dashed border-gray-200 dark:border-gray-700",
              )}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-sm text-center">Generating your draft…</p>
                </div>
              ) : draft ? (
                <SmartDraftRenderer
                  draft={draft}
                  blanks={blanks}
                  onBlanksChange={setBlanks}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 p-6 text-center">
                  <p className="text-sm">Your draft will appear here.</p>
                  <p className="text-xs">Describe your situation and click Generate.</p>
                </div>
              )}
            </div>

            {/* Quick-fill panel */}
            {draft && (
              <BlankQuickFillPanel
                draft={draft}
                blanks={blanks}
                onBlanksChange={setBlanks}
                caseDetails={caseDetails}
                kind={kind}
              />
            )}
          </div>
        </div>

        {draft && (
          <div className="mt-6 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <strong>Next step:</strong> Fill in any remaining blanks above, then take this draft to a qualified advocate. They will review the facts and file it properly on your behalf. Do not file this document yourself without legal help.
          </div>
        )}
      </div>
    </div>
  )
}

export default function ConsumerIndiaDraftPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    }>
      <ConsumerDraftEditor />
    </Suspense>
  )
}
