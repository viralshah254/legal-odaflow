"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, FileText, Loader2 } from "lucide-react"

import { MatterOverviewSummary } from "@/components/matters/matter-overview-summary"
import {
  MatterPriorityAction,
  type MatterAction,
} from "@/components/matters/matter-priority-action"
import { MatterRecentActivity } from "@/components/matters/matter-recent-activity"
import { MatterDetailsCard, MatterStagePipelineCard } from "@/components/matters/matter-stage-details"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { MatterAIActionCard } from "@/components/matters/matter-ai-action-card"
import { AutonomyStatusPanel } from "@/components/matters/autonomy-status-panel"
import { MatterGetStartedChecklist } from "@/components/matters/matter-get-started-checklist"
import { MatterIntakeQuestionnaire } from "@/components/matters/matter-intake-questionnaire"
import { MatterBriefCard } from "@/components/matters/matter-brief-card"
import { SavedResearchPanel } from "@/components/research/saved-research-panel"
import { WorkflowTriggerButton } from "@/components/workflows/workflow-trigger-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useToast } from "@/hooks/use-toast"
import { getMatterAccessLevel } from "@/lib/api/matter-access"
import { getMatter, updateMatter } from "@/lib/api/matters"
import { listCourtDeadlines } from "@/lib/api/court-deadlines"
import { listSavedResearch, type SavedResearchItem } from "@/lib/api/ai"
import { queryKeys } from "@/lib/api/query-keys"
import { listTimelineEvents, type ApiTimelineEvent } from "@/lib/api/timeline"
import type { ApiMatter } from "@/lib/api/types"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { selectMatterOverviewPriority } from "@/lib/matters/overview-priority"
import type { TimelineEvent } from "@/lib/types/timeline"

function toTimelineEvent(event: ApiTimelineEvent): TimelineEvent {
  return {
    id: event.id,
    matterId: event.matterId,
    type: (event.eventType || "MATTER_CREATED") as TimelineEvent["type"],
    title: event.title,
    description: event.description ?? undefined,
    userId: event.userId ?? "",
    userName: event.userName ?? "System",
    createdAt: new Date(event.createdAt || event.occurredAt),
    metadata: event.metadata ?? undefined,
  }
}

export default function MatterDetailPage({
  params,
}: {
  params: Promise<{ matterId: string }> | { matterId: string }
}) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const matterId = resolvedParams.matterId
  const t = useTranslations("matters")
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { activeTenantId } = useTenant()
  const { currentRole } = useRole()
  const { setMatterId, setClientId } = useCopilotContext()
  const [localStage, setLocalStage] = useState<string | null>(null)
  const [updatingStage, setUpdatingStage] = useState(false)
  const created = searchParams.get("created") === "1"

  const {
    data: matter,
    isLoading,
    error,
  } = useApiData<ApiMatter>(
    queryKeys.matters.detail(activeTenantId, matterId),
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: Boolean(activeTenantId && matterId),
    },
  )

  const {
    data: activity = [],
    isLoading: activityLoading,
  } = useApiData(
    queryKeys.matters.operationalTimeline(activeTenantId, matterId),
    {
      apiFn: () => listTimelineEvents(activeTenantId!, matterId),
      enabled: Boolean(activeTenantId && matterId),
    },
  )

  const { data: accessInfo } = useApiData(
    ["matter-access", activeTenantId, matterId],
    {
      apiFn: () => getMatterAccessLevel(activeTenantId!, matterId),
      enabled: Boolean(activeTenantId && matterId),
    },
  )
  const { data: courtDeadlines = [] } = useApiData(
    ["matter-court-deadlines", activeTenantId, matterId],
    {
      apiFn: () => listCourtDeadlines(activeTenantId!, matterId),
      enabled: Boolean(activeTenantId && matterId),
    },
  )
  const limitationDeadline = courtDeadlines.find((deadline) => deadline.deadlineType === "LIMITATION")
  const {
    data: savedResearch = [],
    isLoading: savedResearchLoading,
  } = useApiData<SavedResearchItem[]>(
    queryKeys.research.saved(activeTenantId, { matterId }),
    {
      apiFn: () => listSavedResearch(activeTenantId!, { matterId }),
      enabled: Boolean(activeTenantId && matterId),
    },
  )

  useEffect(() => {
    if (!matter) return
    setMatterId(matter.id)
    setClientId(matter.clientId ?? undefined)
    setLocalStage(matter.stage ?? "Active")

    return () => {
      setMatterId(undefined)
      setClientId(undefined)
    }
  }, [matter, setClientId, setMatterId])

  const timelineEvents = useMemo(
    () =>
      activity
        .map(toTimelineEvent)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [activity],
  )

  const priorityActions = useMemo<{
    primary: MatterAction
    suggestions: MatterAction[]
  }>(() => {
    const selection = selectMatterOverviewPriority(matter?.riskScore)
    const askAi: MatterAction = {
      title: t("ask_matter_ai"),
      description: t("ask_matter_ai_description"),
      href: `/app/matters/${matterId}/workbench`,
    }

    if (selection.primary === "review-risk") {
      return {
        primary: {
          title: t("review_matter_risk"),
          description: t("review_matter_risk_description", {
            risk: selection.riskLevel === "critical" ? t("critical_risk") : t("high_risk"),
          }),
          href: `/app/matters/${matterId}/strategy`,
        },
        suggestions: [askAi],
      }
    }

    return { primary: askAi, suggestions: [] }
  }, [matter?.riskScore, matterId, t])

  if (isLoading || !activeTenantId) {
    return <PageSkeleton className="p-4 sm:p-6" />
  }

  if (!matter) {
    return (
      <EmptyState
        icon={error ? AlertCircle : FileText}
        title={t("matter_not_found")}
        actionLabel={t("back_to_matters")}
        actionHref="/app/matters"
        className="m-4 sm:m-6"
      />
    )
  }

  const activeStage = localStage ?? matter.stage ?? "Active"
  const hasFullFirmAccess =
    currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER"
  const isOwner = accessInfo?.isOwner ?? hasFullFirmAccess
  const canEdit =
    isOwner || accessInfo?.accessLevel === "WRITE" || currentRole === "PARTNER_ADMIN"
  const shellMatter: ApiMatter = { ...matter, stage: activeStage }

  const handleStageUpdate = async (stage: string) => {
    if (!activeTenantId || updatingStage || stage === activeStage) return
    const previousStage = activeStage
    setLocalStage(stage)
    setUpdatingStage(true)

    try {
      await updateMatter(activeTenantId, matterId, { stage })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.detail(activeTenantId, matterId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.operationalTimeline(activeTenantId, matterId),
        }),
      ])
      toast({ title: t("stageUpdated", { stage }) })
    } catch {
      setLocalStage(previousStage)
      toast({ title: t("failed_to_update_stage"), variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  return (
    <MatterWorkspaceShell
      matter={shellMatter}
      tenantId={activeTenantId}
      showIntelligenceSidebar
      primaryAction={
        <WorkflowTriggerButton
          matterId={matter.id}
          practiceArea={matter.practiceArea}
          trigger="manual"
          className="h-8"
        />
      }
    >
      <main className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
        {created && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Matter workspace created</p>
                <p className="text-xs text-muted-foreground">Add documents and complete the checklist so the workspace can build a reliable matter brief.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <MatterPriorityAction
          primary={priorityActions.primary}
          suggestions={priorityActions.suggestions}
        />

        <MatterBriefCard tenantId={activeTenantId} matterId={matterId} />

        <MatterGetStartedChecklist
          matterId={matterId}
          factsComplete={Boolean(matter.factsSummary?.trim())}
          analysisComplete={Boolean(matter.matterProfile)}
        />

        <MatterOverviewSummary
          matter={matter}
          limitation={
            limitationDeadline
              ? { dueDate: limitationDeadline.dueDate, rule: limitationDeadline.ruleReference }
              : null
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <MatterAIActionCard
            matterId={matterId}
            clientId={matter.clientId ?? undefined}
            matterTitle={matter.title}
          />
          <AutonomyStatusPanel matterId={matterId} />
        </div>

        <SavedResearchPanel
          items={savedResearch}
          loading={savedResearchLoading}
          title="Matter legal research"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <MatterRecentActivity
            events={timelineEvents}
            matterId={matterId}
            loading={activityLoading}
          />
          <MatterStagePipelineCard
            activeStage={activeStage}
            canEdit={canEdit}
            updatingStage={updatingStage}
            onStageChange={(stage) => void handleStageUpdate(stage)}
          />
          <MatterDetailsCard matter={matter} />
        </div>

        <div id="intake-questionnaire" className="scroll-mt-28">
          <MatterIntakeQuestionnaire
            matterId={matterId}
            practiceArea={matter.practiceArea}
            canEdit={canEdit}
          />
        </div>

        {updatingStage && (
          <p className="sr-only" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("stage_pipeline")}
          </p>
        )}
      </main>
    </MatterWorkspaceShell>
  )
}
