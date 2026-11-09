"use client"


import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listTasks } from "@/lib/api/tasks"
import { Button } from "@/components/ui/button"

export default function TasksPage() {
  const tRelease = useTranslations("common.release")
  const { activeTenantId } = useTenant()
  const [showCompleted, setShowCompleted] = useState(false)
  const { data: tasks = [], isLoading, error } = useApiData(
    ["tasks-all", activeTenantId],
    { apiFn: () => listTasks(activeTenantId!), enabled: !!activeTenantId },
  )
  const visibleTasks = useMemo(() => tasks
    .filter((task) => showCompleted || !["DONE", "COMPLETED", "CANCELLED"].includes(task.status.toUpperCase()))
    .sort((a, b) => {
      const date = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity
      return date(a.dueDate) - date(b.dueDate)
    }), [tasks, showCompleted])

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{tRelease("tasksTitle")}</h1>
          <p className="text-sm text-muted-foreground">{tRelease("tasksDescription")}</p>
        </div>
        <Button asChild><Link href="/app/tasks/new">{tRelease("newTask")}</Link></Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
        Include completed and cancelled tasks
      </label>
      {!activeTenantId ? <p>{tRelease("selectFirmTasks")}</p>
        : isLoading ? <p role="status">{tRelease("loadingTasks")}</p>
        : error ? <p role="alert">{tRelease("tasksLoadFailed")}</p>
        : visibleTasks.length === 0 ? <p>{tRelease("noTasks")}</p>
        : <ul className="divide-y rounded-lg border">
          {visibleTasks.map((task) => {
            const due = task.dueDate ? new Date(task.dueDate) : null
            const validDue = due && Number.isFinite(due.getTime()) ? due : null
            const overdue = validDue && validDue.getTime() < Date.now() && !["DONE", "COMPLETED", "CANCELLED"].includes(task.status.toUpperCase())
            return <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground">{task.status} · {task.priority}</p>
                {task.matterId && <Link className="text-sm underline" href={`/app/matters/${task.matterId}/tasks`}>{tRelease("openMatterTasks")}</Link>}
              </div>
              <span className={overdue ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>
                {overdue ? "Overdue · " : ""}{validDue ? validDue.toLocaleDateString() : "No deadline set"}
              </span>
            </li>
          })}
        </ul>}
    </main>
  )
}
