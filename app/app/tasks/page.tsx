"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tasksApi } from "@/lib/mock-api"
import { formatDate } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { Plus } from "lucide-react"

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState("today")

  useEffect(() => {
    async function loadTasks() {
      const filters: any = {}
      if (view === "overdue") filters.overdue = true
      if (view === "today") filters.dueToday = true
      const data = await tasksApi.listTasks(filters)
      setTasks(data)
    }
    loadTasks()
  }, [view])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage your tasks and deadlines</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="next7">Next 7 Days</TabsTrigger>
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
                        <Badge variant={task.priority === "CRITICAL" ? "destructive" : "secondary"}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                      {task.matter && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Matter: {task.matter.title}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Due: {formatDate(task.dueDate)}
                      </p>
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

