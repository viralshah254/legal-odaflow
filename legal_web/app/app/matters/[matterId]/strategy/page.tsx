"use client"
import { useTranslations } from "next-intl"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import {
  listStrategyMemos,
  createStrategyMemo,
  updateStrategyMemo,
  deleteStrategyMemo,
  type StrategyMemo,
} from "@/lib/api/matter-strategy"
import { autoGenerateStrategyMemo } from "@/lib/api/matter-analysis"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Sparkles, Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X, AlertCircle, Bot, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function StrategyPage() {
  const t = useTranslations("matters")
  const tCommon = useTranslations("common")
  const tErr = useTranslations("errors")
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [generating, setGenerating] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [autoFocusPrompt, setAutoFocusPrompt] = useState("")
  const [showAutoPanel, setShowAutoPanel] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-strategy-matter", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: memos = [], isLoading: memosLoading, error } = useApiData<StrategyMemo[]>(
    ["strategy-memos", activeTenantId, matterId],
    {
      apiFn: () => listStrategyMemos(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const handleGenerate = useCallback(async () => {
    if (!activeTenantId || !matter) return
    setGenerating(true)
    try {
      const memo = await createStrategyMemo(activeTenantId, matterId, {
        title: `Strategy memo — ${format(new Date(), "MMM d, yyyy")}`,
        prompt: `Generate a comprehensive legal strategy memo for: "${matter.title}". Client: ${matter.client?.name ?? "Unknown"}. Practice area: ${matter.practiceArea ?? "General"}. Jurisdiction: ${matter.jurisdiction ?? "Not specified"}. Summary: ${matter.factsSummary ?? "No summary"}. Include: (1) Key legal issues and applicable law, (2) Strongest arguments, (3) Risk factors, (4) Recommended strategy, (5) Next steps.`,
      })
      queryClient.invalidateQueries({ queryKey: ["strategy-memos", activeTenantId, matterId] })
      setExpandedId(memo.id)
      toast({ title: tErr("toast.strategyMemoGenerated") })
    } catch {
      toast({ title: tErr("toast.failedToGenerateMemo"), variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }, [activeTenantId, matter, matterId, queryClient, toast])

  const startEdit = (memo: StrategyMemo) => {
    setEditingId(memo.id)
    setEditContent(memo.content)
    setExpandedId(memo.id)
  }

  const handleSave = async (memoId: string) => {
    if (!activeTenantId) return
    setSavingId(memoId)
    try {
      await updateStrategyMemo(activeTenantId, matterId, memoId, { content: editContent })
      queryClient.invalidateQueries({ queryKey: ["strategy-memos", activeTenantId, matterId] })
      setEditingId(null)
      toast({ title: tErr("toast.memoSaved") })
    } catch {
      toast({ title: tErr("toast.failedToSave"), variant: "destructive" })
    } finally {
      setSavingId(null)
    }
  }

  const handleAutoGenerate = useCallback(async () => {
    if (!activeTenantId) return
    setAutoGenerating(true)
    try {
      const memo = await autoGenerateStrategyMemo(activeTenantId, matterId, autoFocusPrompt ? { focusPrompt: autoFocusPrompt } : undefined)
      queryClient.invalidateQueries({ queryKey: ["strategy-memos", activeTenantId, matterId] })
      setExpandedId(memo.id)
      setShowAutoPanel(false)
      setAutoFocusPrompt("")
      toast({ title: "AI strategy memo generated", description: "Built from matter facts, issues, and jurisdiction context." })
    } catch {
      toast({ title: tErr("toast.failedToGenerateMemo"), variant: "destructive" })
    } finally {
      setAutoGenerating(false)
    }
  }, [activeTenantId, matterId, autoFocusPrompt, queryClient, toast, tErr])

  const handleDelete = async () => {
    if (!activeTenantId || !deleteId) return
    setDeleting(true)
    try {
      await deleteStrategyMemo(activeTenantId, matterId, deleteId)
      queryClient.invalidateQueries({ queryKey: ["strategy-memos", activeTenantId, matterId] })
      toast({ title: tErr("toast.memoDeleted") })
    } catch {
      toast({ title: tErr("toast.failedToDelete"), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  if (matterLoading || !matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId!} showIntelligenceSidebar={false}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{t("strategy_memos")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-generated legal strategy, editable and versioned per matter.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowAutoPanel((v) => !v)}
              disabled={autoGenerating || generating}
              size="sm"
              className="gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" />
              Auto-Generate
            </Button>
            <Button onClick={handleGenerate} disabled={generating || autoGenerating} size="sm" className="gap-1.5">
              {generating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("generating")}</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" />{t("generate_strategy")}</>
              )}
            </Button>
          </div>
        </div>

        {/* Auto-generate panel */}
        {showAutoPanel && (
          <Card className="border-primary/30 bg-primary/[0.02]">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Auto-Generate Strategy from Matter Context
              </div>
              <p className="text-xs text-muted-foreground">
                Uses all matter facts, issues, jurisdiction, and desired outcome to build a comprehensive strategy memo.
              </p>
              <Textarea
                value={autoFocusPrompt}
                onChange={(e) => setAutoFocusPrompt(e.target.value)}
                placeholder="Optional: focus on specific arguments, risks, or procedural aspects…"
                className="min-h-[60px] resize-none text-sm"
              />
              <div className="flex items-center gap-2">
                <Button onClick={handleAutoGenerate} disabled={autoGenerating} size="sm" className="gap-1.5">
                  {autoGenerating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                  ) : (
                    <><Bot className="h-3.5 w-3.5" /> Generate Now</>
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAutoPanel(false)}>Cancel</Button>
                <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Uses matter facts, issues &amp; jurisdiction
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">{t("failed_to_load_memos")}</p>
              <Button variant="outline" size="sm" className="mt-3"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["strategy-memos", activeTenantId, matterId] })}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {memosLoading && !error && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!memosLoading && !error && memos.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-4">
              <Sparkles className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium text-lg">{t("no_strategy_memos_yet")}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Generate an AI strategy memo to get legal theories, risk analysis, recommended approach, and next steps for this matter.
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={generating} size="lg" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate first memo
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Memo list */}
        {memos.map((memo) => {
          const isExpanded = expandedId === memo.id
          const isEditing = editingId === memo.id
          return (
            <Card key={memo.id} className={cn("transition-all", isExpanded && "ring-1 ring-border")}>
              <CardHeader
                className="cursor-pointer rounded-t-xl pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => !isEditing && setExpandedId(isExpanded ? null : memo.id)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(event) => {
                  if (!isEditing && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault()
                    setExpandedId(isExpanded ? null : memo.id)
                  }
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{memo.title || "Strategy memo"}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(memo.createdAt), "MMM d, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={memo.status === "FINAL" ? "default" : "secondary"} className="text-xs">
                      {memo.status}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(memo)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(memo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[400px] text-sm font-mono"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleSave(memo.id)} disabled={savingId === memo.id} className="gap-1.5">
                          {savingId === memo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                      {memo.content}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete_memo")}</DialogTitle>
            <DialogDescription>{t("this_cannot_be_undone")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MatterWorkspaceShell>
  )
}
