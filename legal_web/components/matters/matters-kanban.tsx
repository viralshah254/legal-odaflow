"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateMatter } from "@/lib/api/matters"
import type { ApiMatter } from "@/lib/api/types"
import type { ApiTask } from "@/lib/api/tasks"
import { formatDate } from "@/lib/utils"
import { Loader2, Sparkles } from "lucide-react"

export const KANBAN_STAGES = [
  "Intake",
  "Active",
  "Discovery",
  "Negotiation",
  "Closing",
  "Closed",
] as const

type MatterRow = {
  id: string
  title: string
  ref: string
  clientName?: string
  stage: string
  status: string
  updatedAt: string
  hasAutoRun?: boolean
}

type MattersKanbanProps = {
  matters: MatterRow[]
  rawMatters: ApiMatter[]
  tasks: ApiTask[]
  tenantId: string
  onStageChange?: () => void
}

export function MattersKanban({
  matters,
  rawMatters,
  tasks,
  tenantId,
  onStageChange,
}: MattersKanbanProps) {
  const t = useTranslations("matters")
  const router = useRouter()
  const [movingId, setMovingId] = useState<string | null>(null)

  const stageLabel = (stage: string) =>
    t(`kanbanStages.${stage.toLowerCase()}` as "kanbanStages.intake")

  const assigneeByMatter = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const task of tasks) {
      if (!task.matterId || !task.assigneeId) continue
      const set = map.get(task.matterId) ?? new Set<string>()
      set.add(task.assigneeId)
      map.set(task.matterId, set)
    }
    return map
  }, [tasks])

  const updatedAtById = useMemo(
    () => new Map(rawMatters.map((m) => [m.id, m.updatedAt])),
    [rawMatters],
  )

  const columns = useMemo(() => {
    const grouped = new Map<string, MatterRow[]>()
    for (const stage of KANBAN_STAGES) {
      grouped.set(stage, [])
    }
    for (const matter of matters) {
      const stage = KANBAN_STAGES.includes(matter.stage as (typeof KANBAN_STAGES)[number])
        ? matter.stage
        : "Active"
      grouped.get(stage)?.push({
        ...matter,
        updatedAt: updatedAtById.get(matter.id) ?? matter.updatedAt,
      })
    }
    return grouped
  }, [matters, updatedAtById])

  const handleStageChange = async (matterId: string, stage: string) => {
    setMovingId(matterId)
    try {
      await updateMatter(tenantId, matterId, { stage })
      onStageChange?.()
    } finally {
      setMovingId(null)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {KANBAN_STAGES.map((stage) => {
        const items = columns.get(stage) ?? []
        return (
          <div key={stage} className="min-w-0">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold">{stageLabel(stage)}</h3>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="space-y-3 min-h-[120px]">
              {items.map((matter) => (
                <Card
                  key={matter.id}
                  className="cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => router.push(`/app/matters/${matter.id}`)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug line-clamp-2">{matter.title}</p>
                      {movingId === matter.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {matter.ref}
                      {matter.clientName ? ` · ${matter.clientName}` : ""}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {matter.status}
                      </Badge>
                      {matter.hasAutoRun && (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border-violet-200 dark:border-violet-800 py-0"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </Badge>
                      )}
                      {assigneeByMatter.get(matter.id)?.size ? (
                        <span className="text-xs text-muted-foreground">
                          {assigneeByMatter.get(matter.id)!.size}{" "}
                          {assigneeByMatter.get(matter.id)!.size > 1
                            ? t("assignees_plural")
                            : t("assignee_singular")}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("updated_on", { date: formatDate(matter.updatedAt) })}
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={matter.stage}
                        onValueChange={(value) => handleStageChange(matter.id, value)}
                        disabled={movingId === matter.id}
                      >
                        <SelectTrigger className="h-8 text-xs min-h-[44px] md:min-h-0 md:h-8">
                          <SelectValue placeholder={t("move_stage")} />
                        </SelectTrigger>
                        <SelectContent>
                          {KANBAN_STAGES.map((option) => (
                            <SelectItem key={option} value={option}>
                              {t("move_to_stage", { stage: stageLabel(option) })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("no_matters_in_column")}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export type { MatterRow }
