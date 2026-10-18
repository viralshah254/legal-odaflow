"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Loader2, Plus, X, Users } from "lucide-react"
import type { ParticipantInput } from "@/lib/api/tasks"
import type { ApiMatter } from "@/lib/api/types"
import type { ApiClient } from "@/lib/api/types"

export type TenantUser = {
  userId: string
  role: string
  user: { name: string | null; email: string }
}

export interface TaskFields {
  title: string
  description: string
  notes: string
  matterId: string
  assigneeId: string
  priority: "Low" | "Normal" | "High" | "Critical"
  status: "Todo" | "In Progress" | "Done" | "Cancelled"
  dueDate: string
  participants: ParticipantInput[]
}

export type PartialTaskFields = Partial<TaskFields>

interface Props {
  value: PartialTaskFields
  onChange: (fields: PartialTaskFields) => void
  matters: ApiMatter[]
  tenantUsers: TenantUser[]
  clients: ApiClient[]
  mattersLoading?: boolean
  usersLoading?: boolean
  clientsLoading?: boolean
  /** Show status field (edit mode) */
  showStatus?: boolean
  /** Whether due date is required */
  dueDateRequired?: boolean
}

const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Critical"] as const
const STATUS_OPTIONS = ["Todo", "In Progress", "Done", "Cancelled"] as const

const ROLE_LABELS: Record<string, string> = {
  ASSIGNEE: "Assignee",
  COLLABORATOR: "Collaborator",
  WATCHER: "Watcher",
  CLIENT: "Client",
}

const ROLE_COLORS: Record<string, string> = {
  ASSIGNEE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  COLLABORATOR: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  WATCHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  CLIENT: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
}

export function TaskFormFields({
  value,
  onChange,
  matters,
  tenantUsers,
  clients,
  mattersLoading,
  usersLoading,
  clientsLoading,
  showStatus = false,
  dueDateRequired = false,
}: Props) {
  const t = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const [participantPopoverOpen, setParticipantPopoverOpen] = useState(false)
  const [participantSearch, setParticipantSearch] = useState("")

  const set = (fields: PartialTaskFields) => onChange({ ...value, ...fields })

  const participants = value.participants ?? []

  // Guarded select values to avoid Radix ref loops
  const matterSelectValue = useMemo(() => {
    if (!value.matterId) return "none"
    return matters.some((m) => m.id === value.matterId) ? value.matterId : "none"
  }, [value.matterId, matters])

  const assigneeSelectValue = useMemo(() => {
    if (!value.assigneeId) return undefined
    return tenantUsers.some((tu) => tu.userId === value.assigneeId)
      ? value.assigneeId
      : undefined
  }, [value.assigneeId, tenantUsers])

  // When a matter is selected, auto-suggest the matter's client as a participant chip
  const selectedMatter = useMemo(
    () => matters.find((m) => m.id === value.matterId),
    [matters, value.matterId],
  )

  useEffect(() => {
    if (!selectedMatter) return
    const matterClient = (selectedMatter as any).client as ApiClient | undefined
    if (!matterClient) return
    const alreadyAdded = participants.some(
      (p) => p.participantType === "CLIENT" && p.clientId === matterClient.id,
    )
    if (!alreadyAdded) {
      set({
        participants: [
          ...participants,
          { participantType: "CLIENT", clientId: matterClient.id, role: "CLIENT" },
        ],
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatter?.id])

  function addParticipant(p: ParticipantInput) {
    const alreadyAdded = participants.some(
      (ep) =>
        (p.participantType === "USER" && ep.userId === p.userId) ||
        (p.participantType === "CLIENT" && ep.clientId === p.clientId),
    )
    if (alreadyAdded) return
    set({ participants: [...participants, p] })
    setParticipantPopoverOpen(false)
    setParticipantSearch("")
  }

  function removeParticipant(index: number) {
    const next = [...participants]
    next.splice(index, 1)
    set({ participants: next })
  }

  // Filter candidates not already added
  const availableUsers = useMemo(
    () =>
      tenantUsers.filter(
        (tu) =>
          tu.userId !== value.assigneeId &&
          !participants.some(
            (p) => p.participantType === "USER" && p.userId === tu.userId,
          ) &&
          (participantSearch === "" ||
            (tu.user.name ?? tu.user.email)
              .toLowerCase()
              .includes(participantSearch.toLowerCase())),
      ),
    [tenantUsers, participants, value.assigneeId, participantSearch],
  )

  const availableClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          !participants.some(
            (p) => p.participantType === "CLIENT" && p.clientId === c.id,
          ) &&
          (participantSearch === "" ||
            c.name.toLowerCase().includes(participantSearch.toLowerCase())),
      ),
    [clients, participants, participantSearch],
  )

  function getParticipantLabel(p: ParticipantInput): string {
    if (p.participantType === "USER") {
      const tu = tenantUsers.find((u) => u.userId === p.userId)
      return tu ? (tu.user.name ?? tu.user.email) : p.userId ?? "Unknown"
    }
    const c = clients.find((cl) => cl.id === p.clientId)
    return c ? c.name : p.clientId ?? "Unknown"
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="tf-title">{t("task_title")}</Label>
        <Input
          id="tf-title"
          placeholder={t("enter_task_title")}
          value={value.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="tf-description">{tBilling("description")}</Label>
        <Textarea
          id="tf-description"
          placeholder={t("what_needs_to_be_done")}
          value={value.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="tf-notes">{t("notes_amp_context")}</Label>
        <Textarea
          id="tf-notes"
          placeholder={t("additional_context_references_or_instructions")}
          value={value.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value })}
          rows={3}
        />
      </div>

      {/* Matter */}
      <div className="space-y-2">
        <Label htmlFor="tf-matter">{t("matter_optional")}</Label>
        {mattersLoading ? (
          <div className="flex h-10 items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading matters…
          </div>
        ) : (
          <Select
            value={matterSelectValue}
            onValueChange={(v) => set({ matterId: v === "none" ? "" : v })}
          >
            <SelectTrigger id="tf-matter">
              <SelectValue placeholder={tBilling("select_a_matter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tAdmin("none")}</SelectItem>
              {matters.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Primary assignee + additional participants */}
      <div className="space-y-2">
        <Label htmlFor="tf-assignee">{t("primary_assignee")}</Label>
        {usersLoading ? (
          <div className="flex h-10 items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading team…
          </div>
        ) : tenantUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("no_team_members_found")}</p>
        ) : (
          <Select value={assigneeSelectValue} onValueChange={(v) => set({ assigneeId: v })}>
            <SelectTrigger id="tf-assignee">
              <SelectValue placeholder={t("select_assignee")} />
            </SelectTrigger>
            <SelectContent>
              {tenantUsers.map((tu) => (
                <SelectItem key={tu.userId} value={tu.userId}>
                  {tu.user.name ?? tu.user.email} ({tu.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Additional participants */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Additional participants
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (team members or clients)
          </span>
        </Label>

        <div className="flex flex-wrap gap-2 min-h-[2rem] p-2 rounded-md border bg-background">
          {participants.map((p, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[p.role] ?? "bg-gray-100 text-gray-700"}`}
            >
              {getParticipantLabel(p)}
              <span className="opacity-60 text-[10px]">
                {ROLE_LABELS[p.role] ?? p.role}
              </span>
              <button
                type="button"
                onClick={() => removeParticipant(i)}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <Popover
            open={participantPopoverOpen}
            onOpenChange={setParticipantPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <Input
                placeholder={t("search_team_or_clients")}
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {availableUsers.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
                      Team members
                    </p>
                    {availableUsers.map((tu) => (
                      <div key={tu.userId} className="space-y-0.5">
                        {(["COLLABORATOR", "WATCHER"] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() =>
                              addParticipant({
                                participantType: "USER",
                                userId: tu.userId,
                                role,
                              })
                            }
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                          >
                            <span>{tu.user.name ?? tu.user.email}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {ROLE_LABELS[role]}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    ))}
                  </>
                )}
                {availableClients.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 mt-1">
                      Clients
                    </p>
                    {availableClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          addParticipant({
                            participantType: "CLIENT",
                            clientId: c.id,
                            role: "CLIENT",
                          })
                        }
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                      >
                        <span>{c.name}</span>
                        <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
                          Client
                        </Badge>
                      </button>
                    ))}
                  </>
                )}
                {availableUsers.length === 0 && availableClients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {clientsLoading || usersLoading ? "Loading…" : "No results found"}
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="tf-priority">{t("priority")}</Label>
          <Select
            value={value.priority ?? "Normal"}
            onValueChange={(v) => set({ priority: v as TaskFields["priority"] })}
          >
            <SelectTrigger id="tf-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due date */}
        <div className="space-y-2">
          <Label htmlFor="tf-dueDate">Due Date {dueDateRequired && "*"}</Label>
          <Input
            id="tf-dueDate"
            type="datetime-local"
            value={value.dueDate ?? ""}
            onChange={(e) => set({ dueDate: e.target.value })}
            required={dueDateRequired}
          />
        </div>
      </div>

      {/* Status (edit mode only) */}
      {showStatus && (
        <div className="space-y-2">
          <Label htmlFor="tf-status">{tAdmin("status")}</Label>
          <Select
            value={value.status ?? "Todo"}
            onValueChange={(v) => set({ status: v as TaskFields["status"] })}
          >
            <SelectTrigger id="tf-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
