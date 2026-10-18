"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { useRole } from "@/lib/contexts/role-context"
import { useIsSolo } from "@/lib/hooks/use-is-solo"
import { useTenant } from "@/lib/contexts/tenant-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { useUIStore } from "@/lib/store"
import { listUrgentAlerts } from "@/lib/api/alerts"
import { getMissingKycDocs, getExpiredKycDocs } from "@/lib/api/kyc"
import { listPendingAssistance } from "@/lib/api/assistance"
import { listTasks, type ApiTask } from "@/lib/api/tasks"
import { listCalendarEvents } from "@/lib/api/calendar"
import { listMatters } from "@/lib/api/matters"
import { listPipelineLeads } from "@/lib/api/marketplace"
import { getFinanceDashboard } from "@/lib/api/finance"
import { listTenantUsers } from "@/lib/api/users"
import { useApiData } from "@/lib/hooks/use-api-data"
import { mapTenantRoleToUserRole } from "@/lib/auth/role-mapper"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { DashboardAISearch } from "@/components/dashboard/dashboard-ai-search"
import { NextBestActions } from "@/components/dashboard/next-best-actions"
import type { Alert } from "@/lib/types/alerts"
import type { DashboardTask } from "@/components/dashboard/tasks-list"
import { UrgentAlertStrip } from "@/components/dashboard/urgent-alert-strip"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TasksList } from "@/components/dashboard/tasks-list"
import { CalendarMini } from "@/components/dashboard/calendar-mini"
import { MattersTableMini } from "@/components/dashboard/matters-table-mini"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileText,
  Plus,
  ArrowRight,
  Mic,
  Clock,
  Users,
  Gavel,
  Receipt,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useCurrency } from "@/lib/contexts/currency-context"
import { cn, formatCurrencyShort } from "@/lib/utils"
import { PlanGate } from "@/components/plan/plan-gate"
import { ReferralDashboardCard } from "@/components/referrals/referral-dashboard-card"
import { MonitorsWidget } from "@/components/dashboard/monitors-widget"
import { format } from "date-fns"

function apiTaskToDashboard(t: ApiTask): DashboardTask {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueDate ?? new Date().toISOString(),
    assignedToName: undefined,
  }
}

function filterTasksByWindow(tasks: ApiTask[], userId: string, window: "today" | "overdue" | "next7") {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  return tasks
    .filter((t) => t.assignedToId === userId)
    .filter((t) => {
      const due = t.dueDate ? new Date(t.dueDate) : null
      if (!due) return false
      const done = t.status === "Done" || t.status === "COMPLETED"
      if (window === "overdue") return due < now && !done
      if (window === "today") {
        const dueCopy = new Date(due)
        dueCopy.setHours(0, 0, 0, 0)
        return dueCopy >= today && dueCopy < tomorrow && !done
      }
      const dueCopy = new Date(due)
      dueCopy.setHours(0, 0, 0, 0)
      return dueCopy >= today && dueCopy < nextWeek && !done
    })
    .map(apiTaskToDashboard)
}

export default function DashboardPage() {
  const toISOString = useTranslations("dashboard")
  const t = useTranslations("dashboard")
  const ta = useTranslations("dashboard.actions")
  const talerts = useTranslations("dashboard.alerts")
  const tc = useTranslations("common")
  const { currentRole, currentUser, permissions } = useRole()
  const isSolo = useIsSolo()
  const { activeTenantId } = useTenant()
  const { currency } = useCurrency()
  const setRecordMeetingOpen = useUIStore((s) => s.setRecordMeetingOpen)
  const dashboardWindow = useUIStore((s) => s.dashboardWindow)
  const userId = currentUser?.id ?? ""

  const canRecordMeetings = hasMeetingPermission(currentRole, "meetingsRecord")

  const { data: urgentAlerts = [] } = useApiData<Alert[]>(
    ["dashboard-alerts", activeTenantId],
    { apiFn: () => listUrgentAlerts(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: missingKyc = [] } = useApiData(
    ["dashboard-kyc-missing", activeTenantId],
    { apiFn: () => getMissingKycDocs(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: expiredKyc = [] } = useApiData(
    ["dashboard-kyc-expired", activeTenantId],
    { apiFn: () => getExpiredKycDocs(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: pendingAssistance = [] } = useApiData(
    ["dashboard-assistance", activeTenantId],
    {
      apiFn: () => listPendingAssistance(activeTenantId!),
      enabled: !!activeTenantId && currentRole === "PARTNER_ADMIN",
    },
  )

  const { data: apiTasks = [] } = useApiData(
    ["dashboard-tasks", activeTenantId],
    { apiFn: () => listTasks(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: apiEvents = [] } = useApiData(
    ["dashboard-events", activeTenantId],
    { apiFn: () => listCalendarEvents(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: apiMatters = [] } = useApiData(
    ["dashboard-matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: pipelineLeads = [] } = useApiData(
    ["dashboard-leads-pipeline", activeTenantId],
    { apiFn: () => listPipelineLeads(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: finance } = useApiData(
    ["dashboard-finance", activeTenantId],
    {
      apiFn: () => getFinanceDashboard(activeTenantId!),
      enabled: !!activeTenantId && permissions.canViewFinance,
      retry: false,
    },
  )

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId && currentRole === "PARTNER_ADMIN" && !isSolo,
    },
  )

  const teamMembers = useMemo(() => {
    const allUsers = tenantUsers.map((u) => ({
      id: u.user.id,
      name: u.user.name ?? "User",
      email: u.user.email,
      role: mapTenantRoleToUserRole(u.role),
    }))
    return allUsers.filter((u) => u.role !== "PARTNER_ADMIN")
  }, [tenantUsers])

  const kycAlerts: Alert[] = useMemo(
    () => [
      ...missingKyc.map((item) => ({
        id: `kyc-missing-${item.clientId}`,
        title: talerts("missingKycDocuments"),
        description: talerts("missingKycDescription", { clientName: item.clientName, count: item.docs.length }),
        severity: "High" as const,
        type: "KYC_MISSING" as const,
        clientId: item.clientId,
        clientName: item.clientName,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      })),
      ...expiredKyc.map((item) => ({
        id: `kyc-expired-${item.clientId}`,
        title: talerts("expiredKycDocuments"),
        description: talerts("expiredKycDescription", { clientName: item.clientName, count: item.docs.length }),
        severity: "High" as const,
        type: "KYC_EXPIRED" as const,
        clientId: item.clientId,
        clientName: item.clientName,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      })),
    ],
    [missingKyc, expiredKyc, talerts],
  )

  const assistanceAlerts: Alert[] = useMemo(
    () =>
      pendingAssistance.map((req) => ({
        id: `assist-${req.id}`,
        title: talerts("assistanceRequestPending"),
        description: talerts("assistanceRequestDescription", {
          requester: req.requestedByName ?? talerts("someone"),
          matter: req.matterTitle ?? talerts("aMatter"),
        }),
        severity: "Normal" as const,
        type: "ASSISTANCE_REQUEST" as const,
        matterId: req.matterId,
        matterTitle: req.matterTitle,
        assistanceRequestId: req.id,
        createdAt: req.createdAt,
        acknowledged: false,
      })),
    [pendingAssistance, talerts],
  )

  const userAlerts = urgentAlerts.filter((a) => a.assignedToId === userId)
  const alertsToShow =
    currentRole === "PARTNER_ADMIN"
      ? [...urgentAlerts, ...kycAlerts, ...assistanceAlerts]
      : [...userAlerts, ...kycAlerts]

  const userTasksDueToday = filterTasksByWindow(apiTasks, userId, "today")
  const userOverdueTasks = filterTasksByWindow(apiTasks, userId, "overdue")
  const userTasksNext7Days = filterTasksByWindow(apiTasks, userId, "next7")

  const nextBestActions = useMemo(
    () =>
      [
        alertsToShow.length > 0
          ? {
              title: ta("reviewUrgentRisks"),
              description: ta("reviewUrgentRisksDescription", { count: alertsToShow.length }),
              href: "/app/alerts",
              cta: ta("openAlerts"),
              tone: "danger" as const,
            }
          : null,
        userOverdueTasks.length > 0
          ? {
              title: ta("clearOverdueTasks"),
              description: ta("clearOverdueTasksDescription", { count: userOverdueTasks.length }),
              href: "/app/tasks",
              cta: ta("reviewTasks"),
              tone: "warning" as const,
            }
          : null,
        pipelineLeads.length > 0
          ? {
              title: ta("moveIntakeForward"),
              description: ta("moveIntakeForwardDescription", { count: pipelineLeads.length }),
              href: "/app/leads",
              cta: ta("openPipeline"),
              tone: "default" as const,
            }
          : null,
        {
          title: ta("startNewMatter"),
          description: ta("startNewMatterDescription"),
          href: "/app/intake",
          cta: ta("newClientMatter"),
          tone: "default" as const,
        },
      ].filter(Boolean) as Array<{
        title: string
        description: string
        href: string
        cta: string
        tone: "default" | "warning" | "danger"
      }>,
    [alertsToShow.length, userOverdueTasks.length, pipelineLeads.length, ta],
  )

  // Apply dashboard window filter: week/month shows next7 tab by default
  // (passed to TasksList via its own defaultTab logic based on overdueTasks count)

  const userEvents = apiEvents.slice(0, 3).map((e) => ({
    id: e.id,
    title: e.title,
    startAt: new Date(e.startAt),
    endAt: new Date(e.endAt),
    type: (e.type as "Meeting" | "Hearing" | "Deadline" | "Appointment" | "Other") || "Other",
    matterId: e.matterId ?? undefined,
    attendeeIds: [] as string[],
    attendeeNames: [] as string[],
  }))

  const userMatters = apiMatters.slice(0, 5).map((m) => ({
    id: m.id,
    title: m.title,
    ref: m.caseNumber ?? m.id.slice(0, 8),
    clientId: m.clientId ?? "",
    clientName: m.client?.name ?? "—",
    stage: (m.stage ?? "Active") as "Intake" | "Active" | "Discovery" | "Negotiation" | "Closing" | "Closed",
    status: (m.status ?? "Active") as "Active" | "On Hold" | "Closed",
    ownerId: "",
    ownerName: "—",
    risk: "Medium" as "Low" | "Medium" | "High" | "Critical",
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
  }))

  const allMatters = userMatters
  const mattersAtRisk = userMatters.filter((m) => m.risk === "High" || m.risk === "Critical")

  const collectionsThisMonth = finance?.collectionsThisMonth ?? 0
  const outstandingInvoices = finance?.outstandingTotal ?? 0
  const overdueInvoices = finance?.overdueTotal ?? 0
  const originatorStats = finance?.originatorStats ?? []
  const invoiceAging = {
    current: finance?.invoiceAging?.[0]?.amount ?? 0,
    days30: finance?.invoiceAging?.[1]?.amount ?? 0,
    days60: finance?.invoiceAging?.[2]?.amount ?? 0,
    days90: finance?.invoiceAging?.[3]?.amount ?? 0,
    over90: finance?.invoiceAging?.[4]?.amount ?? 0,
  }

  const roleLabel = t(`roles.${currentRole}` as "roles.PARTNER_ADMIN")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = currentUser?.name?.split(" ")[0] ?? ""

  const invoiceAgingRows = useMemo(
    () => [
      { label: t("agingCurrent"), value: invoiceAging.current, danger: false },
      { label: t("agingDays30"), value: invoiceAging.days30, danger: false },
      { label: t("agingDays60"), value: invoiceAging.days60, danger: false },
      { label: t("agingDays90"), value: invoiceAging.days90, danger: false },
      { label: t("agingOver90"), value: invoiceAging.over90, danger: true },
    ],
    [t, invoiceAging],
  )

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5 motion-page-enter">

      {/* Page header — personalized greeting */}
      <div className="flex items-center justify-between gap-3 animate-slide-up-d0">
        <div>
          <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="text-xl font-bold leading-tight mt-0.5">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs font-medium hidden sm:inline-flex">
            {roleLabel}
          </Badge>
          <OpenCopilotButton />
        </div>
      </div>

      {/* Legal Research / New Intake hero — the front door for every role */}
      <div className="animate-slide-up-d1">
        <DashboardAISearch />
      </div>

      {/* Autonomous daily brief — next best actions with one-click agent assist */}
      <div className="animate-slide-up-d2">
        <NextBestActions />
      </div>

      {/* Onboarding checklist (PARTNER_ADMIN only) */}
      {currentRole === "PARTNER_ADMIN" && (
        <div data-tour="dashboard-onboarding" className="animate-slide-up-d2">
          <OnboardingChecklist solo={isSolo} />
        </div>
      )}

      {/* Urgent Alerts Strip */}
      {alertsToShow.length > 0 && (
        <div data-tour="dashboard-alerts" className="animate-slide-up-d3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Alerts</p>
          <UrgentAlertStrip alerts={alertsToShow} showAssignee={currentRole === "PARTNER_ADMIN"} />
        </div>
      )}

      {nextBestActions.length > 0 && (
        <div className="animate-slide-up-d3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recommended actions</p>

          {/* Mobile: icon cards with descriptions */}
          <div className="flex flex-col gap-2 sm:hidden motion-stagger-list">
            {nextBestActions.slice(0, 4).map((action) => {
              const ActionIcon =
                action.tone === "danger" ? AlertTriangle :
                action.tone === "warning" ? Clock :
                action.title.toLowerCase().includes("intake") || action.title.toLowerCase().includes("pipeline") ? Users :
                Briefcase

              const iconBg =
                action.tone === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : action.tone === "warning"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-primary/10 text-primary"

              return (
                <Link key={action.title} href={action.href} className="block group">
                  <div
                    className={cn(
                      "relative flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-all active:scale-[0.99]",
                      action.tone === "danger"
                        ? "border-destructive/30 bg-destructive/5"
                        : action.tone === "warning"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border/60 bg-card",
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
                      <ActionIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-semibold leading-snug",
                        action.tone === "danger" && "text-destructive",
                        action.tone === "warning" && "text-amber-700 dark:text-amber-400",
                      )}>
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{action.description}</p>
                      <p className="text-xs text-primary font-medium mt-1.5 flex items-center gap-1">
                        {action.cta}
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* sm+: full card grid */}
          <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {nextBestActions.slice(0, 4).map((action) => (
              <Link key={action.title} href={action.href} className="block group">
                <div
                  className={cn(
                    "relative rounded-xl border p-4 h-full flex flex-col gap-3 transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5",
                    action.tone === "danger"
                      ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                      : action.tone === "warning"
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : "border-border/60 bg-card hover:border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-0.5 rounded-t-xl",
                      action.tone === "danger" && "bg-gradient-to-r from-destructive/70 to-destructive/20",
                      action.tone === "warning" && "bg-gradient-to-r from-amber-500/70 to-amber-500/20",
                      action.tone === "default" && "bg-gradient-to-r from-primary/50 to-primary/10",
                    )}
                  />
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-semibold leading-snug",
                      action.tone === "danger" && "text-destructive",
                      action.tone === "warning" && "text-amber-700 dark:text-amber-400",
                    )}>
                      {action.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium text-primary group-hover:gap-2 transition-all">
                    <span>{action.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Role-Specific KPIs */}
      {currentRole === "PARTNER_ADMIN" && (
        <>
          {/* Mobile: horizontal scroll strip */}
          <div
            className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 lg:hidden snap-x snap-mandatory scrollbar-none animate-slide-up-d4"
            data-tour="dashboard-kpis"
            style={{ scrollbarWidth: "none" }}
          >
            <KpiCard compact icon={Briefcase} label={t("activeMatters")} value={allMatters.length} delta={{ value: 12, positive: true }} variant="default" />
            <KpiCard compact icon={AlertTriangle} label={t("criticalDeadlines")} value={mattersAtRisk.filter((m) => m.risk === "Critical").length} variant="danger" />
            <KpiCard compact icon={CheckCircle2} label={t("tasksOverdue")} value={userOverdueTasks.length} variant={userOverdueTasks.length > 0 ? "warning" : "success"} />
            <KpiCard compact icon={DollarSign} label={t("outstandingInvoices")} value={formatCurrencyShort(outstandingInvoices, currency)} variant="default" />
          </div>
          {/* Desktop: 4-col grid */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-3 motion-stagger-list pt-1" data-tour="dashboard-kpis">
            <KpiCard
              icon={Briefcase}
              label={t("activeMatters")}
              value={allMatters.length}
              delta={{ value: 12, positive: true }}
              variant="default"
            />
            <KpiCard
              icon={AlertTriangle}
              label={t("criticalDeadlines")}
              value={mattersAtRisk.filter((m) => m.risk === "Critical").length}
              variant="danger"
            />
            <KpiCard
              icon={CheckCircle2}
              label={t("tasksOverdue")}
              value={userOverdueTasks.length}
              variant={userOverdueTasks.length > 0 ? "warning" : "success"}
            />
            <KpiCard
              icon={DollarSign}
              label={t("outstandingInvoices")}
              value={formatCurrencyShort(outstandingInvoices, currency)}
              variant="default"
            />
          </div>

          {/* Regulatory Intelligence widget */}
          <MonitorsWidget />

          {/* Team Workload — only when the firm has other team members */}
          {teamMembers.length > 0 && (
            <PlanGate
              requiredPlan="PROFESSIONAL"
              feature={t("planTeamAnalytics")}
              description={t("planTeamAnalyticsDescription")}
            >
              <Card className="card-glow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t("teamWorkloadMonitoring")}</CardTitle>
                    <Link href="/app/team">
                      <Button variant="outline" size="sm" className="text-xs">
                        {tc("viewAll")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {teamMembers.slice(0, 4).map((member) => {
                      const memberTasks = apiTasks.filter((task) => task.assignedToId === member.id)
                      const now = new Date()
                      const overdueCount = memberTasks.filter(
                        (task) => task.dueDate && new Date(task.dueDate) < now && task.status !== "Done",
                      ).length
                      return (
                        <Link
                          key={member.id}
                          href="/app/team"
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-center">
                            <div>
                              <p className="text-sm font-semibold">{memberTasks.length}</p>
                              <p className="text-[10px] text-muted-foreground">{tc("tasks")}</p>
                            </div>
                            <div>
                              <p className={cn("text-sm font-semibold", overdueCount > 0 && "text-red-600 dark:text-red-400")}>
                                {overdueCount}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{t("tasks.overdueLabel")}</p>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </PlanGate>
          )}

          {/* Finance Performance */}
          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature={t("planAdvancedReporting")}
            description={t("planAdvancedReportingDescription")}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="card-glow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("topOriginators")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {originatorStats.slice(0, 5).map((stat, index) => (
                      <div
                        key={stat.userId}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{stat.userName}</div>
                            <div className="text-xs text-muted-foreground">{t("invoicesCount", { count: stat.invoiceCount })}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">{formatCurrencyShort(stat.collectedAmount, currency)}</div>
                          <div className="text-xs text-muted-foreground">{t("collected")}</div>
                        </div>
                      </div>
                    ))}
                    {originatorStats.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("noOriginatorDataYet")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("collectionsThisMonth")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold stat-counter mb-1">
                    {formatCurrencyShort(collectionsThisMonth, currency)}
                  </div>
                  <p className="text-sm text-muted-foreground">{t("totalCollectionsThisMonth")}</p>
                </CardContent>
              </Card>
            </div>
          </PlanGate>

          {/* Urgent Watchlist */}
          <Card className="card-glow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("urgentWatchlist")}</CardTitle>
            </CardHeader>
            <CardContent>
              {mattersAtRisk.length === 0 && pendingAssistance.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {t("noUrgentMatters")}
                </div>
              ) : (
                <div className="space-y-2">
                  {mattersAtRisk.slice(0, 5).map((matter) => (
                    <div
                      key={matter.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-sm">{matter.title}</div>
                        <div className="text-xs text-muted-foreground">{matter.clientName}</div>
                      </div>
                      <Badge variant={matter.risk === "Critical" ? "destructive" : "outline"}>
                        {matter.risk}
                      </Badge>
                    </div>
                  ))}
                  {pendingAssistance.length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {t("pendingAssistance")}
                      </div>
                      {pendingAssistance.slice(0, 3).map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/40 mb-1.5"
                        >
                          <div className="text-xs">
                            <div className="font-medium">{req.requestedByName}</div>
                            <div className="text-muted-foreground">{req.matterTitle}</div>
                          </div>
                          <Badge variant="secondary" className="text-xs">{req.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {currentRole === "FINANCE" && (
        <>
          {/* Mobile: horizontal scroll strip */}
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 lg:hidden snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
            <KpiCard compact icon={DollarSign} label={t("collectionsThisMonth")} value={formatCurrencyShort(collectionsThisMonth, currency)} variant="success" delta={{ value: 15, positive: true }} />
            <KpiCard compact icon={TrendingUp} label={t("outstandingInvoices")} value={formatCurrencyShort(outstandingInvoices, currency)} variant="default" />
            <KpiCard compact icon={AlertTriangle} label={t("overdueInvoices")} value={typeof overdueInvoices === "number" ? overdueInvoices : 0} variant={overdueInvoices > 0 ? "danger" : "success"} />
            <KpiCard compact icon={FileText} label={t("totalInvoices")} value={0} variant="default" />
          </div>
          {/* Desktop: 4-col grid */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-3 motion-stagger-list">
            <KpiCard
              icon={DollarSign}
              label={t("collectionsThisMonth")}
              value={formatCurrencyShort(collectionsThisMonth, currency)}
              variant="success"
              delta={{ value: 15, positive: true }}
            />
            <KpiCard
              icon={TrendingUp}
              label={t("outstandingInvoices")}
              value={formatCurrencyShort(outstandingInvoices, currency)}
              variant="default"
            />
            <KpiCard
              icon={AlertTriangle}
              label={t("overdueInvoices")}
              value={typeof overdueInvoices === "number" ? overdueInvoices : 0}
              variant={overdueInvoices > 0 ? "danger" : "success"}
            />
            <KpiCard
              icon={FileText}
              label={t("totalInvoices")}
              value={0}
              variant="default"
            />
          </div>

          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature={t("planAdvancedReporting")}
            description={t("planAdvancedReportingDescription")}
          >
            <Card className="card-glow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("topOriginators")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {originatorStats.slice(0, 5).map((stat, index) => (
                    <div
                      key={stat.userId}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{stat.userName}</div>
                          <div className="text-xs text-muted-foreground">{t("invoicesCount", { count: stat.invoiceCount })}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatCurrencyShort(stat.collectedAmount, currency)}</div>
                        <div className="text-xs text-muted-foreground">{t("collected")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </PlanGate>

          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature={t("planInvoiceAgingAnalysis")}
            description={t("planInvoiceAgingDescription")}
          >
            <Card className="card-glow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("invoiceAging")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoiceAgingRows.map((row) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        row.danger ? "border-red-500/20 bg-red-500/5" : "border-border/50"
                      }`}
                    >
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className={`font-bold text-sm ${row.danger ? "text-red-600 dark:text-red-400" : ""}`}>
                        {formatCurrencyShort(row.value, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </PlanGate>
        </>
      )}

      {/* Common Panels for All Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-tour="dashboard-tasks">
        <div className="lg:col-span-2">
          <TasksList
            tasksDueToday={userTasksDueToday}
            overdueTasks={userOverdueTasks}
            tasksNext7Days={userTasksNext7Days}
          />
        </div>
        <div className="space-y-4">
          <CalendarMini events={userEvents} />
          <MattersTableMini matters={userMatters.slice(0, 5)} showOwner={currentRole === "PARTNER_ADMIN"} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t("quickActions")}
        </p>

        {/* Mobile: 2-column icon-button grid */}
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
            <Link href="/app/matters/new" className="block">
              <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card py-3.5 hover:bg-muted/40 active:scale-[0.97] transition-all">
                <Briefcase className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t("createMatter")}</span>
              </div>
            </Link>
          </RoleGate>
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
            <Link href="/app/tasks/new" className="block">
              <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card py-3.5 hover:bg-muted/40 active:scale-[0.97] transition-all">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t("addTask")}</span>
              </div>
            </Link>
          </RoleGate>
          <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
            <Link href="/app/accounting/invoices/new" className="block">
              <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card py-3.5 hover:bg-muted/40 active:scale-[0.97] transition-all">
                <Receipt className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t("createInvoice")}</span>
              </div>
            </Link>
          </RoleGate>
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
            <Link href="/app/clients/new" className="block">
              <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card py-3.5 hover:bg-muted/40 active:scale-[0.97] transition-all">
                <UserPlus className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{t("addClient")}</span>
              </div>
            </Link>
          </RoleGate>
          {canRecordMeetings && (
            <button
              onClick={() => setRecordMeetingOpen(true)}
              className="flex flex-col items-center gap-1.5 rounded-xl border bg-card py-3.5 hover:bg-muted/40 active:scale-[0.97] transition-all"
            >
              <Mic className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">{t("recordMeeting")}</span>
            </button>
          )}
        </div>

        {/* Desktop: original flex-wrap buttons */}
        <div className="hidden sm:flex flex-wrap gap-2">
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
            <Link href="/app/matters/new">
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("createMatter")}
              </Button>
            </Link>
          </RoleGate>
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
            <Link href="/app/tasks/new">
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("addTask")}
              </Button>
            </Link>
          </RoleGate>
          <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
            <Link href="/app/accounting/invoices/new">
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("createInvoice")}
              </Button>
            </Link>
          </RoleGate>
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
            <Link href="/app/clients/new">
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("addClient")}
              </Button>
            </Link>
          </RoleGate>
          {canRecordMeetings && (
            <Button variant="outline" size="sm" onClick={() => setRecordMeetingOpen(true)}>
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              {t("recordMeeting")}
            </Button>
          )}
        </div>
      </div>

      <ReferralDashboardCard />
    </div>
  )
}
