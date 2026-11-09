"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Loader2,
  ListTree,
  Maximize2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Scale,
  Sparkles,
  UserPlus,
  Wand2,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { approveHumanReview, exportIndiaDraft, getHumanReviewStatus, editIndiaDraft, enrichDraftWithAuthorities, fixIndiaDraftVerification, regenerateSection, reverifyIndiaDraft, applyIndiaDraftRepairConfirmations, type EditInstruction, type CaseLawArea, type CitationAppendixEntry, type AuthorityEnrichGateResult, type IndiaDraftAccuracyGate, type SectionResult, type ConfidenceReport, type VerificationReport, type PinnedSection, type PinnedCaseLaw, type FinalDraftResolutionStatus, type DraftRepairConfirmationQuestion, type DraftEnrichMode, type LinkedDraftDocket } from "@/lib/api/india-drafting"
import { getDraftById } from "@/lib/api/draft-history"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { PdfExportButton, WordExportButton } from "@/components/export/pdf-export-button"
import { SmartDraftRenderer } from "@/components/india-drafting/SmartDraftRenderer"
import { BlankQuickFillPanel } from "@/components/india-drafting/BlankQuickFillPanel"
import { DraftPinnedAuthoritiesEditor } from "@/components/india-drafting/DraftPinnedAuthoritiesEditor"
import { DraftAccuracyPanel } from "@/components/drafting/accuracy/DraftAccuracyPanel"
import { DraftAuthorityInsights } from "@/components/drafting/draft-authority-insights"
import { DraftGenerationProgress } from "@/components/drafting/accuracy/DraftGenerationProgress"
import { DraftV2SectionPanel } from "@/components/drafting/accuracy/DraftV2SectionPanel"
import { SectionFeedbackWidget } from "@/components/drafting/SectionFeedbackWidget"
import { TrainingConsentBanner } from "@/components/drafting/TrainingConsentBanner"
import { submitImplicitEditFeedback } from "@/lib/api/draft-feedback"
import { TableOfAuthoritiesPanel, type RichCitationAppendixEntry } from "@/components/citations/TableOfAuthoritiesPanel"
import { DraftSamplePreview } from "@/components/drafting/draft-sample-preview"
import { DraftFullscreenModal } from "@/components/india-drafting/DraftFullscreenModal"
import { SaveToClientDialog } from "@/components/india-drafting/SaveToClientDialog"
import { ExportBlockedDialog } from "@/components/verification/verification-ui"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { updateSavedDraft } from "@/lib/api/draft-history"
import { isFillableBlankLabel, normalizeDraftForBlanks } from "@/lib/drafting/draft-text-formatter"
import { buildDraftOutline, getDraftExportAvailability, parseReadinessBlocker } from "@/lib/drafting/draft-workspace"

type ViewMode = "fill" | "edit"

const QUICK_EDITS: { instruction: EditInstruction; label: string }[] = [
  { instruction: "check_law", label: "Check law" },
  { instruction: "add_citations", label: "Add citations" },
  { instruction: "strengthen", label: "Strengthen" },
  { instruction: "make_formal", label: "Make formal" },
  { instruction: "rephrase", label: "Rephrase" },
  { instruction: "make_concise", label: "Make concise" },
  { instruction: "fix_grammar", label: "Fix grammar" },
]

interface IndiaDraftOutputPanelProps {
  draft: string
  blanks: string[]
  onBlanksChange: (blanks: string[]) => void
  onReset: () => void
  kind: string
  label: string
  caseDetails: string
  clientName?: string
  tenantId?: string
  loading?: boolean
  progressVariant?: "filingGrade" | "express"
  sampleDraft?: string
  verification?: DraftVerificationAudit | null
  onVerificationChange?: (audit: DraftVerificationAudit | null) => void
  accuracyGate?: IndiaDraftAccuracyGate | null
  onAccuracyGateChange?: (gate: IndiaDraftAccuracyGate | null) => void
  finalResolutionStatus?: FinalDraftResolutionStatus | null
  confirmationQuestions?: DraftRepairConfirmationQuestion[]
  unresolvedFindingCodes?: string[]
  confirmedCaseRecord?: Record<string, unknown> | null
  onDraftChange?: (draft: string) => void
  onRepairStateChange?: (state: {
    finalResolutionStatus: FinalDraftResolutionStatus
    confirmationQuestions: DraftRepairConfirmationQuestion[]
    caseRecord?: Record<string, unknown>
    unresolvedFindingCodes?: string[]
  }) => void
  jurisdiction?: string
  savedDraftId?: string
  /** v3 draft job ID — used for case-law enrichment endpoint */
  jobId?: string
  modelUsed?: string
  counselChecklist?: string
  /** v2 engine outputs */
  sections?: SectionResult[]
  confidenceReport?: ConfidenceReport
  verificationReport?: VerificationReport
  citationAppendix?: CitationAppendixEntry[]
  engineVersion?: "v1" | "v2" | "v3"
  /** v3 unified engine real-time progress */
  serverPercent?: number
  serverStage?: string
  pinnedSections?: PinnedSection[]
  pinnedCaseLaws?: PinnedCaseLaw[]
  onPinnedChange?: (next: { pinnedSections: PinnedSection[]; pinnedCaseLaws: PinnedCaseLaw[] }) => void
  onRedraftWithPins?: () => void
  redrafting?: boolean
}

function resolveDraftText(draft: string, blanks: string[]): string {
  const normalized = normalizeDraftForBlanks(draft)
  let i = 0
  return normalized.replace(/\[[^\]]+\]/g, (match) => {
    const inner = match.slice(1, -1).trim()
    if (!isFillableBlankLabel(inner)) return match
    return blanks[i++]?.trim() || "[BLANK]"
  })
}

async function hashDraft(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
}

export function IndiaDraftOutputPanel({
  draft,
  blanks,
  onBlanksChange,
  onReset,
  kind,
  label,
  caseDetails,
  clientName,
  tenantId,
  loading = false,
  progressVariant = "filingGrade",
  sampleDraft,
  verification,
  onVerificationChange,
  accuracyGate,
  onAccuracyGateChange,
  finalResolutionStatus = null,
  confirmationQuestions = [],
  unresolvedFindingCodes = [],
  confirmedCaseRecord = null,
  onDraftChange,
  onRepairStateChange,
  jurisdiction,
  savedDraftId,
  jobId,
  modelUsed,
  counselChecklist,
  sections,
  confidenceReport,
  verificationReport,
  citationAppendix,
  engineVersion,
  serverPercent,
  serverStage,
  pinnedSections = [],
  pinnedCaseLaws = [],
  onPinnedChange,
  onRedraftWithPins,
  redrafting = false,
}: IndiaDraftOutputPanelProps) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("fill")
  const [editedText, setEditedText] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null)
  const [v2Sections, setV2Sections] = useState<SectionResult[] | undefined>(sections)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)

  // Sync v2Sections whenever the parent generates a new document
  useEffect(() => {
    setV2Sections(sections)
  }, [sections])

  const [aiLoading, setAiLoading] = useState(false)
  const [customInstruction, setCustomInstruction] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Case-law enrichment state
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichError, setEnrichError] = useState<string | null>(null)
  const [enrichedCaseLawAreas, setEnrichedCaseLawAreas] = useState<CaseLawArea[] | null>(null)
  const [enrichedCitationAppendix, setEnrichedCitationAppendix] = useState<CitationAppendixEntry[] | null>(null)
  const [enrichGate, setEnrichGate] = useState<AuthorityEnrichGateResult | null>(null)
  const [editExplanation, setEditExplanation] = useState<string | null>(null)
  const [pinsSheetOpen, setPinsSheetOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [linkedDocket, setLinkedDocket] = useState<LinkedDraftDocket | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [advocateApproved, setAdvocateApproved] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [mobileExportSheetOpen, setMobileExportSheetOpen] = useState(false)
  const [mobileAiSheetOpen, setMobileAiSheetOpen] = useState(false)
  const [exportBlockedOpen, setExportBlockedOpen] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [confirmPanelOpen, setConfirmPanelOpen] = useState(false)
  const [confirmAnswers, setConfirmAnswers] = useState<Record<string, string>>({})
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [persistenceStatus, setPersistenceStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  useEffect(() => {
    if (finalResolutionStatus === "needs_user_confirmation" && confirmationQuestions.length > 0) {
      setConfirmPanelOpen(true)
    }
  }, [finalResolutionStatus, confirmationQuestions])

  useEffect(() => {
    if (!savedDraftId || !tenantId) {
      setLinkedDocket(null)
      return
    }

    let cancelled = false
    void getDraftById(savedDraftId, tenantId)
      .then((record) => {
        if (cancelled) return
        if (record.clientId && (record.linkedClientName || record.clientName)) {
          setLinkedDocket({
            clientId: record.clientId,
            clientName: record.linkedClientName ?? record.clientName ?? "Client",
            matterId: record.matterId ?? undefined,
          })
        } else {
          setLinkedDocket(null)
        }
      })
      .catch(() => {
        if (!cancelled) setLinkedDocket(null)
      })

    return () => {
      cancelled = true
    }
  }, [savedDraftId, tenantId])

  const resolvedFromBlanks = useMemo(
    () => resolveDraftText(draft, blanks),
    [draft, blanks],
  )
  const displayText = editedText ?? resolvedFromBlanks
  const outline = useMemo(() => buildDraftOutline(displayText), [displayText])
  const caseRecordMetadata = confirmedCaseRecord?.metadata as
    | {
        caseRecordId?: string
        version?: number
        playbookVersion?: string
      }
    | undefined

  useEffect(() => {
    let cancelled = false
    setAdvocateApproved(false)
    setApprovalError(null)
    if (
      !savedDraftId ||
      !caseRecordMetadata?.caseRecordId ||
      caseRecordMetadata.version == null ||
      !caseRecordMetadata.playbookVersion ||
      !displayText.trim()
    ) {
      return
    }
    void hashDraft(displayText)
      .then((draftHash) =>
        getHumanReviewStatus(
          {
            draftId: savedDraftId,
            caseRecordId: caseRecordMetadata.caseRecordId!,
            caseRecordVersion: caseRecordMetadata.version!,
            playbookVersion: caseRecordMetadata.playbookVersion!,
            draftHash,
          },
          tenantId,
        ),
      )
      .then((status) => {
        if (!cancelled) setAdvocateApproved(status.valid)
      })
      .catch(() => {
        if (!cancelled) setAdvocateApproved(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    caseRecordMetadata?.caseRecordId,
    caseRecordMetadata?.playbookVersion,
    caseRecordMetadata?.version,
    displayText,
    savedDraftId,
    tenantId,
  ])

  useEffect(() => {
    if (!savedDraftId || !tenantId || !displayText.trim()) return
    setPersistenceStatus("idle")
    const timer = window.setTimeout(() => {
      setPersistenceStatus("saving")
      void updateSavedDraft(
        savedDraftId,
        {
          draftText: displayText,
        },
        tenantId,
      )
        .then(() => setPersistenceStatus("saved"))
        .catch(() => setPersistenceStatus("error"))
    }, 750)
    return () => window.clearTimeout(timer)
  }, [displayText, savedDraftId, tenantId, verification])
  const effectiveGate = accuracyGate ?? (verification
    ? {
        canCertify: verification.canCertify ?? verification.verificationStatus === "verified",
        canExport: true,
        exportWatermark: verification.canCertify ? undefined : "DRAFT - NOT FOR FILING",
        certificationLabel: verification.certificationLabel ?? "needs_review",
      } satisfies IndiaDraftAccuracyGate
    : null)
  const filingReadiness = effectiveGate?.filingReadiness
  const readinessBlockers = (filingReadiness?.mandatoryBlockers ?? []).map(parseReadinessBlocker)
  const readinessChecks = Object.entries(filingReadiness?.checks ?? {})
  const enrichBlocksExport = enrichGate != null && enrichGate.canExport === false
  const nonReviewBlockers = readinessBlockers.filter(
    (blocker) => !/human|lawyer|advocate\s+review/i.test(`${blocker.reason} ${blocker.action}`),
  )
  const automatedChecksPassed =
    readinessChecks
      .filter(([check]) => check !== "humanReview")
      .every(([, status]) => status !== "blocked") &&
    nonReviewBlockers.length === 0
  const systemCanExportForFiling =
    filingReadiness ? automatedChecksPassed : effectiveGate?.canCertify === true
  const reportedReadinessStatus = filingReadiness?.status ?? (
    effectiveGate?.canCertify ? "filing_ready" : "working_draft"
  )
  const readinessStatus =
    reportedReadinessStatus === "filing_ready" && !advocateApproved
      ? "lawyer_review_ready"
      : reportedReadinessStatus
  const readinessMeta = {
    working_draft: {
      label: "Working draft",
      description: "Review and resolve mandatory checks before filing.",
      className: "border-amber-200 bg-amber-50/95 text-amber-950 dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100",
    },
    lawyer_review_ready: {
      label: "Ready for lawyer review",
      description: "The draft is prepared for substantive counsel review.",
      className: "border-blue-200 bg-blue-50/95 text-blue-950 dark:border-blue-800 dark:bg-blue-950/90 dark:text-blue-100",
    },
    filing_ready: {
      label: "Filing ready",
      description: "Mandatory readiness checks have passed.",
      className: "border-emerald-200 bg-emerald-50/95 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100",
    },
  }[readinessStatus]
  const exportAvailability = getDraftExportAvailability({
    draftText: draft,
    systemChecksPassed: systemCanExportForFiling,
    authorityChecksPassed: !enrichBlocksExport,
    advocateApproved,
  })
  const canExportDraft = exportAvailability.canExportReviewCopy
  const canExportForFiling = exportAvailability.canExportForFiling
  const copyBlocked = !canExportDraft
  const draftWatermark = !canExportForFiling
    ? enrichBlocksExport
      ? "AUTHORITY VERIFICATION FAILED — NOT FOR FILING"
      : effectiveGate?.exportWatermark ?? "DRAFT - NOT FOR FILING"
    : undefined

  useEffect(() => {
    setEditedText(null)
    setViewMode("fill")
    setSelectedText("")
    setToolbarPos(null)
    setEditExplanation(null)
  }, [draft])

  // Auto-grow textarea in edit mode.
  useEffect(() => {
    if (viewMode === "edit" && editTextareaRef.current) {
      const el = editTextareaRef.current
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [viewMode, editedText])

  const recordEditFeedback = useCallback(() => {
    if (!draft?.trim()) return
    void submitImplicitEditFeedback({
      sectionType: "full_draft",
      documentKind: kind,
      aiText: draft,
      userText: displayText,
      jurisdiction,
      caseDetails,
      courtDraftRecordId: savedDraftId,
      draftJobSectionId: jobId,
    })
  }, [draft, kind, displayText, jurisdiction, caseDetails, savedDraftId, jobId])

  const enterFillMode = () => {
    if (viewMode === "edit" && editedText && editedText !== draft) {
      recordEditFeedback()
    }
    setViewMode("fill")
    setSelectedText("")
    setToolbarPos(null)
  }

  const enterEditMode = () => {
    setEditedText((prev) => prev ?? resolvedFromBlanks)
    setViewMode("edit")
  }

  const handleCopy = async () => {
    if (copyBlocked) return
    await navigator.clipboard.writeText(displayText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const navigateToHeading = (id: string) => {
    if (viewMode === "edit") {
      enterFillMode()
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const captureSelection = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ""
    if (!text || text.length < 3) {
      setSelectedText("")
      setToolbarPos(null)
      return
    }
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    if (!rect || !containerRef.current?.contains(range?.commonAncestorContainer ?? null)) {
      setSelectedText("")
      setToolbarPos(null)
      return
    }
    setSelectedText(text)
    setToolbarPos({
      top: Math.min(window.innerHeight - 260, Math.max(8, rect.top - 48)),
      left: Math.min(window.innerWidth - 320, Math.max(8, rect.left)),
    })
  }, [])

  const applyAiEdit = async (instruction: EditInstruction | string) => {
    if (!selectedText.trim()) return
    setAiLoading(true)
    setEditError(null)
    setEditExplanation(null)
    try {
      const source = editedText ?? resolvedFromBlanks
      const result = await editIndiaDraft(
        {
          documentKind: kind,
          selectedText,
          instruction,
          context: source.slice(0, 2000),
          caseDetails,
          jurisdiction,
        },
        tenantId,
      )
      const revised = result.revisedText.trim()
      setEditedText(source.includes(selectedText) ? source.replace(selectedText, revised) : `${source}\n\n${revised}`)
      setViewMode("edit")
      setEditExplanation(result.explanation)
      if (result.verification) onVerificationChange?.(result.verification)
      if (result.accuracyGate) onAccuracyGateChange?.(result.accuracyGate)
      if (result.creditsUsed > 0) invalidateCreditWalletQueries(queryClient, tenantId)
      setSelectedText("")
      setToolbarPos(null)
      setCustomInstruction("")
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "AI edit failed")
    } finally {
      setAiLoading(false)
    }
  }

  const applyVerificationResult = (result: {
    draft: string
    verification: DraftVerificationAudit
    accuracyGate: IndiaDraftAccuracyGate
    creditsUsed: number
  }) => {
    setEditedText(result.draft)
    setViewMode("edit")
    onVerificationChange?.(result.verification)
    onAccuracyGateChange?.(result.accuracyGate)
    if (result.creditsUsed > 0) invalidateCreditWalletQueries(queryClient, tenantId)
  }

  const handleReverify = async () => {
    setFixLoading(true)
    setEditError(null)
    try {
      const result = await reverifyIndiaDraft(
        {
          documentKind: kind,
          draft: displayText,
          caseDetails,
          jurisdiction,
        },
        tenantId,
      )
      applyVerificationResult(result)
      setEditExplanation("Draft re-verified against current text.")
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Re-verify failed")
    } finally {
      setFixLoading(false)
    }
  }

  const handleFixTopBlockers = async () => {
    setFixLoading(true)
    setEditError(null)
    try {
      const first = verification?.findings?.find((f) => f.severity === "BLOCKER" && f.state !== "PASS")
      const propositionText = verification?.propositions?.find((p) => p.id === first?.propositionId)?.text
      const instruction =
        first?.repairAction === "QUALIFY" ? "qualify_claim"
        : first?.repairAction === "REMOVE" ? "qualify_claim"
        : "retrieve_authority"
      const result = await fixIndiaDraftVerification(
        {
          documentKind: kind,
          draft: displayText,
          caseDetails,
          jurisdiction,
          instruction,
          findingId: first?.checkId,
          selectedText: propositionText,
        },
        tenantId,
      )
      applyVerificationResult(result)
      setEditExplanation("Top verification blocker checked and re-verified.")
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Fix blockers failed")
    } finally {
      setFixLoading(false)
    }
  }

  const handleApplyRepairConfirmations = async () => {
    if (!confirmedCaseRecord || confirmationQuestions.length === 0) {
      setConfirmError("Case record is required to apply confirmations.")
      return
    }
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      const answers = confirmationQuestions.map((q) => ({
        findingCode: q.findingCode,
        field: q.field,
        value: confirmAnswers[`${q.findingCode}|${q.field}`] ?? q.options?.[0]?.value ?? "",
      }))
      const result = await applyIndiaDraftRepairConfirmations(
        {
          documentKind: kind,
          draft: displayText,
          caseRecord: confirmedCaseRecord,
          answers,
          caseDetails,
        },
        tenantId,
      )
      onDraftChange?.(result.draft)
      setEditedText(result.draft)
      onAccuracyGateChange?.(result.accuracyGate)
      onRepairStateChange?.({
        finalResolutionStatus: result.finalResolutionStatus,
        confirmationQuestions: result.confirmationQuestions,
        caseRecord: result.caseRecord,
        unresolvedFindingCodes: result.unresolvedFindingCodes,
      })
      if (
        result.finalResolutionStatus === "clean" ||
        result.finalResolutionStatus === "repaired"
      ) {
        setConfirmPanelOpen(false)
        setExportBlockedOpen(false)
      }
      setEditExplanation("Repair confirmations applied and draft re-audited.")
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Could not apply confirmations")
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleGenerateCaseLaws = async (mode: DraftEnrichMode = "case_laws") => {
    if (!draft || enrichLoading) return
    setEnrichLoading(true)
    setEnrichError(null)
    setEnrichGate(null)
    try {
      const enrichJobId = jobId ?? savedDraftId ?? `local-${Date.now()}`
      const result = await enrichDraftWithAuthorities(
        enrichJobId,
        { draftText: displayText, documentKind: kind, rawFacts: caseDetails, mode },
        tenantId,
      )
      if (result.enrichedDraft?.trim()) {
        setEditedText(result.enrichedDraft)
        setViewMode("edit")
      }
      setEnrichedCaseLawAreas(result.caseLawAreas)
      setEnrichedCitationAppendix(result.citationAppendix)
      if (result.releaseGate) {
        setEnrichGate(result.releaseGate)
      } else if (typeof result.canExport === "boolean") {
        setEnrichGate({
          canExport: result.canExport,
          status: result.canExport ? "pass" : "fail",
          userLabel: result.canExport
            ? "Authorities verified for draft propositions"
            : "Authority verification failed — unrelated authorities retrieved. Exclude and rerun proposition-based retrieval.",
          blockers: [],
          verifiedCount: result.caseLawAreas?.length ?? 0,
          excludedCount: result.excludedAuthorities?.length ?? 0,
        })
      }
      if (result.creditsCharged > 0) {
        invalidateCreditWalletQueries(queryClient, tenantId)
      }
      if (result.releaseGate?.status === "fail" || result.canExport === false) {
        setEnrichError(
          result.releaseGate?.userLabel ??
            "Authority verification failed — unrelated authorities retrieved. Exclude and rerun proposition-based retrieval.",
        )
      } else if (!result.caseLawAreas?.length) {
        setEnrichError("No verified authorities found for this draft yet. Try adding more case details, then Enrich again.")
      }
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Failed to generate case laws")
    } finally {
      setEnrichLoading(false)
    }
  }

  const handleAdvocateApproval = async () => {
    if (
      approvalLoading ||
      !savedDraftId ||
      !caseRecordMetadata?.caseRecordId ||
      caseRecordMetadata.version == null ||
      !caseRecordMetadata.playbookVersion
    ) {
      setApprovalError("Confirm the case record and save the draft before advocate approval.")
      return
    }
    setApprovalLoading(true)
    setApprovalError(null)
    try {
      const draftHash = await hashDraft(displayText)
      await approveHumanReview(
        {
          draftId: savedDraftId,
          caseRecordId: caseRecordMetadata.caseRecordId,
          caseRecordVersion: caseRecordMetadata.version,
          playbookVersion: caseRecordMetadata.playbookVersion,
          draftHash,
        },
        tenantId,
      )
      setAdvocateApproved(true)
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "Could not record advocate approval.")
    } finally {
      setApprovalLoading(false)
    }
  }

  const prepareFilingExport = async (format: "pdf" | "docx") => {
    if (!savedDraftId) throw new Error("Save this draft before creating a filing copy.")
    const result = await exportIndiaDraft(
      {
        documentKind: kind,
        html: displayText,
        fileName: label,
        format,
        citationAppendix: enrichedCitationAppendix ?? citationAppendix,
        draftId: savedDraftId,
        exportMode: "filing",
      },
      tenantId,
    )
    return result.html
  }

  const exportMeta = {
    countryCode: "IN",
    date: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
    disclaimer:
      "This draft is AI-assisted and for informational purposes only. It must be reviewed, adapted, and verified by a qualified advocate before filing in court.",
  }
  const activeCitationEntries = enrichedCitationAppendix ?? (citationAppendix && citationAppendix.length > 0 ? citationAppendix : null)
  const verifiedToaLines =
    canExportForFiling
      ? activeCitationEntries
          ?.filter(
            (e) =>
              !e.excluded &&
              e.verified &&
              e.identityStatus === "pass" &&
              e.relevanceStatus === "pass",
          )
          .map((e) => e.citation) ?? []
      : []
  const draftExportMeta = {
    ...exportMeta,
    watermark: draftWatermark,
    tableOfAuthorities: verifiedToaLines.length > 0 ? verifiedToaLines : undefined,
  }

  const modelLabel = modelUsed ? "OkayLegal drafting" : null

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      {draft && (
        <section
          aria-label="Filing readiness"
          aria-live="polite"
          className={cn(
            "sticky top-14 xl:top-0 z-20 rounded-xl border px-3 py-2.5 shadow-sm backdrop-blur",
            readinessMeta.className,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {readinessStatus === "filing_ready" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold">{readinessMeta.label}</p>
                <p className="truncate text-[11px] opacity-75">{readinessMeta.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
              <span>{canExportDraft ? "Review-copy export available" : "Draft export blocked"}</span>
              <span>{canExportForFiling ? "Filing export available" : "Not cleared for filing export"}</span>
              {readinessBlockers.length > 0 && (
                <button
                  type="button"
                  onClick={() => document.getElementById("filing-readiness-blockers")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  {readinessBlockers.length} mandatory blocker{readinessBlockers.length === 1 ? "" : "s"}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── Toolbar (desktop) ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left: title + mode toggle */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Generated Draft</h2>
          {savedDraftId && (
            <span
              className={cn(
                "text-[10px]",
                persistenceStatus === "error" ? "text-red-600" : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {persistenceStatus === "saving"
                ? "Saving edits…"
                : persistenceStatus === "saved"
                  ? "Edits saved"
                  : persistenceStatus === "error"
                    ? "Edits not saved"
                    : ""}
            </span>
          )}
          {modelLabel && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 text-muted-foreground">
              <Zap className="h-2.5 w-2.5" />
              {modelLabel}
            </span>
          )}
          {draft && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={enterFillMode}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    viewMode === "fill"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700",
                  )}
                >
                  Fill blanks
                </button>
                <button
                  type="button"
                  onClick={enterEditMode}
                  className={cn(
                    "px-2.5 py-1 inline-flex items-center gap-1 transition-colors border-l border-gray-200 dark:border-gray-700",
                    viewMode === "edit"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700",
                  )}
                >
                  <Pencil className="h-3 w-3" />
                  Edit text
                </button>
              </div>
              {draft && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={enrichLoading || redrafting}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {enrichLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Enrich
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem
                      disabled={enrichLoading}
                      onClick={() => void handleGenerateCaseLaws("case_laws")}
                      className="gap-2"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <div className="flex flex-col">
                        <span>Add case laws</span>
                        <span className="text-[10px] text-muted-foreground">
                          AI search + update · ~{FEATURE_CREDIT_COSTS.RESEARCH_ENRICH}+ credits
                        </span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={enrichLoading}
                      onClick={() => void handleGenerateCaseLaws("sections")}
                      className="gap-2"
                    >
                      <Scale className="h-3.5 w-3.5" />
                      <div className="flex flex-col">
                        <span>Add statute sections</span>
                        <span className="text-[10px] text-muted-foreground">
                          Section finder · ~{FEATURE_CREDIT_COSTS.RESEARCH_ENRICH}+ credits
                        </span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={enrichLoading}
                      onClick={() => void handleGenerateCaseLaws("both")}
                      className="gap-2"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <div className="flex flex-col">
                        <span>Add both</span>
                        <span className="text-[10px] text-muted-foreground">
                          Case laws + sections · ~{FEATURE_CREDIT_COSTS.RESEARCH_ENRICH * 2}+ credits
                        </span>
                      </div>
                    </DropdownMenuItem>
                    {onPinnedChange && onRedraftWithPins ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={enrichLoading || redrafting}
                          onClick={() => setPinsSheetOpen(true)}
                          className="gap-2"
                        >
                          <Scale className="h-3.5 w-3.5" />
                          <div className="flex flex-col">
                            <span>Pin sections / case laws</span>
                            <span className="text-[10px] text-muted-foreground">
                              Manual pins, then redraft
                            </span>
                          </div>
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Right: action buttons (desktop only) */}
        {draft && (
          <div className="hidden lg:flex items-center gap-1.5">
            {/* Fullscreen */}
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Full screen (Esc to close)"
              aria-label="Open draft in full screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={copyBlocked}
              title={copyBlocked ? "Nothing to copy yet" : "Copy draft"}
              className={cn(
                "inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors text-muted-foreground",
                copyBlocked ? "opacity-50 cursor-not-allowed" : "hover:bg-muted",
              )}
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border hover:bg-muted transition-colors text-muted-foreground"
              >
                <Download className="h-3 w-3" />
                Export options
                <ChevronDown className="h-3 w-3" />
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg py-2 min-w-[220px]"
                    onClick={() => {
                      recordEditFeedback()
                      setExportMenuOpen(false)
                    }}
                  >
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Review copy — not for filing</p>
                    {canExportDraft ? (
                      <>
                        <div className="px-2 pb-1">
                          <PdfExportButton title={label} content={displayText} meta={draftExportMeta} variant="button" label="Review-copy PDF" className="w-full text-xs justify-start" />
                        </div>
                        <div className="px-2">
                          <WordExportButton title={label} content={displayText} meta={draftExportMeta} variant="button" label="Review-copy Word" className="w-full text-xs justify-start" />
                        </div>
                      </>
                    ) : (
                      <p className="px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Review-copy export is temporarily blocked by a mandatory check.</p>
                    )}
                    <div className="my-2 border-t" />
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Court-filing copy — readiness required</p>
                    {canExportForFiling ? (
                      <>
                        <div className="px-2 pb-1">
                          <PdfExportButton title={label} content={displayText} meta={exportMeta} variant="button" label="Court-filing PDF" className="w-full text-xs justify-start" prepareHtml={() => prepareFilingExport("pdf")} />
                        </div>
                        <div className="px-2">
                          <WordExportButton title={label} content={displayText} meta={exportMeta} variant="button" label="Court-filing Word" className="w-full text-xs justify-start" prepareHtml={() => prepareFilingExport("docx")} />
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setExportBlockedOpen(true)
                        }}
                        className="mx-2 block w-[calc(100%-1rem)] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        Resolve blockers before filing export
                      </button>
                    )}
                    </div>
                </>
              )}
            </div>

            {/* Save to client */}
            {savedDraftId && tenantId && (
              linkedDocket ? (
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={copyBlocked}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors font-medium dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60 max-w-[280px] disabled:opacity-50 disabled:cursor-not-allowed"
                  title={copyBlocked ? "Nothing to save yet" : `Linked to ${linkedDocket.clientName}${linkedDocket.matterTitle ? ` · ${linkedDocket.matterTitle}` : ""}. Click to change.`}
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    Saved to {linkedDocket.clientName}
                    {linkedDocket.matterTitle ? ` · ${linkedDocket.matterTitle}` : ""}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={copyBlocked}
                  title={copyBlocked ? "Nothing to save yet" : "Save draft to docket"}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="h-3 w-3" />
                  Save to docket
                </button>
              )
            )}

            {/* Checklist toggle (desktop) */}
            {counselChecklist && (
              <button
                type="button"
                onClick={() => setChecklistOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors font-medium",
                  checklistOpen
                    ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300"
                    : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40",
                )}
              >
                <ClipboardList className="h-3 w-3" />
                Checklist
              </button>
            )}

            {/* Overflow: Reset */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOverflowMenuOpen((v) => !v)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="More draft actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {overflowMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOverflowMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg py-1 min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => { onReset(); setOverflowMenuOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted text-muted-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Mobile header actions (only fullscreen + mode) */}
        {draft && (
          <div className="flex lg:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted"
              title="Full screen"
              aria-label="Open draft in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {draft && outline.length > 0 && (
        <details className="lg:hidden rounded-lg border bg-background px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold">
            Document outline · {outline.length} sections
          </summary>
          <nav aria-label="Document outline" className="mt-2 max-h-52 space-y-0.5 overflow-y-auto">
            {outline.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToHeading(item.id)}
                className="block w-full truncate rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                style={{ paddingLeft: `${Math.min(item.level, 3) * 0.5}rem` }}
              >
                {item.text}
              </button>
            ))}
          </nav>
        </details>
      )}

      <div className={cn("grid min-h-0 flex-1 gap-3", draft && outline.length > 0 && "lg:grid-cols-[13rem_minmax(0,1fr)]")}>
        {draft && outline.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-xl border bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <ListTree className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                <h3 className="text-xs font-semibold">Document outline</h3>
              </div>
              <nav aria-label="Document outline" className="max-h-[55vh] space-y-0.5 overflow-y-auto">
                {outline.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateToHeading(item.id)}
                    className="block w-full truncate rounded py-1.5 pr-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    style={{ paddingLeft: `${Math.min(item.level, 3) * 0.5}rem` }}
                    title={item.text}
                  >
                    {item.text}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* ─── Document card ──────────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          onMouseUp={captureSelection}
          className={cn(
            "relative min-h-[60vh] rounded-xl border overflow-y-auto shadow-sm",
            draft
              ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950"
              : "border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
          )}
        >
        {loading ? (
          <DraftGenerationProgress
            active={loading}
            variant={progressVariant}
            engineVersion={engineVersion}
            serverPercent={serverPercent}
            serverStage={serverStage}
          />
        ) : draft ? (
          viewMode === "edit" ? (
            <div className="relative p-6">
              <textarea
                ref={editTextareaRef}
                value={editedText ?? resolvedFromBlanks}
                onChange={(e) => {
                  setEditedText(e.target.value)
                  // auto-grow
                  e.target.style.height = "auto"
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onMouseUp={captureSelection}
                className="w-full resize-none font-serif text-sm leading-relaxed text-gray-800 dark:text-gray-200 bg-transparent border-0 outline-none min-h-[420px]"
                spellCheck
              />
              <span className="absolute bottom-2 right-4 text-[10px] text-muted-foreground pointer-events-none">
                {displayText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          ) : (
            <SmartDraftRenderer
              draft={draft}
              blanks={blanks}
              onBlanksChange={onBlanksChange}
            />
          )
        ) : sampleDraft ? (
          <DraftSamplePreview sample={sampleDraft} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-6 text-center min-h-[480px]">
            <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Your generated draft will appear here.</p>
            <p className="text-xs text-gray-400">Fill in the case details and click Generate.</p>
          </div>
        )}
        </div>
      </div>

      {/* ─── AI selection toolbar (floating) ────────────────────────────────────── */}
      {toolbarPos && selectedText && draft && (
        <div
          className="fixed z-40 hidden max-h-[calc(100vh-7rem)] max-w-sm overflow-y-auto rounded-xl border bg-background shadow-xl p-3 space-y-2 lg:block"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
              <Wand2 className="h-3 w-3 inline mr-1 text-indigo-500" />
              &ldquo;{selectedText.slice(0, 80)}{selectedText.length > 80 ? "…" : ""}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => { setSelectedText(""); setToolbarPos(null) }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close AI edit toolbar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_EDITS.map(({ instruction, label: actionLabel }) => (
              <button
                key={instruction}
                type="button"
                disabled={aiLoading}
                onClick={() => void applyAiEdit(instruction)}
                className="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 disabled:opacity-50"
              >
                {actionLabel}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Custom instruction…"
              className="flex-1 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInstruction.trim()) void applyAiEdit(customInstruction.trim())
              }}
            />
            <button
              type="button"
              disabled={aiLoading || !customInstruction.trim()}
              onClick={() => void applyAiEdit(customInstruction.trim())}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Apply
            </button>
          </div>
        </div>
      )}

      {editExplanation && (
        <p className="text-xs text-green-700 dark:text-green-400 px-1">{editExplanation}</p>
      )}
      {editError && (
        <p className="text-xs text-red-600 dark:text-red-400 px-1">{editError}</p>
      )}

      {draft && (
        <p className="text-xs text-muted-foreground">
          Highlight any passage to refine it with AI, or switch to <strong>Edit text</strong> to amend manually.
        </p>
      )}

      {draft && (readinessBlockers.length > 0 || readinessChecks.length > 0) && (
        <section
          id="filing-readiness-blockers"
          aria-labelledby="filing-readiness-title"
          className="scroll-mt-24 rounded-xl border bg-background p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="filing-readiness-title" className="text-sm font-semibold">
                Filing readiness review
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mandatory items must be resolved before creating a court-filing copy.
              </p>
            </div>
            {readinessChecks.length > 0 && (
              <div className="flex flex-wrap gap-1" aria-label="Readiness checks">
                {readinessChecks.map(([name, status]) => (
                  <span
                    key={name}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      status === "pass"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : status === "blocked"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                    )}
                  >
                    {name.replace(/[_-]+/g, " ")} · {status}
                  </span>
                ))}
              </div>
            )}
          </div>
          {systemCanExportForFiling && !enrichBlocksExport && !advocateApproved && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
              <div>
                <p className="text-xs font-semibold">System checks passed — advocate approval required</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Approval is bound to this exact draft, case-record version, and playbook version.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={approvalLoading}
                onClick={() => void handleAdvocateApproval()}
              >
                {approvalLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Approve as advocate
              </Button>
            </div>
          )}
          {advocateApproved && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Advocate approval recorded for this unchanged draft.
            </p>
          )}
          {approvalError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{approvalError}</p>
          )}
          {readinessBlockers.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {readinessBlockers.map((blocker, index) => {
                const relatedHeading = outline.find((item) =>
                  item.text.toLowerCase().includes(blocker.section.toLowerCase()),
                )
                const isAuthorityBlocker = /authorit|citation|case[\s-]?law/i.test(
                  `${blocker.section} ${blocker.reason} ${blocker.action}`,
                )
                return (
                  <article key={`${blocker.raw}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{blocker.section}</p>
                        <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Reason:</span> {blocker.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Next action:</span> {blocker.action}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {isAuthorityBlocker && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={enrichLoading}
                              onClick={() => void handleGenerateCaseLaws("case_laws")}
                            >
                              {enrichLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              Retry verified authorities
                            </Button>
                          )}
                          {relatedHeading && (
                            <Button type="button" variant="outline" size="sm" onClick={() => navigateToHeading(relatedHeading.id)}>
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              Open section
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("draft-verification-details")?.scrollIntoView({ behavior: "smooth" })}
                          >
                            Review verification
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              No mandatory blockers reported.
            </p>
          )}
        </section>
      )}

      {draft && <DraftAuthorityInsights verification={verification} />}

      <div id="draft-verification-details" className="scroll-mt-24">
        {engineVersion === "v2" && v2Sections && confidenceReport && verificationReport ? (
          <DraftV2SectionPanel
            sections={v2Sections}
            confidenceReport={confidenceReport}
            verificationReport={verificationReport}
            citationAppendix={citationAppendix}
            regeneratingSectionId={regeneratingSectionId}
            documentKind={kind}
            caseDetails={caseDetails}
            courtDraftRecordId={savedDraftId}
            draftJobSectionId={jobId}
            jurisdiction={jurisdiction}
            onRegenerateSection={async (sectionId) => {
              setRegeneratingSectionId(sectionId)
              try {
                const updated = await regenerateSection(
                  {
                    sectionId,
                    kind,
                    caseDetails,
                    clientName,
                    jurisdiction,
                  },
                  tenantId,
                )
                setV2Sections((prev) =>
                  prev?.map((s) => (s.sectionId === sectionId ? updated : s)) ?? prev,
                )
              } finally {
                setRegeneratingSectionId(null)
              }
            }}
          />
        ) : (
          <DraftAccuracyPanel
            verification={verification}
            onFixTopBlockers={() => void handleFixTopBlockers()}
            onReverify={() => void handleReverify()}
            fixLoading={fixLoading}
            hideSimilarCases
            hideVerificationCard
          />
        )}
      </div>

      {(finalResolutionStatus === "repaired" ||
        finalResolutionStatus === "needs_user_confirmation" ||
        finalResolutionStatus === "needs_advocate_review" ||
        finalResolutionStatus === "blocked") && (
        <div
          className={
            finalResolutionStatus === "blocked"
              ? "rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              : "rounded-lg border bg-muted/20 px-3 py-2 text-xs"
          }
        >
          <p className="font-medium">
            {finalResolutionStatus === "repaired"
              ? "Automated repair completed — draft re-audited."
              : finalResolutionStatus === "needs_user_confirmation"
                ? "Automated repair needs your confirmation on ambiguous facts."
                : finalResolutionStatus === "needs_advocate_review"
                  ? "Advocate review required for remaining legal judgment calls."
                  : "Export blocked — unresolved accuracy issues remain after automated repair. Filing export is unavailable until blockers are cleared."}
          </p>
          {unresolvedFindingCodes.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs opacity-90">
              {unresolvedFindingCodes.map((code) => (
                <li key={code}>{code.replace(/_/g, " ").toLowerCase()}</li>
              ))}
            </ul>
          )}
          {confirmationQuestions.length > 0 && (
            <button
              type="button"
              className="mt-1 text-amber-800 underline dark:text-amber-200"
              onClick={() => setConfirmPanelOpen(true)}
            >
              Review confirmation questions
            </button>
          )}
        </div>
      )}

      {confirmPanelOpen && confirmationQuestions.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-sm font-medium">Confirm facts to continue repair</p>
          {confirmationQuestions.map((q) => {
            const key = `${q.findingCode}|${q.field}`
            return (
              <div key={key} className="space-y-1 text-xs">
                <p className="font-medium">{q.question}</p>
                {q.options && q.options.length > 0 ? (
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5"
                    value={confirmAnswers[key] ?? String(q.options[0]?.value ?? "")}
                    onChange={(e) =>
                      setConfirmAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  >
                    {q.options.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-md border bg-background px-2 py-1.5"
                    value={confirmAnswers[key] ?? ""}
                    onChange={(e) =>
                      setConfirmAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={q.field}
                  />
                )}
              </div>
            )
          })}
          {confirmError && <p className="text-xs text-destructive">{confirmError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={confirmLoading || !confirmedCaseRecord}
              onClick={() => void handleApplyRepairConfirmations()}
            >
              {confirmLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Apply and re-audit
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmPanelOpen(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* ─── Table of Authorities / Case Laws Panel ─── */}
      {(() => {
        const activeCitations = enrichedCitationAppendix ?? (citationAppendix && citationAppendix.length > 0 ? citationAppendix : null)
        if (activeCitations && activeCitations.length > 0) {
          return (
            <TableOfAuthoritiesPanel
              entries={activeCitations as RichCitationAppendixEntry[]}
              engineVersion={engineVersion}
              compact={false}
            />
          )
        }
        if (draft && !loading) {
          return (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                <BookOpen className="h-4 w-4 text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Authorities</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    After drafting, use Enrich to retrieve proposition-grounded authorities — same flow as Legal Research.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={enrichLoading}
                  onClick={() => void handleGenerateCaseLaws()}
                  className="shrink-0"
                >
                  {enrichLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Enrich
                </Button>
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* ─── Authority enrichment section (outside draft body) ─── */}
      {enrichGate?.status === "fail" && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Authority verification failed</p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
            {enrichGate.userLabel}
          </p>
          {enrichGate.excludedCount > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {enrichGate.excludedCount} unrelated authorit{enrichGate.excludedCount === 1 ? "y" : "ies"} excluded from the Table of Authorities. Export is blocked until proposition-based retrieval succeeds.
            </p>
          )}
        </div>
      )}
      {enrichedCaseLawAreas && enrichedCaseLawAreas.filter((c) => !c.excluded).length > 0 && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-800">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Verified Authorities</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
              Authorities verified against draft propositions. This section is not part of the pleading body.
            </p>
          </div>
          <div className="divide-y divide-indigo-100 dark:divide-indigo-900">
            {enrichedCaseLawAreas.filter((c) => !c.excluded).map((c) => {
              const isCase = !c.authorityType || c.authorityType === "case"
              const verifiedForProp =
                c.relevanceStatus === "pass" &&
                c.identityStatus === "pass" &&
                (c.caseId.startsWith("curated__") || c.citedInDraft === true) &&
                (c.treatmentStatus === "good_law" || c.caseId.startsWith("curated__"))
              return (
                <div key={c.caseId} className="px-4 py-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.title}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        {c.citation} · {isCase ? c.court : "Legislation"}
                        {c.decisionYear ? ` · ${c.decisionYear}` : ""}
                        {" · "}
                        <span className="text-gray-500">{isCase ? "Case law" : "Statute"}</span>
                        {c.sourceUrl ? (
                          <>
                            {" · "}
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-indigo-800"
                            >
                              Source
                            </a>
                          </>
                        ) : null}
                      </p>
                      {c.issue && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Supports: {c.issue.replace(/_/g, " ")}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                        verifiedForProp
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                      )}
                    >
                      {verifiedForProp ? "Verified for this proposition" : "Unverified"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.proposition}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.areas.map((area) => (
                      <span key={area} className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                        {area.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {enrichError && enrichGate?.status !== "fail" && (
        <p className="text-xs text-red-600 dark:text-red-400 px-1">{enrichError}</p>
      )}

      {draft && viewMode === "fill" && (
        <BlankQuickFillPanel
          draft={draft}
          blanks={blanks}
          onBlanksChange={onBlanksChange}
          caseDetails={caseDetails}
          kind={kind}
          tenantId={tenantId}
        />
      )}

      {/* ─── Counsel's Pre-Filing Checklist card ────────────────────────────────── */}
      {counselChecklist && checklistOpen && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Counsel&apos;s Pre-Filing Checklist
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-600 dark:text-amber-500 italic">
                Not part of the pleading body — for filing verification only
              </span>
              <button
                type="button"
                onClick={() => setChecklistOpen(false)}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
                aria-label="Close checklist"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="px-4 py-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
            {counselChecklist}
          </div>
        </div>
      )}

      {/* ─── Draft feedback (v1 only — v2 shows per-section feedback) ─────────── */}
      {draft && engineVersion !== "v2" && (
        <div className="space-y-2 pt-1 pb-2 border-t">
          {tenantId && <TrainingConsentBanner tenantId={tenantId} />}
          <div className="flex items-center justify-end">
            <SectionFeedbackWidget
              sectionType="full_draft"
              documentKind={kind}
              aiText={draft}
              userText={displayText}
              jurisdiction={jurisdiction}
              caseDetails={caseDetails}
              courtDraftRecordId={savedDraftId}
              draftJobSectionId={jobId}
            />
          </div>
        </div>
      )}

      {/* ─── Mobile sticky bottom action bar ────────────────────────────────────── */}
      {draft && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center justify-around gap-1">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={copyBlocked}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={copyBlocked ? "Nothing to copy yet" : "Copy draft"}
          >
            {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileExportSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Open export options"
          >
            <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Export</span>
          </button>

          {savedDraftId && tenantId && (
            <button
              type="button"
              onClick={() => setSaveDialogOpen(true)}
              disabled={copyBlocked}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors max-w-[72px]",
                copyBlocked && "opacity-50 cursor-not-allowed",
                linkedDocket
                  ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
              aria-label={
                copyBlocked
                  ? "Nothing to save yet"
                  : linkedDocket
                    ? `Saved to ${linkedDocket.clientName}. Change client.`
                    : "Save draft to client"
              }
            >
              {linkedDocket ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <UserPlus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
              <span
                className={cn(
                  "text-[10px] text-center truncate w-full",
                  linkedDocket
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-gray-500 dark:text-gray-400",
                )}
              >
                {linkedDocket ? linkedDocket.clientName.split(/\s+/)[0] : "Save"}
              </span>
            </button>
          )}

          {counselChecklist && (
            <button
              type="button"
              onClick={() => setChecklistOpen((v) => !v)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors",
                checklistOpen
                  ? "bg-amber-100 dark:bg-amber-900/40"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
              aria-label={checklistOpen ? "Hide counsel checklist" : "Show counsel checklist"}
              aria-pressed={checklistOpen}
            >
              <ClipboardList className={cn("h-5 w-5", checklistOpen ? "text-amber-700 dark:text-amber-300" : "text-gray-600 dark:text-gray-400")} />
              <span className={cn("text-[10px]", checklistOpen ? "text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400")}>Checklist</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileAiSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Open AI editing tools"
          >
            <Wand2 className="h-5 w-5 text-indigo-500" />
            <span className="text-[10px] text-indigo-500">AI Edit</span>
          </button>
        </div>
      )}

      {/* ─── Mobile Export Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={mobileExportSheetOpen} onOpenChange={setMobileExportSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">Export Draft</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review copy — not for filing</p>
            {canExportDraft ? (
              <>
                <PdfExportButton
                  title={label}
                  content={displayText}
                  meta={draftExportMeta}
                  variant="button"
                  label="Review-copy PDF"
                  className="w-full justify-start text-sm py-3"
                />
                <WordExportButton
                  title={label}
                  content={displayText}
                  meta={draftExportMeta}
                  variant="button"
                  label="Review-copy Word (.docx)"
                  className="w-full justify-start text-sm py-3"
                />
              </>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Review-copy export is temporarily blocked by a mandatory check.
              </p>
            )}
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Court-filing copy — readiness required</p>
              {canExportForFiling ? (
                <div className="space-y-2">
                  <PdfExportButton
                    title={label}
                    content={displayText}
                    meta={exportMeta}
                    variant="button"
                    label="Court-filing PDF"
                    className="w-full justify-start text-sm py-3"
                    prepareHtml={() => prepareFilingExport("pdf")}
                  />
                  <WordExportButton
                    title={label}
                    content={displayText}
                    meta={exportMeta}
                    variant="button"
                    label="Court-filing Word (.docx)"
                    className="w-full justify-start text-sm py-3"
                    prepareHtml={() => prepareFilingExport("docx")}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setExportBlockedOpen(true)}
                  className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  Resolve blockers before filing export
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Mobile AI Edit Sheet ────────────────────────────────────────────────── */}
      <Sheet open={mobileAiSheetOpen} onOpenChange={setMobileAiSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">AI Edit</SheetTitle>
          </SheetHeader>
          {selectedText ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 line-clamp-3">
                &ldquo;{selectedText.slice(0, 120)}{selectedText.length > 120 ? "…" : ""}&rdquo;
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_EDITS.map(({ instruction, label: actionLabel }) => (
                  <button
                    key={instruction}
                    type="button"
                    disabled={aiLoading}
                    onClick={() => { void applyAiEdit(instruction); setMobileAiSheetOpen(false) }}
                    className="px-3 py-3 rounded-xl text-sm font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 disabled:opacity-50 text-left"
                  >
                    {actionLabel}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="Custom instruction…"
                  className="flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customInstruction.trim()) {
                      void applyAiEdit(customInstruction.trim())
                      setMobileAiSheetOpen(false)
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={aiLoading || !customInstruction.trim()}
                  onClick={() => { void applyAiEdit(customInstruction.trim()); setMobileAiSheetOpen(false) }}
                  className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Apply
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Highlight text in the draft to enable AI editing.
            </p>
          )}
        </SheetContent>
      </Sheet>

      {onPinnedChange && onRedraftWithPins ? (
        <Sheet open={pinsSheetOpen} onOpenChange={setPinsSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Pin sections &amp; case laws</SheetTitle>
            </SheetHeader>
            <p className="mt-2 text-xs text-muted-foreground">
              Optional manual pins after the draft is ready. Prefer Enrich for AI research; use this when you already know the authorities to force in.
            </p>
            <div className="mt-4 pb-6">
              <DraftPinnedAuthoritiesEditor
                documentKind={kind}
                jurisdiction={jurisdiction}
                value={{ pinnedSections, pinnedCaseLaws }}
                onChange={onPinnedChange}
                redrafting={redrafting}
                onRedraft={() => {
                  setPinsSheetOpen(false)
                  onRedraftWithPins()
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {/* ─── Fullscreen modal ───────────────────────────────────────────────────── */}
      <DraftFullscreenModal
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        draft={draft}
        blanks={blanks}
        onBlanksChange={onBlanksChange}
        editedText={editedText}
        onEditedTextChange={setEditedText}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        label={label}
        kind={kind}
        caseDetails={caseDetails}
        tenantId={tenantId}
        verification={verification}
        onVerificationChange={onVerificationChange}
        jurisdiction={jurisdiction}
        displayText={displayText}
        citationAppendix={citationAppendix}
        engineVersion={engineVersion}
      />

      {/* ─── Save to client dialog ──────────────────────────────────────────────── */}
      {savedDraftId && tenantId && (
        <SaveToClientDialog
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          onSaved={(linked) => {
            setLinkedDocket(linked)
            recordEditFeedback()
          }}
          draftId={savedDraftId}
          tenantId={tenantId}
          documentLabel={label}
          draftText={displayText}
          suggestedClientName={clientName}
        />
      )}
      <ExportBlockedDialog
        open={exportBlockedOpen}
        findings={verification?.findings}
        accuracyWarnings={verification?.citationWarnings}
        confirmationQuestions={confirmationQuestions}
        finalResolutionStatus={finalResolutionStatus}
        onClose={() => setExportBlockedOpen(false)}
        onAnswerConfirmations={() => {
          setExportBlockedOpen(false)
          setConfirmPanelOpen(true)
        }}
        onExportDraft={() => {
          setExportBlockedOpen(false)
          setMobileExportSheetOpen(true)
          setExportMenuOpen(true)
        }}
      />
    </div>
  )
}
