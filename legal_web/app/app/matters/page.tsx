"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listMatters, deleteMatter, getAutoAnalyzedIds } from "@/lib/api/matters"
import { listTasks } from "@/lib/api/tasks"
import { listTenantUsers } from "@/lib/api/users"
import type { ApiMatter } from "@/lib/api/types"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Search, LayoutGrid, List, ExternalLink, MessageSquare, Copy, Trash2, Sparkles, SlidersHorizontal } from "lucide-react"
import { PageCopilotActions } from "@/components/copilot/page-copilot-actions"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { RoleGate } from "@/components/dashboard/role-gate"
import { MattersKanban, type MatterRow } from "@/components/matters/matters-kanban"
import { format } from "date-fns"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useRealtime } from "@/lib/contexts/realtime-context"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import {
  MATTER_STAGE_OPTIONS,
  MATTER_STATUS_OPTIONS,
  normalizeMatterStage,
  normalizeMatterStatus,
} from "@/lib/matters/lifecycle"
import { queryKeys } from "@/lib/api/query-keys"

const STAGE_VALUES = ["all", ...MATTER_STAGE_OPTIONS] as const
const STATUS_VALUES = ["all", ...MATTER_STATUS_OPTIONS] as const

function apiMatterToRow(m: ApiMatter, autoAnalyzed?: Set<string>): MatterRow {
  return {
    id: m.id,
    title: m.title,
    ref: m.caseNumber ?? m.id.slice(0, 8).toUpperCase(),
    clientName: m.client?.name ?? undefined,
    stage: normalizeMatterStage(m.stage) ?? "Active",
    status: normalizeMatterStatus(m.status),
    updatedAt: m.updatedAt,
    hasAutoRun: autoAnalyzed?.has(m.id) ?? false,
  }
}

export default function MattersPage() {
  const tClients = useTranslations("clients")
  const t = useTranslations("matters")
  const tLawyer = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const { setContext, setActiveTab } = useCopilotContext()
  const { setCopilotDrawerOpen } = useUIStore()
  const { subscribe } = useRealtime()
  const [view, setView] = useState<"list" | "kanban">("list")
  const [stageFilter, setStageFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [deletingMatter, setDeletingMatter] = useState<MatterRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const MATTERS_PER_PAGE = 25

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (stageFilter !== "all") count += 1
    if (statusFilter !== "all") count += 1
    if (assigneeFilter !== "all") count += 1
    if (dateFrom) count += 1
    if (dateTo) count += 1
    return count
  }, [stageFilter, statusFilter, assigneeFilter, dateFrom, dateTo])

  const { data: apiMatters, isLoading, error } = useApiData<ApiMatter[]>(
    queryKeys.matters.list(activeTenantId, {
      searchQuery,
      statusFilter,
      stageFilter,
      assigneeFilter,
      dateFrom,
      dateTo,
      page,
    }),
    {
      apiFn: () =>
        listMatters(activeTenantId!, {
          search: searchQuery || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          stage: stageFilter !== "all" ? stageFilter : undefined,
          assignee: assigneeFilter !== "all" ? assigneeFilter : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          limit: MATTERS_PER_PAGE,
        }),
      enabled: !!activeTenantId,
    },
  )

  const { data: tasks = [] } = useApiData(
    ["tasks-all", activeTenantId],
    {
      apiFn: () => listTasks(activeTenantId!),
      enabled: !!activeTenantId && view === "kanban",
    },
  )

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: autoAnalyzedIds } = useApiData<string[]>(
    ["auto-analyzed-ids", activeTenantId],
    {
      apiFn: () => getAutoAnalyzedIds(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  // Refresh auto-analyzed badges when an autonomy job completes
  useEffect(() => {
    const unsub = subscribe("matter.autonomy.completed" as Parameters<typeof subscribe>[0], () => {
      queryClient.invalidateQueries({ queryKey: ["auto-analyzed-ids", activeTenantId] })
    })
    return unsub
  }, [subscribe, queryClient, activeTenantId])

  const matters = useMemo(() => {
    const autoSet = new Set(autoAnalyzedIds ?? [])
    let list = (apiMatters ?? []).map((m) => apiMatterToRow(m, autoSet))
    if (stageFilter !== "all") list = list.filter((m) => m.stage === stageFilter)

    if (assigneeFilter !== "all") {
      const matterIds = new Set(
        tasks
          .filter((task) => task.assigneeId === assigneeFilter && task.matterId)
          .map((task) => task.matterId as string),
      )
      list = list.filter((m) => matterIds.has(m.id))
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      list = list.filter((m) => new Date(m.updatedAt) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      list = list.filter((m) => new Date(m.updatedAt) <= to)
    }

    return list
  }, [
    apiMatters,
    autoAnalyzedIds,
    currentRole,
    stageFilter,
    assigneeFilter,
    tasks,
    dateFrom,
    dateTo,
  ])

  const filteredBySearch = matters

  const stageLabel = (value: string) => {
    if (value === "all") return t("all_stages")
    const key = value.toLowerCase() as "intake" | "active" | "discovery" | "negotiation" | "closing" | "closed"
    return t(`kanbanStages.${key}`)
  }

  const statusLabel = (value: string) => {
    if (value === "all") return t("all_statuses")
    if (value === "OPEN") return t("open_status")
    if (value === "On Hold") return t("on_hold")
    if (value === "Closed") return t("kanbanStages.closed")
    return t("kanbanStages.active")
  }

  const refreshMatters = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matters.lists(activeTenantId) })
  }

  const openCopilotForMatter = (matterId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setContext({ selectedMatterId: matterId })
    setCopilotDrawerOpen(true)
    setActiveTab("ask")
  }

  // Reset page when server-side filters change
  const handleStageFilter = (v: string) => { setStageFilter(v); setPage(1) }
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setPage(1) }
  const handleAssigneeFilter = (v: string) => { setAssigneeFilter(v); setPage(1) }
  const handleDateFrom = (v: string) => { setDateFrom(v); setPage(1) }
  const handleDateTo = (v: string) => { setDateTo(v); setPage(1) }

  const copyLink = (matterId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(`${window.location.origin}/app/matters/${matterId}`)
  }

  const handleDeleteClick = (matter: MatterRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingMatter(matter)
  }

  const confirmDelete = async () => {
    if (!deletingMatter || !activeTenantId) return
    setIsDeleting(true)
    try {
      await deleteMatter(activeTenantId, deletingMatter.id)
      queryClient.invalidateQueries({ queryKey: queryKeys.matters.lists(activeTenantId) })
      setDeletingMatter(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const clearFilters = () => {
    setStageFilter("all")
    setStatusFilter("all")
    setAssigneeFilter("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  const filterControls = (
    <>
      <Select value={stageFilter} onValueChange={handleStageFilter}>
        <SelectTrigger className="w-full md:w-[160px]">
          <SelectValue placeholder={tCommon("stage")} />
        </SelectTrigger>
        <SelectContent>
          {STAGE_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {stageLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={handleStatusFilter}>
        <SelectTrigger className="w-full md:w-[140px]">
          <SelectValue placeholder={tAdmin("status")} />
        </SelectTrigger>
        <SelectContent>
          {STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {statusLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={assigneeFilter} onValueChange={handleAssigneeFilter}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder={tLawyer("assignee")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tLawyer("all_assignees")}</SelectItem>
          {tenantUsers.map((member) => (
            <SelectItem key={member.user.id} value={member.user.id}>
              {member.user.name ?? member.user.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => handleDateFrom(e.target.value)}
        className="w-full md:w-[150px]"
        aria-label={t("updated_from")}
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => handleDateTo(e.target.value)}
        className="w-full md:w-[150px]"
        aria-label={t("updated_to")}
      />
    </>
  )

  return (
    <>
    <div className="space-y-4 sm:space-y-6 px-4 py-4 sm:p-6 pb-20 md:pb-6">
      <PageHeader
        title={tClients("stats.matters")}
        description={t("manage_your_legal_matters")}
        actions={
          <>
            <Tabs value={view} onValueChange={(value) => setView(value as "list" | "kanban")}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="list">
                  <List className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("list_view")}</span>
                </TabsTrigger>
                <TabsTrigger value="kanban">
                  <LayoutGrid className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("kanban_view")}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <PageCopilotActions />
            <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
              <Button
                onClick={() => router.push("/app/matters/new")}
                data-tour="matters-create"
                size="icon"
                className="sm:w-auto sm:px-4 sm:gap-2"
                aria-label={t("newMatter")}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("newMatter")}</span>
              </Button>
            </RoleGate>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3" data-tour="matters-filter">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search_by_title_ref_or_client")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>

        {/* Mobile: Filters sheet */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden gap-2 min-h-[44px]">
              <SlidersHorizontal className="h-4 w-4" />
              {t("filters")}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] pb-safe-bottom">
            <SheetHeader className="mb-3 text-left">
              <SheetTitle>{t("filters")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pb-4">
              {filterControls}
              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={clearFilters} className="mt-1">
                  {tCommon("clear_filters")}
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop: inline filters */}
        <div className="hidden md:flex md:flex-wrap md:items-center md:gap-3">
          {filterControls}
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={t("failed_to_load_matters")} />
      ) : filteredBySearch.length === 0 ? (
        <EmptyState
          title={t("no_matters_found")}
          description={t("create_first_matter_hint")}
          actionLabel={t("createMatter")}
          onAction={() => router.push("/app/matters/new")}
        />
      ) : view === "kanban" ? (
        <div data-tour="matters-list">
        <MattersKanban
          matters={filteredBySearch}
          rawMatters={apiMatters ?? []}
          tasks={tasks}
          tenantId={activeTenantId!}
          onStageChange={refreshMatters}
        />
        </div>
      ) : (
        <div className="space-y-3" data-tour="matters-list">
          <div className="grid gap-3">
            {filteredBySearch.map((matter) => {
            const statusColor = matter.status === "Active" || matter.status === "OPEN"
              ? "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400"
              : matter.status === "IN_PROGRESS" || matter.status === "On Hold"
                ? "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
                : matter.status === "Closed" || matter.status === "CLOSED"
                  ? "bg-slate-500/10 text-slate-600 border-slate-500/30"
                  : "bg-muted text-muted-foreground border-border"

            return (
              <Card
                key={matter.id}
                className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-150 group"
                onClick={() => router.push(`/app/matters/${matter.id}`)}
              >
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="text-base font-semibold line-clamp-2">{matter.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("text-xs border", statusColor)}>{matter.status}</Badge>
                      <Badge variant="secondary" className="text-xs">{matter.stage}</Badge>
                      {matter.hasAutoRun && (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{matter.ref}</span>
                      {matter.clientName && (
                        <span className="truncate max-w-[160px]">{matter.clientName}</span>
                      )}
                      <span>{t("updated_on", { date: format(new Date(matter.updatedAt), "MMM d, yyyy") })}</span>
                    </div>
                  </div>
                  {/* Quick actions — always visible on touch; hover on md+ */}
                  <div className="flex gap-1 pt-1 border-t opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 min-h-[44px] md:min-h-0 md:h-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => openCopilotForMatter(matter.id, e)}
                      title={tClients("askCopilot")}
                    >
                      <MessageSquare className="h-3.5 w-3.5 md:mr-0" />
                      <span className="ml-1.5 text-xs md:hidden">{tClients("askCopilot")}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-8 md:w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => copyLink(matter.id, e)}
                      title={t("copy_link")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-8 md:w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); router.push(`/app/matters/${matter.id}`) }}
                      title={t("open_matter")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-8 md:w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteClick(matter, e)}
                        title="Delete matter"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </RoleGate>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          </div>
          {/* Pagination controls */}
          {(apiMatters ?? []).length === MATTERS_PER_PAGE || page > 1 ? (
            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
              <span>{t("page_label", { page })}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  {t("prev")}
                </Button>
                <span className="px-2">{page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(apiMatters ?? []).length < MATTERS_PER_PAGE || isLoading}
                >
                  {tCommon("next")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
    <Dialog open={!!deletingMatter} onOpenChange={(open) => { if (!open) setDeletingMatter(null) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete matter?</DialogTitle>
          <DialogDescription>
            <strong>{deletingMatter?.title}</strong> will be permanently deleted along with all its timeline events, notes, and tasks. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeletingMatter(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  )
}
