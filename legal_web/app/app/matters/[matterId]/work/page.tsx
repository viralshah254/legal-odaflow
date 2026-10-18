"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Circle,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Video,
} from "lucide-react"

import { ImportMeetingModal } from "@/components/meetings/import-meeting-modal"
import { MeetingGate } from "@/components/meetings/meeting-gate"
import { MeetingsList } from "@/components/meetings/meetings-list"
import { UploadMeetingModal } from "@/components/meetings/upload-meeting-modal"
import { MatterTimeline } from "@/components/matters/matter-timeline"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { getMatter } from "@/lib/api/matters"
import { addMatterNote, listMatterNotes, type ApiMatterNote } from "@/lib/api/matter-notes"
import { queryKeys } from "@/lib/api/query-keys"
import { listTasks, type ApiTask } from "@/lib/api/tasks"
import { listTimelineEvents, type ApiTimelineEvent } from "@/lib/api/timeline"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useRole } from "@/lib/contexts/role-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  buildWorkHubHref,
  resolveWorkHubView,
} from "@/lib/matters/work-hub-state"
import type { TimelineEvent } from "@/lib/types/timeline"
import { hasMeetingPermission } from "@/lib/types/roles"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

function isDone(status: string) {
  return ["DONE", "COMPLETED"].includes(status.toUpperCase())
}

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

export default function MatterWorkPage() {
  const t = useTranslations("matters")
  const params = useParams()
  const matterId = params.matterId as string
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const activeView = resolveWorkHubView(searchParams.get("view"))
  const contentHeadingRef = useRef<HTMLHeadingElement>(null)

  const {
    data: matter,
    isLoading,
    isError,
    refetch,
  } = useApiData(queryKeys.matters.detail(activeTenantId, matterId), {
    apiFn: () => getMatter(activeTenantId!, matterId),
    enabled: !!activeTenantId && !!matterId,
  })

  const changeView = (view: string) => {
    router.push(
      buildWorkHubHref(matterId, resolveWorkHubView(view), searchParams.toString()),
      { scroll: false },
    )
    window.requestAnimationFrame(() => contentHeadingRef.current?.focus())
  }

  if (isLoading || !activeTenantId) return <PageSkeleton className="p-4 sm:p-6" />
  if (isError || !matter) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load this matter"
        description="The matter work hub is temporarily unavailable."
        actionLabel="Retry"
        onAction={() => void refetch()}
        className="m-4 sm:m-6"
      />
    )
  }

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId}>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">{t("workspace.work")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep tasks, meetings, notes, and the matter timeline together.
          </p>
        </div>

        <Tabs value={activeView} onValueChange={changeView}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="tasks"><CheckSquare className="mr-2 h-4 w-4" />{t("workspace.tasks")}</TabsTrigger>
            <TabsTrigger value="meetings"><Video className="mr-2 h-4 w-4" />{t("workspace.meetings")}</TabsTrigger>
            <TabsTrigger value="notes"><MessageSquareText className="mr-2 h-4 w-4" />{t("notes")}</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="mr-2 h-4 w-4" />{t("activity_timeline")}</TabsTrigger>
          </TabsList>
          <h3 ref={contentHeadingRef} tabIndex={-1} className="sr-only">
            {activeView}
          </h3>

          <TabsContent value="tasks" className="mt-5">
            <MatterTasksView
              tenantId={activeTenantId}
              matterId={matterId}
              active={activeView === "tasks"}
              highlightTaskId={searchParams.get("highlight") ?? searchParams.get("task")}
            />
          </TabsContent>
          <TabsContent value="meetings" className="mt-5">
            <MatterMeetingsView matterId={matterId} />
          </TabsContent>
          <TabsContent value="notes" className="mt-5">
            <MatterNotesView tenantId={activeTenantId} matterId={matterId} active={activeView === "notes"} />
          </TabsContent>
          <TabsContent value="activity" className="mt-5">
            <MatterActivityView tenantId={activeTenantId} matterId={matterId} active={activeView === "activity"} />
          </TabsContent>
        </Tabs>
      </div>
    </MatterWorkspaceShell>
  )
}

function MatterTasksView({
  tenantId,
  matterId,
  active,
  highlightTaskId,
}: {
  tenantId: string
  matterId: string
  active: boolean
  highlightTaskId: string | null
}) {
  const t = useTranslations("matters")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"open" | "completed" | "all">(
    highlightTaskId ? "all" : "open",
  )
  const { data: tasks = [], isLoading, isError, refetch } = useApiData<ApiTask[]>(
    ["matter-work-tasks", tenantId, matterId],
    {
      apiFn: () => listTasks(tenantId, matterId),
      enabled: active,
    },
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks.filter((task) => {
      const done = isDone(task.status)
      return (
        (!query ||
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)) &&
        (status === "all" || (status === "completed" ? done : !done))
      )
    })
  }, [search, status, tasks])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
          </div>
          <div className="flex rounded-md border p-1" aria-label="Filter tasks by status">
            {(["open", "completed", "all"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={status === value ? "secondary" : "ghost"}
                onClick={() => setStatus(value)}
                className="flex-1 capitalize"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href={`/app/tasks/new?matterId=${matterId}`}>
            <Plus className="mr-2 h-4 w-4" />
            {t("add_task")}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-label="Loading matter tasks">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20" />)}
        </div>
      ) : isError ? (
        <RetryPanel message="Matter tasks could not be loaded." onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={tasks.length ? "No tasks match these filters" : t("no_tasks_yet")}
          description={t("tasks_tab_description")}
          actionLabel={tasks.length ? undefined : t("add_task")}
          actionHref={tasks.length ? undefined : `/app/tasks/new?matterId=${matterId}`}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <Card
              key={task.id}
              className={cn(
                isDone(task.status) && "opacity-60",
                highlightTaskId === task.id && "border-primary ring-2 ring-primary",
              )}
            >
              <CardContent className="flex items-start gap-3 p-4">
                {isDone(task.status) ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", isDone(task.status) && "line-through")}>{task.title}</p>
                  {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{task.priority}</Badge>
                    <Badge variant="secondary">{task.status.replaceAll("_", " ")}</Badge>
                    {task.dueDate && <span>Due {format(new Date(task.dueDate), "MMM d, yyyy")}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MatterMeetingsView({ matterId }: { matterId: string }) {
  const { currentRole } = useRole()
  const setRecordMeetingOpen = useUIStore((state) => state.setRecordMeetingOpen)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  return (
    <>
      <MeetingGate permission="meetingsRead">
        <MeetingsList
          matterId={matterId}
          showActions
          onRecordClick={
            hasMeetingPermission(currentRole, "meetingsRecord")
              ? () => setRecordMeetingOpen(true)
              : undefined
          }
          onUploadClick={
            hasMeetingPermission(currentRole, "meetingsUpload")
              ? () => setUploadOpen(true)
              : undefined
          }
          onImportClick={() => setImportOpen(true)}
        />
      </MeetingGate>
      {hasMeetingPermission(currentRole, "meetingsUpload") && (
        <UploadMeetingModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          initialMatterId={matterId}
          requireClientSelection
        />
      )}
      <ImportMeetingModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}

function MatterNotesView({
  tenantId,
  matterId,
  active,
}: {
  tenantId: string
  matterId: string
  active: boolean
}) {
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: notes = [], isLoading, isError, refetch } = useApiData<ApiMatterNote[]>(
    ["matter-notes", tenantId, matterId],
    {
      apiFn: () => listMatterNotes(tenantId, matterId),
      enabled: active,
    },
  )

  const addNote = async () => {
    if (!body.trim() || saving) return
    setSaving(true)
    try {
      await addMatterNote(tenantId, matterId, body.trim())
      setBody("")
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.operationalTimeline(tenantId, matterId),
        }),
      ])
    } catch {
      toast({ title: "Could not add note", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a matter note…"
            aria-label="Matter note"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={!body.trim() || saving} onClick={() => void addNote()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add note
            </Button>
          </div>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="space-y-2" aria-label="Loading matter notes">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
        </div>
      ) : isError ? (
        <RetryPanel message="Matter notes could not be loaded." onRetry={() => void refetch()} />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No notes yet"
          description="Add the first internal note for this matter."
        />
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {note.authorName ?? "Team member"} · {format(new Date(note.createdAt), "MMM d, yyyy · h:mm a")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MatterActivityView({
  tenantId,
  matterId,
  active,
}: {
  tenantId: string
  matterId: string
  active: boolean
}) {
  const { data: events = [], isLoading, isError, refetch } = useApiData<ApiTimelineEvent[]>(
    queryKeys.matters.operationalTimeline(tenantId, matterId),
    {
      apiFn: () => listTimelineEvents(tenantId, matterId),
      enabled: active,
    },
  )
  const timeline = useMemo(
    () => events.map(toTimelineEvent).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [events],
  )
  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20" />)}</div>
  }
  if (isError) return <RetryPanel message="Matter activity could not be loaded." onRetry={() => void refetch()} />
  return <MatterTimeline events={timeline} />
}

function RetryPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 p-8 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  )
}
