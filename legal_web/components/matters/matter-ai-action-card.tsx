"use client"
import { useTranslations } from "next-intl"

import { useState, useCallback, useEffect } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useQueryClient } from "@tanstack/react-query"
import { sendCopilotMessage } from "@/lib/api/copilot"
import { generateBillingNarrative } from "@/lib/api/office"
import { createTask } from "@/lib/api/tasks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  CheckSquare,
  Clock,
  Mail,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"

function AiProgressSteps({ active }: { active: boolean }) {
  const t = useTranslations("matters")
  const steps = [
    t("ai_progress_reading"),
    t("ai_progress_retrieving"),
    t("ai_progress_analysing"),
    t("ai_progress_generating"),
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!active) {
      setStep(0)
      return
    }
    const id = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s))
    }, 2200)
    return () => clearInterval(id)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null

  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((label, i) => (
        <div
          key={label}
          className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${
            i < step
              ? "text-muted-foreground opacity-50"
              : i === step
              ? "text-foreground font-medium"
              : "text-muted-foreground opacity-30"
          }`}
        >
          {i < step ? (
            <span className="text-primary">✓</span>
          ) : i === step ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
          ) : (
            <span className="w-3 h-3 shrink-0" />
          )}
          {label}
        </div>
      ))}
    </div>
  )
}

interface ProposedTask {
  title: string
  description?: string
  priority?: string
}

interface MatterAIActionCardProps {
  matterId: string
  clientId?: string
  matterTitle: string
  tenantId?: string
}

type ActionId = "draft-update" | "suggest-tasks" | "billing-narrative"

interface ActionState {
  loading: boolean
  result: string | null
  error: string | null
  proposedTasks?: ProposedTask[]
  creatingTasks?: boolean
}

function parseProposedTasks(content: string): ProposedTask[] {
  const lines = content.split("\n")
  const tasks: ProposedTask[] = []
  for (const line of lines) {
    const match = line.match(/^(?:\d+\.|-|\*)\s+(.+)/)
    if (match) {
      tasks.push({ title: match[1].replace(/\*\*/g, "").trim() })
    }
  }
  return tasks.slice(0, 10)
}

const COLLAPSE_STORAGE_KEY = "matter-ai-card-collapsed"

function getInitialCollapsed(matterId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw) as Record<string, number>
    const visits = data[matterId] ?? 0
    return visits >= 3
  } catch {
    return false
  }
}

function recordVisit(matterId: string): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    const data: Record<string, number> = raw ? JSON.parse(raw) : {}
    data[matterId] = (data[matterId] ?? 0) + 1
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function MatterAIActionCard({ matterId, clientId, matterTitle }: MatterAIActionCardProps) {
  const t = useTranslations("matters")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { gate, handleApiError } = useInsufficientCreditsGate({
    feature: "drafting",
    tenantId: activeTenantId ?? undefined,
    requiredCredits: FEATURE_CREDIT_COSTS.MATTER_AI_ACTION,
  })

  const [collapsed, setCollapsed] = useState(() => getInitialCollapsed(matterId))
  const [actions, setActions] = useState<Record<ActionId, ActionState>>({
    "draft-update": { loading: false, result: null, error: null },
    "suggest-tasks": { loading: false, result: null, error: null },
    "billing-narrative": { loading: false, result: null, error: null },
  })

  const handleToggle = () => {
    setCollapsed((c) => {
      if (!c) recordVisit(matterId)
      return !c
    })
  }

  const updateAction = useCallback((id: ActionId, patch: Partial<ActionState>) => {
    setActions((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
  }, [])

  const runAction = async (id: ActionId, prompt: string) => {
    if (!activeTenantId) return
    updateAction(id, { loading: true, result: null, error: null })
    try {
      const res = await sendCopilotMessage(activeTenantId, {
        message: prompt,
        context: { matterId, clientId, selectedMatterId: matterId },
      })
      const content = res.message.content
      const hasAsyncWork = res.asyncJobs && res.asyncJobs.length > 0
      const finalContent = hasAsyncWork && (!content || content.trim().length < 10)
        ? "Working on it in the background… Check back shortly."
        : content
      const proposedTasks = id === "suggest-tasks" ? parseProposedTasks(finalContent) : undefined
      updateAction(id, { loading: false, result: finalContent, proposedTasks })
      const charged = (res as { creditsCharged?: number }).creditsCharged
      if (charged) {
        toast({ title: `${charged} ${t("credits_used", { count: charged })}`, duration: 3000 })
      }
    } catch (err) {
      const errorMsg = handleApiError(err, t("ai_response_failed"))
      if (errorMsg !== t("ai_response_failed")) {
        updateAction(id, { loading: false, error: null })
      } else {
        updateAction(id, { loading: false, error: errorMsg })
        toast({ title: t("ai_action_failed"), variant: "destructive" })
      }
    }
  }

  const handleDraftUpdate = () => {
    runAction(
      "draft-update",
      `Please draft a professional client update email for the matter "${matterTitle}". 
Include: current status, recent developments, and next steps. 
Keep it concise and professional (under 200 words).`,
    )
  }

  const handleSuggestTasks = () => {
    runAction(
      "suggest-tasks",
      `Suggest the next 5 actionable tasks for the matter "${matterTitle}". 
Format each task as a numbered list item with a clear, specific action verb. 
Focus on legal workflow: filings, deadlines, client communications, research, and hearings.`,
    )
  }

  const handleBillingNarrative = async () => {
    if (!activeTenantId) return
    updateAction("billing-narrative", { loading: true, result: null, error: null })
    try {
      const res = await generateBillingNarrative(activeTenantId, matterId)
      updateAction("billing-narrative", { loading: false, result: res.narrative })
    } catch (err) {
      const errorMsg = handleApiError(err, t("ai_response_failed"))
      if (errorMsg !== t("ai_response_failed")) {
        updateAction("billing-narrative", { loading: false, error: null })
      } else {
        updateAction("billing-narrative", { loading: false, error: errorMsg })
        toast({ title: t("ai_action_failed"), variant: "destructive" })
      }
    }
  }

  const handleCopyResult = (id: ActionId) => {
    const result = actions[id].result
    if (!result) return
    navigator.clipboard.writeText(result)
    toast({ title: t("copied_to_clipboard") })
  }

  const handleCreateAllTasks = async (id: ActionId) => {
    if (!activeTenantId) return
    const { proposedTasks = [] } = actions[id]
    if (proposedTasks.length === 0) return

    updateAction(id, { creatingTasks: true })
    let created = 0
    try {
      await Promise.all(
        proposedTasks.map(async (t) => {
          await createTask(activeTenantId, {
            title: t.title,
            matterId,
            priority: "Normal",
            status: "Todo",
          })
          created++
        }),
      )
      queryClient.invalidateQueries({ queryKey: ["tasks", activeTenantId, matterId] })
      queryClient.invalidateQueries({ queryKey: ["tasks", activeTenantId] })
      toast({ title: t("tasks_created_count", { count: created }) })
    } catch {
      toast({ title: t("some_tasks_failed"), variant: "destructive" })
    } finally {
      updateAction(id, { creatingTasks: false })
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      {gate}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("ai_actions")}
            <Badge variant="secondary" className="text-xs">{t("powered_by_copilot")}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleToggle} className="h-7 px-2">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4">
          {/* Action: Draft client update */}
          <ActionBlock
            id="draft-update"
            icon={<Mail className="h-4 w-4" />}
            label={t("draft_client_update")}
            description={t("draft_client_update_description")}
            creditCost={FEATURE_CREDIT_COSTS.MATTER_AI_ACTION}
            state={actions["draft-update"]}
            onRun={handleDraftUpdate}
            onCopy={() => handleCopyResult("draft-update")}
            onEdit={(v) => updateAction("draft-update", { result: v })}
          />

          {/* Action: Suggest next tasks */}
          <ActionBlock
            id="suggest-tasks"
            icon={<CheckSquare className="h-4 w-4" />}
            label={t("suggest_next_tasks")}
            description={t("suggest_next_tasks_description")}
            creditCost={FEATURE_CREDIT_COSTS.MATTER_AI_ACTION}
            state={actions["suggest-tasks"]}
            onRun={handleSuggestTasks}
            onCopy={() => handleCopyResult("suggest-tasks")}
            onEdit={(v) => updateAction("suggest-tasks", { result: v })}
            extraAction={
              actions["suggest-tasks"].proposedTasks && actions["suggest-tasks"].proposedTasks.length > 0 ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleCreateAllTasks("suggest-tasks")}
                  disabled={actions["suggest-tasks"].creatingTasks}
                >
                  {actions["suggest-tasks"].creatingTasks ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckSquare className="mr-2 h-3.5 w-3.5" />
                  )}
                  {t("create_all_tasks", { count: actions["suggest-tasks"].proposedTasks.length })}
                </Button>
              ) : null
            }
          />

          {/* Action: Billing narrative */}
          <ActionBlock
            id="billing-narrative"
            icon={<Clock className="h-4 w-4" />}
            label={t("billing_narrative")}
            description={t("billing_narrative_description")}
            creditCost={FEATURE_CREDIT_COSTS.MATTER_AI_ACTION}
            state={actions["billing-narrative"]}
            onRun={handleBillingNarrative}
            onCopy={() => handleCopyResult("billing-narrative")}
            onEdit={(v) => updateAction("billing-narrative", { result: v })}
          />
        </CardContent>
      )}
    </Card>
  )
}

function ActionBlock({
  icon,
  label,
  description,
  creditCost,
  state,
  onRun,
  onCopy,
  onEdit,
  extraAction,
}: {
  id: ActionId
  icon: React.ReactNode
  label: string
  description: string
  creditCost?: number
  state: ActionState
  onRun: () => void
  onCopy: () => void
  onEdit: (v: string) => void
  extraAction?: React.ReactNode
}) {
  const t = useTranslations("matters")
  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground mt-0.5">{icon}</span>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            {creditCost && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">~{creditCost} credits</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={state.result ? "outline" : "default"}
          onClick={onRun}
          disabled={state.loading}
          className="shrink-0"
        >
          {state.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state.result ? (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("regenerate")}
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t("run")}
            </>
          )}
        </Button>
      </div>

      {state.error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{state.error}</p>
      )}

      {state.loading && <AiProgressSteps active={state.loading} />}

      {state.result && (
        <div className="space-y-2">
          <Textarea
            value={state.result}
            onChange={(e) => onEdit(e.target.value)}
            rows={4}
            className="resize-none text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onCopy}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {t("copy")}
            </Button>
            {extraAction}
          </div>
        </div>
      )}
    </div>
  )
}
