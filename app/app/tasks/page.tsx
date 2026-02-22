"use client"

"use client"

import { useEffect, useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tasksApi } from "@/lib/mock-api"
import { formatDate } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { Plus } from "lucide-react"
import { mockTasks, getCompletedTasks, getTasksByAssignee, type Task as MockTask } from "@/lib/mock/tasks"
import { mockUsers } from "@/lib/mock/users"
import { RoleGate } from "@/components/dashboard/role-gate"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import Link from "next/link"

export default function TasksPage() {
  const { currentRole, currentUser } = useRole()
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  const [tasks, setTasks] = useState<MockTask[]>([])
  const [view, setView] = useState("today")

  useEffect(() => {
    function loadTasks() {
      let filteredTasks: MockTask[] = []
      
      if (view === "completed") {
        filteredTasks = getCompletedTasks()
      } else if (view === "overdue") {
        filteredTasks = mockTasks.filter((t) => {
          const now = new Date()
          return new Date(t.dueAt) < now && t.status !== "Done"
        })
      } else if (view === "today") {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        filteredTasks = mockTasks.filter((t) => {
          const dueDate = new Date(t.dueAt)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate >= today && dueDate < tomorrow && t.status !== "Done"
        })
      } else if (view === "next7") {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)
        filteredTasks = mockTasks.filter((t) => {
          const dueDate = new Date(t.dueAt)
          return dueDate >= today && dueDate <= nextWeek && t.status !== "Done"
        })
      } else {
        filteredTasks = [...mockTasks]
      }

      // Filter by role - non-admins only see their own tasks
      if (currentRole !== "PARTNER_ADMIN") {
        filteredTasks = filteredTasks.filter((t) => t.assignedToId === user.id)
      }

      setTasks(filteredTasks)
    }
    loadTasks()
  }, [view, currentRole, user.id])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage your tasks and deadlines</p>
        </div>
        <div className="flex items-center gap-2">
          <OpenCopilotButton />
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
            <Link href="/app/tasks/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </Link>
          </RoleGate>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="next7">Next 7 Days</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="space-y-4">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No tasks found
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{task.title}</h3>
                        <Badge variant={task.priority === "Critical" ? "destructive" : task.priority === "High" ? "default" : "secondary"}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                      {task.matterTitle && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Matter:{" "}
                          {task.matterId ? (
                            <Link
                              href={`/app/matters/${task.matterId}`}
                              className="hover:underline text-primary"
                            >
                              {task.matterTitle}
                            </Link>
                          ) : (
                            task.matterTitle
                          )}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <p>Due: {formatDate(task.dueAt)}</p>
                        {task.assignedToName && currentRole === "PARTNER_ADMIN" && (
                          <p>Assigned to: {task.assignedToName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

