"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { sanitizeDocumentHtml } from "@/lib/security/sanitize-html"
import {
  analyzeDraftingSession,
  editDraftingSession,
  exportDraftingSession,
  finalizeDraftingSession,
  getDraftingSession,
  importDraftingDocument,
} from "@/lib/api/drafting-session"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

const EDIT_PRESETS = [
  { label: "Make formal", instruction: "Rewrite this in a more formal legal tone" },
  { label: "Strengthen", instruction: "Strengthen the legal language and add more protective clauses" },
  { label: "Simplify", instruction: "Simplify the language to be clearer and easier to understand" },
  { label: "Add heading", instruction: "Add a proper section heading here" },
  { label: "Translate to English", instruction: "Translate this passage to plain English" },
]

const ACCEPTED_FORMATS = [
  { ext: "DOCX", mime: ".doc,.docx" },
  { ext: "PDF", mime: ".pdf" },
  { ext: "TXT", mime: ".txt" },
  { ext: "MD", mime: ".md" },
]

function EditPageInner() {
  const t = useTranslations("drafting")
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const { setContext } = useCopilotContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sessionIdParam = searchParams.get("sessionId")
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam)
  const [html, setHtml] = useState("")
  const [editInstruction, setEditInstruction] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState("")
  const [matterId, setMatterId] = useState("")
  const [savedDocId, setSavedDocId] = useState<string | null>(null)
  const [creditsUsed, setCreditsUsed] = useState(0)
  const [lastExplanation, setLastExplanation] = useState<string | null>(null)

  useEffect(() => {
    setContext({ page: "document-drafting-studio", intent: "DOCUMENT_EDIT" })
  }, [setContext])

  const { data: session, refetch } = useQuery({
    queryKey: ["drafting-session", activeTenantId, sessionId],
    queryFn: () => getDraftingSession(activeTenantId!, sessionId!),
    enabled: Boolean(activeTenantId && sessionId),
  })

  const { data: clients } = useQuery({
    queryKey: ["clients", activeTenantId],
    queryFn: () => listClients(activeTenantId!),
    enabled: Boolean(activeTenantId),
  })

  const { data: matters } = useQuery({
    queryKey: ["matters", activeTenantId],
    queryFn: () => listMatters(activeTenantId!),
    enabled: Boolean(activeTenantId),
  })

  useEffect(() => {
    if (session?.workingHtml) {
      setHtml(sanitizeDocumentHtml(session.workingHtml))
    }
  }, [session])

  const handleUpload = useCallback(
    async (file: File) => {
      if (!activeTenantId) return
      setUploading(true)
      setError(null)
      try {
        const created = await importDraftingDocument(activeTenantId, file)
        setSessionId(created.id)
        router.replace(`/app/document-drafting/edit?sessionId=${created.id}`, { scroll: false })
        void analyzeDraftingSession(activeTenantId, created.id).then(() => refetch())
      } catch (e) {
        setError(e instanceof Error ? e.message : t("edit.uploadFailed"))
      } finally {
        setUploading(false)
      }
    },
    [activeTenantId, router, refetch, t],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleUpload(file)
    },
    [handleUpload],
  )

  const handleSelectionEdit = async () => {
    if (!activeTenantId || !sessionId || !editInstruction.trim()) return
    setLoading(true)
    setError(null)
    setLastExplanation(null)
    try {
      const result = await editDraftingSession(activeTenantId, sessionId, {
        instruction: editInstruction,
        selectedText: selectedText || undefined,
      })
      if (result.workingHtml) {
        setHtml(sanitizeDocumentHtml(result.workingHtml))
      }
      if (result.creditsUsed) {
        setCreditsUsed((prev) => prev + result.creditsUsed!)
        invalidateCreditWalletQueries(queryClient, activeTenantId)
      }
      if (result.explanation) {
        setLastExplanation(result.explanation)
      }
      setEditInstruction("")
      setSelectedText("")
      void refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("edit.editFailed"))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!activeTenantId || !sessionId) return
    setLoading(true)
    try {
      const result = await finalizeDraftingSession(activeTenantId, sessionId, {
        clientId: clientId || undefined,
        matterId: matterId || undefined,
        fileName: session?.sourceFileName?.replace(/\.[^.]+$/, "") || "Edited document",
        actions: ["save"],
      })
      setSavedDocId(result.documentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("edit.saveFailed"))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: "docx" | "pdf") => {
    if (!activeTenantId || !sessionId) return
    setLoading(true)
    try {
      const result = await exportDraftingSession(activeTenantId, sessionId, format)
      window.open(result.url, "_blank")
    } catch (e) {
      setError(e instanceof Error ? e.message : t("edit.exportFailed"))
    } finally {
      setLoading(false)
    }
  }

  if (!activeTenantId) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/app/legal-forms"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Legal Forms
        </Link>
        {sessionId && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replace document
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS.map((f) => f.mime).join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
          }}
        />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Attach &amp; edit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a Word doc or PDF, edit with AI, then save or export.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Pre-upload dropzone */}
      {!sessionId ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative cursor-pointer rounded-2xl border-2 border-dashed transition-all",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20",
          )}
        >
          {uploading && (
            <div className="absolute inset-0 rounded-2xl bg-background/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Processing document…</p>
                <Skeleton className="h-2 w-48 rounded-full" />
              </div>
            </div>
          )}

          <div className="py-16 px-8 flex flex-col items-center text-center gap-5">
            <div className={cn(
              "rounded-2xl p-5 transition-colors",
              isDragging ? "bg-primary/15" : "bg-muted/60",
            )}>
              <Upload className={cn(
                "h-10 w-10 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground",
              )} />
            </div>

            <div className="space-y-1.5">
              <p className="text-base font-semibold">
                {isDragging ? "Drop your document here" : "Upload a document to edit"}
              </p>
              <p className="text-sm text-muted-foreground">
                Drag &amp; drop, or click to browse
              </p>
            </div>

            {/* Format pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ACCEPTED_FORMATS.map((f) => (
                <span
                  key={f.ext}
                  className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {f.ext}
                </span>
              ))}
              <span className="text-xs text-muted-foreground">— max 20 MB</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px w-12 bg-border" />
              or
              <span className="h-px w-12 bg-border" />
            </div>

            <Button variant="outline" size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); router.push("/app/legal-forms") }}>
              <Sparkles className="h-3.5 w-3.5" />
              Draft a new document with AI instead
            </Button>
          </div>
        </div>
      ) : (
        /* Active editor */
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Document panel */}
          <div className="lg:col-span-2 space-y-3">
            {/* Filename + credits bar */}
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm font-medium truncate">
                  {session?.sourceFileName ?? "Document"}
                </p>
              </div>
              {creditsUsed > 0 && (
                <Badge variant="secondary" className="shrink-0 gap-1 text-[11px]">
                  <Zap className="h-3 w-3" />
                  {creditsUsed} credit{creditsUsed !== 1 ? "s" : ""} used
                </Badge>
              )}
            </div>

            {/* Selection banner */}
            {selectedText && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                <p className="text-xs text-primary leading-snug">
                  <span className="font-medium">Editing selection:</span>{" "}
                  &ldquo;{selectedText.length > 100 ? selectedText.slice(0, 100) + "…" : selectedText}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedText("")}
                  className="ml-auto shrink-0 text-[10px] text-primary/60 hover:text-primary"
                >
                  Clear
                </button>
              </div>
            )}

            {/* HTML document preview */}
            <Card>
              <CardContent className="p-0">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-xl p-5 min-h-[400px] max-h-[600px] overflow-y-auto bg-background selection:bg-primary/20"
                  dangerouslySetInnerHTML={{ __html: html }}
                  onMouseUp={() => {
                    const sel = window.getSelection()?.toString().trim()
                    if (sel && sel.length > 1) setSelectedText(sel)
                  }}
                />
              </CardContent>
            </Card>

            {/* Explanation toast */}
            {lastExplanation && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-snug">
                  {lastExplanation}
                </p>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* AI edit panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI edit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  {EDIT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setEditInstruction(preset.instruction)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        editInstruction === preset.instruction
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <Textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  rows={4}
                  placeholder={
                    selectedText
                      ? "Instruction for the selected passage…"
                      : "Instruction for the whole document…"
                  }
                  className="resize-none text-sm"
                />


                <Button
                  className="w-full gap-2"
                  disabled={loading || !editInstruction.trim()}
                  onClick={() => void handleSelectionEdit()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Apply AI edit
                </Button>
              </CardContent>
            </Card>

            {/* Save & export panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Save &amp; export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Link client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={matterId} onValueChange={setMatterId}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Link matter (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No matter</SelectItem>
                    {(matters ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button className="w-full gap-2" disabled={loading} onClick={() => void handleSave()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save to Documents
                </Button>

                {savedDocId && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Saved successfully
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    disabled={loading}
                    onClick={() => void handleExport("docx")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    DOCX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    disabled={loading}
                    onClick={() => void handleExport("pdf")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DocumentDraftingEditPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <EditPageInner />
    </Suspense>
  )
}
