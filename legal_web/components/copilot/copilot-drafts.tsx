"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import {
  listCopilotSessions,
  deleteCopilotSession,
  getCopilotSessionMessages,
  type CopilotSessionApi,
  type CopilotChatMessage,
} from "@/lib/api/copilot"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Loader2, Sparkles, Trash2, Copy, RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useUIStore } from "@/lib/store"
import {
  formatSessionTimestamp,
  getFirstUserMessage,
  getLastAssistantMessage,
  getSessionMeta,
  getSessionPreview,
  getSessionSubtitle,
  getSessionTitle,
  stripMarkdownInline,
} from "@/lib/copilot/session-display"

function getDocumentDrafts(sessions: CopilotSessionApi[]): CopilotSessionApi[] {
  return sessions.filter((s) => {
    const msgs = s.messages ?? []
    const hasDocOutput = msgs.some(
      (m) =>
        m.role === "assistant" &&
        (m.content.toLowerCase().includes("draft") ||
          m.content.toLowerCase().includes("dear") ||
          m.content.toLowerCase().includes("subject:")),
    )
    const context = s.context as Record<string, unknown> | null
    const isDraftContext = context?.intent === "DOCUMENT_DRAFT" || context?.type === "DOCUMENT_DRAFT"
    return hasDocOutput || isDraftContext
  })
}

interface CopilotDraftsProps {
  onOpenDraft?: (sessionId: string, messages: CopilotChatMessage[]) => void
}

export default function CopilotDrafts({ onOpenDraft }: CopilotDraftsProps) {
  const t = useTranslations("copilot")
  const tCommon = useTranslations("common")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { setMatterId } = useCopilotContext()
  const { setCopilotDrawerOpen } = useUIStore()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const { data: allSessions = [], isLoading, error, refetch } = useApiData<CopilotSessionApi[]>(
    ["copilot-sessions", activeTenantId],
    {
      apiFn: () => listCopilotSessions(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const drafts = getDocumentDrafts(allSessions)

  const handleCopy = (session: CopilotSessionApi) => {
    const content = getLastAssistantMessage(session) ?? getFirstUserMessage(session)
    if (!content) return
    navigator.clipboard.writeText(content)
    toast({ title: t("copiedToClipboard") })
  }

  const handleOpen = async (session: CopilotSessionApi) => {
    if (!activeTenantId) return
    const ctx = session.context as Record<string, unknown> | null
    const matterId = ctx?.selectedMatterId as string | undefined
    if (matterId) setMatterId(matterId)

    if (!onOpenDraft) return

    setOpeningId(session.id)
    try {
      const messages = await getCopilotSessionMessages(activeTenantId, session.id)
      onOpenDraft(session.id, messages)
    } catch {
      toast({ title: t("somethingWentWrong"), variant: "destructive" })
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = async () => {
    if (!activeTenantId || !deleteConfirmId) return
    setDeleting(true)
    try {
      await deleteCopilotSession(activeTenantId, deleteConfirmId)
      queryClient.invalidateQueries({ queryKey: ["copilot-sessions", activeTenantId] })
      toast({ title: t("draftDeleted") })
      setDeleteConfirmId(null)
    } catch {
      toast({ title: t("failedToDeleteDraft"), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="text-destructive font-medium mb-1">{t("failed_to_load_drafts")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {tCommon("retry")}
        </Button>
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="py-10 text-center space-y-4 px-3">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <p className="font-medium mb-1">{t("no_ai_drafts_yet")}</p>
          <p className="text-sm text-muted-foreground">{t("draftsEmptyHint")}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("quick_starts")}</p>
          <div className="flex flex-col gap-2 items-center">
            {[
              t("quickStartDraftStatus"),
              t("quickStartDemandLetter"),
              t("quickStartSettlement"),
            ].map((prompt) => (
              <button
                key={prompt}
                className="text-sm text-primary hover:underline"
                onClick={() => setCopilotDrawerOpen(true)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("draftCount", { count: drafts.length })}</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {t("refresh")}
        </Button>
      </div>

      {drafts.map((session) => {
        const title = getSessionTitle(session, t("draftUntitled"))
        const subtitle = getSessionSubtitle(session)
        const preview = getSessionPreview(session, t("noContent"))
        const { matter, client } = getSessionMeta(session)

        return (
          <Card key={session.id} className="group hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm leading-snug line-clamp-2">{title}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatSessionTimestamp(session.updatedAt)}
                    </span>
                  </div>

                  {(matter || client) && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {matter && (
                        <Badge variant="secondary" className="text-[11px] font-normal max-w-full truncate">
                          {matter}
                        </Badge>
                      )}
                      {client && (
                        <Badge variant="outline" className="text-[11px] font-normal max-w-full truncate">
                          {client}
                        </Badge>
                      )}
                    </div>
                  )}

                  {subtitle && (
                    <p className="text-xs text-muted-foreground mb-1.5 line-clamp-1">
                      <span className="font-medium text-foreground/70">{t("draftOutputLabel")}:</span>{" "}
                      {stripMarkdownInline(subtitle)}
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>

                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleOpen(session)}
                      disabled={openingId === session.id}
                    >
                      {openingId === session.id && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      {t("openDraft")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleCopy(session)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      {t("copyDraft")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive ml-auto"
                      onClick={() => setDeleteConfirmId(session.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete_draft")}</DialogTitle>
            <DialogDescription>{t("deleteDraftConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
