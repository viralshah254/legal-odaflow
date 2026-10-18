"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  getThread,
  listInboxThreads,
  postMessage,
  type InboxThread,
} from "@/lib/api/inbox"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { formatDate } from "@/lib/utils"
import { Inbox, Loader2, Mail, Search } from "lucide-react"

export default function InboxPage() {
  const t = useTranslations("lawyer")
  const router = useRouter()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)

  const { data: threads = [], isLoading, error, refetch } = useApiData<InboxThread[]>(
    ["inbox-threads", activeTenantId],
    {
      apiFn: () => listInboxThreads(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: selectedThread, isLoading: threadLoading } = useApiData(
    ["inbox-thread", activeTenantId, selectedThreadId],
    {
      apiFn: () => getThread(activeTenantId!, selectedThreadId!),
      enabled: !!activeTenantId && !!selectedThreadId,
    },
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return threads
    return threads.filter(
      (t) =>
        t.subject?.toLowerCase().includes(q) ||
        t.channel.toLowerCase().includes(q) ||
        t.messages?.[0]?.body.toLowerCase().includes(q),
    )
  }, [threads, searchQuery])

  const handleSendReply = async () => {
    if (!activeTenantId || !selectedThreadId || !replyBody.trim()) return
    setSending(true)
    try {
      await postMessage(activeTenantId, selectedThreadId, {
        direction: "OUTBOUND",
        body: replyBody.trim(),
      })
      setReplyBody("")
      await queryClient.invalidateQueries({ queryKey: ["inbox-thread", activeTenantId, selectedThreadId] })
      await queryClient.invalidateQueries({ queryKey: ["inbox-threads", activeTenantId] })
    } finally {
      setSending(false)
    }
  }

  if (!activeTenantId) {
    return <PageSkeleton rows={6} />
  }

  if (isLoading) return <PageSkeleton rows={6} />
  if (error) {
    return (
      <ErrorState
        title={t("could_not_load_inbox")}
        message={error.message}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE", "PARALEGAL"]}>
      <div className="p-6 space-y-6" data-tour="inbox-list">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6" />
            Unified inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Client and portal messages across matters in one thread view.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search_threads")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={t("no_inbox_threads")}
            description={t("portal_and_client_messages_will_appear_when_synced")}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((thread) => {
              const preview = thread.messages?.[0]
              return (
                <Card
                  key={thread.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setSelectedThreadId(thread.id)}
                >
                  <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium truncate">
                          {thread.subject ?? "No subject"}
                        </p>
                        <Badge variant="outline">{thread.channel}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {preview?.body ?? "No messages yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-sm text-muted-foreground">
                      {thread.matterId && (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/app/matters/${thread.matterId}`)
                          }}
                        >
                          View matter
                        </Button>
                      )}
                      <span>
                        {thread.lastMessageAt
                          ? formatDate(thread.lastMessageAt)
                          : formatDate(thread.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <Dialog open={!!selectedThreadId} onOpenChange={(open) => !open && setSelectedThreadId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedThread?.subject ?? "Thread"}</DialogTitle>
            </DialogHeader>
            {threadLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {(selectedThread?.messages ?? []).map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-3 text-sm ${
                        msg.direction === "OUTBOUND" ? "ml-8 bg-primary/5" : "mr-8 bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {msg.direction}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  ))}
                  {(selectedThread?.messages ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No messages in this thread yet.
                    </p>
                  )}
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Textarea
                    placeholder={t("write_a_reply")}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={() => void handleSendReply()}
                    disabled={sending || !replyBody.trim()}
                  >
                    {sending ? "Sending…" : "Send reply"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
