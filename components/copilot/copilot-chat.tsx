"use client"

import { useState, useRef, useEffect } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import {
  getOrCreateCurrentSession,
  addMessage,
  getMessagesForSession,
  summarizeMatter,
  summarizeClient,
  draftEmail,
  proposeTasks,
  getMissingItems,
  getMatterKickoff,
} from "@/lib/mock/copilot"
import type { CopilotMessage } from "@/lib/types/copilot"
import { ContextPills } from "./context-pills"
import { ActionProposalCard } from "./action-proposal-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

const QUICK_PROMPTS = [
  "Summarize this matter",
  "What's missing?",
  "Matter kickoff plan",
  "Draft a client update email",
  "Suggest next tasks",
]

export function CopilotChat() {
  const { currentUser, currentRole } = useRole()
  const { context, hasPermission } = useCopilotContext()
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)

  const userId = currentUser?.id ?? "1"
  const userRole = currentRole ?? "PARTNER_ADMIN"
  const tenantId = "tenant-1"
  const canApprove = hasPermission("canApproveCopilotActions")

  useEffect(() => {
    const session = getOrCreateCurrentSession(userId, userRole, tenantId, context)
    sessionIdRef.current = session.id
    setMessages(getMessagesForSession(session.id))
  }, [userId, userRole, context.selectedMatterId, context.selectedClientId])

  const sessionId = sessionIdRef.current

  const runTurn = (userContent: string) => {
    if (!sessionId || !hasPermission("canUseCopilotChat")) return
    addMessage(sessionId, "user", userContent)
    setMessages(getMessagesForSession(sessionId))
    setInput("")
    setLoading(true)

    // Smart mock: respond from real data based on prompt and context
    setTimeout(() => {
      const lower = userContent.toLowerCase()
      let assistantContent = ""
      let actionProposals: CopilotMessage["actionProposals"]
      let citations: CopilotMessage["citations"]

      if (lower.includes("summarize") && context.selectedMatterId) {
        const res = summarizeMatter(context.selectedMatterId)
        assistantContent = res.summary
        citations = res.citations
      } else if (lower.includes("summarize") && context.selectedClientId) {
        const res = summarizeClient(context.selectedClientId)
        assistantContent = res.summary
        citations = res.citations
      } else if (
        (lower.includes("missing") || lower.includes("what's missing") || lower.includes("whats missing") || lower.includes("gaps")) &&
        (context.selectedMatterId || context.selectedClientId)
      ) {
        const res = getMissingItems({
          matterId: context.selectedMatterId,
          clientId: context.selectedClientId,
        })
        assistantContent = res.summary
        citations = res.citations
      } else if (
        (lower.includes("kickoff") || lower.includes("kick off") || lower.includes("30/60/90") || lower.includes("plan") && lower.includes("matter")) &&
        context.selectedMatterId
      ) {
        const kickoff = getMatterKickoff(context.selectedMatterId)
        assistantContent =
          `**Matter kickoff: ${kickoff.overview}**\n\n` +
          `**30-day plan:**\n${kickoff.plan30.map((s) => "• " + s).join("\n")}\n\n` +
          `**60-day plan:**\n${kickoff.plan60.map((s) => "• " + s).join("\n")}\n\n` +
          `**90-day plan:**\n${kickoff.plan90.map((s) => "• " + s).join("\n")}\n\n` +
          `**Risks:** ${kickoff.risks.join(" ")}\n\n` +
          `**Engagement letter outline:**\n${kickoff.engagementOutline}`
        citations = kickoff.citations
      } else if (lower.includes("email") || lower.includes("draft")) {
        const res = draftEmail({
          matterId: context.selectedMatterId,
          clientId: context.selectedClientId,
          purpose: "update",
        })
        assistantContent = `**Draft email**\n\nSubject: ${res.subject}\n\n${res.body}`
      } else if (lower.includes("task") || lower.includes("suggest") || lower.includes("next")) {
        const res = proposeTasks({
          matterId: context.selectedMatterId,
          clientId: context.selectedClientId,
          count: 5,
        })
        assistantContent =
          "**Suggested next tasks** (based on matter stage and existing tasks):\n\n" +
          res.tasks.map((t, i) => `${i + 1}. ${t.title} (due in ${t.dueDays} days, ${t.priority})${t.description ? ` — ${t.description}` : ""}`).join("\n")
        citations = res.citations
        actionProposals = [
          {
            id: `prop-${Date.now()}`,
            label: "Create these tasks",
            description: "Add the suggested tasks to the matter.",
            toolName: "createTasks",
            payload: { tasks: res.tasks },
            affectedRecords: context.selectedMatterId ? [{ type: "matter", id: context.selectedMatterId, label: "Current matter" }] : [],
            reasoning: "Based on matter stage and existing workload.",
            requiresApproval: !canApprove,
            status: "proposed",
          },
        ]
      } else if (!hasContext && (lower.includes("summarize") || lower.includes("missing") || lower.includes("kickoff"))) {
        assistantContent =
          "I need context to answer that. Open a **matter** or **client** page (e.g. click a matter from Matters or a client from Clients), then open Copilot again. I'll automatically use that context for summaries, what's missing, and kickoff plans."
      } else {
        assistantContent =
          "I can:\n\n• **Summarize** the current matter or client (open a matter/client page first)\n• **What's missing?** — KYC, overdue tasks, overdue invoices\n• **Matter kickoff plan** — 30/60/90 day plan and engagement outline\n• **Draft a client email** — personalised to matter/client\n• **Suggest next tasks** — based on matter stage and existing tasks\n\nUse the quick prompts or type your question."
      }

      addMessage(sessionId, "assistant", assistantContent, {
        actionProposals,
        citations,
      })
      setMessages(getMessagesForSession(sessionId))
      setLoading(false)
    }, 600)
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (!sessionId) return null

  const hasContext = !!(context.selectedMatterId || context.selectedClientId)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <ContextPills />
        {hasContext && (
          <p className="text-xs text-muted-foreground">
            Copilot is using this context for summaries, suggestions, and drafts.
          </p>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0 p-3">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {hasContext
                ? "Ask a question or use a quick prompt. I'll use the current matter/client to give you relevant answers."
                : "Open a matter or client page so I can use that context, or ask a general question."}
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "assistant" && msg.content.includes("**") ? (
                  <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                    {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={i}>{part.slice(2, -2)}</strong>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs">
                    Sources: {msg.citations.map((c) => c.label).join(", ")}
                  </div>
                )}
                {msg.actionProposals?.map((proposal) => (
                  <div key={proposal.id} className="mt-3">
                    <ActionProposalCard
                      proposal={proposal}
                      canApprove={canApprove}
                      onApprove={() => {
                        // In real impl would call createTasksViaCopilot then update proposal status
                      }}
                    />
                  </div>
                ))}
                <p className="text-xs opacity-70 mt-1">{format(msg.createdAt, "HH:mm")}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                Thinking...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      <div className="p-3 border-t space-y-2">
        <div className="flex gap-2 flex-wrap">
          {QUICK_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => runTurn(prompt)}
              disabled={loading}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ask Copilot..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (input.trim()) runTurn(input.trim())
              }
            }}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={() => input.trim() && runTurn(input.trim())}
            disabled={loading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
