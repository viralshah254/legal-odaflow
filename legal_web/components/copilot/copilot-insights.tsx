"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listTasks } from "@/lib/api/tasks"
import { listTimelineEvents } from "@/lib/api/timeline"
import { getKycChecklist } from "@/lib/api/kyc"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckSquare, Clock, AlertCircle, FileWarning, Activity, ChevronRight } from "lucide-react"
import { CopilotProactiveBrief } from "./copilot-proactive-brief"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

const TASK_STATUS_CONFIG: Record<string, { color: string; labelKey: string }> = {
  TODO: { color: "bg-slate-400", labelKey: "taskStatusTodo" },
  IN_PROGRESS: { color: "bg-amber-400", labelKey: "taskStatusInProgress" },
  REVIEW: { color: "bg-blue-400", labelKey: "taskStatusReview" },
  BLOCKED: { color: "bg-red-500", labelKey: "taskStatusBlocked" },
}

function safeFormatDistance(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return formatDistanceToNow(date, { addSuffix: true })
}

function isOpenTaskStatus(status: string): boolean {
  const normalized = status.toUpperCase().replace(/\s+/g, "_")
  return normalized !== "DONE" && normalized !== "COMPLETED" && normalized !== "CANCELLED"
}

function isOverdueTask(task: { dueDate?: string | null; status: string }): boolean {
  if (!task.dueDate || !isOpenTaskStatus(task.status)) return false
  const due = new Date(task.dueDate)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

function CopilotInsightsContent() {
  const t = useTranslations("copilot")
  const tCommon = useTranslations("common")
  const tDashboardTasks = useTranslations("dashboard.tasks")
  const tDashboard = useTranslations("dashboard")
  const { context } = useCopilotContext()
  const { activeTenantId } = useTenant()

  const matterId = context.selectedMatterId
  const clientId = context.selectedClientId

  const { data: firmTasks = [], isLoading: firmTasksLoading } = useApiData(
    ["copilot-insights-firm-tasks", activeTenantId],
    {
      apiFn: () => listTasks(activeTenantId!, undefined, { all: true }),
      enabled: !!activeTenantId && !matterId && !clientId,
    },
  )

  const { data: tasks = [], isLoading: tasksLoading } = useApiData(
    ["copilot-insights-tasks", activeTenantId, matterId],
    {
      apiFn: () => listTasks(activeTenantId!, matterId ?? undefined),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: timeline = [], isLoading: timelineLoading } = useApiData(
    ["copilot-insights-timeline", activeTenantId, matterId],
    {
      apiFn: () => listTimelineEvents(activeTenantId!, matterId!),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: kyc, isLoading: kycLoading } = useApiData(
    ["copilot-insights-kyc", activeTenantId, clientId],
    {
      apiFn: () => getKycChecklist(activeTenantId!, clientId!),
      enabled: !!activeTenantId && !!clientId,
    },
  )

  const openTasks = tasks.filter((t) => t.status !== "Done" && t.status !== "COMPLETED").slice(0, 5)
  const overdueFirmTasks = firmTasks
    .filter(isOverdueTask)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)
  const recentEvents = [...(timeline ?? [])].slice(-3).reverse()
  const missingKyc = kyc?.documents?.filter((d) => d.status === "missing").slice(0, 5) ?? []
  const isLoading = tasksLoading || timelineLoading || kycLoading

  if (!matterId && !clientId) {
    return (
      <div className="p-4 space-y-4">
        <CopilotProactiveBrief />

        <Card>
          <CardHeader className="py-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <CardTitle className="text-sm">{tDashboard("overdueTasks")}</CardTitle>
              </div>
              {overdueFirmTasks.length > 0 && (
                <Link href="/app/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {tCommon("viewAll")}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-2 space-y-1">
            {firmTasksLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : overdueFirmTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">{tDashboardTasks("noOverdueTasks")}</p>
            ) : (
              overdueFirmTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/app/tasks?id=${task.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
                  <span className="text-sm flex-1 line-clamp-1">{task.title}</span>
                  {task.dueDate && safeFormatDistance(task.dueDate) && (
                    <span className="text-xs text-destructive shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {safeFormatDistance(task.dueDate)}
                    </span>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="p-4 text-sm text-muted-foreground text-center border rounded-lg border-dashed">
          {t("insightsFirmHint")}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <CopilotProactiveBrief />

      {/* Open tasks */}
      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">{t("open_tasks")}</CardTitle>
            </div>
            {openTasks.length > 0 && (
              <Link href="/app/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">{tCommon("viewAll")}<ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-2 space-y-1">
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">{t("no_open_tasks_on_this_matter")}</p>
          ) : (
            openTasks.map((task) => {
              const config = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.TODO
              return (
                <Link
                  key={task.id}
                  href={`/app/tasks?id=${task.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors group"
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", config.color)} />
                  <span className="text-sm flex-1 line-clamp-1">{task.title}</span>
                  {task.dueDate && safeFormatDistance(task.dueDate) && (
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {safeFormatDistance(task.dueDate)}
                    </span>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Recent timeline */}
      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{t("recent_activity")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-2 space-y-1">
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">{t("no_timeline_events_yet")}</p>
          ) : (
            recentEvents.map((event, idx) => (
              <div key={event.id ?? idx} className="flex items-start gap-2 px-2 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-1">{event.description ?? event.eventType ?? t("defaultEventLabel")}</p>
                  {event.createdAt && safeFormatDistance(event.createdAt) && (
                    <p className="text-xs text-muted-foreground">
                      {safeFormatDistance(event.createdAt)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* KYC gaps */}
      {clientId && (
        <Card>
          <CardHeader className="py-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">{t("kyc_gaps")}</CardTitle>
              </div>
              {missingKyc.length > 0 && (
                <Badge variant="destructive" className="text-xs">{t("missingCount", { count: missingKyc.length })}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-2 space-y-1">
            {missingKyc.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">{t("kyc_checklist_complete")}</p>
            ) : (
              missingKyc.map((doc, idx) => (
                <div key={doc.id ?? idx} className="flex items-center gap-2 px-2 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <span className="text-sm flex-1 line-clamp-1">{doc.docType ?? doc.label ?? t("defaultDocumentLabel")}</span>
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30">{t("missing")}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function CopilotInsights() {
  const t = useTranslations("copilot")
  const { hasPermission } = useCopilotContext()

  if (!hasPermission("canUseCopilotChat")) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        {t("noInsightsPermission")}
      </div>
    )
  }

  return <CopilotInsightsContent />
}
