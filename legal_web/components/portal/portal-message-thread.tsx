"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  listPortalMessages,
  markPortalMessageRead,
  replyPortalMessage,
  type PortalMessage,
} from "@/lib/api/portal"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Send } from "lucide-react"

type PortalMessageThreadProps = {
  initialMessages: PortalMessage[]
  matterId?: string
}

function groupBySubject(messages: PortalMessage[]) {
  const threads = new Map<string, PortalMessage[]>()
  for (const message of messages) {
    const key = message.subject.trim().toLowerCase()
    const list = threads.get(key) ?? []
    list.push(message)
    threads.set(key, list)
  }
  return Array.from(threads.entries()).map(([key, items]) => ({
    key,
    subject: items[0]?.subject ?? key,
    messages: items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  }))
}

export function PortalMessageThread({ initialMessages, matterId }: PortalMessageThreadProps) {
  const t = useTranslations("portal")
  const tCommon = useTranslations("portal")
  const tLawyer = useTranslations("portal")
  const queryClient = useQueryClient()
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [replySubject, setReplySubject] = useState("")
  const [replyBody, setReplyBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const { data: messages = initialMessages, isLoading } = useQuery({
    queryKey: ["portal-messages", matterId],
    queryFn: () => listPortalMessages(matterId),
    initialData: initialMessages,
  })

  const threads = useMemo(() => groupBySubject(messages), [messages])
  const activeThread =
    threads.find((thread) => thread.subject === activeSubject) ?? threads[0] ?? null

  const handleOpenThread = async (subject: string) => {
    setActiveSubject(subject)
    setReplySubject(subject)
    const thread = threads.find((item) => item.subject === subject)
    if (!thread) return

    await Promise.all(
      thread.messages
        .filter((message) => message.fromFirm && !message.readAt)
        .map((message) => markPortalMessageRead(message.id).catch(() => undefined)),
    )
    queryClient.invalidateQueries({ queryKey: ["portal-messages", matterId] })
    queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] })
  }

  const handleReply = async () => {
    if (!replySubject.trim() || !replyBody.trim()) return
    setSubmitting(true)
    try {
      await replyPortalMessage({
        subject: replySubject.trim(),
        body: replyBody.trim(),
        matterId,
      })
      setReplyBody("")
      queryClient.invalidateQueries({ queryKey: ["portal-messages", matterId] })
      queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (threads.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t("no_messages_yet")}</p>
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        {threads.map((thread) => {
          const unread = thread.messages.some((m) => m.fromFirm && !m.readAt)
          return (
            <button
              key={thread.key}
              type="button"
              onClick={() => handleOpenThread(thread.subject)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                activeThread?.subject === thread.subject ? "bg-accent" : "hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">{thread.subject}</p>
                {unread && <Badge variant="destructive">{tCommon("new")}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}
              </p>
            </button>
          )
        })}
      </div>

      {activeThread && (
        <div className="space-y-4">
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {activeThread.messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border p-3 ${
                  message.fromFirm ? "bg-muted/30" : "bg-primary/5 ml-6"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="outline">
                    {message.fromFirm ? "From firm" : "You"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                {message.fromFirm && message.readAt && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Read {format(new Date(message.readAt), "MMM d, h:mm a")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="reply-subject">{t("reply_subject")}</Label>
              <Input
                id="reply-subject"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reply-body">{tLawyer("message")}</Label>
              <Textarea
                id="reply-body"
                rows={3}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={t("write_your_reply")}
              />
            </div>
            <Button onClick={handleReply} disabled={submitting || !replyBody.trim()}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send reply
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
