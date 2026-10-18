"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { listTenantUsers, getTeamCreditUsage, type ApiTenantUser, type TeamCreditUsageSummary } from "@/lib/api/users"
import { listMatters } from "@/lib/api/matters"
import { listTasks, type ApiTask } from "@/lib/api/tasks"
import { listCalendarEvents } from "@/lib/api/calendar"
import { useApiData } from "@/lib/hooks/use-api-data"
import { User, UserRole } from "@/lib/types/roles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Loader2, UserPlus } from "lucide-react"
import { MattersTableMini, type DashboardMatter } from "@/components/dashboard/matters-table-mini"
import { TasksList, type DashboardTask } from "@/components/dashboard/tasks-list"
import { CalendarMini } from "@/components/dashboard/calendar-mini"
import { PlanGate } from "@/components/plan/plan-gate"
import { RoleGate } from "@/components/dashboard/role-gate"
import { mapTenantRoleToUserRole } from "@/lib/auth/role-mapper"
import { CreditUsageBar } from "@/components/team/CreditUsageBar"
import { AddMemberDialog } from "@/components/team/AddMemberDialog"
import { MemberDetailSheet } from "@/components/team/MemberDetailSheet"
import type { CreditUsageStatus } from "@/lib/api/users"

function apiUserToDisplay(u: ApiTenantUser): User {
  return {
    id: u.user.id,
    name: u.user.name ?? "User",
    email: u.user.email,
    role: mapTenantRoleToUserRole(u.role),
  }
}

export default function TeamPage() {
  const tDashboard = useTranslations("dashboard")
  const t = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const tClients = useTranslations("clients")
  const tBilling = useTranslations("billing")
  const { currentRole, currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [sheetMember, setSheetMember] = useState<ApiTenantUser | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const user = currentUser ?? { id: "", name: "User", email: "", role: currentRole }
  const isAdmin = currentRole === "PARTNER_ADMIN"

  const { data: tenantUsers = [], isLoading } = useApiData(
    ["tenant-users", activeTenantId],
    { apiFn: () => listTenantUsers(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: creditSummary } = useApiData<TeamCreditUsageSummary>(
    ["team-credit-usage", activeTenantId],
    {
      apiFn: () => getTeamCreditUsage(activeTenantId!),
      enabled: !!activeTenantId && isAdmin,
    },
  )

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: tasks = [] } = useApiData<ApiTask[]>(
    ["tasks", activeTenantId],
    { apiFn: () => listTasks(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: events = [] } = useApiData(
    ["calendar-events", activeTenantId],
    { apiFn: () => listCalendarEvents(activeTenantId!), enabled: !!activeTenantId },
  )

  const allUsers = tenantUsers.map(apiUserToDisplay)

  // Index credit usage by userId for O(1) lookup
  const creditByUser = useMemo(() => {
    const map = new Map<string, TeamCreditUsageSummary["users"][0]>()
    creditSummary?.users.forEach((u) => map.set(u.userId, u))
    return map
  }, [creditSummary])

  const teamMembers = useMemo(() => {
    if (currentRole === "PARTNER_ADMIN") {
      return allUsers.filter((u) => u.role !== "PARTNER_ADMIN")
    }
    if (currentRole === "JUNIOR_PARTNER") {
      return allUsers.filter((u) => u.id !== user.id && u.role !== "JUNIOR_PARTNER")
    }
    return []
  }, [allUsers, currentRole, user.id])

  const getTeamWorkload = (memberId: string) => {
    const memberTasks = tasks.filter((t) => t.assignedToId === memberId)
    const now = new Date()
    const overdueTasks = memberTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "Done",
    )
    return {
      matters: matters.length,
      tasks: memberTasks.length,
      overdueTasks: overdueTasks.length,
    }
  }

  const selectedMemberTasks = selectedUserId
    ? tasks.filter((t) => t.assignedToId === selectedUserId)
    : []

  const toDashboardTask = (t: ApiTask): DashboardTask => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueDate ?? new Date(),
  })

  const selectedMatters: DashboardMatter[] = matters.slice(0, 5).map((m) => ({
    id: m.id,
    title: m.title,
    ref: m.caseNumber ?? m.id.slice(0, 8),
    clientName: m.client?.name ?? "—",
    stage: m.stage ?? "Active",
    risk: "Low",
  }))

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <RoleGate
      allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "OPS_HR"]}
      requiredPermission="canViewTeam"
    >
    <PlanGate
      requiredPlan="PROFESSIONAL"
      feature="Team Analytics"
      description={tDashboard("planTeamAnalyticsDescription")}
    >
      <div className="space-y-6 p-6" data-tour="team-invite">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{tDashboard("teamWorkloadMonitoring")}</h1>
            <p className="text-muted-foreground">
              {currentRole === "PARTNER_ADMIN"
                ? "Monitor firm-wide workload and team performance"
                : "Monitor your team's workload and performance"}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setAddMemberOpen(true)} className="shrink-0">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("team_members")}</CardTitle>
            <CardDescription>
              {teamMembers.length} team member{teamMembers.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{tCommon("no_team_members_found")}</p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setAddMemberOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite your first team member
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => {
                  const workload = getTeamWorkload(member.id)
                  const credit = creditByUser.get(member.id)
                  const tuRecord = tenantUsers.find((tu) => tu.user.id === member.id)

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (tuRecord) {
                          setSheetMember(tuRecord)
                        } else {
                          setSelectedUserId(member.id)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">
                              {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold">{member.name}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center hidden sm:block">
                            <div className="text-lg font-bold">{workload.matters}</div>
                            <div className="text-xs text-muted-foreground">{tClients("stats.matters")}</div>
                          </div>
                          <div className="text-center hidden sm:block">
                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                              {workload.overdueTasks}
                            </div>
                            <div className="text-xs text-muted-foreground">{tBilling("overdue")}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (tuRecord) setSheetMember(tuRecord)
                              else setSelectedUserId(member.id)
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </div>

                      {/* Credit usage bar — only visible to admins */}
                      {isAdmin && credit && (
                        <CreditUsageBar
                          used={credit.used}
                          limit={credit.limit}
                          status={credit.status as CreditUsageStatus}
                          cycleEnd={creditSummary?.cycleEnd}
                          className="px-1"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legacy workload sheet (tasks/calendar/matters) */}
        {selectedUserId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex justify-end"
            onClick={() => setSelectedUserId(null)}>
            <div
              className="bg-background w-full max-w-2xl h-full overflow-y-auto p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {allUsers.find((u) => u.id === selectedUserId)?.name ?? "Team Member"}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
                  Close
                </Button>
              </div>
              <div className="space-y-6">
                <MattersTableMini matters={selectedMatters} showOwner={false} />
                <TasksList
                  tasksDueToday={selectedMemberTasks.filter((t) => {
                    if (!t.dueDate) return false
                    const today = new Date(); today.setHours(0, 0, 0, 0)
                    const due = new Date(t.dueDate); due.setHours(0, 0, 0, 0)
                    return due.getTime() === today.getTime()
                  }).map(toDashboardTask)}
                  overdueTasks={selectedMemberTasks.filter((t) => {
                    if (!t.dueDate) return false
                    return new Date(t.dueDate) < new Date() && t.status !== "Done"
                  }).map(toDashboardTask)}
                  tasksNext7Days={selectedMemberTasks.filter((t) => {
                    if (!t.dueDate) return false
                    const today = new Date()
                    const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7)
                    const due = new Date(t.dueDate)
                    return due >= today && due <= nextWeek
                  }).map(toDashboardTask)}
                />
                <CalendarMini events={events.slice(0, 5).map((e) => ({
                  id: e.id,
                  title: e.title,
                  startAt: new Date(e.startAt),
                  endAt: new Date(e.endAt),
                  type: (e.type as "Meeting" | "Hearing" | "Deadline" | "Appointment" | "Other" | undefined),
                }))} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New member detail sheet */}
      <MemberDetailSheet
        tenantId={activeTenantId ?? ""}
        member={sheetMember}
        open={!!sheetMember}
        onOpenChange={(v) => { if (!v) setSheetMember(null) }}
        isAdmin={isAdmin}
      />

      {isAdmin && activeTenantId && (
        <AddMemberDialog
          tenantId={activeTenantId}
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
        />
      )}
    </PlanGate>
    </RoleGate>
  )
}
