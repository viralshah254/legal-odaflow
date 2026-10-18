"use client"
import { useTranslations } from "next-intl"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useSearchParams } from "next/navigation"
import { CalendarView } from "@/components/calendar/calendar-view"
import { CreateEventDialog } from "@/components/calendar/create-event-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Clock,
  MapPin,
  FileText,
  X,
  Loader2,
  CheckSquare,
  AlertCircle,
} from "lucide-react"
import { format, addDays, isSameDay, isAfter } from "date-fns"
import {
  listCalendarEvents,
  createCalendarEvent,
  getCalendarEvent,
  type ApiCalendarEvent,
} from "@/lib/api/calendar"
import { listTasks, type ApiTask } from "@/lib/api/tasks"
import { useApiData } from "@/lib/hooks/use-api-data"
import type { CalendarDisplayEvent } from "@/lib/types/calendar-display"
import Link from "next/link"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQueryClient } from "@tanstack/react-query"

function apiEventToDisplay(e: ApiCalendarEvent): CalendarDisplayEvent {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    startAt: new Date(e.startAt),
    endAt: new Date(e.endAt),
    type: e.type === "TASK_DEADLINE" ? "Deadline" : ((e.type as CalendarDisplayEvent["type"]) ?? "Meeting"),
    location: e.location ?? undefined,
    matterId: e.matterId ?? undefined,
    taskId: e.taskId ?? undefined,
  }
}

function taskToCalendarEvent(task: ApiTask): CalendarDisplayEvent | null {
  if (!task.dueDate) return null
  const due = new Date(task.dueDate)
  const isDone =
    task.status.toUpperCase() === "DONE" ||
    task.status.toUpperCase() === "COMPLETED"
  if (isDone) return null
  return {
    id: `task-${task.id}`,
    title: `📋 ${task.title}`,
    description: task.description ?? undefined,
    startAt: due,
    endAt: due,
    type: "Deadline",
    matterId: task.matterId ?? undefined,
  }
}

function CalendarContent() {
  const tCommon = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const tDashboard = useTranslations("lawyer")
  const { currentRole, currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const eventId = searchParams.get("event")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarDisplayEvent | null>(null)
  const [showTasks, setShowTasks] = useState(true)

  const from = useMemo(() => addDays(new Date(), -30).toISOString(), [])
  const to = useMemo(() => addDays(new Date(), 90).toISOString(), [])

  const { data: apiEvents = [], isLoading, error } = useApiData(
    ["calendar-events", activeTenantId, from, to],
    {
      apiFn: () => listCalendarEvents(activeTenantId!, from, to),
      enabled: !!activeTenantId,
    },
  )

  const { data: apiTasks = [] } = useApiData<ApiTask[]>(
    ["tasks-for-calendar", activeTenantId],
    {
      apiFn: () => listTasks(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const calendarEvents = useMemo(
    () => (apiEvents ?? []).map(apiEventToDisplay),
    [apiEvents],
  )

  const taskEvents = useMemo((): CalendarDisplayEvent[] => {
    if (!showTasks) return []
    const userId = currentUser?.id
    // Server-synced TASK_DEADLINE events (from CalendarEvent table, already per-user)
    // already appear in calendarEvents. Client-side merge acts as fallback for tasks
    // that haven't been synced yet (e.g. tasks without participants).
    const serverTaskIds = new Set(
      calendarEvents.filter((e) => e.taskId).map((e) => e.taskId!),
    )
    return (apiTasks ?? [])
      .filter((t) => {
        if (!t.dueDate) return false
        if (serverTaskIds.has(t.id)) return false // already shown via server row
        // Non-admins only see their own tasks
        if (currentRole !== "PARTNER_ADMIN" && userId && t.assignedToId !== userId)
          return false
        return true
      })
      .map(taskToCalendarEvent)
      .filter((e): e is CalendarDisplayEvent => e !== null)
  }, [apiTasks, calendarEvents, showTasks, currentRole, currentUser?.id])

  const allEvents = useMemo(
    () => [
      ...calendarEvents,
      ...(showTasks ? taskEvents : []),
    ],
    [calendarEvents, taskEvents, showTasks],
  )

  const handleCreateEvent = async (
    eventData: Parameters<typeof createCalendarEvent>[1],
  ) => {
    if (!activeTenantId) return
    await createCalendarEvent(activeTenantId, eventData)
    queryClient.invalidateQueries({ queryKey: ["calendar-events", activeTenantId] })
    setCreateDialogOpen(false)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setCreateDialogOpen(true)
  }

  const handleEventClick = (event: CalendarDisplayEvent) => {
    setSelectedEvent(event)
  }

  useEffect(() => {
    if (!eventId || !activeTenantId) return
    getCalendarEvent(activeTenantId, eventId)
      .then((e) => setSelectedEvent(apiEventToDisplay(e)))
      .catch(() => {})
  }, [eventId, activeTenantId])

  const now = new Date()
  const eventsThisWeek = useMemo(() => {
    const weekEnd = addDays(now, 7)
    return allEvents.filter((e) => e.startAt >= now && e.startAt <= weekEnd)
  }, [allEvents]) // eslint-disable-line react-hooks/exhaustive-deps

  const eventsToday = useMemo(() => {
    const todayStr = format(now, "yyyy-MM-dd")
    return allEvents.filter((e) => format(e.startAt, "yyyy-MM-dd") === todayStr)
  }, [allEvents]) // eslint-disable-line react-hooks/exhaustive-deps

  const upcomingTasksDue = useMemo(() => {
    const in7 = addDays(now, 7)
    return (apiTasks ?? []).filter((t) => {
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      const isDone =
        t.status.toUpperCase() === "DONE" ||
        t.status.toUpperCase() === "COMPLETED"
      return !isDone && isAfter(due, now) && due <= in7
    })
  }, [apiTasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const isTaskEvent = (e: CalendarDisplayEvent) =>
    e.id.startsWith("task-") || e.type === "Deadline"

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tCommon("calendar")}</h1>
          <p className="text-muted-foreground">{t("view_and_manage_your_schedule")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showTasks ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowTasks(!showTasks)}
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            {showTasks ? "Hide tasks" : "Show tasks"}
          </Button>
          <OpenCopilotButton />
          <Button onClick={() => setCreateDialogOpen(true)} data-tour="calendar-create">
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-destructive">
            Failed to load calendar events
          </CardContent>
        </Card>
      )}

      {showTasks && taskEvents.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Task deadlines shown on calendar
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>{taskEvents.length} task{taskEvents.length !== 1 ? "s" : ""} with due dates</span>
        </div>
      )}

      <div data-tour="calendar-view">
      <CalendarView
        events={allEvents}
        onDateClick={handleDateClick}
        onEventClick={handleEventClick}
      />
      </div>

      {/* Event / Task detail dialog */}
      {selectedEvent && (
        <Dialog
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-xl">
                    {isTaskEvent(selectedEvent)
                      ? selectedEvent.title.replace(/^📋\s*/, "")
                      : selectedEvent.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2" asChild>
                    <div className="flex items-center gap-2">
                      {isTaskEvent(selectedEvent) ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" />
                          Task deadline
                        </Badge>
                      ) : (
                        selectedEvent.type && (
                          <Badge variant="outline">{selectedEvent.type}</Badge>
                        )
                      )}
                    </div>
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedEvent(null)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.description}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {format(selectedEvent.startAt, "EEEE, MMMM d, yyyy")}
                  </div>
                  {!isTaskEvent(selectedEvent) && (
                    <div className="text-sm text-muted-foreground">
                      {format(selectedEvent.startAt, "h:mm a")}
                      {selectedEvent.endAt &&
                        !isSameDay(selectedEvent.startAt, selectedEvent.endAt) &&
                        ` – ${format(selectedEvent.endAt, "h:mm a")}`}
                    </div>
                  )}
                </div>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    {selectedEvent.location}
                  </div>
                </div>
              )}
              {selectedEvent.matterId && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <Link
                    href={`/app/matters/${selectedEvent.matterId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    View matter
                  </Link>
                </div>
              )}
              {isTaskEvent(selectedEvent) && (
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <Link
                    href={
                      selectedEvent.taskId
                        ? `/app/tasks?highlight=${selectedEvent.taskId}`
                        : selectedEvent.id.startsWith("task-")
                        ? `/app/tasks?highlight=${selectedEvent.id.replace("task-", "")}`
                        : "/app/tasks"
                    }
                    className="text-sm text-primary hover:underline"
                  >
                    Open in Tasks
                  </Link>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={selectedDate || undefined}
        onSave={handleCreateEvent}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("total_events")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calendarEvents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("scheduled_events")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("this_week")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventsThisWeek.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Events + deadlines next 7 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{tDashboard("today")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventsToday.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("events_today")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4" />
              Tasks due soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingTasksDue.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("due_in_next_7_days")}</p>
            {upcomingTasksDue.length > 0 && (
              <Link
                href="/app/tasks?view=next7"
                className="text-xs text-primary hover:underline mt-1 block"
              >
                View tasks →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming task deadlines list */}
      {showTasks && upcomingTasksDue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Task deadlines this week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingTasksDue.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between py-1.5 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <Badge
                    variant={
                      task.priority === "HIGH" || task.priority === "URGENT"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {task.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "MMM d")
                      : ""}
                  </span>
                </div>
              </div>
            ))}
            {upcomingTasksDue.length > 5 && (
              <Link
                href="/app/tasks"
                className="text-xs text-primary hover:underline block pt-1"
              >
                + {upcomingTasksDue.length - 5} more tasks
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const taskToCalendarEvent = useTranslations("lawyer")
  const toISOString = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const t = useTranslations("lawyer")
  const tDashboard = useTranslations("dashboard")
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            Loading calendar...
          </div>
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  )
}
