"use client"

import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { User } from "@/lib/types/roles"
import { getMattersByOwner, getMattersByTeam } from "@/lib/mock/matters"
import { getTasksByAssignee, getOverdueTasks } from "@/lib/mock/tasks"
import { getEventsByAttendee, getUpcomingEvents } from "@/lib/mock/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Briefcase, CheckCircle2, Clock, Calendar } from "lucide-react"
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MattersTableMini } from "@/components/dashboard/matters-table-mini"
import { TasksList } from "@/components/dashboard/tasks-list"
import { CalendarMini } from "@/components/dashboard/calendar-mini"

export default function TeamPage() {
  const { currentRole, currentUser } = useRole()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  
  // Get team members based on role
  let teamMembers: User[] = []
  if (currentRole === "PARTNER_ADMIN") {
    teamMembers = mockUsers.filter((u) => u.role !== "PARTNER_ADMIN")
  } else if (currentRole === "JUNIOR_PARTNER") {
    teamMembers = mockUsers.filter((u) => u.teamId === user.teamId && u.role !== "JUNIOR_PARTNER")
  }

  const getTeamWorkload = (memberId: string) => {
    const matters = getMattersByOwner(memberId)
    const tasks = getTasksByAssignee(memberId)
    const overdueTasks = getOverdueTasks().filter((t) => t.assignedToId === memberId)
    const criticalDeadlines = matters.filter((m) => m.risk === "Critical" || m.risk === "High").length
    const events = getUpcomingEvents(7).filter((e) => e.attendeeIds.includes(memberId))
    
    return {
      matters: matters.length,
      tasks: tasks.length,
      overdueTasks: overdueTasks.length,
      criticalDeadlines,
      lastActivity: mockUsers.find((u) => u.id === memberId)?.lastActivity,
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Team Workload & Monitoring</h1>
        <p className="text-muted-foreground">
          {currentRole === "PARTNER_ADMIN" 
            ? "Monitor firm-wide workload and team performance"
            : "Monitor your team's workload and performance"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {teamMembers.length} team member{teamMembers.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamMembers.map((member) => {
              const workload = getTeamWorkload(member.id)
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedUserId(member.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                      {member.teamName && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {member.teamName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-lg font-bold">{workload.matters}</div>
                      <div className="text-xs text-muted-foreground">Matters</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">
                        {workload.overdueTasks}
                      </div>
                      <div className="text-xs text-muted-foreground">Overdue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {workload.criticalDeadlines}
                      </div>
                      <div className="text-xs text-muted-foreground">Critical</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={(e) => {
                      e.stopPropagation()
                      setSelectedUserId(member.id)
                    }}>
                      View Details
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Staff Detail Sheet */}
      {selectedUserId && (
        <Sheet open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {mockUsers.find((u) => u.id === selectedUserId)?.name || "Team Member"}
              </SheetTitle>
              <SheetDescription>
                View assigned matters, tasks, and calendar for this team member
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <MattersTableMini
                matters={getMattersByOwner(selectedUserId)}
                showOwner={false}
              />
              <TasksList
                tasksDueToday={getTasksByAssignee(selectedUserId).filter((t) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const dueDate = new Date(t.dueAt)
                  dueDate.setHours(0, 0, 0, 0)
                  return dueDate.getTime() === today.getTime()
                })}
                overdueTasks={getOverdueTasks().filter((t) => t.assignedToId === selectedUserId)}
                tasksNext7Days={getTasksByAssignee(selectedUserId).filter((t) => {
                  const today = new Date()
                  const nextWeek = new Date(today)
                  nextWeek.setDate(nextWeek.getDate() + 7)
                  return new Date(t.dueAt) >= today && new Date(t.dueAt) <= nextWeek
                })}
              />
              <CalendarMini events={getEventsByAttendee(selectedUserId).slice(0, 5)} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

