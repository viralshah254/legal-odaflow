"use client"

import { Suspense, useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Loader2, Copy, Check, RotateCcw, CheckCircle2, X, Pencil } from "lucide-react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useTenant } from "@/lib/contexts/tenant-context"
import { generateUsDraft, fillUsDraftBlanks } from "@/lib/api/us-drafting"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { DraftAccuracyPanel } from "@/components/drafting/accuracy/DraftAccuracyPanel"
import { DraftAuthorityInsights } from "@/components/drafting/draft-authority-insights"
import { DraftActionsToolbar } from "@/components/drafting/draft-actions-toolbar"
import {
  KnowledgeSourcePicker,
  DEFAULT_KNOWLEDGE_SOURCES,
  parseKnowledgeSourcesParam,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import { DraftGenerationProgress } from "@/components/drafting/accuracy/DraftGenerationProgress"
import { DRAFT_CREDIT_COSTS } from "@/lib/credits/draft-credit-costs"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { PdfExportButton, WordExportButton } from "@/components/export/pdf-export-button"
import { SmartDraftRenderer } from "@/components/india-drafting/SmartDraftRenderer"
import { US_STATE_OPTIONS } from "@/lib/us-drafting/formats"
import { cn } from "@/lib/utils"
import {
  DraftMobileTabBar,
  type DraftMobileTab,
} from "@/components/shared/draft-mobile-tab-bar"
import { MobileBottomBar } from "@/components/shared/mobile-bottom-bar"
import {
  resolveDraftBackHref,
  draftBackLabel,
} from "@/lib/drafting/draft-navigation"
import { buildFormSampleDraft } from "@/lib/drafting/form-sample"
import { SavedDraftsButton } from "@/components/drafting/saved-drafts-button"
import { DraftSamplePreview } from "@/components/drafting/draft-sample-preview"
import { getDraftFieldSchema } from "@/lib/drafting/draft-field-schemas"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { CreditErrorBanner } from "@/components/credits/CreditErrorBanner"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"

type ViewMode = "fill" | "edit"

function resolveDraftText(draft: string, blanks: string[]): string {
  let i = 0
  return draft.replace(/\[([^\]]+)\]/g, () => blanks[i++]?.trim() || "[BLANK]")
}

function UsBlankQuickFillPanel({
  draft,
  blanks,
  onBlanksChange,
  caseDetails,
  kind,
  stateCode,
  tenantId,
}: {
  draft: string
  blanks: string[]
  onBlanksChange: (blanks: string[]) => void
  caseDetails: string
  kind: string
  stateCode?: string
  tenantId?: string
}) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labels = draft.match(/\[([^\]]+)\]/g)?.map(m => m.slice(1, -1)) ?? []
  const emptyLabels = labels.filter((label, i) => !(blanks[i]?.trim()))

  const handleAutoFill = async () => {
    if (emptyLabels.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const context: Record<string, string> = { caseDetails }
      labels.forEach((label, i) => {
        const value = blanks[i]?.trim()
        if (value) context[label] = value
      })
      const res = await fillUsDraftBlanks(
        { documentKind: kind, context, emptyFields: emptyLabels, stateCode },
        tenantId,
      )
      const next = [...blanks]
      labels.forEach((label, i) => {
        if (!next[i]?.trim() && res.suggestions[label]) next[i] = res.suggestions[label]
      })
      onBlanksChange(next)
      if (res.creditsUsed > 0) {
        invalidateCreditWalletQueries(queryClient, tenantId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-fill failed")
    } finally {
      setLoading(false)
    }
  }

  if (labels.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {emptyLabels.length} empty field{emptyLabels.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={handleAutoFill}
          disabled={loading || emptyLabels.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Auto-fill
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function DraftEditor() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations("drafting")
  const { activeTenantId } = useTenant()

  const kind = searchParams.get("kind") ?? ""
  const label = searchParams.get("label") ?? kind
  const subtitle = searchParams.get("subtitle") ?? ""
  const requiresState = searchParams.get("requiresState") === "true"
  const initialState = searchParams.get("stateCode") ?? searchParams.get("boundState") ?? ""
  const formNumber = searchParams.get("formNumber") ?? undefined
  const documentKindParam = searchParams.get("documentKind") ?? undefined
  const detailsParam = searchParams.get("details") ?? ""
  const formCountry = searchParams.get("formCountry") ?? searchParams.get("jurisdiction") ?? "US"
  const authority = searchParams.get("authority") ?? undefined
  const practiceArea = searchParams.get("practiceArea") ?? undefined
  const knowledgeSourcesParam = searchParams.get("knowledgeSources")

  const backHref = resolveDraftBackHref(searchParams, "/app/us-drafting")
  const backLabel = draftBackLabel(backHref)

  const sampleDraft = useMemo(
    () =>
      buildFormSampleDraft({
        label,
        kind,
        formNumber,
        countryCode: formCountry,
        authority,
        practiceArea,
        documentKind: documentKindParam,
      }),
    [label, kind, formNumber, formCountry, authority, practiceArea, documentKindParam],
  )

  const fieldSchema = useMemo(
    () => getDraftFieldSchema(documentKindParam),
    [documentKindParam],
  )

  const [caseDetails, setCaseDetails] = useState(detailsParam)
  const [clientName, setClientName] = useState("")
  const [courtName, setCourtName] = useState("")
  const [opposingParty, setOpposingParty] = useState("")
  const [stateCode, setStateCode] = useState(initialState)

  const [draft, setDraft] = useState("")
  const [blanks, setBlanks] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("fill")
  const [editedText, setEditedText] = useState<string | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [verification, setVerification] = useState<DraftVerificationAudit | null>(null)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (knowledgeSourcesParam) {
      setKnowledgeSources(parseKnowledgeSourcesParam(knowledgeSourcesParam))
    }
  }, [knowledgeSourcesParam])

  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const topupStatus = searchParams.get("status")
  const [showTopupSuccess, setShowTopupSuccess] = useState(topupStatus === "success")
  const [copied, setCopied] = useState(false)
  const [mobileTab, setMobileTab] = useState<DraftMobileTab>("form")

  const { gate: creditsGate, handleApiError, openGate } = useInsufficientCreditsGate({
    feature: "drafting",
    tenantId: activeTenantId ?? undefined,
    countryCode: formCountry.length <= 3 ? formCountry : "US",
    requiredCredits: DRAFT_CREDIT_COSTS.FULL_DRAFT,
  })

  useEffect(() => {
    if (!kind) {
      router.replace(backHref)
    }
  }, [kind, backHref, router])

  const resolvedFromBlanks = useMemo(
    () => resolveDraftText(draft, blanks),
    [draft, blanks],
  )
  const displayText = editedText ?? resolvedFromBlanks

  useEffect(() => {
    setEditedText(null)
    setViewMode("fill")
  }, [draft])

  useEffect(() => {
    if (viewMode === "edit" && editTextareaRef.current) {
      const el = editTextareaRef.current
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [viewMode, editedText])

  if (!kind) {
    return null
  }

  const getResolvedDraft = () => displayText

  const handleGenerate = async () => {
    if (caseDetails.trim().length < 10) {
      setError("Please provide at least 10 characters of case details.")
      return
    }
    if (requiresState && !stateCode) {
      setError("Please select a state for this document.")
      return
    }
    setError(null)
    setLoading(true)
    setDraft("")
    setBlanks([])
    setEditedText(null)
    setViewMode("fill")
    setVerification(null)
    try {
      const res = await generateUsDraft(
        {
          kind,
          caseDetails: caseDetails.trim(),
          clientName: clientName.trim() || undefined,
          courtName: fieldSchema.showCourtName ? courtName.trim() || undefined : undefined,
          opposingParty: fieldSchema.showOpposingParty ? opposingParty.trim() || undefined : undefined,
          stateCode: stateCode || undefined,
          formNumber,
          formTitle: label !== kind ? label : undefined,
          knowledgeSources,
        },
        activeTenantId ?? undefined,
      )
      setDraft(res.draft)
      setVerification(res.verification ?? null)
      setBlanks(new Array((res.draft.match(/\[([^\]]+)\]/g) ?? []).length).fill(""))
      invalidateCreditWalletQueries(queryClient, activeTenantId)
      setMobileTab("draft")
    } catch (e) {
      const isCredErr = isInsufficientCreditsError(e)
      handleApiError(e, e instanceof Error ? e.message : t("errors.generateFailed"))
      setIsCreditError(isCredErr)
      if (!isCredErr) {
        setError(e instanceof Error ? e.message : t("errors.generateFailed"))
      }
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
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <Suspense fallback={null}>
          <SavedDraftsButton />
        </Suspense>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            {formCountry.length <= 3 ? formCountry : formCountry.slice(0, 3).toUpperCase()}
          </span>
          {subtitle && (
            <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-950 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
              {subtitle}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{label}</h1>
      </div>

      <DraftMobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        draftReady={Boolean(draft)}
      />

      <div className="grid xl:grid-cols-2 gap-6 pb-24 xl:pb-0">
        <div className={cn("space-y-4", mobileTab !== "form" && "hidden xl:block")}>
          {requiresState && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={stateCode}
                onChange={e => setStateCode(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select state…</option>
                {US_STATE_OPTIONS.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {fieldSchema.caseDetailsLabel} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={caseDetails}
              onChange={e => setCaseDetails(e.target.value)}
              rows={8}
              placeholder={fieldSchema.caseDetailsPlaceholder}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Knowledge sources
            </p>
            <KnowledgeSourcePicker
              selected={knowledgeSources}
              onChange={setKnowledgeSources}
              countryCode="US"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{fieldSchema.clientNameLabel}</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder={fieldSchema.clientNamePlaceholder} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {fieldSchema.showCourtName && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{fieldSchema.courtNameLabel ?? "Court name"}</label>
                <input type="text" value={courtName} onChange={e => setCourtName(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          {fieldSchema.showOpposingParty && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{fieldSchema.opposingPartyLabel ?? "Opposing party"}</label>
              <input type="text" value={opposingParty} onChange={e => setOpposingParty(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {showTopupSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Credits added! Click <strong>Generate Draft</strong> to continue.
              </span>
              <button
                type="button"
                onClick={() => setShowTopupSuccess(false)}
                className="ml-auto shrink-0 opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            isCreditError ? (
              <CreditErrorBanner message={error} onGetCredits={openGate} />
            ) : (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || caseDetails.trim().length < 10}
            className="hidden xl:inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate Draft</>}
          </button>
          <p className="hidden xl:block text-xs text-gray-400 dark:text-gray-500">
            {t("generateCreditCost", { credits: DRAFT_CREDIT_COSTS.FULL_DRAFT })}
          </p>
        </div>

        <div className={cn("flex flex-col", mobileTab !== "draft" && "hidden xl:flex")}>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Generated Draft</h2>
              {draft && (
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("fill")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      viewMode === "fill"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700",
                    )}
                  >
                    Fill blanks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedText((prev) => prev ?? resolvedFromBlanks)
                      setViewMode("edit")
                    }}
                    className={cn(
                      "px-2.5 py-1 inline-flex items-center gap-1 transition-colors border-l border-gray-200 dark:border-gray-700",
                      viewMode === "edit"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit text
                  </button>
                </div>
              )}
            </div>
            {draft && (
              <div className="flex items-center gap-2">
                <button onClick={() => { setDraft(""); setBlanks([]); setEditedText(null); setViewMode("fill"); setVerification(null) }} className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <button onClick={handleCopy} className="inline-flex items-center gap-1 text-xs text-gray-500">
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <PdfExportButton
                  title={label}
                  content={getResolvedDraft()}
                  meta={{
                    countryCode: "US",
                    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                    disclaimer: "AI-assisted draft for informational purposes only. Review with a licensed attorney before filing.",
                  }}
                  variant="button"
                  label="Export PDF"
                />
                <WordExportButton
                  title={label}
                  content={getResolvedDraft()}
                  meta={{
                    countryCode: "US",
                    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                    disclaimer: "AI-assisted draft for informational purposes only. Review with a licensed attorney before filing.",
                  }}
                  variant="button"
                  label="Export Word"
                />
              </div>
            )}
          </div>

          <div className={cn("flex-1 min-h-[420px] rounded-xl border bg-white dark:bg-gray-900 overflow-y-auto", draft ? "border-gray-200 dark:border-gray-700" : "border-dashed border-gray-200 dark:border-gray-700")}>
            {loading ? (
              <DraftGenerationProgress active={loading} accentClassName="text-blue-500" />
            ) : draft ? (
              viewMode === "edit" ? (
                <div className="relative p-6">
                  <textarea
                    ref={editTextareaRef}
                    value={editedText ?? resolvedFromBlanks}
                    onChange={(e) => {
                      setEditedText(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    className="w-full resize-none font-serif text-sm leading-relaxed text-gray-800 dark:text-gray-200 bg-transparent border-0 outline-none min-h-[420px]"
                    spellCheck
                  />
                  <span className="absolute bottom-2 right-4 text-[10px] text-muted-foreground pointer-events-none">
                    {displayText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              ) : (
                <SmartDraftRenderer draft={draft} blanks={blanks} onBlanksChange={setBlanks} />
              )
            ) : (
              <DraftSamplePreview sample={sampleDraft} />
            )}
          </div>

          {draft && viewMode === "fill" && (
            <UsBlankQuickFillPanel
              draft={draft}
              blanks={blanks}
              onBlanksChange={setBlanks}
              caseDetails={caseDetails}
              kind={kind}
              stateCode={stateCode || undefined}
              tenantId={activeTenantId ?? undefined}
            />
          )}

          {draft && viewMode === "edit" && (
            <p className="text-xs text-muted-foreground px-1">
              Edit the full document directly. Copy and export use this text.
            </p>
          )}

          {draft && (
            <DraftActionsToolbar
              draftText={displayText}
              documentKind={kind}
              rawFacts={caseDetails}
              tenantId={activeTenantId}
              countryCode="US"
              stateCode={stateCode || undefined}
              onEnriched={({ enrichedDraft }) => {
                setDraft(enrichedDraft)
                setEditedText(enrichedDraft)
              }}
              disabled={loading}
            />
          )}

          {draft && (
            <DraftAuthorityInsights
              verification={verification}
              caseLawSelected={knowledgeSources.includes("case_law")}
              hasDraft
            />
          )}

          <DraftAccuracyPanel
            verification={verification}
            hideSimilarCases
            hideVerificationCard
          />
        </div>
      </div>

      <MobileBottomBar>
        {mobileTab === "form" ? (
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading || caseDetails.trim().length < 10}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-3 min-h-[44px]"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate Draft</>}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("form")}
              className="flex-1 rounded-lg border border-border px-3 py-3 min-h-[44px] text-sm font-medium"
            >
              Edit form
            </button>
            {draft && (
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="flex-1 rounded-lg bg-blue-600 text-white px-3 py-3 min-h-[44px] text-sm font-medium"
              >
                {copied ? "Copied!" : "Copy draft"}
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t("generateCreditCost", { credits: DRAFT_CREDIT_COSTS.FULL_DRAFT })}
        </p>
      </MobileBottomBar>

      {creditsGate}
    </div>
  )
}

export default function UsDraftPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>}>
      <DraftEditor />
    </Suspense>
  )
}
