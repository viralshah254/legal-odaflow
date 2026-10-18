"use client"

import { Suspense, useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Loader2, Paperclip, X, CheckCircle2, AlertCircle, Info, PanelLeft } from "lucide-react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Button } from "@/components/ui/button"
import { generateIndiaDraft, extractDraftContext, extractCaseRecord, confirmCaseRecord, extractIndiaDraftFormFields } from "@/lib/api/india-drafting"
import type { SectionResult, ConfidenceReport, VerificationReport, CitationAppendixEntry, IndiaDraftAccuracyGate, PinnedSection, PinnedCaseLaw, FinalDraftResolutionStatus, DraftRepairConfirmationQuestion } from "@/lib/api/india-drafting"
import { CaseRecordConfirmPanel, type CaseRecordConfirmPayload } from "@/components/india-drafting/CaseRecordConfirmPanel"
import { useDraftJob } from "@/lib/hooks/use-draft-job"
import { getDraftById } from "@/lib/api/draft-history"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { DRAFT_CREDIT_COSTS } from "@/lib/credits/draft-credit-costs"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { IndiaDraftOutputPanel } from "@/components/india-drafting/IndiaDraftOutputPanel"
import { SavedDraftsButton } from "@/components/drafting/saved-drafts-button"
import {
  ProceduralDeterminationCard,
  type ProceduralDetermination,
  type ResearchPhaseInfo,
} from "@/components/drafting/procedural-determination-card"
import { cn } from "@/lib/utils"
import { initDraftFillState } from "@/lib/drafting/draft-text-formatter"
import { prefillBlanksFromContext, type PrefillBlankContext } from "@/lib/drafting/prefill-blanks-from-context"

import { resolveFieldConfig, type DraftFieldConfig } from "@/lib/india-drafting/form-config"
import { INDIA_DRAFT_FORMATS } from "@/lib/india-drafting/formats"
import { BilingualLanguagePicker } from "@/components/language/bilingual-language-picker"
import {
  KnowledgeSourcePicker,
  DEFAULT_KNOWLEDGE_SOURCES,
  parseKnowledgeSourcesParam,
  serializeKnowledgeSourcesParam,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import { FilingSetStepper } from "@/components/india-drafting/FilingSetStepper"
import {
  resolveDraftBackHref,
  draftBackLabel,
  getDraftSet,
  buildDraftSetNavUrl,
  updateDraftSetItem,
  setDraftSetCurrentIndex,
  syncDraftSetIndexForKind,
  getDraftSetPartyContext,
  saveDraftSetPartyContext,
  getDraftSetCaseDetails,
  saveDraftSetCaseDetails,
  getDraftSetCaseRecord,
  saveDraftSetCaseRecord,
  bundleStatusFromResolution,
  type DraftSetState,
  type DraftSetNavContext,
} from "@/lib/drafting/draft-navigation"
import { buildFormSampleDraft } from "@/lib/drafting/form-sample"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { CreditErrorBanner } from "@/components/credits/CreditErrorBanner"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import {
  extractDraftFieldHints,
  resolveDraftFieldHintContext,
  isPlausibleCourtName,
  type DraftFieldHints,
  type ExtractedParties,
} from "@/lib/india-drafting/extract-field-hints"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DraftMissingFieldsForm } from "@/components/india-drafting/DraftMissingFieldsForm"

function isExpressDraftKind(kind: string): boolean {
  return /legal_notice|demand_letter|reply_to_notice|cease_and_desist|notice_reply/i.test(kind)
}

/** Returns true when the error string is a procedural-gate "blocked" response
 *  listing missing required inputs — these should be shown as a structured form
 *  rather than a plain red error banner. */
function isBlockedMissingInputError(err: string): boolean {
  return (
    err.includes("Required input missing") ||
    err.includes("petitioner / applicant identified") ||
    err.includes("Additional information is required to continue")
  )
}

function caseRecordPrefillContext(
  record: Record<string, unknown> | null | undefined,
): PrefillBlankContext["caseRecord"] | undefined {
  if (!record) return undefined
  const chronology = Array.isArray(record.chronology)
    ? (record.chronology as Array<{ label?: string; date?: string }>)
        .filter((e) => e.label || e.date)
        .map((e) => ({ label: e.label ?? "", date: e.date }))
    : undefined
  const moneyRecords = Array.isArray(record.moneyRecords)
    ? (record.moneyRecords as Array<{ kind?: string; amountLabel?: string; description?: string }>)
        .filter((m) => m.amountLabel || m.description)
        .map((m) => ({
          kind: m.kind ?? "other",
          amountLabel: m.amountLabel ?? "",
          description: m.description,
        }))
    : undefined
  const parties = Array.isArray(record.parties)
    ? (record.parties as Array<{ role?: string; name?: string }>)
        .filter((p) => p.name)
        .map((p) => ({ role: p.role ?? "", name: p.name ?? "" }))
    : undefined
  if (!chronology?.length && !moneyRecords?.length && !parties?.length) return undefined
  return { chronology, moneyRecords, parties }
}

/** Client abort — must stay below nginx proxy_read_timeout for /api/v1/ai/ (600s). */
const DRAFT_GENERATE_TIMEOUT_MS = {
  express: 120_000,
  filingGrade: 600_000,
} as const

function DraftEditor() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations("drafting")
  const { activeTenantId } = useTenant()

  const kind = searchParams.get("kind") ?? ""
  const label = searchParams.get("label") ?? kind
  const subtitle = searchParams.get("subtitle") ?? ""
  const category = searchParams.get("category") ?? undefined
  const formNumber = searchParams.get("formNumber") ?? undefined
  const formTitle = searchParams.get("formTitle") ?? undefined
  const authority = searchParams.get("authority") ?? undefined
  const jurisdiction = searchParams.get("jurisdiction") ?? undefined
  const practiceArea = searchParams.get("practiceArea") ?? undefined
  const documentKindParam = searchParams.get("documentKind") ?? undefined
  const detailsParam = searchParams.get("details") ?? ""
  const clientNameParam = searchParams.get("clientName") ?? ""
  const courtNameParam = searchParams.get("courtName") ?? ""
  const opposingPartyParam = searchParams.get("opposingParty") ?? ""
  const draftIdParam = searchParams.get("draftId") ?? ""
  const knowledgeSourcesParam = searchParams.get("knowledgeSources")
  const autoGenerate = searchParams.get("autoGenerate") === "1"
  const languageParam = searchParams.get("language") ?? ""

  const effectiveKind = kind || "india_criminal_revision"
  const hintContext = useMemo(
    () => resolveDraftFieldHintContext(effectiveKind, category),
    [effectiveKind, category],
  )

  const backHref = resolveDraftBackHref(searchParams, "/app/india-drafting")
  const backLabel = draftBackLabel(backHref)

  const sampleDraft = useMemo(
    () =>
      buildFormSampleDraft({
        label,
        kind,
        formNumber,
        countryCode: "IN",
        authority,
        practiceArea,
        documentKind: documentKindParam,
      }),
    [label, kind, formNumber, authority, practiceArea, documentKindParam],
  )

  const [caseDetails, setCaseDetails] = useState(() => {
    if (typeof window === "undefined") return detailsParam
    const stored = getDraftSetCaseDetails()
    if (stored && stored.length > detailsParam.length) return stored
    return detailsParam || stored
  })

  // Sync party/court from session + regex on first paint (before effects / autoGenerate).
  const initialPrefill = useMemo(() => {
    const stored =
      typeof window !== "undefined" ? getDraftSetCaseDetails() : ""
    const sessionParties =
      typeof window !== "undefined" ? getDraftSetPartyContext() : null
    const seed =
      [stored, detailsParam, caseDetails]
        .map((s) => (s ?? "").trim())
        .sort((a, b) => b.length - a.length)[0] || ""
    const hints = seed
      ? extractDraftFieldHints(seed, hintContext)
      : {}
    const client =
      clientNameParam.trim() ||
      sessionParties?.clientName?.trim() ||
      hints.clientName ||
      ""
    const opposing =
      opposingPartyParam.trim() ||
      sessionParties?.opposingParty?.trim() ||
      hints.opposingParty ||
      ""
    const rawCourt =
      (courtNameParam.trim() && isPlausibleCourtName(courtNameParam)
        ? courtNameParam.trim()
        : "") ||
      (sessionParties?.courtName?.trim() &&
      isPlausibleCourtName(sessionParties.courtName)
        ? sessionParties.courtName.trim()
        : "") ||
      (hints.courtName && isPlausibleCourtName(hints.courtName) ? hints.courtName : "")
    const parties =
      hints.parties ??
      (sessionParties?.parties
        ? {
            plaintiffs: sessionParties.parties.plaintiffs.map((p) => ({
              name: p.name,
              role: (p.role === "petitioner" ? "petitioner" : "plaintiff") as
                | "plaintiff"
                | "petitioner",
            })),
            defendants: sessionParties.parties.defendants.map((p) => ({
              name: p.name,
              role: (p.role === "respondent" ? "respondent" : "defendant") as
                | "defendant"
                | "respondent",
            })),
          }
        : opposing
          ? {
              plaintiffs: client
                ? [{ name: client, role: "petitioner" as const }]
                : [],
              defendants: opposing
                .split(/\s*;\s*/)
                .filter(Boolean)
                .map((name) => ({ name, role: "respondent" as const })),
            }
          : null)
    return { client, opposing, court: rawCourt, parties, seed }
    // Only for initial mount values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [clientName, setClientName] = useState(initialPrefill.client)
  const [courtName, setCourtName] = useState(initialPrefill.court)
  const [opposingParty, setOpposingParty] = useState(initialPrefill.opposing)
  const [extractedParties, setExtractedParties] = useState<ExtractedParties | null>(
    initialPrefill.parties,
  )
  const [language, setLanguage] = useState(languageParam || "en")

  const [draft, setDraft] = useState("")
  const [blanks, setBlanks] = useState<string[]>([])
  const [verification, setVerification] = useState<DraftVerificationAudit | null>(null)
  const [accuracyGate, setAccuracyGate] = useState<IndiaDraftAccuracyGate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const topupStatus = searchParams.get("status")
  const [showTopupSuccess, setShowTopupSuccess] = useState(topupStatus === "success")
  const [savedDraftId, setSavedDraftId] = useState<string | undefined>()
  const [modelUsed, setModelUsed] = useState<string | undefined>()
  const [proceduralDetermination, setProceduralDetermination] =
    useState<ProceduralDetermination | null>(null)
  const [researchPhase, setResearchPhase] = useState<ResearchPhaseInfo | null>(null)
  const [resolvedItems, setResolvedItems] = useState<string[]>([])
  const [counselChecklist, setCounselChecklist] = useState<string | undefined>()
  const [v2Sections, setV2Sections] = useState<SectionResult[] | undefined>()
  const [v2ConfidenceReport, setV2ConfidenceReport] = useState<ConfidenceReport | undefined>()
  const [v2VerificationReport, setV2VerificationReport] = useState<VerificationReport | undefined>()
  const [v2CitationAppendix, setV2CitationAppendix] = useState<CitationAppendixEntry[] | undefined>()
  const [engineVersion, setEngineVersion] = useState<"v1" | "v2" | "v3" | undefined>()
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null)
  const [completedJobId, setCompletedJobId] = useState<string | undefined>()
  const [caseRecordPayload, setCaseRecordPayload] = useState<CaseRecordConfirmPayload | null>(null)
  const [confirmedCaseRecord, setConfirmedCaseRecord] = useState<Record<string, unknown> | null>(null)
  const [repairCaseRecord, setRepairCaseRecord] = useState<Record<string, unknown> | null>(null)
  const [finalResolutionStatus, setFinalResolutionStatus] = useState<FinalDraftResolutionStatus | null>(null)
  const [confirmationQuestions, setConfirmationQuestions] = useState<DraftRepairConfirmationQuestion[]>([])
  const [unresolvedFindingCodes, setUnresolvedFindingCodes] = useState<string[]>([])
  const [confirmingCaseRecord, setConfirmingCaseRecord] = useState(false)
  const [mobileTab, setMobileTab] = useState<"form" | "draft">("form")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentContext, setAttachmentContext] = useState<string | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string>("")
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [draftSet, setDraftSetState] = useState<DraftSetState | null>(null)
  const [inputsSheetOpen, setInputsSheetOpen] = useState(false)
  const [detectedHints, setDetectedHints] = useState<DraftFieldHints>({})
  const prefillReadyRef = useRef(false)
  const generateAbortRef = useRef<AbortController | null>(null)
  /**
   * Quality mode — AUTO (default) routes to cheapest accurate model per section.
   * PREMIUM forces higher-accuracy models (Opus for grounds/arguments); costs more credits.
   */
  const [draftModelMode, setDraftModelMode] = useState<"AUTO" | "PREMIUM">("AUTO")
  const [pinnedSections, setPinnedSections] = useState<PinnedSection[]>([])
  const [pinnedCaseLaws, setPinnedCaseLaws] = useState<PinnedCaseLaw[]>([])
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)

  // ── Unified engine (v3) async job tracking ─────────────────────────────────
  const {
    progress: draftJobProgress,
    result: draftJobResult,
    error: draftJobError,
    cancel: cancelDraftJob,
  } = useDraftJob(asyncJobId, activeTenantId ?? undefined)

  const draftSetNavContext = useMemo(
    (): DraftSetNavContext => ({
      // Prefer session for the full narrative; keep URL stub short.
      details: caseDetails.trim().slice(0, 800),
      clientName,
      courtName: courtName && isPlausibleCourtName(courtName) ? courtName : "",
      opposingParty,
      knowledgeSources: serializeKnowledgeSourcesParam(knowledgeSources),
    }),
    [caseDetails, clientName, courtName, opposingParty, knowledgeSources],
  )

  useEffect(() => {
    if (knowledgeSourcesParam) {
      setKnowledgeSources(parseKnowledgeSourcesParam(knowledgeSourcesParam))
    }
  }, [knowledgeSourcesParam])

  const refreshDraftSet = () => {
    setDraftSetState(getDraftSet())
  }

  useEffect(() => {
    refreshDraftSet()
    const synced = syncDraftSetIndexForKind(kind)
    if (synced) setDraftSetState(synced)
  }, [kind, label])

  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort()
    }
  }, [])

  // When the unified engine job completes, map result into existing state setters.
  useEffect(() => {
    if (!draftJobResult) return
    const { draft: normalizedDraft, blanks: initialBlanks } = initDraftFillState(draftJobResult.draft)
    const prefilled = prefillBlanksFromContext(normalizedDraft, initialBlanks, {
      caseDetails,
      clientName,
      courtName,
      opposingParty,
      hintContext,
      caseRecord: caseRecordPrefillContext(repairCaseRecord ?? getDraftSetCaseRecord()),
    })
    setDraft(normalizedDraft)
    setVerification(draftJobResult.verification ?? null)
    setAccuracyGate(draftJobResult.accuracyGate ?? null)
    setFinalResolutionStatus(draftJobResult.finalResolutionStatus ?? null)
    setConfirmationQuestions(draftJobResult.confirmationQuestions ?? [])
    setUnresolvedFindingCodes(draftJobResult.unresolvedFindingCodes ?? [])
    setSavedDraftId(draftJobResult.draftId)
    setCompletedJobId(draftJobResult.jobId)
    setV2VerificationReport(draftJobResult.verificationReport)
    setV2CitationAppendix(draftJobResult.citationAppendix)
    setEngineVersion(draftJobResult.engineVersion)
    setBlanks(prefilled)
    setMobileTab("draft")
    setLoading(false)
    setAsyncJobId(null)
    invalidateCreditWalletQueries(queryClient, activeTenantId)

    const debitWarning = draftJobProgress?.failureReason
    if (debitWarning?.startsWith("credit_debit_failed")) {
      setError(
        "Draft generated, but credits could not be debited. Your balance may be out of date — refresh or top up if needed.",
      )
    }

    // Mark the current filing-set item from accuracy resolution (not blindly Ready).
    const set = getDraftSet()
    if (set && draftJobResult.draftId) {
      const resolution = draftJobResult.finalResolutionStatus
      const updated = updateDraftSetItem(set.currentIndex, {
        status: bundleStatusFromResolution(resolution),
        draftId: draftJobResult.draftId,
        resolutionStatus: resolution ?? undefined,
      })
      if (updated) setDraftSetState(updated)
    }
    // Prefill uses current form fields at completion time — omit from deps to avoid re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJobResult, draftJobProgress?.failureReason, queryClient, activeTenantId])

  // Surface errors from the async job.
  useEffect(() => {
    if (!draftJobError) return
    setError(draftJobError)
    setLoading(false)
    setAsyncJobId(null)
  }, [draftJobError])

  const syncJoinedFromParties = (parties: ExtractedParties) => {
    setExtractedParties(parties)
    setClientName(parties.plaintiffs.map((p) => p.name).filter(Boolean).join("; "))
    setOpposingParty(parties.defendants.map((p) => p.name).filter(Boolean).join("; "))
  }

  type EnsuredFormFields = {
    clientName: string
    opposingParty: string
    courtName: string
    parties: ExtractedParties | null
  }

  /** Prefill party / court: URL → session → regex → AI if still incomplete. Overwrites bad courts. */
  const ensureFormFieldsFromDetails = async (text: string): Promise<EnsuredFormFields> => {
    const storedDetails = getDraftSetCaseDetails()
    const sourceText =
      [text, storedDetails, caseDetails, detailsParam, attachmentContext]
        .map((s) => (s ?? "").trim())
        .sort((a, b) => b.length - a.length)[0] || ""
    const combined = [sourceText, attachmentContext].filter(Boolean).join("\n\n")
    if (sourceText && sourceText.length > (detailsParam?.length ?? 0)) {
      setCaseDetails((prev) => (prev.trim().length >= sourceText.length ? prev : sourceText))
      saveDraftSetCaseDetails(sourceText)
    }

    const sessionCtx = getDraftSetPartyContext()

    let nextClient = clientName.trim() || clientNameParam.trim() || sessionCtx?.clientName?.trim() || ""
    let nextOpposing =
      opposingParty.trim() || opposingPartyParam.trim() || sessionCtx?.opposingParty?.trim() || ""
    let nextCourt =
      (courtName.trim() && isPlausibleCourtName(courtName)
        ? courtName.trim()
        : "") ||
      (courtNameParam.trim() && isPlausibleCourtName(courtNameParam)
        ? courtNameParam.trim()
        : "") ||
      (sessionCtx?.courtName?.trim() && isPlausibleCourtName(sessionCtx.courtName)
        ? sessionCtx.courtName.trim()
        : "")
    let nextParties: ExtractedParties | null =
      extractedParties ??
      (sessionCtx?.parties
        ? {
            plaintiffs: sessionCtx.parties.plaintiffs.map((p) => ({
              name: p.name,
              role: (p.role === "petitioner" ? "petitioner" : "plaintiff") as "plaintiff" | "petitioner",
            })),
            defendants: sessionCtx.parties.defendants.map((p) => ({
              name: p.name,
              role: (p.role === "respondent" ? "respondent" : "defendant") as
                | "defendant"
                | "respondent",
            })),
          }
        : null)

    const hints = extractDraftFieldHints(combined, hintContext)
    setDetectedHints(hints)
    if (hints.clientName) nextClient = nextClient || hints.clientName
    if (hints.opposingParty) nextOpposing = nextOpposing || hints.opposingParty
    if (hints.courtName && isPlausibleCourtName(hints.courtName)) {
      nextCourt = nextCourt || hints.courtName
    }
    if (hints.parties) nextParties = nextParties ?? hints.parties

    const stillIncomplete = !nextClient || !nextOpposing || !nextCourt
    if (stillIncomplete && combined.trim().length >= 10) {
      try {
        const ai = await extractIndiaDraftFormFields(
          {
            caseDetails: combined.slice(0, 12000),
            kind: effectiveKind,
            category,
          },
          activeTenantId ?? undefined,
        )
        if (!nextClient && ai.clientName?.trim()) nextClient = ai.clientName.trim()
        if (!nextOpposing && ai.opposingParty?.trim()) nextOpposing = ai.opposingParty.trim()
        if (
          !nextCourt &&
          ai.courtName?.trim() &&
          isPlausibleCourtName(ai.courtName)
        ) {
          nextCourt = ai.courtName.trim()
        }
        if (!nextParties && ai.parties) nextParties = ai.parties
      } catch {
        // Keep regex/session results; generate can still proceed.
      }
    }

    if (nextClient) setClientName((prev) => prev.trim() || nextClient)
    if (nextOpposing) setOpposingParty((prev) => prev.trim() || nextOpposing)
    setCourtName((prev) => {
      if (prev.trim() && isPlausibleCourtName(prev)) return prev
      return nextCourt || ""
    })
    if (nextParties) setExtractedParties(nextParties)

    if (nextClient || nextOpposing || nextCourt || nextParties) {
      saveDraftSetPartyContext({
        clientName: nextClient || undefined,
        opposingParty: nextOpposing || undefined,
        courtName: nextCourt || undefined,
        parties: nextParties ?? undefined,
      })
    }

    return {
      clientName: nextClient,
      opposingParty: nextOpposing,
      courtName: nextCourt,
      parties: nextParties,
    }
  }

  /** Sync regex-only autofill (debounced edits). */
  const autoFillFromDetails = (text: string) => {
    void ensureFormFieldsFromDetails(text)
  }

  const navigateToSetIndex = (index: number, options?: { autoGenerate?: boolean }) => {
    const set = getDraftSet()
    if (!set || index < 0 || index >= set.items.length || loading) return
    const item = set.items[index]
    if (caseDetails.trim()) saveDraftSetCaseDetails(caseDetails)
    if (confirmedCaseRecord) saveDraftSetCaseRecord(confirmedCaseRecord)
    else if (repairCaseRecord) saveDraftSetCaseRecord(repairCaseRecord)
    saveDraftSetPartyContext({
      clientName: clientName || undefined,
      opposingParty: opposingParty || undefined,
      courtName:
        courtName && isPlausibleCourtName(courtName) ? courtName : undefined,
      parties: extractedParties ?? undefined,
    })
    setDraftSetCurrentIndex(index)
    refreshDraftSet()
    const href = buildDraftSetNavUrl(item, {
      ...draftSetNavContext,
      autoGenerate: options?.autoGenerate,
    })
    router.push(href)
  }

  // Reset draft output when navigating to another document in a filing set.
  const prevKindRef = useRef<string | null>(null)
  useEffect(() => {
    if (!kind || !prevKindRef.current || prevKindRef.current === kind || draftIdParam) {
      prevKindRef.current = kind
      return
    }
    prevKindRef.current = kind
    setDraft("")
    setBlanks([])
    setVerification(null)
    setAccuracyGate(null)
    setFinalResolutionStatus(null)
    setConfirmationQuestions([])
    // Keep CaseRecord across filing-set steps; only clear when leaving the set.
    const inFilingSet = Boolean(getDraftSet())
    if (!inFilingSet) {
      setRepairCaseRecord(null)
      setConfirmedCaseRecord(null)
    } else {
      const stored = getDraftSetCaseRecord()
      if (stored) {
        setConfirmedCaseRecord(stored)
        setRepairCaseRecord(stored)
      }
    }
    setProceduralDetermination(null)
    setResearchPhase(null)
    setResolvedItems([])
    setError(null)
    setSavedDraftId(undefined)
    setCompletedJobId(undefined)
    setModelUsed(undefined)
    setCounselChecklist(undefined)
    setV2Sections(undefined)
    setV2ConfidenceReport(undefined)
    setV2VerificationReport(undefined)
    setV2CitationAppendix(undefined)
    setEngineVersion(undefined)
    setCompletedJobId(undefined)
    setMobileTab("form")
  }, [kind, label, draftIdParam])

  // Immediate autofill when arriving with details (URL and/or session); await before autoGenerate.
  useEffect(() => {
    const storedDetails = getDraftSetCaseDetails()
    const storedCaseRecord = getDraftSetCaseRecord()
    if (storedCaseRecord) {
      setConfirmedCaseRecord(storedCaseRecord)
      setRepairCaseRecord(storedCaseRecord)
    }
    const seed =
      [detailsParam, storedDetails, caseDetails]
        .map((s) => (s ?? "").trim())
        .sort((a, b) => b.length - a.length)[0] || ""

    if (!seed && !clientNameParam && !opposingPartyParam) {
      // Clear stale bad court from a prior session even when there is no narrative yet.
      if (courtName && !isPlausibleCourtName(courtName)) setCourtName("")
      prefillReadyRef.current = true
      return
    }

    let cancelled = false
    void (async () => {
      if (storedDetails && storedDetails.length > detailsParam.length) {
        setCaseDetails(storedDetails)
      }
      // Sync regex first so fields fill before any network round-trip.
      const syncHints = extractDraftFieldHints(seed || storedDetails, hintContext)
      if (syncHints.clientName) setClientName((prev) => prev.trim() || syncHints.clientName!)
      if (syncHints.opposingParty) {
        setOpposingParty((prev) => prev.trim() || syncHints.opposingParty!)
      }
      if (syncHints.courtName && isPlausibleCourtName(syncHints.courtName)) {
        setCourtName((prev) =>
          prev.trim() && isPlausibleCourtName(prev) ? prev : syncHints.courtName!,
        )
      } else {
        setCourtName((prev) => (prev.trim() && isPlausibleCourtName(prev) ? prev : ""))
      }
      if (syncHints.parties) setExtractedParties(syncHints.parties)
      setDetectedHints(syncHints)

      const ensured = await ensureFormFieldsFromDetails(seed)
      if (cancelled) return
      prefillReadyRef.current = true
      if (autoGenerate && seed.length >= 10 && activeTenantId && kind) {
        const set = getDraftSet()
        if (set) {
          const idx = set.items.findIndex((item) => item.kind === kind)
          if (idx >= 0) {
            const updated = updateDraftSetItem(idx, { status: "generating" })
            if (updated) setDraftSetState(updated)
          }
        }
        void handleGenerate(seed, undefined, ensured)
      }
    })()
    return () => {
      cancelled = true
    }
    // Run once on mount (and when tenant becomes available for autoGenerate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId])

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachmentFile(file)
    setAttachmentContext(null)
    setAttachmentPreview("")
    setAttachmentError(null)
    setAttachmentLoading(true)
    try {
      const result = await extractDraftContext(file, activeTenantId ?? undefined)
      setAttachmentContext(result.extractedText)
      setAttachmentPreview(result.extractedText.slice(0, 200))
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : "Could not extract text from this file.")
      setAttachmentFile(null)
    } finally {
      setAttachmentLoading(false)
    }
  }

  const clearAttachment = () => {
    setAttachmentFile(null)
    setAttachmentContext(null)
    setAttachmentPreview("")
    setAttachmentError(null)
  }

  const { gate: creditsGate, handleApiError, openGate } = useInsufficientCreditsGate({
    feature: "drafting",
    tenantId: activeTenantId ?? undefined,
    countryCode: "IN",
    requiredCredits: DRAFT_CREDIT_COSTS.FULL_DRAFT,
  })

  useEffect(() => {
    // india_custom is a valid free-form kind — don't redirect
    if (!kind && !draftIdParam) {
      router.replace(backHref)
    }
  }, [kind, draftIdParam, backHref, router])

  // Auto-fill party / court fields as case details or attachments change.
  useEffect(() => {
    if (!caseDetails.trim() && !attachmentContext?.trim()) return
    if (!prefillReadyRef.current) return
    const timer = setTimeout(
      () => autoFillFromDetails(caseDetails || attachmentContext || ""),
      350,
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseDetails, attachmentContext, hintContext])

  useEffect(() => {
    if (!draftIdParam || !activeTenantId) return
    void getDraftById(draftIdParam, activeTenantId).then((record) => {
      const { draft: normalizedDraft, blanks: initialBlanks } = initDraftFillState(record.draftText)
      const nextCaseDetails = record.caseDetails ?? ""
      const nextClientName = record.clientName ?? ""
      const nextCourtName = record.courtName ?? ""
      const nextOpposingParty = record.opposingParty ?? ""
      const prefilled = prefillBlanksFromContext(normalizedDraft, initialBlanks, {
        caseDetails: nextCaseDetails,
        clientName: nextClientName,
        courtName: nextCourtName,
        opposingParty: nextOpposingParty,
        hintContext: resolveDraftFieldHintContext(record.kind, record.category),
      })
      setDraft(normalizedDraft)
      setCaseDetails(nextCaseDetails)
      setClientName(nextClientName)
      setCourtName(nextCourtName)
      setOpposingParty(nextOpposingParty)
      setLanguage(record.language ?? "en")
      setVerification(record.verificationAudit ?? null)
      setAccuracyGate(null)
      setFinalResolutionStatus(null)
      setConfirmationQuestions([])
      setRepairCaseRecord(null)
      setSavedDraftId(record.id)
      setBlanks(prefilled)
      if (!kind) {
        const params = new URLSearchParams()
        params.set("kind", record.kind)
        params.set("label", record.label ?? record.kind)
        params.set("draftId", record.id)
        if (record.category) params.set("category", record.category)
        router.replace(`/app/india-drafting/draft?${params.toString()}`)
      }
    }).catch(() => {
      setError("Could not load saved draft.")
    })
  }, [draftIdParam, activeTenantId, kind, router])

  if (!kind && !draftIdParam) {
    return null
  }

  const isCustomDraft = effectiveKind === "india_custom"
  // For custom drafts use the generic config (all fields shown, general placeholders)
  const fieldConfig: DraftFieldConfig = isCustomDraft
    ? resolveFieldConfig("india_civil_plaint", undefined, undefined)
    : resolveFieldConfig(effectiveKind, category, documentKindParam)

  const handleGenerate = async (
    detailsOverride?: string,
    confirmedRecordOverride?: Record<string, unknown> | null,
    fieldOverrides?: Partial<EnsuredFormFields>,
  ) => {
    const effectiveDetails = detailsOverride ?? caseDetails
    if (effectiveDetails.trim().length < 10) {
      setError("Please provide at least 10 characters of case details.")
      return
    }

    // Apply party/court hints synchronously — auto-generate may run before debounced autofill.
    const hintSource = [effectiveDetails.trim(), attachmentContext?.trim()]
      .filter(Boolean)
      .join("\n\n")
    const hints = extractDraftFieldHints(hintSource, hintContext)
    const effectiveClientName =
      fieldOverrides?.clientName?.trim() ||
      clientName.trim() ||
      hints.clientName ||
      ""
    const effectiveOpposingParty =
      fieldOverrides?.opposingParty?.trim() ||
      opposingParty.trim() ||
      hints.opposingParty ||
      ""
    const rawCourt =
      fieldOverrides?.courtName?.trim() ||
      courtName.trim() ||
      hints.courtName ||
      ""
    const effectiveCourtName =
      rawCourt && isPlausibleCourtName(rawCourt) ? rawCourt : ""
    const partiesForGenerate =
      fieldOverrides?.parties ?? hints.parties ?? extractedParties ?? undefined
    if (hints.parties) setExtractedParties(hints.parties)
    if (effectiveClientName && !clientName.trim()) setClientName(effectiveClientName)
    if (effectiveOpposingParty && !opposingParty.trim()) setOpposingParty(effectiveOpposingParty)
    if (effectiveCourtName && !(courtName.trim() && isPlausibleCourtName(courtName))) {
      setCourtName(effectiveCourtName)
    }
    setDetectedHints(hints)

    const lockedCaseRecord =
      confirmedRecordOverride !== undefined
        ? confirmedRecordOverride
        : confirmedCaseRecord ?? getDraftSetCaseRecord()

    // Filing-grade / Wave-1 kinds: extract + confirm Case Record before generate
    const needsCaseRecordConfirm =
      /bail|legal_notice|service_agreement|consumer_complaint|consumer_medical|civil_suit|plaint|writ|anticipatory|criminal_complaint|arbitration|maintenance|employment|research_memo|case_strategy|legal_research/i.test(
        effectiveKind,
      ) && !lockedCaseRecord
    if (needsCaseRecordConfirm) {
      setError(null)
      setLoading(true)
      try {
        const extracted = await extractCaseRecord(
          {
            kind: effectiveKind,
            caseDetails: effectiveDetails.trim(),
            clientName: effectiveClientName || undefined,
            courtName: fieldConfig.showCourtName ? effectiveCourtName || undefined : undefined,
            opposingParty: fieldConfig.showOpposingParty
              ? effectiveOpposingParty || undefined
              : undefined,
            jurisdiction,
            attachmentContext: attachmentContext ?? undefined,
          },
          activeTenantId ?? undefined,
        )
        setCaseRecordPayload(extracted)
        setLoading(false)
        return
      } catch (err) {
        setLoading(false)
        setError(err instanceof Error ? err.message : "Failed to extract Case Record")
        return
      }
    }

    setError(null)
    setLoading(true)
    setDraft("")
    setBlanks([])
    setVerification(null)
    setAccuracyGate(null)
    setFinalResolutionStatus(null)
    setConfirmationQuestions([])
    setRepairCaseRecord(null)
    setV2Sections(undefined)
    setV2ConfidenceReport(undefined)
    setV2VerificationReport(undefined)
    setV2CitationAppendix(undefined)
    setEngineVersion(undefined)
    // Cancel any in-flight async job from the previous generation.
    cancelDraftJob()
    setAsyncJobId(null)

    generateAbortRef.current?.abort()
    const abortController = new AbortController()
    generateAbortRef.current = abortController

    const generateTimeoutMs = isExpressDraftKind(effectiveKind)
      ? DRAFT_GENERATE_TIMEOUT_MS.express
      : DRAFT_GENERATE_TIMEOUT_MS.filingGrade

    const timeoutId = setTimeout(() => {
      if (!abortController.signal.aborted) {
        abortController.abort()
        setError(
          isExpressDraftKind(effectiveKind)
            ? "Draft generation timed out — the server is taking too long. Please try again in a moment."
            : "Draft generation timed out — complex court drafts can take several minutes. Please try again; if this persists, contact support.",
        )
        setLoading(false)
        generateAbortRef.current = null
      }
    }, generateTimeoutMs)

    const set = getDraftSet()
    const bundleMode = Boolean(set && set.items.length > 1)
    const bundleIndex = set?.currentIndex ?? 0
    if (set && bundleIndex >= 0 && bundleIndex < set.items.length) {
      const updated = updateDraftSetItem(bundleIndex, { status: "generating" })
      if (updated) setDraftSetState(updated)
    }

    let startedAsyncJob = false

    try {
      const res = await generateIndiaDraft(
        {
          kind: effectiveKind,
          caseDetails: effectiveDetails.trim(),
          clientName: effectiveClientName || undefined,
          courtName: fieldConfig.showCourtName ? effectiveCourtName || undefined : undefined,
          opposingParty: fieldConfig.showOpposingParty ? effectiveOpposingParty || undefined : undefined,
          language,
          formNumber,
          formTitle,
          authority,
          jurisdiction,
          practiceArea,
          category,
          attachmentContext: attachmentContext ?? undefined,
          bundleMode: bundleMode || undefined,
          bundleIndex: bundleMode ? bundleIndex : undefined,
          modelMode: draftModelMode,
          pinnedSections: pinnedSections.length > 0 ? pinnedSections : undefined,
          pinnedCaseLaws: pinnedCaseLaws.length > 0 ? pinnedCaseLaws : undefined,
          confirmedCaseRecord: lockedCaseRecord ?? undefined,
          parties: partiesForGenerate,
          knowledgeSources,
        },
        activeTenantId ?? undefined,
        abortController.signal,
      )

      // Clear confirmed record after a successful kickoff so next regen re-confirms if needed
      // Keep a copy for post-draft repair confirmation answers.
      if (lockedCaseRecord) {
        setRepairCaseRecord(lockedCaseRecord)
        saveDraftSetCaseRecord(lockedCaseRecord)
      }
      // Keep confirmed CaseRecord in memory across filing-set steps.
      if (!getDraftSet()) {
        setConfirmedCaseRecord(null)
      }
      setCaseRecordPayload(null)

      if (abortController.signal.aborted) return

      // ── Unified engine (v3): response is an immediate job receipt ──────────
      if (res.migratedToAsyncEngine && res.jobId) {
        startedAsyncJob = true
        setEngineVersion("v3")
        setAsyncJobId(res.jobId)
        // Keep loading=true — useDraftJob hook clears it when the job finishes.
        generateAbortRef.current = null
        return
      }

      // ── Legacy synchronous path (v1 / v2) ─────────────────────────────────
      const { draft: normalizedDraft, blanks: initialBlanks } = initDraftFillState(res.draft)
      const prefilled = prefillBlanksFromContext(normalizedDraft, initialBlanks, {
        caseDetails: effectiveDetails,
        clientName: effectiveClientName,
        courtName: effectiveCourtName,
        opposingParty: effectiveOpposingParty,
        hintContext,
        caseRecord: caseRecordPrefillContext(
          (confirmedCaseRecord as Record<string, unknown> | null) ?? getDraftSetCaseRecord(),
        ),
      })
      setDraft(normalizedDraft)
      setVerification(res.verification ?? null)
      setAccuracyGate(res.accuracyGate ?? null)
      setFinalResolutionStatus(res.finalResolutionStatus ?? null)
      setConfirmationQuestions(res.confirmationQuestions ?? [])
      setUnresolvedFindingCodes(res.unresolvedFindingCodes ?? [])
      setProceduralDetermination(res.proceduralDetermination ?? null)
      setResearchPhase(res.researchPhase ?? null)
      setResolvedItems(res.resolvedItems ?? [])
      setCounselChecklist(res.counselChecklist)
      setSavedDraftId(res.draftId)
      setModelUsed(res.modelUsed)
      setBlanks(prefilled)
      // v2 engine outputs
      setV2Sections(res.sections)
      setV2ConfidenceReport(res.confidenceReport)
      setV2VerificationReport(res.verificationReport)
      setV2CitationAppendix(res.citationAppendix)
      setEngineVersion(res.engineVersion)
      setMobileTab("draft")
      invalidateCreditWalletQueries(queryClient, activeTenantId)

      if (set && res.draftId) {
        const resolution = res.finalResolutionStatus
        const updated = updateDraftSetItem(bundleIndex, {
          status: bundleStatusFromResolution(resolution),
          draftId: res.draftId,
          resolutionStatus: resolution ?? undefined,
        })
        if (updated) setDraftSetState(updated)
      }

      if (res.proceduralDetermination?.kindOverridden) {
        const recommended = res.proceduralDetermination.recommendedKind
        const fmt = INDIA_DRAFT_FORMATS.find((f) => f.id === recommended)
        const params = new URLSearchParams(searchParams.toString())
        params.set("kind", recommended)
        if (fmt?.label) params.set("label", fmt.label)
        if (fmt?.subtitle) params.set("subtitle", fmt.subtitle)
        if (fmt?.category) params.set("category", fmt.category)
        router.replace(`/app/india-drafting/draft?${params.toString()}`)
      }
    } catch (e) {
      if (abortController.signal.aborted) return
      const isCredErr = isInsufficientCreditsError(e)
      handleApiError(e, e instanceof Error ? e.message : t("errors.generateFailed"))
      setIsCreditError(isCredErr)
      if (!isCredErr) {
        setError(e instanceof Error ? e.message : t("errors.generateFailed"))
      }
      if (set) {
        const updated = updateDraftSetItem(bundleIndex, { status: "error" })
        if (updated) setDraftSetState(updated)
      }
    } finally {
      clearTimeout(timeoutId)
      if (generateAbortRef.current === abortController) {
        generateAbortRef.current = null
        if (!startedAsyncJob) {
          setLoading(false)
        }
      }
    }
  }

  const handleReset = () => {
    setDraft("")
    setBlanks([])
    setVerification(null)
    setAccuracyGate(null)
    setFinalResolutionStatus(null)
    setConfirmationQuestions([])
    setRepairCaseRecord(null)
    setCompletedJobId(undefined)
    setError(null)
  }

  const focusMode = Boolean(draft)
  const caseDetailsRows = focusMode ? 6 : 10

  const renderInputForm = (compact = false) => (
    <div className={cn("space-y-3", compact && "pt-1")}>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 leading-snug break-words">
          {fieldConfig.caseDetailsLabel} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={caseDetails}
          onChange={e => setCaseDetails(e.target.value)}
          rows={caseDetailsRows}
          placeholder={fieldConfig.caseDetailsPlaceholder}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
        />
        <p className="text-xs text-gray-400 mt-1">{caseDetails.length} characters</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Knowledge sources
        </p>
        <KnowledgeSourcePicker
          selected={knowledgeSources}
          onChange={setKnowledgeSources}
          countryCode="IN"
        />
      </div>

      <div className={cn("grid gap-3", fieldConfig.showCourtName ? "sm:grid-cols-2" : "grid-cols-1")}>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 leading-snug break-words">
            {fieldConfig.clientNameLabel}
          </label>
          {(extractedParties?.plaintiffs?.length
            ? extractedParties.plaintiffs
            : clientName.trim()
              ? clientName.split(/\s*;\s*/).filter(Boolean).map((name) => ({ name, role: "plaintiff" as const }))
              : [{ name: "", role: "plaintiff" as const }]
          ).map((p, idx, arr) => (
            <div key={`plaintiff-${idx}`} className="flex items-center gap-1.5">
              <input
                type="text"
                value={p.name}
                onChange={(e) => {
                  const names = arr.map((row, i) => (i === idx ? e.target.value : row.name))
                  const plaintiffs = names
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ name, role: "plaintiff" as const }))
                  const defendants = extractedParties?.defendants ?? []
                  if (plaintiffs.length === 0 && !e.target.value.trim()) {
                    setClientName("")
                    setExtractedParties(
                      defendants.length ? { plaintiffs: [{ name: "", role: "plaintiff" }], defendants } : null,
                    )
                    return
                  }
                  syncJoinedFromParties({
                    plaintiffs: plaintiffs.length ? plaintiffs : [{ name: e.target.value, role: "plaintiff" }],
                    defendants,
                  })
                }}
                placeholder={fieldConfig.clientNamePlaceholder}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {arr.length > 1 && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted-foreground hover:text-red-600 px-1"
                  onClick={() => {
                    const plaintiffs = arr
                      .filter((_, i) => i !== idx)
                      .map((row) => ({ name: row.name, role: "plaintiff" as const }))
                    syncJoinedFromParties({
                      plaintiffs,
                      defendants: extractedParties?.defendants ?? [],
                    })
                  }}
                  aria-label="Remove plaintiff"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={() => {
              const plaintiffs = [
                ...(extractedParties?.plaintiffs?.length
                  ? extractedParties.plaintiffs
                  : clientName
                      .split(/\s*;\s*/)
                      .filter(Boolean)
                      .map((name) => ({ name, role: "plaintiff" as const }))),
                { name: "", role: "plaintiff" as const },
              ]
              syncJoinedFromParties({
                plaintiffs,
                defendants: extractedParties?.defendants ?? [],
              })
            }}
          >
            + Add plaintiff
          </button>
        </div>
        {fieldConfig.showCourtName && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 leading-snug break-words">
              {fieldConfig.courtNameLabel}
            </label>
            <input
              type="text"
              value={courtName}
              onChange={e => setCourtName(e.target.value)}
              placeholder={fieldConfig.courtNamePlaceholder}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {fieldConfig.showOpposingParty && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 leading-snug break-words">
            {fieldConfig.opposingPartyLabel}
          </label>
          {(extractedParties?.defendants?.length
            ? extractedParties.defendants
            : opposingParty.trim()
              ? opposingParty.split(/\s*;\s*/).filter(Boolean).map((name) => ({ name, role: "defendant" as const }))
              : [{ name: "", role: "defendant" as const }]
          ).map((p, idx, arr) => (
            <div key={`defendant-${idx}`} className="flex items-center gap-1.5">
              {arr.length > 1 && (
                <span className="shrink-0 text-[10px] text-muted-foreground w-5 text-right">
                  {idx + 1}.
                </span>
              )}
              <input
                type="text"
                value={p.name}
                onChange={(e) => {
                  const names = arr.map((row, i) => (i === idx ? e.target.value : row.name))
                  const defendants = names
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ name, role: "defendant" as const }))
                  const plaintiffs = extractedParties?.plaintiffs ??
                    (clientName.trim()
                      ? clientName.split(/\s*;\s*/).filter(Boolean).map((name) => ({
                          name,
                          role: "plaintiff" as const,
                        }))
                      : [])
                  syncJoinedFromParties({
                    plaintiffs,
                    defendants: defendants.length
                      ? defendants
                      : [{ name: e.target.value, role: "defendant" }],
                  })
                }}
                placeholder={
                  arr.length > 1
                    ? `Opposite party No. ${idx + 1}`
                    : fieldConfig.opposingPartyPlaceholder
                }
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {arr.length > 1 && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted-foreground hover:text-red-600 px-1"
                  onClick={() => {
                    const defendants = arr
                      .filter((_, i) => i !== idx)
                      .map((row) => ({ name: row.name, role: "defendant" as const }))
                    syncJoinedFromParties({
                      plaintiffs: extractedParties?.plaintiffs ?? [],
                      defendants,
                    })
                  }}
                  aria-label="Remove opposite party"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={() => {
              const defendants = [
                ...(extractedParties?.defendants?.length
                  ? extractedParties.defendants
                  : opposingParty
                      .split(/\s*;\s*/)
                      .filter(Boolean)
                      .map((name) => ({ name, role: "defendant" as const }))),
                { name: "", role: "defendant" as const },
              ]
              syncJoinedFromParties({
                plaintiffs: extractedParties?.plaintiffs ??
                  (clientName.trim()
                    ? clientName.split(/\s*;\s*/).filter(Boolean).map((name) => ({
                        name,
                        role: "plaintiff" as const,
                      }))
                    : []),
                defendants,
              })
            }}
          >
            + Add opposite party
          </button>
        </div>
      )}

      <BilingualLanguagePicker value={language} onChange={setLanguage} label="Output language" />

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 leading-snug break-words">
          Attach document for context{" "}
          <span className="font-normal text-gray-400">(optional — PDF, DOCX, image, TXT · max 20 MB)</span>
        </label>
        {!attachmentFile ? (
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 transition-colors">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span>Choose file or drag &amp; drop</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={handleAttachmentChange}
            />
          </label>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {attachmentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500 shrink-0" />
                ) : attachmentContext ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className="truncate text-gray-700 dark:text-gray-300 font-medium">{attachmentFile.name}</span>
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {attachmentLoading && <p className="text-xs text-indigo-500 mt-1">Extracting text…</p>}
            {attachmentError && <p className="text-xs text-red-500 mt-1">{attachmentError}</p>}
            {attachmentPreview && !attachmentLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{attachmentPreview}…</p>
            )}
          </div>
        )}
      </div>

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
        ) : isBlockedMissingInputError(error) ? (
          <DraftMissingFieldsForm
            blockedReason={error}
            documentKind={effectiveKind}
            caseDetails={caseDetails}
            loading={loading}
            onRegenerate={(updatedDetails) => {
              setCaseDetails(updatedDetails)
              handleGenerate(updatedDetails)
            }}
          />
        ) : (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )
      )}

      {caseRecordPayload && (
        <CaseRecordConfirmPanel
          payload={caseRecordPayload}
          confirming={confirmingCaseRecord}
          onCancel={() => setCaseRecordPayload(null)}
          onConfirm={async (resolutions) => {
            setConfirmingCaseRecord(true)
            setError(null)
            try {
              const { caseRecord } = await confirmCaseRecord(
                {
                  caseRecord: caseRecordPayload.caseRecord as unknown as Record<string, unknown>,
                  resolutions,
                },
                activeTenantId ?? undefined,
              )
              setConfirmedCaseRecord(caseRecord)
              setRepairCaseRecord(caseRecord)
              saveDraftSetCaseRecord(caseRecord)
              setCaseRecordPayload(null)
              setConfirmingCaseRecord(false)
              // Sync Case Record parties into form fields
              const crParties = (caseRecord as { parties?: Array<{ role: string; name: string }> })
                .parties
              if (Array.isArray(crParties) && crParties.length > 0) {
                const plaintiffs = crParties
                  .filter((p) => /plaintiff|petitioner|applicant|client/i.test(p.role))
                  .map((p) => ({
                    name: p.name,
                    role: /petitioner/i.test(p.role)
                      ? ("petitioner" as const)
                      : ("plaintiff" as const),
                  }))
                const defendants = crParties
                  .filter((p) => /defendant|respondent|accused|opposing/i.test(p.role))
                  .map((p) => ({
                    name: p.name,
                    role: /respondent/i.test(p.role)
                      ? ("respondent" as const)
                      : ("defendant" as const),
                  }))
                if (plaintiffs.length || defendants.length) {
                  syncJoinedFromParties({ plaintiffs, defendants })
                }
              }
              // Proceed to generate with confirmed record (pass directly — state update is async)
              void handleGenerate(undefined, caseRecord)
            } catch (err) {
              setConfirmingCaseRecord(false)
              setError(err instanceof Error ? err.message : "Failed to confirm Case Record")
            }
          }}
        />
      )}

      {/* Quality toggle — Standard vs Higher accuracy */}
      <div className="hidden xl:flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Accuracy mode</span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {draftModelMode === "AUTO" ? "Standard" : "Higher accuracy"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDraftModelMode((m) => (m === "AUTO" ? "PREMIUM" : "AUTO"))}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1",
            draftModelMode === "PREMIUM"
              ? "bg-indigo-600"
              : "bg-gray-200 dark:bg-gray-600",
          )}
          role="switch"
          aria-checked={draftModelMode === "PREMIUM"}
          aria-label="Higher accuracy mode"
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
              draftModelMode === "PREMIUM" ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
      </div>

      <button
        onClick={() => void handleGenerate()}
        disabled={loading || caseDetails.trim().length < 10}
        className="hidden xl:inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2.5 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating draft…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Draft
          </>
        )}
      </button>
    </div>
  )

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      {/* Back nav + saved drafts */}
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

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-950 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
            India
          </span>
          {subtitle && (
            <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-950 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
              {subtitle}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug break-words">{label}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          Provide the facts below and click Generate. The AI will produce a court-ready draft referencing current BNS/BNSS/BSA 2023 — review before filing.
        </p>
        {kind === "india_maintenance_order_revision" && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mt-3 dark:bg-amber-950/20 dark:border-amber-800">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
              This will be drafted as a <strong>Criminal Revision Petition (BNSS §438)</strong>. Interim maintenance orders under BNSS §144 are challenged by way of revision — not by a memorandum of appeal.
            </p>
          </div>
        )}
      </div>

      {draftSet && draftSet.items.length > 1 && (
        <FilingSetStepper
          draftSet={draftSet}
          loading={loading}
          currentDraftReady={Boolean(draft || draftIdParam)}
          onNavigateToIndex={(index) => navigateToSetIndex(index)}
          onPrevious={() => navigateToSetIndex(draftSet.currentIndex - 1)}
          onNext={() =>
            navigateToSetIndex(draftSet.currentIndex + 1, { autoGenerate: true })
          }
        />
      )}

      {/* ── Mobile / tablet tab bar (hidden on xl desktop) ── */}
      <div
        className="xl:hidden sticky top-0 z-20 -mx-4 px-4 pt-1 pb-2 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 mb-4 flex gap-1"
        role="tablist"
        aria-label="Drafting workspace"
      >
        <button
          type="button"
          onClick={() => setMobileTab("form")}
          role="tab"
          id="drafting-form-tab"
          aria-selected={mobileTab === "form"}
          aria-controls="drafting-form-panel"
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
            mobileTab === "form"
              ? "bg-indigo-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
          )}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("draft")}
          role="tab"
          id="drafting-draft-tab"
          aria-selected={mobileTab === "draft"}
          aria-controls="drafting-draft-panel"
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
            mobileTab === "draft"
              ? "bg-indigo-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
          )}
        >
          Draft{draft ? " ✓" : ""}
        </button>
      </div>

      {focusMode && (
        <div className="hidden xl:flex justify-end mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setInputsSheetOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
            Edit inputs
          </Button>
        </div>
      )}

      <div
        className={cn(
          "grid gap-5",
          focusMode ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(340px,400px)_1fr]",
        )}
      >
        <div
          id="drafting-form-panel"
          role="tabpanel"
          aria-labelledby="drafting-form-tab"
          className={cn(
            "min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto",
            mobileTab !== "form" && "hidden xl:block",
            focusMode && "hidden xl:hidden",
          )}
        >
          {renderInputForm()}
          <div className="xl:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pt-3 pb-4 pb-safe-bottom bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => void handleGenerate()}
              disabled={loading || caseDetails.trim().length < 10}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base px-4 py-3.5 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating draft…
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Draft · {DRAFT_CREDIT_COSTS.FULL_DRAFT} cr
                </>
              )}
            </button>
          </div>
        </div>

        <div
          id="drafting-draft-panel"
          role="tabpanel"
          aria-labelledby="drafting-draft-tab"
          className={cn(
            "space-y-2 min-w-0 pb-24 xl:pb-0 flex flex-col flex-1",
            mobileTab !== "draft" && "hidden xl:flex",
          )}
        >
          <ProceduralDeterminationCard
            procedural={proceduralDetermination}
            research={researchPhase}
            resolvedItems={resolvedItems}
            currentKind={effectiveKind}
            currentLabel={label}
          />
          <IndiaDraftOutputPanel
            draft={draft}
            blanks={blanks}
            onBlanksChange={setBlanks}
            onReset={handleReset}
            kind={effectiveKind}
            label={label}
            caseDetails={caseDetails}
            clientName={clientName}
            tenantId={activeTenantId ?? undefined}
            loading={loading}
            progressVariant={isExpressDraftKind(effectiveKind) ? "express" : "filingGrade"}
            serverPercent={draftJobProgress?.percent}
            serverStage={draftJobProgress?.stage}
            sampleDraft={sampleDraft}
            verification={verification}
            onVerificationChange={setVerification}
            accuracyGate={accuracyGate}
            onAccuracyGateChange={setAccuracyGate}
            finalResolutionStatus={finalResolutionStatus}
            confirmationQuestions={confirmationQuestions}
            unresolvedFindingCodes={unresolvedFindingCodes}
            confirmedCaseRecord={repairCaseRecord}
            onDraftChange={setDraft}
            onRepairStateChange={(state) => {
              setFinalResolutionStatus(state.finalResolutionStatus)
              setConfirmationQuestions(state.confirmationQuestions)
              if (state.caseRecord) setRepairCaseRecord(state.caseRecord)
              if (state.unresolvedFindingCodes) {
                setUnresolvedFindingCodes(state.unresolvedFindingCodes)
              }
              const set = getDraftSet()
              if (set) {
                const updated = updateDraftSetItem(set.currentIndex, {
                  status: bundleStatusFromResolution(state.finalResolutionStatus),
                  resolutionStatus: state.finalResolutionStatus,
                })
                if (updated) setDraftSetState(updated)
              }
            }}
            jurisdiction={jurisdiction}
            savedDraftId={savedDraftId}
            jobId={asyncJobId ?? completedJobId}
            modelUsed={modelUsed}
            pinnedSections={pinnedSections}
            pinnedCaseLaws={pinnedCaseLaws}
            onPinnedChange={(next) => {
              setPinnedSections(next.pinnedSections)
              setPinnedCaseLaws(next.pinnedCaseLaws)
            }}
            onRedraftWithPins={() => {
              setInputsSheetOpen(false)
              void handleGenerate()
            }}
            redrafting={loading}
            counselChecklist={counselChecklist}
            sections={v2Sections}
            confidenceReport={v2ConfidenceReport}
            verificationReport={v2VerificationReport}
            citationAppendix={v2CitationAppendix}
            engineVersion={engineVersion ?? (asyncJobId ? "v3" : undefined)}
          />
        </div>
      </div>

      <Sheet open={inputsSheetOpen} onOpenChange={setInputsSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit inputs</SheetTitle>
          </SheetHeader>
          <div className="mt-4 pb-6">{renderInputForm(true)}</div>
          <button
            onClick={() => {
              void handleGenerate()
              setInputsSheetOpen(false)
            }}
            disabled={loading || caseDetails.trim().length < 10}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Regenerate draft
          </button>
        </SheetContent>
      </Sheet>

      {creditsGate}

      {/* Disclaimer */}
      <div className="mt-8 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
        <strong>Disclaimer:</strong> This AI-generated draft is a starting point only and does not constitute legal advice. All blanks must be completed with verified facts. The draft must be reviewed, amended, and certified by a qualified advocate enrolled with the Bar Council of India before being filed in any court.
      </div>
    </div>
  )
}

export default function IndiaDraftPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    }>
      <DraftEditor />
    </Suspense>
  )
}
