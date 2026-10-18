"use client"
import { useTranslations } from "next-intl"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { createTask } from "@/lib/api/tasks"
import { listMatters } from "@/lib/api/matters"
import { listTenantUsers } from "@/lib/api/users"
import { listClients } from "@/lib/api/clients"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  TaskFormFields,
  type TaskFields,
} from "@/components/tasks/task-form-fields"

export default function NewTaskPage() {
  const toISOString = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const tDashboard = useTranslations("dashboard")
  const t = useTranslations("lawyer")
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">{tCommon("loading")}</div>}>
      <NewTaskPageContent />
    </Suspense>
  )
}

function NewTaskPageContent() {
  const tDashboard = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const initialMatterId = searchParams.get("matterId") ?? ""

  const { data: matters = [], isLoading: mattersLoading } = useApiData(
    ["matters-for-task", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: tenantUsers = [], isLoading: usersLoading } = useApiData(
    ["tenant-users-for-task", activeTenantId],
    { apiFn: () => listTenantUsers(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: clients = [], isLoading: clientsLoading } = useApiData(
    ["clients-for-task", activeTenantId],
    { apiFn: () => listClients(activeTenantId!), enabled: !!activeTenantId },
  )

  const [fields, setFields] = useState<Partial<TaskFields>>({
    title: "",
    description: "",
    notes: "",
    matterId: initialMatterId,
    priority: "Normal",
    dueDate: "",
    participants: [],
  })
  const [submitting, setSubmitting] = useState(false)

  // Default assignee once users are loaded
  useEffect(() => {
    if (fields.assigneeId || tenantUsers.length === 0) return
    const defaultId =
      currentUser?.id && tenantUsers.some((tu) => tu.userId === currentUser.id)
        ? currentUser.id
        : tenantUsers[0]?.userId
    if (defaultId) setFields((f) => ({ ...f, assigneeId: defaultId }))
  }, [tenantUsers, currentUser?.id, fields.assigneeId])

  const canSubmit =
    !!fields.title?.trim() && !!fields.dueDate && !!fields.assigneeId && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !activeTenantId) return
    setSubmitting(true)
    try {
      await createTask(activeTenantId, {
        title: fields.title!,
        description: fields.description || undefined,
        notes: fields.notes || undefined,
        matterId: fields.matterId || undefined,
        assigneeId: fields.assigneeId,
        dueDate: new Date(fields.dueDate!).toISOString(),
        priority: fields.priority ?? "Normal",
        status: "Todo",
        participants: fields.participants ?? [],
      })
      router.push(
        fields.matterId
          ? `/app/matters/${fields.matterId}/work`
          : "/app/matters?workView=tasks",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={
            initialMatterId
              ? `/app/matters/${initialMatterId}/work`
              : "/app/matters?workView=tasks"
          }
        >
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{tDashboard("newTask")}</h1>
          <p className="text-muted-foreground">{t("create_a_new_task_and_assign_participants")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("task_details")}</CardTitle>
          <CardDescription>
            Fill in the task information below. All participants will receive calendar reminders and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TaskFormFields
              value={fields}
              onChange={setFields}
              matters={matters}
              tenantUsers={tenantUsers}
              clients={clients}
              mattersLoading={mattersLoading}
              usersLoading={usersLoading}
              clientsLoading={clientsLoading}
              dueDateRequired
            />

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/app/tasks">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
