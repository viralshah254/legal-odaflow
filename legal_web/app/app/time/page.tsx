"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, Play, Square, Plus, Loader2, CheckCircle, Pencil, Trash2, Sparkles, X } from "lucide-react"
import {
  listTimeEntries,
  getActiveTimer,
  startTimer,
  stopTimer,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  approveTimeEntry,
  listSuggestedTime,
  approveSuggestedTime,
  dismissSuggestedTime,
  loadPersistedTimer,
  persistTimer,
  clearPersistedTimer,
  type ApiTimeEntry,
  type ApiTimerSession,
  type UpdateTimeEntryRequest,
  type SuggestedTimeEntry,
} from "@/lib/api/time"
import { getTimeApprovals, type TimeApprovalEntry } from "@/lib/api/billing"
import { ApiClientError } from "@/lib/api/client"
import { listMatters } from "@/lib/api/matters"
import { listTenantUsers } from "@/lib/api/users"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return "0m"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00:00"
  const w = Math.floor(seconds)
  const h = Math.floor(w / 3600)
  const m = Math.floor((w % 3600) / 60)
  const s = w % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

function toDateKey(value: string): string {
  return value.slice(0, 10)
}

function computeTimerElapsedSeconds(timer: ApiTimerSession): number {
  const startMs = Date.parse(timer.startedAt)
  if (!Number.isFinite(startMs)) return 0
  const accumulatedSeconds = (timer.accumulatedMinutes ?? 0) * 60
  if (timer.pausedAt) {
    const pausedMs = Date.parse(timer.pausedAt)
    if (Number.isFinite(pausedMs)) {
      return Math.max(0, Math.floor((pausedMs - startMs) / 1000) + accumulatedSeconds)
    }
  }
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000) + accumulatedSeconds)
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export default function TimePage() {
  const toDateKey = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const tCommon = useTranslations("common")
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">{t("loading_time_tracking")}</div>}>
      <TimePageContent />
    </Suspense>
  )
}

function TimePageContent() {
  const t = useTranslations("lawyer")
  const tBilling = useTranslations("lawyer")
  const tCommon = useTranslations("lawyer")
  const tAdmin = useTranslations("lawyer")
  const tErr = useTranslations("errors")
  const searchParams = useSearchParams()
  const { currentUser, currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const userId = currentUser?.id ?? ""
  const userName = currentUser?.name ?? "User"
  const isFinanceOrAdmin = currentRole === "FINANCE" || currentRole === "PARTNER_ADMIN"
  const initialMatterId = searchParams.get("matterId") ?? ""

  const [timer, setTimerState] = useState<ApiTimerSession | null>(null)
  const [timerTick, setTimerTick] = useState(0)
  const [dateFrom, setDateFrom] = useState(() => format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"))
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [matterFilter, setMatterFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [showLogForm, setShowLogForm] = useState(!!initialMatterId)
  const [logDate, setLogDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [logMatterId, setLogMatterId] = useState(initialMatterId)
  const [logDurationMinutes, setLogDurationMinutes] = useState("")
  const [logNarrative, setLogNarrative] = useState("")
  const [logBillable, setLogBillable] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("entries")

  // Edit state
  const [editEntry, setEditEntry] = useState<ApiTimeEntry | null>(null)
  const [editForm, setEditForm] = useState<UpdateTimeEntryRequest>({})
  const [editLoading, setEditLoading] = useState(false)

  // Delete state
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<ApiTimeEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: apiEntries = [], isLoading } = useApiData<ApiTimeEntry[]>(
    ["time-entries", activeTenantId],
    {
      apiFn: () => listTimeEntries(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: suggestedEntries = [], isLoading: suggestionsLoading, refetch: refetchSuggestions } =
    useApiData<SuggestedTimeEntry[]>(
      ["time-suggestions", activeTenantId],
      {
        apiFn: () => listSuggestedTime(activeTenantId!),
        enabled: !!activeTenantId,
      },
    )

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users", activeTenantId],
    { apiFn: () => listTenantUsers(activeTenantId!), enabled: !!activeTenantId && isFinanceOrAdmin },
  )

  const { data: approvalQueue = [], isLoading: approvalsLoading } = useApiData<TimeApprovalEntry[]>(
    ["time-approvals", activeTenantId],
    {
      apiFn: () => getTimeApprovals(activeTenantId!),
      enabled: !!activeTenantId && isFinanceOrAdmin,
    },
  )

  const matterMap = useMemo(() => new Map(matters.map((m) => [m.id, m])), [matters])

  useEffect(() => {
    if (!activeTenantId) return
    let cancelled = false
    getActiveTimer(activeTenantId)
      .then((session) => {
        if (cancelled) return
        setTimerState(session ?? loadPersistedTimer(activeTenantId))
      })
      .catch(() => {
        if (!cancelled) setTimerState(loadPersistedTimer(activeTenantId))
      })
    return () => { cancelled = true }
  }, [activeTenantId])

  useEffect(() => {
    if (!timer) return
    const interval = setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [timer?.id])

  const entries = useMemo(() => {
    return apiEntries.filter((e) => {
      const entryDate = toDateKey(e.date)
      if (dateFrom && entryDate < dateFrom) return false
      if (dateTo && entryDate > dateTo) return false
      if (matterFilter !== "all" && e.matterId !== matterFilter) return false
      if (statusFilter !== "all" && e.status !== statusFilter) return false
      if (isFinanceOrAdmin && userFilter !== "all" && e.userId !== userFilter) return false
      if (!isFinanceOrAdmin && e.userId !== userId) return false
      return true
    })
  }, [apiEntries, dateFrom, dateTo, matterFilter, statusFilter, userFilter, isFinanceOrAdmin, userId])

  const timerElapsed = useMemo(() => {
    if (!timer) return 0
    return computeTimerElapsedSeconds(timer)
  }, [timer, timerTick])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["time-entries", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["time-approvals", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["time-suggestions", activeTenantId] })
  }

  const handleApproveSuggestion = async (suggestionId: string) => {
    if (!activeTenantId) return
    setApprovingId(suggestionId)
    try {
      await approveSuggestedTime(activeTenantId, suggestionId)
      invalidate()
      toast({ title: "Suggestion approved and added to your time entries" })
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to approve suggestion"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  const handleDismissSuggestion = async (suggestionId: string) => {
    if (!activeTenantId) return
    setDismissingId(suggestionId)
    try {
      await dismissSuggestedTime(activeTenantId, suggestionId)
      await refetchSuggestions()
      toast({ title: "Suggestion dismissed" })
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to dismiss suggestion"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setDismissingId(null)
    }
  }

  const handleApproveEntry = async (entryId: string) => {
    if (!activeTenantId) return
    setApprovingId(entryId)
    try {
      await approveTimeEntry(activeTenantId, entryId)
      invalidate()
      toast({ title: tErr("toast.entryApproved") })
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to approve entry"
      toast({ title: msg, variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  const handleStartTimer = async () => {
    if (!logMatterId || !activeTenantId) return
    try {
      const session = await startTimer(activeTenantId, { matterId: logMatterId })
      setTimerState(session)
      persistTimer(activeTenantId, session)
      setLogNarrative("")
    } catch {
      toast({ title: tErr("toast.failedToStartTimer"), variant: "destructive" })
    }
  }

  const handleStopTimer = async () => {
    if (!activeTenantId) return
    try {
      await stopTimer(activeTenantId)
      toast({ title: tErr("toast.timerStopped") })
    } catch {
      toast({ title: tErr("toast.failedToStopTimer"), variant: "destructive" })
    } finally {
      setTimerState(null)
      clearPersistedTimer(activeTenantId)
      invalidate()
    }
  }

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logMatterId || !logDurationMinutes || !activeTenantId) return
    const minutes = parseInt(logDurationMinutes, 10)
    if (isNaN(minutes) || minutes <= 0) return
    setSubmitting(true)
    try {
      await createTimeEntry(activeTenantId, {
        matterId: logMatterId,
        date: logDate,
        durationMinutes: minutes,
        narrative: logNarrative.trim() || "Manual entry",
        billable: logBillable,
      })
      invalidate()
      setLogDurationMinutes("")
      setLogNarrative("")
      setShowLogForm(false)
      toast({ title: tErr("toast.timeEntrySaved") })
    } catch {
      toast({ title: tErr("toast.failedToSaveTimeEntry"), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const openEditSheet = (entry: ApiTimeEntry) => {
    setEditEntry(entry)
    setEditForm({
      matterId: entry.matterId ?? undefined,
      date: entry.date.slice(0, 10),
      durationMinutes: entry.durationMinutes,
      narrative: entry.narrative,
      billable: entry.billable,
    })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTenantId || !editEntry) return
    setEditLoading(true)
    try {
      await updateTimeEntry(activeTenantId, editEntry.id, editForm)
      invalidate()
      toast({ title: tErr("toast.timeEntryUpdated") })
      setEditEntry(null)
    } catch {
      toast({ title: tErr("toast.failedToUpdateEntry"), variant: "destructive" })
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!activeTenantId || !deleteConfirmEntry) return
    setDeleting(true)
    try {
      await deleteTimeEntry(activeTenantId, deleteConfirmEntry.id)
      invalidate()
      toast({ title: tErr("toast.entryDeleted") })
      setDeleteConfirmEntry(null)
    } catch {
      toast({ title: tErr("toast.failedToDeleteEntry"), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

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
          <h1 className="text-3xl font-bold">{t("nav.time")}</h1>
          <p className="text-muted-foreground">{t("track_billable_and_non-billable_time_by_matter")}</p>
        </div>
        <OpenCopilotButton />
      </div>

      <Card data-tour="time-log">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timer
          </CardTitle>
          <CardDescription>{t("start_a_timer_for_a_matter_or_log_time_manually_below")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!timer ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2 w-[280px]">
                <Label>{tBilling("matter")}</Label>
                <Select value={logMatterId || undefined} onValueChange={setLogMatterId}>
                  <SelectTrigger>
                    <SelectValue placeholder={tCommon("select_matter")} />
                  </SelectTrigger>
                  <SelectContent>
                    {matters.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleStartTimer} disabled={!logMatterId}>
                <Play className="mr-2 h-4 w-4" />
                Start timer
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-2xl font-mono tabular-nums">{formatElapsed(timerElapsed)}</span>
              <span className="text-muted-foreground text-sm">
                {matterMap.get(timer.matterId)?.title ?? timer.matterId}
              </span>
              <Button size="sm" onClick={handleStopTimer}>
                <Square className="mr-2 h-4 w-4" />
                Stop & save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("time_entries")}</CardTitle>
              <CardDescription>{t("log_time_manually_or_from_the_timer")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowLogForm(!showLogForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Log time
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="entries">{t("my_entries")}</TabsTrigger>
              <TabsTrigger value="suggestions">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t("suggested_time")}
                {suggestedEntries.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{suggestedEntries.length}</Badge>
                )}
              </TabsTrigger>
              {isFinanceOrAdmin && (
                <TabsTrigger value="approvals">
                  Approval queue
                  {approvalQueue.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{approvalQueue.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="entries" className="space-y-4 mt-4">
              {showLogForm && (
                <form onSubmit={handleLogTime} className="grid gap-4 p-4 rounded-lg border bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="grid gap-2">
                      <Label>{tBilling("date")}</Label>
                      <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>{tBilling("matter")}</Label>
                      <Select value={logMatterId || undefined} onValueChange={setLogMatterId} required>
                        <SelectTrigger><SelectValue placeholder={tCommon("select_matter")} /></SelectTrigger>
                        <SelectContent>
                          {matters.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("duration_minutes")}</Label>
                      <Input type="number" min={1} value={logDurationMinutes} onChange={(e) => setLogDurationMinutes(e.target.value)} required />
                    </div>
                    <div className="flex items-end gap-2">
                      <Checkbox id="log-billable" checked={logBillable} onCheckedChange={(c) => setLogBillable(c === true)} />
                      <Label htmlFor="log-billable">{t("billable")}</Label>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>{tBilling("description")}</Label>
                    <Textarea value={logNarrative} onChange={(e) => setLogNarrative(e.target.value)} rows={2} className="resize-none" />
                  </div>
                  <Button type="submit" disabled={!logMatterId || !logDurationMinutes || submitting}>
                    {submitting ? "Saving…" : "Save entry"}
                  </Button>
                </form>
              )}

              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-3">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-[140px]" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-[140px]" />
                <Select value={matterFilter} onValueChange={setMatterFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder={tBilling("matter")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tBilling("all_matters")}</SelectItem>
                    {matters.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder={tAdmin("status")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tAdmin("all_statuses")}</SelectItem>
                    <SelectItem value="DRAFT">{tBilling("draft")}</SelectItem>
                    <SelectItem value="SUBMITTED">{t("submitted")}</SelectItem>
                    <SelectItem value="APPROVED">{tBilling("approved")}</SelectItem>
                    <SelectItem value="REJECTED">{t("rejected")}</SelectItem>
                  </SelectContent>
                </Select>
                {isFinanceOrAdmin && (
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={tAdmin("user")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_users")}</SelectItem>
                      {tenantUsers.map((u) => (
                        <SelectItem key={u.user.id} value={u.user.id}>{u.user.name ?? "User"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Horizontal scroll wrapper for mobile */}
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]" data-tour="time-list">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tBilling("date")}</TableHead>
                      <TableHead>{tBilling("matter")}</TableHead>
                      <TableHead>{tBilling("description")}</TableHead>
                      <TableHead className="text-right">{tBilling("duration")}</TableHead>
                      <TableHead className="text-right">{tBilling("amount")}</TableHead>
                      <TableHead>{tAdmin("status")}</TableHead>
                      {isFinanceOrAdmin && <TableHead>{tAdmin("user")}</TableHead>}
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isFinanceOrAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">
                          No time entries match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry) => (
                        <TableRow key={entry.id} className="group">
                          <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                          <TableCell className="max-w-[160px] truncate">
                            {matterMap.get(entry.matterId ?? "")?.title ?? entry.matterId ?? "General"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{entry.narrative}</TableCell>
                          <TableCell className="text-right">{formatDuration(entry.durationMinutes)}</TableCell>
                          <TableCell className="text-right">
                            {entry.amountCents != null ? formatCents(entry.amountCents) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.status}</Badge>
                          </TableCell>
                          {isFinanceOrAdmin && (
                            <TableCell className="text-sm text-muted-foreground">
                              {tenantUsers.find((u) => u.user.id === entry.userId)?.user.name ?? userName}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditSheet(entry)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmEntry(entry)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">{t("suggested_time_description")}</p>
              {suggestionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : suggestedEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">{t("no_suggested_time")}</p>
              ) : (
                <div className="space-y-3">
                  {suggestedEntries.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-start gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {suggestion.source.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-sm font-medium">{formatDuration(suggestion.minutes)}</span>
                          {suggestion.matterId && (
                            <span className="text-xs text-muted-foreground truncate">
                              {matterMap.get(suggestion.matterId)?.title ?? suggestion.matterId}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{suggestion.narrative ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(suggestion.createdAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled={approvingId === suggestion.id || dismissingId === suggestion.id}
                          onClick={() => void handleApproveSuggestion(suggestion.id)}
                        >
                          {approvingId === suggestion.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {t("approve_suggestion")}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approvingId === suggestion.id || dismissingId === suggestion.id}
                          onClick={() => void handleDismissSuggestion(suggestion.id)}
                        >
                          {dismissingId === suggestion.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <X className="mr-1 h-3 w-3" />
                              {t("dismiss_suggestion")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {isFinanceOrAdmin && (
              <TabsContent value="approvals" className="space-y-4 mt-4">
                {approvalsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tBilling("date")}</TableHead>
                          <TableHead>{tBilling("matter")}</TableHead>
                          <TableHead>{tBilling("description")}</TableHead>
                          <TableHead className="text-right">{tBilling("duration")}</TableHead>
                          <TableHead>{tAdmin("status")}</TableHead>
                          <TableHead className="text-right">{tAdmin("action")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvalQueue.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No entries pending approval.
                            </TableCell>
                          </TableRow>
                        ) : (
                          approvalQueue.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                              <TableCell className="max-w-[180px] truncate">
                                {entry.matter?.title ?? entry.matterId ?? "General"}
                              </TableCell>
                              <TableCell className="max-w-[220px] truncate">
                                {entry.narrative ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatDuration(entry.minutes)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{entry.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.status !== "APPROVED" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={approvingId === entry.id}
                                    onClick={() => handleApproveEntry(entry.id)}
                                  >
                                    {approvingId === entry.id ? (
                                      "Approving…"
                                    ) : (
                                      <>
                                        <CheckCircle className="mr-1 h-3 w-3" />
                                        Approve
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{tBilling("approved")}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit time entry sheet */}
      <Sheet open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("edit_time_entry")}</SheetTitle>
            <SheetDescription>{t("update_the_details_of_this_time_entry")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{tBilling("date")}</Label>
              <Input
                type="date"
                value={editForm.date ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{tBilling("matter")}</Label>
              <Select
                value={editForm.matterId ?? ""}
                onValueChange={(v) => setEditForm((f) => ({ ...f, matterId: v }))}
              >
                <SelectTrigger><SelectValue placeholder={tCommon("select_matter")} /></SelectTrigger>
                <SelectContent>
                  {matters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("duration_minutes")}</Label>
              <Input
                type="number"
                min={1}
                value={editForm.durationMinutes ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || 0 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{tBilling("description")}</Label>
              <Textarea
                value={editForm.narrative ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, narrative: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-billable"
                checked={editForm.billable ?? true}
                onCheckedChange={(c) => setEditForm((f) => ({ ...f, billable: c === true }))}
              />
              <Label htmlFor="edit-billable">{t("billable")}</Label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditEntry(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmEntry} onOpenChange={(o) => !o && setDeleteConfirmEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete_time_entry")}</DialogTitle>
            <DialogDescription>
              {deleteConfirmEntry && (
                <>
                  {formatDuration(deleteConfirmEntry.durationMinutes)} on{" "}
                  {format(new Date(deleteConfirmEntry.date), "MMM d, yyyy")} —{" "}
                  {deleteConfirmEntry.narrative}
                </>
              )}
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmEntry(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
