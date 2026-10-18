"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PenLine,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-media-query"
import { DraftMobileTabBar, type DraftMobileTab } from "@/components/shared/draft-mobile-tab-bar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiFetch, ApiClientError } from "@/lib/api/client"
import {
  exportPdf,
  getDraftDocument,
  saveAndDownloadDraftExport,
  saveDraftDocument,
} from "@/lib/api/document-automation"
import {
  generateDraftingDocument,
  getDraftingWorkspace,
  patchDraftingFields,
  type DraftingMissingField,
  type DraftingSmartStep,
} from "@/lib/api/drafting-workspace"
import { fieldLabelFromId } from "@/components/matters/drafting-workspace-panels"
import { ClausePickerPanel } from "@/components/matters/clause-picker-panel"
import { DraftAuthorityInsights } from "@/components/drafting/draft-authority-insights"
import { DraftActionsToolbar } from "@/components/drafting/draft-actions-toolbar"
import {
  DEFAULT_KNOWLEDGE_SOURCES,
  KnowledgeSourcePicker,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { cn } from "@/lib/utils"
import { handleSanitizedPaste, sanitizeDocumentHtml } from "@/lib/security/sanitize-html"

type LeftTab = "fields" | "clauses"

interface DocumentDraftWorkspaceProps {
  matterId: string
  tenantId: string
  openSignOnMount?: boolean
}

function extractErrorMessage(error: unknown): string | undefined {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof Error) return error.message
  return undefined
}

function DraftHtmlPreview({
  html,
  htmlSeed,
  onChange,
  editorRef,
  className,
}: {
  html: string
  htmlSeed: number
  onChange: (html: string) => void
  editorRef: React.RefObject<HTMLDivElement>
  className?: string
}) {
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = sanitizeDocumentHtml(html)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlSeed, editorRef])

  return (
    <div
      ref={editorRef}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      onPaste={handleSanitizedPaste}
    />
  )
}

// ---------------------------------------------------------------------------
// FieldRow – single editable field entry in the unified panel
// ---------------------------------------------------------------------------
function FieldRow({
  fieldKey,
  label,
  value,
  question,
  options,
  status,
  onChange,
}: {
  fieldKey: string
  label: string
  value: string
  question?: string
  options?: string[]
  status: "confirmed" | "missing"
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(status === "missing")
  const id = `draft-field-${fieldKey}`

  return (
    <div
      id={id}
      className={cn(
        "group relative rounded-lg border px-3 py-2.5 transition-colors",
        status === "missing"
          ? "border-amber-400/40 bg-amber-500/5"
          : editing
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-transparent hover:border-border/80",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
          {label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {status === "confirmed" && !editing && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 opacity-80" />
          )}
          {status === "missing" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400/60 text-amber-600 dark:text-amber-400">
              needed
            </Badge>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
              title="Edit"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          ) : (
            <button
              onClick={() => setEditing(false)}
              className="p-0.5 rounded hover:bg-accent transition-colors"
              title="Collapse"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-1.5 space-y-1.5">
          {question && (
            <p className="text-xs text-muted-foreground">{question}</p>
          )}
          {options && options.length >= 2 ? (
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Textarea
              rows={2}
              className="resize-none text-sm"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              autoFocus
            />
          )}
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-primary hover:underline"
          >
            Done
          </button>
        </div>
      ) : (
        <p className={cn("text-sm leading-snug", !value && "text-muted-foreground italic")}>
          {value || "Not yet provided"}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// UnifiedFieldsPanel – all fields (confirmed + missing) in one scrollable list
// ---------------------------------------------------------------------------
function UnifiedFieldsPanel({
  pendingMissingFields,
  confirmedFields,
  fieldDrafts,
  confirmedDrafts,
  onFieldDraftChange,
  onConfirmedDraftChange,
  onSaveAndRegenerate,
  onSaveOnly,
  saving,
  answeredCount,
  totalRequired,
  completionScore,
}: {
  pendingMissingFields: DraftingMissingField[]
  confirmedFields: Record<string, unknown>
  fieldDrafts: Record<string, string>
  confirmedDrafts: Record<string, string>
  onFieldDraftChange: (key: string, value: string) => void
  onConfirmedDraftChange: (key: string, value: string) => void
  onSaveAndRegenerate: () => void
  onSaveOnly: () => void
  saving: boolean
  answeredCount: number
  totalRequired: number
  completionScore: number
}) {
  const isComplete = pendingMissingFields.length === 0
  const confirmedEntries = Object.entries(confirmedFields)

  return (
    <div className="flex flex-col h-full">
      {/* Progress header */}
      <div className="px-4 pt-4 pb-3 border-b space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Case Details</span>
          <Badge
            variant={isComplete ? "default" : "outline"}
            className={cn(
              "text-xs font-semibold tabular-nums",
              isComplete
                ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20"
                : "border-amber-400/50 text-amber-700 dark:text-amber-400",
            )}
          >
            {answeredCount} / {totalRequired} answered
          </Badge>
        </div>
        <Progress
          value={completionScore}
          className={cn(
            "h-1.5",
            isComplete ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500",
          )}
        />
        {isComplete && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All required details captured — ready to finalise and sign.
          </p>
        )}
      </div>

      {/* Scrollable field list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {pendingMissingFields.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 px-1 pb-0.5">
            Still needed ({pendingMissingFields.length})
          </p>
        )}
        {pendingMissingFields.map((mf) => (
          <FieldRow
            key={mf.field}
            fieldKey={mf.field}
            label={fieldLabelFromId(mf.field)}
            value={fieldDrafts[mf.field] ?? ""}
            question={mf.question}
            options={mf.options}
            status="missing"
            onChange={(v) => onFieldDraftChange(mf.field, v)}
          />
        ))}

        {confirmedEntries.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-0.5 pt-2">
            Confirmed ({confirmedEntries.length})
          </p>
        )}
        {confirmedEntries.map(([key]) => (
          <FieldRow
            key={key}
            fieldKey={key}
            label={fieldLabelFromId(key)}
            value={confirmedDrafts[key] ?? ""}
            status="confirmed"
            onChange={(v) => onConfirmedDraftChange(key, v)}
          />
        ))}
      </div>

      {/* Sticky save/regenerate footer */}
      <div className="px-3 pb-3 pt-2 border-t shrink-0 space-y-2">
        <Button
          className="w-full"
          onClick={onSaveAndRegenerate}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Update &amp; Regenerate
        </Button>
        <Button
          className="w-full"
          variant="outline"
          size="sm"
          onClick={onSaveOnly}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save without regenerating
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function DocumentDraftWorkspace({
  matterId,
  tenantId,
  openSignOnMount = false,
}: DocumentDraftWorkspaceProps) {
  const t = useTranslations("matters")
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const previewRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({})
  const [confirmedDrafts, setConfirmedDrafts] = useState<Record<string, string>>({})
  const [draftHtml, setDraftHtml] = useState("")
  const [htmlSeed, setHtmlSeed] = useState(0)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [exportedPdf, setExportedPdf] = useState<string | null>(null)
  const [signOpen, setSignOpen] = useState(openSignOnMount)
  const [signDocName, setSignDocName] = useState("")
  const [signRecipients, setSignRecipients] = useState("")
  const [fullscreen, setFullscreen] = useState(false)
  const isMobile = useIsMobile()
  const [leftOpen, setLeftOpen] = useState(!isMobile)
  const [leftTab, setLeftTab] = useState<LeftTab>("fields")
  const [mobileTab, setMobileTab] = useState<DraftMobileTab>("form")
  const [selectedClauses, setSelectedClauses] = useState<string[]>([])
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)
  const [verification, setVerification] = useState<DraftVerificationAudit | null>(null)

  useEffect(() => {
    if (isMobile) {
      setLeftOpen(mobileTab === "form")
    } else {
      setLeftOpen(true)
    }
  }, [isMobile, mobileTab])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["drafting-workspace", matterId],
    queryFn: () => getDraftingWorkspace(tenantId, matterId),
  })

  const loadPrimaryDraft = useCallback(async (docId: string) => {
    const doc = await getDraftDocument(tenantId, docId)
    setDocumentId(doc.id)
    setDraftHtml(sanitizeDocumentHtml(doc.htmlContent ?? ""))
    setHtmlSeed((s) => s + 1)
    setSignDocName(doc.fileName)
  }, [tenantId])

  const generateMutation = useMutation({
    mutationFn: (sectionHint?: string) =>
      generateDraftingDocument(
        tenantId,
        matterId,
        sectionHint,
        selectedClauses.length ? selectedClauses : undefined,
        knowledgeSources,
      ),
    onSuccess: async (result) => {
      setDocumentId(result.documentId)
      setDraftHtml(sanitizeDocumentHtml(result.draftHtml))
      setVerification(result.verification ?? null)
      setHtmlSeed((s) => s + 1)
      await queryClient.invalidateQueries({ queryKey: ["drafting-workspace", matterId] })
      toast({ title: t("draftWorkspaceGenerated") })
    },
    onError: (error) => {
      toast({
        title: t("draftWorkspaceGenerateFailed"),
        description: extractErrorMessage(error) ?? t("generateWhenReady"),
        variant: "destructive",
      })
    },
  })

  useEffect(() => {
    if (data?.primaryDraft?.id) {
      void loadPrimaryDraft(data.primaryDraft.id)
    }
  }, [data?.primaryDraft?.id, loadPrimaryDraft])


  const pendingMissingFields =
    data?.pendingMissingFields ?? data?.draftWorkspace.missingFields ?? []

  useEffect(() => {
    if (!pendingMissingFields.length) return
    const initial: Record<string, string> = {}
    for (const mf of pendingMissingFields) {
      const existing = data?.planningAnswers[mf.field]
      if (existing) {
        initial[mf.field] = Array.isArray(existing) ? existing.join(", ") : String(existing)
      }
    }
    setFieldDrafts((prev) => ({ ...initial, ...prev }))
  }, [pendingMissingFields, data?.planningAnswers])

  useEffect(() => {
    if (!data?.confirmedFields) return
    const initial: Record<string, string> = {}
    for (const [key, value] of Object.entries(data.confirmedFields)) {
      initial[key] = Array.isArray(value) ? value.join(", ") : String(value)
    }
    setConfirmedDrafts(initial)
  }, [data?.confirmedFields])

  // Initialise selected clauses: use persisted selection if available, otherwise default to all mandatory
  useEffect(() => {
    if (!data?.clauseCatalog) return
    const persisted = data.draftWorkspace?.selectedClauses
    if (persisted?.length) {
      setSelectedClauses(persisted)
    } else {
      setSelectedClauses(data.clauseCatalog.filter((c) => c.mandatory).map((c) => c.title))
    }
  }, [data?.clauseCatalog, data?.draftWorkspace?.selectedClauses])

  const patchMutation = useMutation({
    mutationFn: ({
      fields,
      regenerate,
    }: {
      fields: Record<string, string | string[]>
      regenerate: boolean
    }) => patchDraftingFields(
      tenantId,
      matterId,
      fields,
      regenerate,
      selectedClauses.length ? selectedClauses : undefined,
      knowledgeSources,
    ),
    onSuccess: async (result) => {
      if (result.generateResult) {
        setDocumentId(result.generateResult.documentId)
        setDraftHtml(sanitizeDocumentHtml(result.generateResult.draftHtml))
        setVerification(result.generateResult.verification ?? null)
        setHtmlSeed((s) => s + 1)
      }
      await refetch()
      toast({ title: t("draftWorkspaceFieldsSaved") })
    },
    onError: (error) => {
      toast({
        title: t("draftWorkspaceFieldsFailed"),
        description: extractErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => saveDraftDocument(tenantId, documentId!, draftHtml),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", tenantId] })
      toast({ title: t("save_draft"), description: t("draftSavedToMatterDocuments") })
    },
    onError: (error) => {
      toast({
        title: t("draftWorkspaceFieldsFailed"),
        description: extractErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const pdfMutation = useMutation({
    mutationFn: () => saveAndDownloadDraftExport(tenantId, documentId!, draftHtml, "pdf"),
    onSuccess: async (result) => {
      setExportedPdf(result.url)
      await queryClient.invalidateQueries({ queryKey: ["documents", tenantId] })
      toast({ title: t("exportPdf"), description: t("draftExportSavedToDocuments") })
    },
    onError: (error) => {
      toast({ title: t("exportPdf"), description: extractErrorMessage(error), variant: "destructive" })
    },
  })

  const docxMutation = useMutation({
    mutationFn: () => saveAndDownloadDraftExport(tenantId, documentId!, draftHtml, "docx"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", tenantId] })
      toast({ title: t("exportDocx"), description: t("draftExportSavedToDocuments") })
    },
    onError: (error) => {
      toast({ title: t("exportDocx"), description: extractErrorMessage(error), variant: "destructive" })
    },
  })

  const handlePrint = () => {
    const content = editorRef.current?.innerHTML ?? draftHtml
    if (!content) return
    const win = window.open("", "_blank")
    if (!win) return
    const title = data?.matterTitle ?? "Draft"
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; padding: 24px; max-width: 800px; margin: 0 auto; }
        h1,h2,h3 { page-break-after: avoid; }
      </style></head><body>${content}</body></html>`,
    )
    win.document.close()
    win.focus()
    win.print()
  }

  const handleSaveAndRegenerate = () => {
    patchMutation.mutate({
      fields: { ...confirmedDrafts, ...fieldDrafts },
      regenerate: true,
    })
  }

  const handleSaveOnly = () => {
    patchMutation.mutate({
      fields: { ...confirmedDrafts, ...fieldDrafts },
      regenerate: false,
    })
  }

  const handleSendForSignature = async () => {
    if (!documentId) {
      toast({ title: t("draftWorkspaceNoDocument"), variant: "destructive" })
      return
    }
    try {
      await saveDraftDocument(tenantId, documentId, draftHtml)
      let pdfUrl = exportedPdf
      if (!pdfUrl) {
        const pdf = await exportPdf(tenantId, documentId)
        pdfUrl = pdf.url
        setExportedPdf(pdf.url)
      }
      await apiFetch("/esign/envelopes", {
        method: "POST",
        tenantId,
        body: {
          matterId,
          documentId,
          documentName: signDocName || data?.matterTitle,
          recipients: signRecipients.split(",").map((e) => e.trim()).filter(Boolean),
        },
      })
      toast({ title: t("envelope_sent") })
      setSignOpen(false)
    } catch {
      toast({ title: t("send_for_signature_failed"), variant: "destructive" })
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const workspace = data.draftWorkspace
  const canSign = pendingMissingFields.length === 0 && Boolean(documentId)
  const isComplete = pendingMissingFields.length === 0
  const isBusy =
    generateMutation.isPending || patchMutation.isPending || saveMutation.isPending

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-4 px-5 py-3 border-b bg-background z-10">
        <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 -ml-1 shrink-0 text-muted-foreground hover:text-foreground">
          <Link href={`/app/matters/${matterId}?hub=1`} aria-label={t("workspace.backToMatter")}>
            <ArrowLeft className="h-4 w-4" />
            {t("workspace.backToMatter")}
          </Link>
        </Button>

        <div className="h-5 w-px bg-border shrink-0" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate leading-tight">
            {workspace.documentTitle ?? data.matterTitle}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="max-w-48 truncate text-[11px] text-muted-foreground">
              {data.matterTitle}
            </span>
            {workspace.documentType && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                · {workspace.documentType.replace(/_/g, " ")}
              </span>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] h-5 px-1.5 font-semibold tabular-nums rounded-full",
                isComplete
                  ? "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400"
                  : "border-amber-400/50 bg-amber-500/5 text-amber-700 dark:text-amber-400",
              )}
            >
              {isComplete && <CheckCircle2 className="h-3 w-3 mr-1 inline-block" />}
              {data.answeredCount} / {data.totalRequired} {t("answered")}
            </Badge>
          </div>
        </div>

        {/* Action group */}
        <div className="hidden xl:flex items-center shrink-0 max-w-[420px]">
          <KnowledgeSourcePicker
            selected={knowledgeSources}
            onChange={setKnowledgeSources}
            countryCode={data?.countryCode}
            compact
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant={draftHtml ? "outline" : "default"}
            className="h-8"
            onClick={() => generateMutation.mutate(undefined)}
            loading={generateMutation.isPending}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              : draftHtml
                ? <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            <span className="hidden sm:inline">{draftHtml ? "Regenerate" : "Generate draft"}</span>
            <span className="sm:hidden">{draftHtml ? "Regen" : "Generate"}</span>
          </Button>

          <div className="hidden lg:flex items-center gap-1.5">
            <div className="h-5 w-px bg-border mx-0.5" />
            <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={saveMutation.isPending || !documentId} title="Save">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={handlePrint} disabled={!documentId} title="Print">
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending || !documentId} title="Export PDF">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              PDF
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => docxMutation.mutate()} disabled={docxMutation.isPending || !documentId} title="Export DOCX">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              DOCX
            </Button>
            <div className="h-5 w-px bg-border mx-0.5" />
            <Button
              size="sm"
              className="h-8"
              onClick={() => setSignOpen(true)}
              disabled={!canSign}
              title={!canSign ? t("draftWorkspaceCompleteFieldsFirst") : undefined}
            >
              <PenLine className="h-3.5 w-3.5 mr-1.5" />
              Send for Signature
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="lg:hidden h-10 w-10 p-0" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !documentId}>
                <Save className="h-4 w-4 mr-2" /> Save
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} disabled={!documentId}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending || !documentId}>
                <Download className="h-4 w-4 mr-2" /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => docxMutation.mutate()} disabled={docxMutation.isPending || !documentId}>
                <FileText className="h-4 w-4 mr-2" /> Export DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSignOpen(true)} disabled={!canSign}>
                <PenLine className="h-4 w-4 mr-2" /> Send for Signature
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {isMobile && (
        <DraftMobileTabBar
          active={mobileTab}
          onChange={(tab) => {
            setMobileTab(tab)
            setLeftOpen(tab === "form")
          }}
          draftReady={Boolean(draftHtml)}
          formLabel="Fields"
          draftLabel="Preview"
          className="mx-0 px-4 border-b"
        />
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 min-w-0 w-full overflow-hidden">

        {/* Left: Fields / Clauses panel */}
        <div
          className={cn(
            "flex flex-col border-r bg-card transition-[width] duration-200 shrink-0 overflow-hidden",
            leftOpen
              ? isMobile
                ? "w-full"
                : "w-[400px]"
              : "w-0",
            isMobile && mobileTab !== "form" && "hidden",
          )}
        >
          {leftOpen && (
            <>
              {/* Tab switcher */}
              <div className="shrink-0 flex border-b bg-muted/30">
                <button
                  onClick={() => setLeftTab("fields")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                    leftTab === "fields"
                      ? "border-b-2 border-primary text-primary bg-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Fields
                  <Badge variant={leftTab === "fields" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
                    {data.answeredCount}/{data.totalRequired}
                  </Badge>
                </button>
                <button
                  onClick={() => setLeftTab("clauses")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                    leftTab === "clauses"
                      ? "border-b-2 border-primary text-primary bg-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  Clauses
                  {data.clauseCatalog && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
                      {selectedClauses.length}
                    </Badge>
                  )}
                </button>
              </div>

              {leftTab === "fields" ? (
                <UnifiedFieldsPanel
                  pendingMissingFields={pendingMissingFields}
                  confirmedFields={data.confirmedFields ?? {}}
                  fieldDrafts={fieldDrafts}
                  confirmedDrafts={confirmedDrafts}
                  onFieldDraftChange={(k, v) => setFieldDrafts((p) => ({ ...p, [k]: v }))}
                  onConfirmedDraftChange={(k, v) => setConfirmedDrafts((p) => ({ ...p, [k]: v }))}
                  onSaveAndRegenerate={handleSaveAndRegenerate}
                  onSaveOnly={handleSaveOnly}
                  saving={isBusy}
                  answeredCount={data.answeredCount}
                  totalRequired={data.totalRequired}
                  completionScore={data.completionScore}
                />
              ) : data.clauseCatalog ? (
                <ClausePickerPanel
                  catalog={data.clauseCatalog}
                  selected={selectedClauses}
                  onChange={setSelectedClauses}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                  No clause catalog available for this document type.
                </div>
              )}
            </>
          )}
        </div>

        {/* Toggle strip — desktop only */}
        <button
          onClick={() => setLeftOpen((v) => !v)}
          className="hidden md:flex shrink-0 w-10 items-center justify-center bg-muted/20 hover:bg-muted/50 border-r transition-colors group"
          title={leftOpen ? "Hide panel" : "Show panel"}
          aria-label={leftOpen ? "Hide panel" : "Show panel"}
        >
          {leftOpen ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground rotate-90 group-hover:text-foreground" />
          )}
        </button>

        {/* Right: Document preview — paper on desk */}
        <div
          className={cn(
            "relative flex-1 min-w-0 overflow-y-auto bg-muted/40",
            isMobile && mobileTab !== "draft" && "hidden",
          )}
          ref={previewRef}
        >

          {/* Generating overlay */}
          {(generateMutation.isPending || patchMutation.isPending) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 bg-background border rounded-xl shadow-lg px-8 py-6">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  {generateMutation.isPending ? "Generating document…" : "Regenerating…"}
                </p>
                <p className="text-xs text-muted-foreground">This may take a moment</p>
              </div>
            </div>
          )}

          {draftHtml ? (
            <div className="min-h-full flex flex-col items-center py-8 px-6 space-y-4">
              <div className="w-full max-w-4xl space-y-3">
                <DraftAuthorityInsights
                  verification={verification}
                  caseLawSelected={knowledgeSources.includes("case_law")}
                  hasDraft={Boolean(draftHtml)}
                  emptyStateActions={
                    <DraftActionsToolbar
                      draftText={draftHtml.replace(/<[^>]+>/g, " ")}
                      documentKind={workspace.documentType ?? data.matterType}
                      rawFacts={workspace.situation ?? data.matterTitle}
                      tenantId={tenantId}
                      countryCode={data.countryCode === "US" ? "US" : "IN"}
                      onEnriched={({ enrichedDraft }) => {
                        setDraftHtml(sanitizeDocumentHtml(enrichedDraft))
                        setHtmlSeed((s) => s + 1)
                      }}
                    />
                  }
                />
              </div>
              {/* Paper card */}
              <div className="w-full max-w-4xl bg-background rounded-xl border shadow-sm">
                {/* Document toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Document Draft
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setFullscreen(true)}
                    title="Full screen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
                <DraftHtmlPreview
                  html={draftHtml}
                  htmlSeed={htmlSeed}
                  onChange={setDraftHtml}
                  editorRef={editorRef}
                  className="w-full px-12 py-10 prose prose-sm dark:prose-invert max-w-none [&_*]:max-w-none [&_div]:w-full [&_table]:w-full [&_p]:w-full focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="min-h-full flex flex-col items-center justify-center px-6 text-center">
              <div className="bg-background border rounded-xl shadow-sm p-10 max-w-sm w-full flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground mb-2">
                  {isComplete ? "Ready to generate" : "Complete required fields"}
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  {isComplete
                    ? "All details are captured. Click \"Generate draft\" to create your document."
                    : "Fill in the required fields in the panel on the left, then generate your draft."}
                </p>
                <Button
                  onClick={() => generateMutation.mutate(undefined)}
                  disabled={generateMutation.isPending}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate draft
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen document preview */}
      {fullscreen && draftHtml && (
        <div className="fixed inset-0 z-50 flex flex-col bg-muted/40">
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 bg-background shadow-sm">
            <span className="text-sm font-semibold truncate max-w-lg">
              {workspace.documentTitle ?? data.matterTitle}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setFullscreen(false)} title="Exit full screen">
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col items-center py-10 px-6">
            <div className="w-full max-w-4xl bg-background rounded-xl border shadow-sm">
              <div
                className="w-full px-12 py-10 prose prose-sm dark:prose-invert max-w-none [&_*]:max-w-none [&_div]:w-full [&_table]:w-full [&_p]:w-full"
                dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(draftHtml) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sign dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("send_for_signature")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("documentDraft")}</Label>
              <Input value={signDocName} onChange={(e) => setSignDocName(e.target.value)} />
            </div>
            <div>
              <Label>{t("esign_recipients")}</Label>
              <Input
                placeholder="signer1@example.com, signer2@example.com"
                value={signRecipients}
                onChange={(e) => setSignRecipients(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleSendForSignature}>
              {t("send_for_signature")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
