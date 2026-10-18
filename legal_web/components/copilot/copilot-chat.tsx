"use client"
import { useTranslations } from "next-intl"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { getCopilotSessionMessages, sendCopilotMessage, buildCopilotContextPayload, approveCopilotAction, rejectCopilotAction } from "@/lib/api/copilot"
import { listAgents } from "@/lib/api/agents"
import type { InternalAgent } from "@/lib/api/types"
import { estimateCreditTask, getCreditWallet } from "@/lib/api/credits"
import Link from "next/link"
import { ApiClientError } from "@/lib/api/client"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal"
import type { CopilotMessage } from "@/lib/types/copilot"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { ContextPills } from "./context-pills"
import { ActionProposalCard } from "./action-proposal-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Zap, Crown, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  KnowledgeSourcePicker,
  DEFAULT_KNOWLEDGE_SOURCES,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import { format } from "date-fns"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRealtimeEvent } from "@/lib/contexts/realtime-context"
import { REALTIME_EVENTS } from "@/lib/realtime/events"
import { useUIStore } from "@/lib/store"

interface CopilotChatProps {
  externalSession?: { id: string; messages: import("@/lib/api/copilot").CopilotChatMessage[] } | null
  onSessionLoaded?: () => void
}

export function CopilotChat({ externalSession, onSessionLoaded }: CopilotChatProps) {
  const t = useTranslations("copilot")
  const { currentUser, currentRole } = useRole()
  const { user } = useAuth()
  const { activeTenantId, activeTenant } = useTenant()
  const { context, hasPermission, canSendCopilotMessages, canOpenCopilot, hasCopilotFeature } = useCopilotContext()
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false)
  const [creditWallet, setCreditWallet] = useState<Awaited<ReturnType<typeof getCreditWallet>> | null>(null)
  const [modelMode, setModelMode] = useState<"AUTO" | "PREMIUM">("AUTO")
  const [premiumModelId, setPremiumModelId] = useState("gpt-4.1")
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null)
  const [usageBlockedReason, setUsageBlockedReason] = useState<string | null>(null)
  const [canSendByCredits, setCanSendByCredits] = useState(true)
  const [agents, setAgents] = useState<InternalAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)
  const scrollRef = useRef<HTMLDivElement>(null)
  const apiSessionIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    setMessages([])
    apiSessionIdRef.current = undefined
    setUsageBlockedReason(null)
    setCanSendByCredits(true)
  }, [activeTenantId])

  // Consume a one-shot prefill prompt (e.g. from the dashboard daily brief).
  const copilotPrompt = useUIStore((state) => state.copilotPrompt)
  const setCopilotPrompt = useUIStore((state) => state.setCopilotPrompt)
  useEffect(() => {
    if (copilotPrompt) {
      setInput(copilotPrompt)
      setCopilotPrompt(null)
    }
  }, [copilotPrompt, setCopilotPrompt])

  // Load external session from History tab
  useEffect(() => {
    if (!externalSession) return
    apiSessionIdRef.current = externalSession.id
    setMessages(
      externalSession.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt),
        citations: m.citations,
        actionProposals: m.actionProposals,
      })),
    )
    onSessionLoaded?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSession])

  useEffect(() => {
    if (!activeTenantId) return
    getCreditWallet(activeTenantId)
      .then((data) => {
        setCreditWallet(data)
        if (data.wallet.aiModelMode) setModelMode(data.wallet.aiModelMode)
        if (data.wallet.premiumModelId) setPremiumModelId(data.wallet.premiumModelId)
      })
      .catch(() => {})
    listAgents(activeTenantId)
      .then(setAgents)
      .catch(() => {})
  }, [activeTenantId])

  useEffect(() => {
    if (!activeTenantId || !canSendCopilotMessages) return
    estimateCreditTask(
      {
        taskType: "LAWYER_MATTER_QA",
        modelMode,
        premiumModelId,
      },
      activeTenantId,
    )
      .then((est) => {
        setEstimatedCredits(est.estimatedCredits)
        setCanSendByCredits(est.sufficient)
        setUsageBlockedReason(est.sufficient ? null : est.blockedReason ?? t("insufficientCredits"))
      })
      .catch(() => {
        setEstimatedCredits(null)
        setCanSendByCredits(true)
        setUsageBlockedReason(null)
      })
  }, [activeTenantId, modelMode, premiumModelId, canSendCopilotMessages])

  const userRole = currentRole ?? "PARTNER_ADMIN"
  const canApprove = hasPermission("canApproveCopilotActions")

  const handleApproveProposal = async (proposal: NonNullable<CopilotMessage["actionProposals"]>[number]) => {
    if (!activeTenantId || !apiSessionIdRef.current) return
    try {
      const updated = await approveCopilotAction(activeTenantId, proposal.id, {
        sessionId: apiSessionIdRef.current,
        toolName: proposal.toolName,
        payload: proposal.payload,
        jobId: proposal.jobId,
      })
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          actionProposals: msg.actionProposals?.map((p) =>
            p.id === proposal.id ? { ...p, ...updated, status: updated.status } : p,
          ),
        })),
      )
    } catch {
      // user can retry from card
    }
  }

  const handleRejectProposal = async (proposal: NonNullable<CopilotMessage["actionProposals"]>[number]) => {
    if (!activeTenantId || !apiSessionIdRef.current) return
    try {
      const updated = await rejectCopilotAction(activeTenantId, proposal.id, {
        sessionId: apiSessionIdRef.current,
        toolName: proposal.toolName,
        payload: proposal.payload,
      })
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          actionProposals: msg.actionProposals?.map((p) =>
            p.id === proposal.id ? { ...p, ...updated, status: "rejected" } : p,
          ),
        })),
      )
    } catch {
      // ignore
    }
  }

  const runApiTurn = async (userContent: string) => {
    if (!hasPermission("canUseCopilotChat") || !activeTenantId || !canSendCopilotMessages || !canSendByCredits) return

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sessionId: apiSessionIdRef.current ?? "api",
      role: "user",
      content: userContent,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const response = await sendCopilotMessage(activeTenantId, {
        message: selectedAgentId ? `@agent ${selectedAgentId} ${userContent}` : userContent,
        sessionId: apiSessionIdRef.current,
        context: {
          ...buildCopilotContextPayload(context, activeTenantId),
          ...(selectedAgentId ? { agentId: selectedAgentId } : {}),
        },
        modelMode,
        premiumModelId,
        knowledgeSources,
      })

      apiSessionIdRef.current = response.sessionId

      const assistantMsg: CopilotMessage = {
        id: response.message.id,
        sessionId: response.sessionId,
        role: response.message.role,
        content: response.message.content,
        createdAt: new Date(response.message.createdAt),
        citations: response.message.citations,
        actionProposals: response.actionProposals ?? response.message.actionProposals,
      }
      setMessages((prev) => [...prev, assistantMsg])
      getCreditWallet(activeTenantId)
        .then((data) => setCreditWallet(data))
        .catch(() => {})
    } catch (err) {
      const insufficient = isInsufficientCreditsError(err)
      const errorMsg: CopilotMessage = {
        id: `err-${Date.now()}`,
        sessionId: apiSessionIdRef.current ?? "api",
        role: "assistant",
        content: insufficient
          ? err instanceof ApiClientError
            ? err.message
            : t("outOfCredits")
          : err instanceof ApiClientError
            ? t("copilotUnreachable", { message: err.message })
            : t("somethingWentWrong"),
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
      if (insufficient) {
        setCanSendByCredits(false)
        setUsageBlockedReason(
          err instanceof ApiClientError ? err.message : t("insufficientCredits"),
        )
        setBuyCreditsOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useRealtimeEvent(REALTIME_EVENTS.COPILOT_MESSAGE_CREATED, async (payload) => {
    if (!activeTenantId || !apiSessionIdRef.current) return
    const sessionId = payload.data?.sessionId as string | undefined
    if (sessionId && sessionId !== apiSessionIdRef.current) return
    try {
      const history = await getCopilotSessionMessages(activeTenantId, apiSessionIdRef.current)
      const latestAssistant = [...history].reverse().find((m) => m.role === "assistant")
      if (!latestAssistant) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === latestAssistant.id)) return prev
        return [
          ...prev,
          {
            id: latestAssistant.id,
            sessionId: latestAssistant.sessionId,
            role: latestAssistant.role,
            content: latestAssistant.content,
            createdAt: new Date(latestAssistant.createdAt),
            citations: latestAssistant.citations,
            actionProposals: latestAssistant.actionProposals,
          },
        ]
      })
    } catch {
      // ignore fetch errors on live update
    }
  })

  const hasEntityContext = !!(
    context.selectedMatterId ||
    context.selectedClientId ||
    context.selectedTaskId ||
    context.selectedInvoiceId
  )
  const canChat = !!activeTenantId && hasPermission("canUseCopilotChat") && canSendCopilotMessages && canSendByCredits
  const canType = !!activeTenantId && hasPermission("canUseCopilotChat") && canSendCopilotMessages

  const firmQuickPrompts = useMemo(
    () => [
      t("quickPromptMorningBrief"),
      t("quickPromptFirmTasks"),
      t("quickPromptFirmUpdate"),
      t("quickPromptOverdueMatters"),
      t("quickPromptAttention"),
    ],
    [t],
  )

  const matterQuickPrompts = useMemo(
    () => [
      t("quickPromptSummarizeMatter"),
      t("quickPromptWhatsMissing"),
      t("quickPromptClientUpdateEmail"),
      t("quickPromptSuggestTasks"),
      t("quickPromptRisks"),
    ],
    [t],
  )

  const clientQuickPrompts = useMemo(
    () => [
      t("quickPromptClientOverview"),
      t("quickPromptKycGaps"),
      t("quickPromptSuggestNext"),
      t("quickPromptWelcomeEmail"),
      t("quickPromptSummarizeMatters"),
    ],
    [t],
  )

  const quickPrompts = context.selectedMatterId
    ? matterQuickPrompts
    : context.selectedClientId
      ? clientQuickPrompts
      : firmQuickPrompts

  const emptyStateContent = () => {
    if (context.selectedMatterId) {
      return {
        title: t("matterCopilotTitle"),
        description: t("matterCopilotDescription"),
      }
    }
    if (context.selectedClientId) {
      return {
        title: t("clientCopilotTitle"),
        description: t("clientCopilotDescription"),
      }
    }
    const firstName = user?.name ? `, ${user.name.split(" ")[0]}` : ""
    return {
      title: t("firmCopilotTitle"),
      description: t("firmCopilotGreeting", { name: firstName }),
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant={modelMode === "AUTO" ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setModelMode("AUTO")}
            >
              <Zap className="h-3 w-3" /> {t("modelAuto")}
            </Button>
            <Button
              type="button"
              variant={modelMode === "PREMIUM" ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setModelMode("PREMIUM")}
            >
              <Crown className="h-3 w-3" /> {t("modelPremium")}
            </Button>
          </div>
          <Link
            href="/app/settings/plan-usage"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("creditsPlanUsage", { count: creditWallet?.wallet.creditsRemaining ?? "—" })}
          </Link>
        </div>
        {modelMode === "PREMIUM" && (
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={premiumModelId}
            onChange={(e) => setPremiumModelId(e.target.value)}
          >
            {(creditWallet?.wallet.availablePremiumModels ?? [{ modelId: "gpt-4.1", label: "GPT-4.1" }]).map(
              (m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.label}
                  {m.estimatedCreditsTypical != null ? ` (~${m.estimatedCreditsTypical} credits/msg)` : ""}
                </option>
              ),
            )}
          </select>
        )}
        {agents.length > 0 && (
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
          >
            <option value="">{t("agentPickerDefault")}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        )}
        {estimatedCredits != null && (
          <p className="text-xs text-muted-foreground">
            {t("creditsPerMessage", {
              count: estimatedCredits,
              model: modelMode === "AUTO" ? creditWallet?.wallet.autoModelName ?? "auto" : premiumModelId,
            })}
          </p>
        )}
        {usageBlockedReason && (
          <p className="text-xs text-destructive">
            {usageBlockedReason}{" "}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setBuyCreditsOpen(true)}
            >
              {t("buyCredits")}
            </button>
          </p>
        )}
        <ContextPills />
        {hasEntityContext && (
          <p className="text-xs text-muted-foreground">
            {t("contextUsageHint")}
          </p>
        )}
        {!hasCopilotFeature && canChat && (
          <p className="text-xs text-muted-foreground">
            {t("planCreditsHint")}{" "}
            <Link href="/app/settings/plan-usage" className="underline hover:text-foreground">
              {t("viewPlanUsage")}
            </Link>
          </p>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0 p-3">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center py-8 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{emptyStateContent().title}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{emptyStateContent().description}</p>
              </div>
              {!activeTenantId && (
                <p className="text-xs text-destructive">{t("select_an_active_firm_tenant_to_use_copilot")}</p>
              )}
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {msg.role === "assistant" ? (
                  <div
                    className={cn(
                      "prose prose-sm dark:prose-invert max-w-none text-sm",
                      "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                      "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1",
                      "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-2 [&_h3]:mb-1",
                      "[&_ul]:my-1 [&_li]:my-0.5 [&_hr]:my-2",
                      "[&_p]:text-sm [&_p]:leading-relaxed",
                    )}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-2">
                    <p className="font-medium">{t("citations_panel")}</p>
                    <ul className="space-y-1">
                      {msg.citations.map((citation) => (
                        <li key={`${msg.id}-${citation.id}`}>
                          <span className="font-medium">{citation.label}</span>
                          <span className="text-muted-foreground"> · {citation.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {msg.actionProposals?.map((proposal) => (
                  <div key={proposal.id} className="mt-3">
                    <ActionProposalCard
                      proposal={proposal}
                      canApprove={canApprove}
                      onApprove={() => void handleApproveProposal(proposal)}
                      onReject={() => void handleRejectProposal(proposal)}
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
                {t("thinking")}
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      <div className="p-3 border-t space-y-2">
        <KnowledgeSourcePicker
          selected={knowledgeSources}
          onChange={setKnowledgeSources}
          countryCode={context.countryCode}
          compact
        />
        <LegalDisclaimer
          variant="compact"
          disclaimerVariant="attorney"
          showCitationNotice
          className="mb-1"
        />
        <div className="flex gap-2 flex-wrap">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => void runApiTurn(prompt)}
              disabled={loading || !canType}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={canSendByCredits ? t("askCopilotPlaceholder") : t("buyCreditsToContinue")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (input.trim()) void runApiTurn(input.trim())
              }
            }}
            className="flex-1"
            disabled={!canType}
          />
          <Button
            size="icon"
            onClick={() => input.trim() && void runApiTurn(input.trim())}
            disabled={loading || !input.trim() || !canChat}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <BuyCreditsModal
        open={buyCreditsOpen}
        onOpenChange={setBuyCreditsOpen}
        packs={creditWallet?.packs ?? []}
        countryCode={activeTenant?.tenant.primaryCountry ?? "US"}
        tenantId={activeTenantId ?? undefined}
      />
    </div>
  )
}
