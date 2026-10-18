"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  clearLegacyPortalStorage,
  getPortalSessionInfo,
  clearPortalSession,
} from "@/lib/portal/portal-session"
import { getPortalDashboard, uploadDocumentForRequest } from "@/lib/api/portal"
import { formatCurrencyWithSymbol } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { format } from "date-fns"
import { FileText, FolderOpen, Receipt, MessageSquare, LogOut, Download, Scale, Upload, ShieldCheck, CreditCard, Lock, Loader2, CheckSquare, Send, CalendarClock, MessageCircle } from "lucide-react"
import { PortalMatterOutlook } from "@/components/portal/portal-matter-outlook"
import { PortalMessageThread } from "@/components/portal/portal-message-thread"
import type { PortalMessage, PortalTask } from "@/lib/api/portal"
import { listPortalTasks, updatePortalTask, addPortalTaskComment } from "@/lib/api/portal"
import { Textarea } from "@/components/ui/textarea"

export default function PortalPage() {
  const toUpperCase = useTranslations("portal")
  const trim = useTranslations("portal")
  const tCommon = useTranslations("common")
  const t = useTranslations("portal")
  const tAuth = useTranslations("auth")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currency } = useCurrency()
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    clearLegacyPortalStorage()
    void getPortalSessionInfo().then((session) => {
      if (!session?.clientId) {
        router.replace("/portal/sign-in")
        return
      }
      setClientId(session.clientId)
    })
  }, [router])

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-dashboard", clientId],
    queryFn: () => getPortalDashboard(),
    enabled: !!clientId,
  })

  const handleSignOut = () => {
    void clearPortalSession().then(() => router.replace("/portal/sign-in"))
  }

  if (!clientId || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">{t("unable_to_load_portal_please_sign_in_again")}</p>
            <Button onClick={handleSignOut}>{tAuth("signIn")}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { client, matters, invoices, documentRequests, messages, sharedDocuments } = data
  const portalMessages: PortalMessage[] = messages.map((message) => ({
    id: message.id,
    clientId: client.id,
    matterId: message.matterId,
    subject: message.subject,
    body: message.body,
    fromFirm: message.fromFirm ?? true,
    readAt: message.readAt,
    createdAt: message.createdAt,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t("client_portal")}</h1>
            <p className="text-sm text-muted-foreground">{client.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {tCommon("signOut")}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("secure_session"), value: t("active"), helper: t("protected_portal_access"), icon: Lock },
            { label: t("messages"), value: messages.length, helper: t("firm_communications"), icon: MessageSquare },
            { label: t("documents"), value: sharedDocuments.length + documentRequests.length, helper: t("shared_and_requested"), icon: FileText },
            { label: t("invoices"), value: invoices.length, helper: t("invoices_and_receipts"), icon: CreditCard },
          ].map(({ label, value, helper, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{helper}</p>
                </div>
                <div className="rounded-full bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-medium">{t("consent-aware_portal")}</span>
            <span className="text-muted-foreground">
              {t("consent_portal_description")}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {t("matter_progress")}
            </CardTitle>
            <CardDescription>{t("current_stage_and_status_for_your_matters")}</CardDescription>
          </CardHeader>
          <CardContent>
            {matters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("no_active_matters")}</p>
            ) : (
              <div className="space-y-4">
                {matters.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-lg border bg-muted/20"
                  >
                    <div>
                      <h3 className="font-semibold">{m.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("reference")}: {m.ref} · {m.practiceArea}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge>{m.stage}</Badge>
                        <Badge variant="outline">{m.status}</Badge>
                      </div>
                      <div className="mt-3">
                        <div className="h-2 w-52 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-2 bg-primary"
                            style={{ width: `${m.progressPercent ?? 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("next_step")}: {m.nextStep ?? t("await_next_update")}
                        </p>
                      </div>
                      <PortalMatterOutlook matterId={m.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t("shared_documents")}
            </CardTitle>
            <CardDescription>{t("documents_your_legal_team_has_shared_with_you")}</CardDescription>
          </CardHeader>
          <CardContent>
            {sharedDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("no_shared_documents_yet")}</p>
            ) : (
              <div className="space-y-2">
                {sharedDocuments.map((doc) => (
                  <div key={doc.id} className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("updated")} {format(new Date(doc.updatedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                        {t("open")}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("unavailable")}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("document_requests")}
            </CardTitle>
            <CardDescription>{t("documents_requested_by_your_legal_team")}</CardDescription>
          </CardHeader>
          <CardContent>
            {documentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("no_document_requests")}
              </p>
            ) : (
              <div className="space-y-3">
                {documentRequests.map((r) => (
                  <PortalDocumentRequestRow
                    key={r.id}
                    request={r}
                    onUploaded={() =>
                      queryClient.invalidateQueries({ queryKey: ["portal-dashboard", clientId] })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t("invoices")}
            </CardTitle>
            <CardDescription>{t("view_and_pay_your_invoices")}</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{tBilling("no_invoices_yet")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">{t("number")}</th>
                      <th className="text-left py-2 font-medium">{tBilling("dueDate")}</th>
                      <th className="text-right py-2 font-medium">{tBilling("amount")}</th>
                      <th className="text-left py-2 font-medium">{tAdmin("status")}</th>
                      <th className="text-right py-2 font-medium">{tAdmin("action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{inv.invoiceNumber}</td>
                        <td className="py-3">{format(new Date(inv.dueDate), "MMM d, yyyy")}</td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrencyWithSymbol(inv.amount, currency)}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              inv.status === "Paid"
                                ? "default"
                                : inv.status === "Overdue"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                            <a
                              href={inv.paymentLink ?? `/pay/${inv.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {t("pay")}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <PortalTasksSection clientId={clientId ?? ""} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t("messages")}
            </CardTitle>
            <CardDescription>{t("secure_messages_from_your_legal_team")}</CardDescription>
          </CardHeader>
          <CardContent>
            <PortalMessageThread initialMessages={portalMessages} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

// ── Portal Tasks Section ──────────────────────────────────────────────────────

function PortalTasksSection({ clientId }: { clientId: string }) {
  const tBilling = useTranslations("billing")
  const t = useTranslations("portal")
  const queryClient = useQueryClient()
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({})

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["portal-tasks", clientId],
    queryFn: listPortalTasks,
    enabled: !!clientId,
  })

  if (isLoading) return null
  if (tasks.length === 0) return null

  function priorityColor(priority: string) {
    const p = priority.toUpperCase()
    if (p === "URGENT" || p === "HIGH") return "destructive" as const
    return "secondary" as const
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      TODO: t("status_todo"),
      IN_PROGRESS: t("status_in_progress"),
      DONE: t("status_done"),
    }
    return map[status.toUpperCase()] ?? status
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    setStatusUpdating((prev) => ({ ...prev, [taskId]: true }))
    try {
      await updatePortalTask(taskId, { status: newStatus })
      queryClient.invalidateQueries({ queryKey: ["portal-tasks", clientId] })
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  async function handleSendComment(taskId: string) {
    const body = commentBody[taskId]?.trim()
    if (!body) return
    setSending((prev) => ({ ...prev, [taskId]: true }))
    try {
      await addPortalTaskComment(taskId, body)
      setCommentBody((prev) => ({ ...prev, [taskId]: "" }))
      queryClient.invalidateQueries({ queryKey: ["portal-tasks", clientId] })
    } finally {
      setSending((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          {t("your_tasks")}
          <Badge variant="secondary" className="ml-1 text-xs">{tasks.length}</Badge>
        </CardTitle>
        <CardDescription>
          {t("tasks_description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task: PortalTask) => {
          const isExpanded = expandedTaskId === task.id
          const isDue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== "DONE" : false
          const isDone = task.status.toUpperCase() === "DONE"

          return (
            <div
              key={task.id}
              className={`rounded-lg border p-4 space-y-3 transition-all ${isDone ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </h3>
                    <Badge variant={priorityColor(task.priority)} className="text-xs">
                      {task.priority}
                    </Badge>
                    <Badge variant={isDone ? "default" : "outline"} className="text-xs">
                      {statusLabel(task.status)}
                    </Badge>
                    {isDue && (
                      <Badge variant="destructive" className="text-xs">{tBilling("overdue")}</Badge>
                    )}
                  </div>
                  {task.matter && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("matter")}: {task.matter.title}
                    </p>
                  )}
                  {task.dueDate && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {t("due")} {format(new Date(task.dueDate), "d MMM yyyy")}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  {isExpanded ? t("close") : t("details")}
                  {task.comments.length > 0 && (
                    <span className="ml-1.5 flex items-center gap-0.5 text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      {task.comments.length}
                    </span>
                  )}
                </Button>
              </div>

              {isExpanded && (
                <div className="space-y-4 border-t pt-3">
                  {task.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        {t("description")}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                    </div>
                  )}

                  {/* Status update */}
                  {!isDone && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{t("update_status")}</p>
                      {["TODO", "IN_PROGRESS", "DONE"].map((s) => (
                        <Button
                          key={s}
                          variant={task.status.toUpperCase() === s ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-7"
                          disabled={statusUpdating[task.id] || task.status.toUpperCase() === s}
                          onClick={() => handleStatusChange(task.id, s)}
                        >
                          {statusLabel(s)}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Comments */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("comments")}
                    </p>
                    {task.comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">{t("no_comments_yet")}</p>
                    ) : (
                      <div className="space-y-2">
                        {task.comments.map((c) => (
                          <div key={c.id} className="rounded-md bg-muted/50 p-2.5 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">
                                {c.authorClientId ? t("you") : t("legal_team")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(c.createdAt), "d MMM, HH:mm")}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{c.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add comment */}
                    <div className="flex gap-2 pt-1">
                      <Textarea
                        placeholder={t("add_a_comment_cmdenter_to_send")}
                        value={commentBody[task.id] ?? ""}
                        onChange={(e) =>
                          setCommentBody((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        rows={2}
                        className="resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            void handleSendComment(task.id)
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={() => void handleSendComment(task.id)}
                        disabled={!commentBody[task.id]?.trim() || sending[task.id]}
                        className="shrink-0 self-end"
                      >
                        {sending[task.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PortalDocumentRequestRow({
  request,
  onUploaded,
}: {
  request: {
    id: string
    title: string
    matterTitle: string
    status: string
    dueDate?: string
    uploadedFileName?: string
  }
  onUploaded: () => void
}) {
  const t = useTranslations("portal")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploaded = request.status === "uploaded" || Boolean(request.uploadedFileName)

  const handleUpload = useCallback(async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fileUrl = URL.createObjectURL(file)
      await uploadDocumentForRequest(request.id, {
        fileName: file.name,
        fileUrl,
        mimeType: file.type || undefined,
      })
      setFile(null)
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("upload_failed"))
    } finally {
      setUploading(false)
    }
  }, [file, onUploaded, request.id])

  return (
    <div className="p-3 rounded-lg border space-y-3">
      <div>
        <p className="font-medium">{request.title}</p>
        <p className="text-sm text-muted-foreground">{request.matterTitle}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant={uploaded ? "default" : "secondary"}>{request.status}</Badge>
          {request.dueDate ? (
            <span className="text-xs text-muted-foreground">
              {t("due")} {format(new Date(request.dueDate), "MMM d, yyyy")}
            </span>
          ) : null}
          {request.uploadedFileName ? (
            <span className="text-xs text-muted-foreground">
              {t("uploaded")}: {request.uploadedFileName}
            </span>
          ) : null}
        </div>
      </div>

      {!uploaded && (
        <div className="space-y-2">
          <Label htmlFor={`upload-${request.id}`} className="text-sm">
            {t("upload_requested_document")}
          </Label>
          <Input
            id={`upload-${request.id}`}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            size="sm"
            disabled={!file || uploading}
            onClick={() => void handleUpload()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {t("submit_document")}
          </Button>
        </div>
      )}
    </div>
  )
}
