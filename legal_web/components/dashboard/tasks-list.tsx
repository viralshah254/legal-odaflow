"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
export interface DashboardTask {
  id: string
  title: string
  priority: string
  status: string
  dueAt: Date | string
  matterTitle?: string
  assignedToName?: string
}
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertCircle, ClipboardList, CalendarCheck, Inbox } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface TasksListProps {
  tasksDueToday: DashboardTask[]
  overdueTasks: DashboardTask[]
  tasksNext7Days: DashboardTask[]
  className?: string
}

const priorityStyles: Record<string, { border: string; badge: string }> = {
  Critical: {
    border: "border-l-red-500",
    badge: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
  High: {
    border: "border-l-orange-500",
    badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  },
  Normal: {
    border: "border-l-blue-500",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  Low: {
    border: "border-l-slate-400",
    badge: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  },
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof ClipboardList
  title: string
  subtitle: string
}) {
  const tt = useTranslations("dashboard.tasks")
  const t = useTranslations("dashboard")
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

export function TasksList({ tasksDueToday, overdueTasks, tasksNext7Days, className }: TasksListProps) {
  const t = useTranslations("dashboard")
  const tt = useTranslations("dashboard.tasks")

  const renderTaskItem = (task: DashboardTask) => {
    const isOverdue = new Date(task.dueAt) < new Date() && task.status !== "Done"
    const styles = priorityStyles[task.priority] ?? priorityStyles.Normal

    return (
      <div
        key={task.id}
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border border-l-2 border-border/50 transition-all duration-200",
          "hover:bg-accent/50 hover:border-l-primary/60 hover:shadow-sm",
          styles.border,
          "group",
        )}
      >
        <div className="mt-0.5 shrink-0">
          {task.status === "Done" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : isOverdue ? (
            <AlertCircle className="h-4 w-4 text-red-600 animate-pulse" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link
              href={`/app/tasks?task=${task.id}`}
              className="font-medium text-sm hover:text-primary transition-colors line-clamp-2"
            >
              {task.title}
            </Link>
            <Badge variant="outline" className={cn("text-xs shrink-0", styles.badge)}>
              {task.priority}
            </Badge>
          </div>
          {task.matterTitle && (
            <p className="text-xs text-muted-foreground mb-1 truncate">
              {tt("matterLabel", { title: task.matterTitle })}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{tt("dueLabel", { date: format(new Date(task.dueAt), "MMM d, yyyy") })}</span>
            {isOverdue && (
              <span className="text-red-600 dark:text-red-400 font-semibold">• {tt("overdueLabel")}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{tt("myTasks")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={overdueTasks.length > 0 ? "overdue" : "today"} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="today" className="text-xs">
              {t("today")}
              {tasksDueToday.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                  {tasksDueToday.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs">
              {t("overdueTasks")}
              {overdueTasks.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-bold">
                  {overdueTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="next7" className="text-xs">
              {tt("next7d")}
              {tasksNext7Days.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                  {tasksNext7Days.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4">
            {tasksDueToday.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title={tt("nothingDueToday")}
                subtitle={tt("caughtUpToday")}
              />
            ) : (
              <div className="space-y-2 motion-stagger-list">
                {tasksDueToday.map(renderTaskItem)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="overdue" className="mt-4">
            {overdueTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={tt("noOverdueTasks")}
                subtitle={tt("greatWorkOnTrack")}
              />
            ) : (
              <div className="space-y-2 motion-stagger-list">
                {overdueTasks.map(renderTaskItem)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="next7" className="mt-4">
            {tasksNext7Days.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={tt("nothingNext7Days")}
                subtitle={tt("scheduleClear")}
              />
            ) : (
              <div className="space-y-2 motion-stagger-list">
                {tasksNext7Days.map(renderTaskItem)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
