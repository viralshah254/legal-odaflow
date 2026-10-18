"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { listTemplates } from "@/lib/api/templates"
import { handleSanitizedPaste, sanitizeDocumentHtml } from "@/lib/security/sanitize-html"
import {
  draftWithAi,
  listMatterDraftDocuments,
  saveDraftDocument,
  exportDocx,
  exportPdf,
  type AiDraftListItem,
} from "@/lib/api/document-automation"
import {
  FileText,
  Sparkles,
  Download,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FilePlus,
  PenLine,
  ShieldCheck,
  ClipboardList,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { apiFetch } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { DocumentRedline } from "@/components/documents/document-redline"

interface GenerateDocumentFlowProps {
  matterId: string
  tenantId: string
  practiceArea?: string | null
  countryCode?: string | null
  onSendForSignature?: (docName: string, docUrl: string) => void
  onShareViaPortal?: (docName: string, docUrl: string) => void
}

type FlowStep = "picker" | "fields" | "drafting" | "review" | "done"

// Fields the AI/template needs that we consider required (must be filled before generating)
const REQUIRED_FIELD_PATTERNS = /^(party[12]Name|clientName|landlordName|tenantName)$/i

// Fields resolved automatically from matter — skip prompting for these
const AUTO_RESOLVED_FIELDS = new Set([
  "clientName", "matterTitle", "matterDescription", "caseNumber", "today",
  "firmName", "practiceArea", "jurisdiction", "courtName", "factsSummary",
  "desiredOutcome", "opposingParty",
])

/** Extract all {{variableName}} tokens from template HTML */
function extractTemplateTokens(html: string): string[] {
  const matches = [...html.matchAll(/\{\{(\w+)\}\}/g)]
  return [...new Set(matches.map((m) => m[1]))]
}

/** Human-readable label for a camelCase or snake_case field key */
function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

export function GenerateDocumentFlow({
  matterId,
  tenantId,
  practiceArea,
  countryCode,
  onSendForSignature,
  onShareViaPortal,
}: GenerateDocumentFlowProps) {
  const t = useTranslations("matters")
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<FlowStep>("picker")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedTemplateContent, setSelectedTemplateContent] = useState<string>("")
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [draftHtml, setDraftHtml] = useState<string>("")
  const [disclaimer, setDisclaimer] = useState<string>("")
  const [exportedDocx, setExportedDocx] = useState<string | null>(null)
  const [exportedPdf, setExportedPdf] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Load templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates", tenantId, practiceArea],
    queryFn: () =>
      listTemplates(tenantId, {
        practiceArea: practiceArea ?? undefined,
        countryCode: countryCode ?? undefined,
      }),
    enabled: open && step === "picker",
  })

  // Load existing draft documents
  const { data: draftDocs, refetch: refetchDrafts } = useQuery({
    queryKey: ["matter-drafts", matterId],
    queryFn: () => listMatterDraftDocuments(tenantId, matterId),
  })

  const draftMutation = useMutation({
    mutationFn: ({ templateId, overrides }: { templateId: string; overrides?: Record<string, string> }) =>
      draftWithAi(tenantId, matterId, templateId, overrides),
    onSuccess: (result) => {
      setDocumentId(result.documentId)
      setDraftHtml(sanitizeDocumentHtml(result.draftHtml))
      setDisclaimer(result.disclaimer)
      setStep("review")
      void refetchDrafts()
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => saveDraftDocument(tenantId, documentId!, draftHtml),
    onSuccess: () => {
      void refetchDrafts()
      void queryClient.invalidateQueries({ queryKey: ["matter-drafts", matterId] })
    },
  })

  const docxMutation = useMutation({
    mutationFn: () => exportDocx(tenantId, documentId!),
    onSuccess: (result) => setExportedDocx(result.url),
  })

  const pdfMutation = useMutation({
    mutationFn: () => exportPdf(tenantId, documentId!),
    onSuccess: (result) => setExportedPdf(result.url),
  })

  const handlePickTemplate = (templateId: string, templateContent: string) => {
    const tokens = extractTemplateTokens(templateContent)
    const unresolved = tokens.filter((t) => !AUTO_RESOLVED_FIELDS.has(t))
    setSelectedTemplateId(templateId)
    setSelectedTemplateContent(templateContent)
    setMissingFields(unresolved)
    setFieldValues({})
    if (unresolved.length > 0) {
      setStep("fields")
    } else {
      setStep("drafting")
      draftMutation.mutate({ templateId })
    }
  }

  const handleProceedFromFields = () => {
    const requiredMissing = missingFields
      .filter((f) => REQUIRED_FIELD_PATTERNS.test(f))
      .some((f) => !fieldValues[f]?.trim())
    if (requiredMissing) return // form validation will show errors
    setStep("drafting")
    draftMutation.mutate({
      templateId: selectedTemplateId!,
      overrides: Object.fromEntries(
        Object.entries(fieldValues).filter(([, v]) => v.trim()),
      ),
    })
  }

  const handleReset = () => {
    setStep("picker")
    setSelectedTemplateId(null)
    setSelectedTemplateContent("")
    setMissingFields([])
    setFieldValues({})
    setDocumentId(null)
    setDraftHtml("")
    setDisclaimer("")
    setExportedDocx(null)
    setExportedPdf(null)
    draftMutation.reset()
  }

  const templates = templatesData?.templates ?? []

  return (
    <>
      {/* Existing drafts list */}
      {draftDocs && draftDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t("ai-generated_documents")}</p>
          {draftDocs.map((doc) => (
            <DraftDocumentCard
              key={doc.id}
              doc={doc}
              tenantId={tenantId}
              onReopen={(id, html) => {
                setDocumentId(id)
                setDraftHtml(html)
                setStep("review")
                setOpen(true)
              }}
              onSendForSignature={onSendForSignature}
              onShareViaPortal={onShareViaPortal}
            />
          ))}
        </div>
      )}

      {/* Generate button */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => {
          handleReset()
          setOpen(true)
        }}
      >
        <FilePlus className="h-4 w-4" />
        Generate from template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate document
            </DialogTitle>
            <DialogDescription>
              AI drafts the full document from your firm template and matter context.
              You review and export.
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(["picker", "fields", "drafting", "review", "done"] as FlowStep[]).map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <span>›</span>}
                <span
                  className={cn(
                    "capitalize",
                    step === s && "text-foreground font-medium",
                    ["fields", "drafting", "review", "done"].indexOf(s) <=
                      ["drafting", "review", "done"].indexOf(step) &&
                      step !== "picker" &&
                      "text-primary",
                  )}
                >
                  {s === "picker" ? t("select_template_step") : s === "drafting" ? t("ai_drafting_step") : s}
                </span>
              </span>
            ))}
          </div>

          <Separator />

          <ScrollArea className="flex-1 pr-2">
            {/* ── Step 1: Template picker ── */}
            {step === "picker" && (
              <div className="space-y-3">
                {templatesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{t("no_templates_found_for_this_practice_area")}</p>
                    <p className="text-xs mt-1">
                      {t("add_templates_in_settings")}
                    </p>
                  </div>
                ) : (
                  templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handlePickTemplate(tpl.id, tpl.content ?? "")}
                      className="w-full text-left rounded-lg border p-4 hover:border-primary/60 hover:bg-primary/5 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{tpl.name}</p>
                        {tpl.category && (
                          <Badge variant="secondary" className="text-xs">
                            {tpl.category}
                          </Badge>
                        )}
                      </div>
                      {tpl.practiceArea && (
                        <p className="text-xs text-muted-foreground">
                          {tpl.practiceArea.replace(/_/g, " ")}
                          {tpl.countryCode ? ` · ${tpl.countryCode}` : ""}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ── Step 1b: Missing fields form ── */}
            {step === "fields" && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <ClipboardList className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Complete document details</p>
                    <p className="text-amber-700 mt-0.5">
                      Fill in the fields below to create a fully personalised document.
                      Fields marked <span className="text-red-600 font-bold">*</span> are required.
                      Optional fields can be left blank — the AI will insert a placeholder you can edit later.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4">
                  {missingFields.map((fieldKey) => {
                    const isRequired = REQUIRED_FIELD_PATTERNS.test(fieldKey)
                    const value = fieldValues[fieldKey] ?? ""
                    const empty = isRequired && !value.trim()
                    return (
                      <div key={fieldKey} className="space-y-1.5">
                        <Label htmlFor={`field-${fieldKey}`} className="flex items-center gap-1">
                          {fieldLabel(fieldKey)}
                          {isRequired && <span className="text-red-500">*</span>}
                          {!isRequired && (
                            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                          )}
                        </Label>
                        <Input
                          id={`field-${fieldKey}`}
                          value={value}
                          onChange={(e) =>
                            setFieldValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                          }
                          placeholder={isRequired ? `Enter ${fieldLabel(fieldKey).toLowerCase()}` : "Leave blank to auto-fill"}
                          className={cn(empty && "border-red-400 focus-visible:ring-red-400")}
                        />
                        {empty && (
                          <p className="text-xs text-red-500">This field is required to generate the document</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep("picker")} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleProceedFromFields}
                    className="flex-1 gap-2"
                    disabled={missingFields
                      .filter((f) => REQUIRED_FIELD_PATTERNS.test(f))
                      .some((f) => !fieldValues[f]?.trim())}
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate document
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Drafting spinner ── */}
            {step === "drafting" && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">{t("aiDrafting")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("aiDraftingSubtitle")}
                  </p>
                </div>
                {draftMutation.isError && (
                  <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-start gap-2 max-w-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {draftMutation.error instanceof Error
                        ? draftMutation.error.message
                        : t("draft_failed_retry")}
                    </span>
                  </div>
                )}
                {draftMutation.isError && (
                  <Button variant="outline" onClick={handleReset}>
                    {t("back_to_templates")}
                  </Button>
                )}
              </div>
            )}

            {/* ── Step 3: Review & edit ── */}
            {step === "review" && (
              <div className="space-y-4">
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{t("attorney_review_required")}</strong> {t("attorney_review_draft_notice")}
                  </span>
                </div>

                {/* Editable HTML preview */}
                <div className="rounded-lg border">
                  <div className="border-b px-3 py-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{t("documentDraft")}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      {t("save_draft")}
                    </Button>
                  </div>
                  <div
                    className="p-4 prose prose-sm dark:prose-invert max-w-none min-h-[300px] focus:outline-none"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setDraftHtml((e.target as HTMLDivElement).innerHTML)}
                    onPaste={handleSanitizedPaste}
                    dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(draftHtml) }}
                  />
                </div>

                {disclaimer && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                    {disclaimer.split("\n")[0]}
                  </p>
                )}

                {/* Export buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => docxMutation.mutate()}
                    disabled={docxMutation.isPending}
                  >
                    {docxMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Download className="h-3 w-3 mr-1" />
                    )}
                    {t("exportDocx")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pdfMutation.mutate()}
                    disabled={pdfMutation.isPending}
                  >
                    {pdfMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Download className="h-3 w-3 mr-1" />
                    )}
                    {t("exportPdf")}
                  </Button>
                  {exportedDocx && (
                    <a href={exportedDocx} download className="text-xs text-primary underline self-center">
                      {t("download_docx")}
                    </a>
                  )}
                  {exportedPdf && (
                    <a href={exportedPdf} download className="text-xs text-primary underline self-center">
                      {t("download_pdf")}
                    </a>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={handleReset}>
                    {t("new_document")}
                  </Button>
                </div>

                <LegalDisclaimer variant="compact" />

                {/* Redline / version compare */}
                {documentId && (
                  <DocumentRedline
                    documentId={documentId}
                    tenantId={tenantId}
                    currentVersion={1}
                    currentHtml={draftHtml}
                  />
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DraftDocumentCard({
  doc,
  tenantId,
  onReopen,
  onSendForSignature,
  onShareViaPortal,
}: {
  doc: AiDraftListItem
  tenantId: string
  onReopen: (id: string, html: string) => void
  onSendForSignature?: (docName: string, docUrl: string) => void
  onShareViaPortal?: (docName: string, docUrl: string) => void
}) {
  const t = useTranslations("matters")
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null)
  const [citationChecking, setCitationChecking] = useState(false)
  const [citationWarnings, setCitationWarnings] = useState<string[] | null>(null)
  const { toast } = useToast()

  const handleCitationCheck = async () => {
    setCitationChecking(true)
    try {
      const result = await apiFetch<{ verified: boolean; warnings: string[]; unverifiableCitations: string[] }>(
        `/document-automation/documents/${doc.id}/citation-check`,
        { method: "POST" }
      )
      setCitationWarnings(result.warnings)
      toast({
        title: result.verified ? t("citations_verified") : t("unverifiable_citations_found", { count: result.unverifiableCitations.length }),
        description: result.verified
          ? t("no_unverifiable_citations")
          : result.unverifiableCitations.slice(0, 3).join(", "),
        variant: result.verified ? "default" : "destructive",
      })
    } catch {
      toast({ title: t("citation_check_failed"), variant: "destructive" })
    } finally {
      setCitationChecking(false)
    }
  }

  const handleExport = async (format: "docx" | "pdf") => {
    setExporting(format)
    try {
      const fn = format === "docx" ? exportDocx : exportPdf
      const result = await fn(tenantId, doc.id)
      const a = document.createElement("a")
      a.href = result.url
      a.download = `${doc.fileName}.${format}`
      a.click()
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{doc.fileName}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {doc.aiDraftStatus && (
              <Badge
                variant={doc.aiDraftStatus === "REVIEWED" ? "default" : "secondary"}
                className="text-xs"
              >
                {doc.aiDraftStatus === "REVIEWED" ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                {doc.aiDraftStatus}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">v{doc.version}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onReopen(doc.id, "")}
        >
          {t("review_draft")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCitationCheck}
          disabled={citationChecking}
          title={t("check_for_unverifiable_citations")}
          className={cn("gap-1", citationWarnings !== null && (citationWarnings.length === 0 ? "text-green-600" : "text-amber-600"))}
        >
          {citationChecking ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ShieldCheck className="h-3 w-3" />
          )}
          {t("cite_check")}
        </Button>
        {doc.pdfUrl && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSendForSignature?.(doc.fileName, doc.pdfUrl!)}
              className="text-xs gap-1"
            >
              <PenLine className="h-3 w-3" />
              {t("send_for_signature_short")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onShareViaPortal?.(doc.fileName, doc.pdfUrl!)}
              className="text-xs gap-1"
            >
              <FileText className="h-3 w-3" />
              {t("share_via_portal")}
            </Button>
          </>
        )}
        {doc.docxUrl ? (
          <a href={doc.docxUrl} download>
            <Button size="sm" variant="ghost">
              <Download className="h-3 w-3" />
              DOCX
            </Button>
          </a>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleExport("docx")}
            disabled={exporting === "docx"}
          >
            {exporting === "docx" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            DOCX
          </Button>
        )}
        {doc.pdfUrl ? (
          <a href={doc.pdfUrl} download>
            <Button size="sm" variant="ghost">
              <Download className="h-3 w-3" />
              PDF
            </Button>
          </a>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleExport("pdf")}
            disabled={exporting === "pdf"}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            PDF
          </Button>
        )}
      </div>
    </div>
  )
}
