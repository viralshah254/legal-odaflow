"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Task } from "@/lib/mock/tasks"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface TasksListProps {
  tasksDueToday: Task[]
  overdueTasks: Task[]
  tasksNext7Days: Task[]
  className?: string
}

export function TasksList({ tasksDueToday, overdueTasks, tasksNext7Days, className }: TasksListProps) {
  const renderTaskItem = (task: Task) => {
    const isOverdue = new Date(task.dueAt) < new Date() && task.status !== "Done"
    const priorityColors = {
      Critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
      High: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
      Normal: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      Low: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    }

    return (
      <div
        key={task.id}
        className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
      >
        <div className="mt-0.5">
          {task.status === "Done" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : isOverdue ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link href={`/app/tasks?task=${task.id}`} className="font-medium text-sm hover:text-primary transition-colors">
              {task.title}
            </Link>
            <Badge variant="outline" className={cn("text-xs shrink-0", priorityColors[task.priority])}>
              {task.priority}
            </Badge>
          </div>
          {task.matterTitle && (
            <p className="text-xs text-muted-foreground mb-1">Matter: {task.matterTitle}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Due: {format(new Date(task.dueAt), "MMM d, yyyy")}</span>
            {isOverdue && <span className="text-red-600 dark:text-red-400 font-medium">Overdue</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>My Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today">
              Today ({tasksDueToday.length})
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue ({overdueTasks.length})
            </TabsTrigger>
            <TabsTrigger value="next7">
              Next 7 Days ({tasksNext7Days.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-4 space-y-2">
            {tasksDueToday.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks due today</p>
            ) : (
              tasksDueToday.map(renderTaskItem)
            )}
          </TabsContent>
          <TabsContent value="overdue" className="mt-4 space-y-2">
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No overdue tasks</p>
            ) : (
              overdueTasks.map(renderTaskItem)
            )}
          </TabsContent>
          <TabsContent value="next7" className="mt-4 space-y-2">
            {tasksNext7Days.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks in the next 7 days</p>
            ) : (
              tasksNext7Days.map(renderTaskItem)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

