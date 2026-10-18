"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, BookOpen, Loader2, Plus, Trash2 } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  createPlaybook,
  deletePlaybook,
  listPlaybooks,
  type ApiPlaybook,
} from "@/lib/api/playbooks"
import { ApiClientError } from "@/lib/api/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContractPlaybooksTab } from "@/components/settings/contract-playbooks-tab"

export default function PlaybooksSettingsPage() {
  const t = useTranslations("settings")
  const tBilling = useTranslations("billing")
  const tMatters = useTranslations("matters")
  const tLawyer = useTranslations("lawyer")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: playbooks = [], isLoading, error } = useApiData(
    ["playbooks", activeTenantId],
    {
      apiFn: () => listPlaybooks(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const handleDelete = async (playbook: ApiPlaybook) => {
    if (!activeTenantId) return
    if (!confirm(`Delete playbook "${playbook.name}"?`)) return

    setDeletingId(playbook.id)
    try {
      await deletePlaybook(activeTenantId, playbook.id)
      await queryClient.invalidateQueries({ queryKey: ["playbooks", activeTenantId] })
    } finally {
      setDeletingId(null)
    }
  }

  if (!activeTenantId) {
    return (
      <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER"]}>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Your firm workspace is still loading.
            </CardContent>
          </Card>
        </div>
      </RoleGate>
    )
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{t("matter_playbooks")}</h1>
            <p className="text-muted-foreground">
              Reusable task templates for common matter types
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Playbook
          </Button>
        </div>

        <Tabs defaultValue="matter" className="space-y-6">
          <TabsList>
            <TabsTrigger value="matter">Matter playbooks</TabsTrigger>
            <TabsTrigger value="contract">Contract rulebooks</TabsTrigger>
          </TabsList>

          <TabsContent value="matter" className="space-y-6">
        {error && (
          <Card>
            <CardContent className="py-6 text-destructive">{error.message}</CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : playbooks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-10 w-10 mb-4 opacity-50" />
              No playbooks yet. Create one to standardize matter onboarding tasks.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {playbooks.map((playbook) => {
              const tasks = Array.isArray(playbook.taskTemplates)
                ? playbook.taskTemplates
                : []
              return (
                <Card key={playbook.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{playbook.name}</CardTitle>
                        {playbook.description && (
                          <CardDescription className="mt-1">
                            {playbook.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={playbook.isEnabled ? "default" : "secondary"}>
                          {playbook.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          disabled={deletingId === playbook.id}
                          onClick={() => handleDelete(playbook)}
                        >
                          {deletingId === playbook.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {playbook.matterType && <p>Matter type: {playbook.matterType}</p>}
                    {playbook.practiceArea && <p>Practice area: {playbook.practiceArea}</p>}
                    {playbook.countryCode && (
                      <p>
                        Jurisdiction: {[playbook.countryCode, playbook.jurisdiction]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p>{tasks.length} task template{tasks.length !== 1 ? "s" : ""}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <CreatePlaybookDialog
          tenantId={activeTenantId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
          </TabsContent>

          <TabsContent value="contract">
            <ContractPlaybooksTab />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGate>
  )
}

function CreatePlaybookDialog({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings")
  const tBilling = useTranslations("billing")
  const tMatters = useTranslations("matters")
  const tLawyer = useTranslations("lawyer")
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [matterType, setMatterType] = useState("")
  const [practiceArea, setPracticeArea] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [isEnabled, setIsEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setDescription("")
    setMatterType("")
    setPracticeArea("")
    setTaskTitle("")
    setIsEnabled(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!name.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      await createPlaybook(tenantId, {
        name: name.trim(),
        description: description.trim() || undefined,
        matterType: matterType.trim() || undefined,
        practiceArea: practiceArea.trim() || undefined,
        taskTemplates: taskTitle.trim()
          ? [{ title: taskTitle.trim(), priority: "MEDIUM" }]
          : [{ title: "Initial client intake review", priority: "HIGH" }],
        isEnabled,
      })
      await queryClient.invalidateQueries({ queryKey: ["playbooks", tenantId] })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create playbook")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("create_playbook")}</DialogTitle>
          <DialogDescription>
            Define a reusable set of tasks for a matter type or practice area.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="playbook-name">{tBilling("name_2")}</Label>
            <Input
              id="playbook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("employment_dispute_intake")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="playbook-description">{tBilling("description")}</Label>
            <Textarea
              id="playbook-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="playbook-matter-type">{tMatters("matterType")}</Label>
              <Input
                id="playbook-matter-type"
                value={matterType}
                onChange={(e) => setMatterType(e.target.value)}
                placeholder={tMatters("practiceAreas.litigation")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playbook-practice">{tLawyer("practice_area")}</Label>
              <Input
                id="playbook-practice"
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                placeholder={t("employment")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="playbook-task">{t("starter_task_title")}</Label>
            <Input
              id="playbook-task"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={t("review_client_documents")}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="playbook-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            <Label htmlFor="playbook-enabled">{t("enabled")}</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
