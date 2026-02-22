"use client"

import { useState, useEffect } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { getOrCreateCurrentSession, getMessagesForSession } from "@/lib/mock/copilot"
import type { CopilotMessage } from "@/lib/types/copilot"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"

export function CopilotHistory() {
  const { currentUser, currentRole } = useRole()
  const { context } = useCopilotContext()
  const [messages, setMessages] = useState<CopilotMessage[]>([])

  useEffect(() => {
    const userId = currentUser?.id ?? "1"
    const session = getOrCreateCurrentSession(userId, currentRole ?? "PARTNER_ADMIN", "tenant-1", context)
    setMessages(getMessagesForSession(session.id))
  }, [currentUser?.id, currentRole, context])

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <span className="text-sm font-medium">History</span>
        <p className="text-xs text-muted-foreground mt-0.5">Past prompts and responses in this session.</p>
      </div>
      <ScrollArea className="flex-1 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No messages in this session yet.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg) => (
              <li key={msg.id} className="border-b pb-3 last:border-0">
                <p className="text-xs text-muted-foreground">
                  {msg.role === "user" ? "You" : "Copilot"} · {format(msg.createdAt, "PPp")}
                </p>
                <p className="text-sm mt-1 line-clamp-2">{msg.content}</p>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
