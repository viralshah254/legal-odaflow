"use client"
import { useTranslations } from "next-intl"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { updateMeetingStatus, deleteMeeting } from "@/lib/api/meetings"
import { useQueryClient } from "@tanstack/react-query"
import { useMeetingRecordingStore } from "@/lib/store/meeting-recording-store"
import { isOrphanedRecording } from "@/lib/meetings/recording-utils"
import type { Meeting } from "@/lib/types/meetings"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDeleteMeetingDialog } from "./confirm-delete-meeting-dialog"
import {
  type CustomDateRange,
  type MeetingDateFilter,
  useMeetingsList,
} from "@/lib/hooks/use-meetings-list"
import { MeetingStatusChip } from "./meeting-status-chip"
import { MeetingSecurityBadge } from "./meeting-security-badge"
import { MeetingsListProgressBar, MeetingsListSkeleton } from "./meetings-list-skeleton"
import {
  Search,
  FileText,
  Mic,
  Upload,
  Video,
  AlertTriangle,
  X,
  Loader2,
  SearchX,
  Trash2,
  FilterX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { formatMediaDuration } from "@/lib/meetings/format-duration"
import { cn } from "@/lib/utils"

interface MeetingsListProps {
  clientId?: string
  matterId?: string
  onRecordClick?: () => void
  onUploadClick?: () => void
  onImportClick?: () => void
  showActions?: boolean
  onTotalChange?: (total: number, hasError?: boolean) => void
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-muted/60",
      )}
    >
      {label}
    </button>
  )
}

export function MeetingsList({
  clientId,
  matterId,
  onRecordClick,
  onUploadClick,
  onImportClick,
  showActions = true,
  onTotalChange,
}: MeetingsListProps) {
  const tClients = useTranslations("common")
  const t = useTranslations("common")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const clearActiveRecordingIfMatching = useMeetingRecordingStore((s) => s.clearActiveRecordingIfMatching)
  const listTopRef = useRef<HTMLDivElement>(null)
  const [discarding, setDiscarding] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
  const [pendingCustomFrom, setPendingCustomFrom] = useState("")
  const [pendingCustomTo, setPendingCustomTo] = useState("")

  const {
    meetings,
    total,
    page,
    totalPages,
    rangeFrom,
    rangeTo,
    hasNextPage,
    hasPrevPage,
    goToNextPage,
    goToPrevPage,
    isInitialLoading,
    isRefreshing,
    isError,
    refetch,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    customDateRange,
    setCustomDateRange,
    hasActiveFilters,
    isSearchPending,
    clearFilters,
  } = useMeetingsList({
    tenantId: activeTenantId,
    clientId,
    matterId,
    enabled: !!activeTenantId,
  })

  useEffect(() => {
    if (!isInitialLoading) onTotalChange?.(total, isError)
  }, [isError, isInitialLoading, total, onTotalChange])

  useEffect(() => {
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [page])

  const handleDiscard = useCallback(async (meetingId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!activeTenantId) return
    setDiscarding(meetingId)
    try {
      await updateMeetingStatus(activeTenantId, meetingId, "failed")
      clearActiveRecordingIfMatching(meetingId)
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
    } catch {
      // ignore — list will still show, user can retry
    } finally {
      setDiscarding(null)
    }
  }, [activeTenantId, queryClient, clearActiveRecordingIfMatching])

  const handleDeleteConfirm = useCallback(async () => {
    if (!activeTenantId || !deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await deleteMeeting(activeTenantId, deleteTarget.id)
      clearActiveRecordingIfMatching(deleteTarget.id)
      await queryClient.invalidateQueries({ queryKey: ["meetings"] })
      setDeleteTarget(null)
      toast({ title: t("meeting_deleted") })
    } catch {
      toast({
        title: t("error"),
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }, [activeTenantId, deleteTarget, clearActiveRecordingIfMatching, queryClient, toast, t])

  const openDeleteDialog = useCallback((meeting: Meeting, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteTarget(meeting)
  }, [])

  const { data: clients = [] } = useApiData(
    ["clients", activeTenantId],
    { apiFn: () => listClients(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const matterMap = useMemo(() => new Map(matters.map((m) => [m.id, m])), [matters])

  const statusOptions: Array<{ value: string | null; label: string }> = [
    { value: null, label: t("meetings_filter_all") },
    { value: "ready", label: t("meetings_filter_ready") },
    { value: "recording", label: t("meetings_filter_recording") },
    { value: "processing", label: t("meetings_filter_processing") },
    { value: "failed", label: t("meetings_filter_failed") },
    { value: "draft", label: t("meetings_filter_draft") },
  ]

  const dateOptions: Array<{ value: MeetingDateFilter; label: string }> = [
    { value: "all", label: t("meetings_date_all") },
    { value: "today", label: t("meetings_date_today") },
    { value: "week", label: t("meetings_date_week") },
    { value: "month", label: t("meetings_date_month") },
    { value: "custom", label: t("meetings_date_custom") },
  ]

  const customDateLabel = useMemo(() => {
    if (dateFilter !== "custom" || !customDateRange) return t("meetings_date_custom")
    return `${customDateRange.from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${customDateRange.to.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
  }, [customDateRange, dateFilter, t])

  const handleDateFilter = (filter: MeetingDateFilter) => {
    if (filter === "custom") {
      const now = new Date()
      const from = customDateRange?.from ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      const to = customDateRange?.to ?? now
      setPendingCustomFrom(from.toISOString().slice(0, 10))
      setPendingCustomTo(to.toISOString().slice(0, 10))
      setCustomPickerOpen(true)
      return
    }
    if (dateFilter === filter) return
    setDateFilter(filter)
    setCustomDateRange(null)
  }

  const applyCustomDateRange = () => {
    if (!pendingCustomFrom || !pendingCustomTo) return
    const from = new Date(`${pendingCustomFrom}T00:00:00`)
    const to = new Date(`${pendingCustomTo}T23:59:59`)
    if (from.getTime() > to.getTime()) return
    const range: CustomDateRange = { from, to }
    setCustomDateRange(range)
    setDateFilter("custom")
    setCustomPickerOpen(false)
  }

  const scopeLabel = clientId
    ? t("meetings_scope_client")
    : matterId
      ? t("meetings_scope_matter")
      : t("meetings_scope_all")

  const showSkeleton = isInitialLoading && meetings.length === 0

  const showEmptyCreatePrompt =
    total === 0 && !hasActiveFilters && !showSkeleton && !isRefreshing

  const showFilteredEmpty =
    meetings.length === 0 && !showSkeleton && !isRefreshing && (hasActiveFilters || total === 0)

  const showClearFilters =
    hasActiveFilters || isSearchPending || customPickerOpen

  const handleClearFilters = () => {
    clearFilters()
    setCustomPickerOpen(false)
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{tClients("stats.meetings")}</CardTitle>
            <CardDescription>
              {scopeLabel}
              {!showSkeleton && total > 0 ? (
                <span className="ml-1 text-foreground/80">
                  · {t("meetings_count", { count: total })}
                </span>
              ) : null}
            </CardDescription>
          </div>
          {showActions && (onRecordClick || onUploadClick || onImportClick) && (
            <div className="flex flex-wrap gap-2">
              {onRecordClick && (
                <Button size="sm" onClick={onRecordClick} data-tour="meetings-record">
                  <Mic className="mr-2 h-4 w-4" />
                  {t("record_transcript")}
                </Button>
              )}
              {onUploadClick && (
                <Button size="sm" variant="outline" onClick={onUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("upload")}
                </Button>
              )}
              {onImportClick && (
                <Button size="sm" variant="outline" onClick={onImportClick}>
                  <Video className="mr-2 h-4 w-4" />
                  {t("import_meeting")}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search_meetings")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {statusOptions.map((opt) => (
              <FilterChip
                key={opt.label}
                label={opt.label}
                selected={statusFilter === opt.value}
                onClick={() => setStatusFilter(opt.value)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              {t("meetings_date_label")}
            </span>
            {dateOptions.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.value === "custom" && dateFilter === "custom" ? customDateLabel : opt.label}
                selected={dateFilter === opt.value}
                onClick={() => handleDateFilter(opt.value)}
              />
            ))}
          </div>

          {showClearFilters && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground"
                onClick={handleClearFilters}
              >
                <FilterX className="h-4 w-4" />
                {t("clear_filters")}
              </Button>
            </div>
          )}

          <MeetingsListProgressBar active={isRefreshing || isSearchPending} />
        </div>

        {customPickerOpen && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="meetings-from">
                {t("meetings_date_from")}
              </label>
              <Input
                id="meetings-from"
                type="date"
                value={pendingCustomFrom}
                onChange={(e) => setPendingCustomFrom(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="meetings-to">
                {t("meetings_date_to")}
              </label>
              <Input
                id="meetings-to"
                type="date"
                value={pendingCustomTo}
                onChange={(e) => setPendingCustomTo(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button size="sm" onClick={applyCustomDateRange}>
              {t("apply")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCustomPickerOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className={cn(!showSkeleton && total > 0 && "pb-4 md:pb-6")}>
        {showSkeleton ? (
          <MeetingsListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center" role="alert">
            <AlertTriangle className="mb-3 h-10 w-10 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">{t("meetings_load_failed")}</p>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => void refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : showFilteredEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            {showEmptyCreatePrompt ? (
              <>
                <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">{t("no_meetings_yet")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("record_or_import_meeting_transcripts")}
                </p>
                {showActions && (onRecordClick || onUploadClick) && (
                  <div className="mt-4 flex gap-2">
                    {onRecordClick && (
                      <Button size="sm" onClick={onRecordClick}>
                        <Mic className="mr-2 h-4 w-4" />
                        {t("record_transcript")}
                      </Button>
                    )}
                    {onUploadClick && (
                      <Button size="sm" variant="outline" onClick={onUploadClick}>
                        <Upload className="mr-2 h-4 w-4" />
                        {t("upload")}
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <SearchX className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">{t("no_meetings_match_filters")}</p>
              </>
            )}
          </div>
        ) : (
          <div ref={listTopRef}>
          <div
            className={cn(
              "transition-opacity duration-200",
              isRefreshing || isSearchPending ? "opacity-70" : "opacity-100",
            )}
          >
            <ul className="space-y-2">
              {meetings.map((m) => {
                const client = clientMap.get(m.clientId)
                const matter = m.matterId ? matterMap.get(m.matterId) : null
                const orphaned = isOrphanedRecording(m)
                return (
                  <li key={m.id}>
                    <Link
                      href={`/app/meetings/${m.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{m.title}</span>
                          {orphaned ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              Interrupted
                            </span>
                          ) : (
                            <MeetingStatusChip status={m.status} />
                          )}
                          <MeetingSecurityBadge level={m.confidentiality} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-sm text-muted-foreground">
                          <span>{client?.name ?? m.clientId}</span>
                          {matter && <span>{matter.title}</span>}
                          <span>{formatDate(m.startAt)}</span>
                          {m.durationMs != null && (
                            <span title={formatMediaDuration(m.durationMs)}>
                              {formatMediaDuration(m.durationMs, { compact: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {orphaned && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDiscard(m.id, e)}
                            disabled={discarding === m.id}
                          >
                            <X className="h-3.5 w-3.5" />
                            Discard
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => openDeleteDialog(m, e)}
                          disabled={deletingId === m.id}
                          aria-label={t("delete_meeting_title")}
                        >
                          {deletingId === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <span>{t("view")}</span>
                        </Button>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            {total > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 pb-2 pr-32 sm:pr-40 md:pr-44 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground shrink-0">
                  {t("meetings_pagination_range", { from: rangeFrom, to: rangeTo, total })}
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {t("meetings_page_of", { page, totalPages })}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={goToPrevPage}
                      disabled={!hasPrevPage || isRefreshing}
                      aria-label={t("prev")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("prev")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={!hasNextPage || isRefreshing}
                      aria-label={t("next")}
                    >
                      {t("next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        )}
      </CardContent>

      <ConfirmDeleteMeetingDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null)
        }}
        meetingTitle={deleteTarget?.title}
        onConfirm={handleDeleteConfirm}
        deleting={deletingId != null}
      />
    </Card>
  )
}
