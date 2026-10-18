"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Plus, GripVertical } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  createCopilotPlan,
  executeCopilotPlan,
  listCopilotPlans,
  updateCopilotPlanSteps,
  type CopilotPlan,
} from "@/lib/api/copilot-plans"
import { createTask } from "@/lib/api/tasks"

export function CopilotWork() {
  const t = useTranslations("copilot")
  const { activeTenantId } = useTenant()
  const [title, setTitle] = useState("")
  const [stepTitle, setStepTitle] = useState("")
  const [draftSteps, setDraftSteps] = useState<Array<{ title: string; kind: string }>>([])
  const [executing, setExecuting] = useState(false)

  const workflowTemplates = useMemo(
    () => [
      {
        title: t("workflowClientUpdate"),
        steps: t("workflowClientUpdateSteps").split("|"),
      },
      {
        title: t("workflowFilingPrep"),
        steps: t("workflowFilingPrepSteps").split("|"),
      },
      {
        title: t("workflowBillingReview"),
        steps: t("workflowBillingReviewSteps").split("|"),
      },
      {
        title: t("workflowMeetingTasks"),
        steps: t("workflowMeetingTasksSteps").split("|"),
      },
    ],
    [t],
  )

  const { data: plans = [], isLoading, refetch } = useApiData<CopilotPlan[]>(
    ["copilot-plans", activeTenantId],
    {
      apiFn: () => listCopilotPlans(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const addStep = () => {
    if (!stepTitle.trim()) return
    setDraftSteps((prev) => [...prev, { title: stepTitle.trim(), kind: "task" }])
    setStepTitle("")
  }

  const applyTemplate = (template: (typeof workflowTemplates)[number]) => {
    setTitle(template.title)
    setDraftSteps(template.steps.map((step) => ({ title: step, kind: "task" })))
  }

  const createPlan = async () => {
    if (!activeTenantId || !title.trim() || draftSteps.length === 0) return
    await createCopilotPlan(activeTenantId, {
      title: title.trim(),
      steps: draftSteps.map((s) => ({ title: s.title, kind: s.kind })),
    })
    setTitle("")
    setDraftSteps([])
    void refetch()
  }

  const handleExecute = async (planId: string) => {
    if (!activeTenantId) return
    setExecuting(true)
    try {
      await executeCopilotPlan(activeTenantId, planId)
      void refetch()
    } finally {
      setExecuting(false)
    }
  }

  const createTaskFromStep = async (stepTitleValue: string) => {
    if (!activeTenantId) return
    await createTask(activeTenantId, {
      title: stepTitleValue,
      priority: "Normal",
      status: "Todo",
    })
  }

  const toggleStepKind = async (plan: CopilotPlan, stepId: string) => {
    if (!activeTenantId) return
    const steps = plan.steps.map((s) =>
      s.id === stepId
        ? { id: s.id, kind: s.kind === "question" ? "task" : "question", status: s.status }
        : { id: s.id, title: s.title, kind: s.kind, status: s.status, sortOrder: s.sortOrder },
    )
    await updateCopilotPlanSteps(activeTenantId, plan.id, steps)
    void refetch()
  }

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      <div>
        <h3 className="font-semibold mb-1">{t("plan_mode")}</h3>
        <p className="text-sm text-muted-foreground">{t("planModeDescription")}</p>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("planReviewNotice")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {workflowTemplates.map((template) => (
            <Button
              key={template.title}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyTemplate(template)}
            >
              {template.title}
            </Button>
          ))}
        </div>
        <Input
          placeholder={t("plan_title_eg_eviction_response_strategy")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder={t("add_step")}
            value={stepTitle}
            onChange={(e) => setStepTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStep()}
          />
          <Button type="button" variant="outline" size="icon" onClick={addStep}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {draftSteps.length > 0 && (
          <ul className="space-y-2">
            {draftSteps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                {step.title}
              </li>
            ))}
          </ul>
        )}
        <Button onClick={() => void createPlan()} disabled={!title.trim() || draftSteps.length === 0}>
          {t("savePlan")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("no_plans_yet_create_one_above")}</p>
      ) : (
        plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium">{plan.title}</h4>
              <Badge variant="outline">{plan.status}</Badge>
            </div>
            <ul className="space-y-2">
              {plan.steps.map((step) => (
                <li key={step.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{step.title}</p>
                    {step.description && (
                      <p className="text-muted-foreground">{step.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary">{step.kind}</Badge>
                    {step.kind === "task" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void createTaskFromStep(step.title)}
                      >
                        {t("addTask")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggleStepKind(plan, step.id)}
                    >
                      {t("toggleQuestion")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              onClick={() => void handleExecute(plan.id)}
              disabled={executing}
            >
              {executing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {t("runWithAgent")}
            </Button>
          </div>
        ))
      )}
    </div>
  )
}
