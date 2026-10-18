"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listMatters } from "@/lib/api/matters"
import {
  createPreBillSession,
  downloadLedesExport,
  getPreBillReview,
  savePreBillSession,
  type PreBillSession,
} from "@/lib/api/billing"
import { approveTimeEntry } from "@/lib/api/time"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Loader2, Receipt, Save } from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/hooks/use-toast"

export default function PreBillReviewPage() {
  const toFixed = useTranslations("billing")
  const t = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const tErr = useTranslations("errors")
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const initialMatterId = searchParams.get("matterId") ?? "all"
  const [matterFilter, setMatterFilter] = useState(initialMatterId)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [session, setSession] = useState<PreBillSession | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [globalWriteDown, setGlobalWriteDown] = useState("")
  const [lineWriteDowns, setLineWriteDowns] = useState<Record<string, string>>({})

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: review, isLoading } = useApiData(
    ["pre-bill", activeTenantId, matterFilter],
    {
      apiFn: () =>
        getPreBillReview(
          activeTenantId!,
          matterFilter !== "all" ? matterFilter : undefined,
        ),
      enabled: !!activeTenantId,
    },
  )

  const lines = review?.lines ?? []
  const summary = review?.summary

  const matterMap = useMemo(() => new Map(matters.map((m) => [m.id, m.title])), [matters])

  const handleApprove = async (entryId: string) => {
    if (!activeTenantId) return
    setApprovingId(entryId)
    try {
      await approveTimeEntry(activeTenantId, entryId)
      queryClient.invalidateQueries({ queryKey: ["pre-bill", activeTenantId] })
    } finally {
      setApprovingId(null)
    }
  }

  const handleExport = async () => {
    if (!activeTenantId) return
    setExporting(true)
    try {
      const csv = await downloadLedesExport(
        activeTenantId,
        matterFilter !== "all" ? matterFilter : undefined,
        session?.id,
      )
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `ledes-export-${Date.now()}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleCreateSession = async () => {
    if (!activeTenantId) return
    setCreatingSession(true)
    try {
      const created = await createPreBillSession(activeTenantId, {
        matterId: matterFilter !== "all" ? matterFilter : undefined,
      })
      setSession(created)
      const writeDowns: Record<string, string> = {}
      for (const adj of created.adjustments ?? []) {
        if (adj.writeDownPercent != null) {
          writeDowns[adj.timeEntryId] = String(adj.writeDownPercent)
        }
      }
      setLineWriteDowns(writeDowns)
      if (created.writeDownPercent != null) {
        setGlobalWriteDown(String(created.writeDownPercent))
      }
      toast({ title: tErr("toast.preBillSessionCreated"), description: tErr("toast.preBillSessionCreatedDescription") })
    } catch {
      toast({ title: tErr("toast.couldNotCreateSession"), variant: "destructive" })
    } finally {
      setCreatingSession(false)
    }
  }

  const handleSaveSession = async () => {
    if (!activeTenantId || !session) return
    setSavingSession(true)
    try {
      const globalPct = globalWriteDown.trim() ? parseFloat(globalWriteDown) : undefined
      const adjustments = lines
        .map((line) => {
          const pct = lineWriteDowns[line.id]?.trim()
          if (!pct) return null
          const writeDownPercent = parseFloat(pct)
          if (isNaN(writeDownPercent)) return null
          return { timeEntryId: line.id, writeDownPercent }
        })
        .filter(Boolean) as Array<{ timeEntryId: string; writeDownPercent: number }>

      const updated = await savePreBillSession(activeTenantId, session.id, {
        writeDownPercent: globalPct,
        adjustments,
      })
      setSession(updated)
      toast({ title: tErr("toast.sessionSaved"), description: tErr("toast.sessionSavedDescription") })
    } catch {
      toast({ title: tErr("toast.couldNotSaveSession"), variant: "destructive" })
    } finally {
      setSavingSession(false)
    }
  }

  return (
    <div className="p-6 space-y-6" data-tour="prebill-workspace">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-7 w-7" />
            Pre-bill review
          </h1>
          <p className="text-muted-foreground">
            Review draft time entries, apply write-downs, and export LEDES CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void handleCreateSession()}
            disabled={creatingSession || !activeTenantId}
          >
            {creatingSession ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Create session
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleSaveSession()}
            disabled={savingSession || !session}
          >
            {savingSession ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save session
          </Button>
          <Button onClick={handleExport} disabled={exporting || !activeTenantId}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export LEDES
          </Button>
        </div>
      </div>

      {session && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("active_session")}</CardTitle>
            <CardDescription>
              Session {session.id.slice(0, 8)} · {session.status}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4 max-w-md">
              <div className="space-y-2 flex-1 min-w-[140px]">
                <Label htmlFor="globalWriteDown">{t("global_write-down")}</Label>
                <Input
                  id="globalWriteDown"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="0"
                  value={globalWriteDown}
                  onChange={(e) => setGlobalWriteDown(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("entries")}</CardDescription>
            <CardTitle>{summary?.entryCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("billable_hours")}</CardDescription>
            <CardTitle>{summary?.billableHours?.toFixed(2) ?? "0.00"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("total_amount")}</CardDescription>
            <CardTitle>${summary?.totalAmount?.toFixed(2) ?? "0.00"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("pending_approval")}</CardDescription>
            <CardTitle>{summary?.pendingApproval ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t("time_entry_lines")}</CardTitle>
              <CardDescription>{t("approve_entries_and_set_per-line_write-downs")}</CardDescription>
            </div>
            <Select value={matterFilter} onValueChange={setMatterFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder={t("filter_by_matter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_matters")}</SelectItem>
                {matters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("matter")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead className="text-right">{t("hours")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead className="text-right w-28">{t("write-down")}</TableHead>
                  <TableHead>{tAdmin("status")}</TableHead>
                  <TableHead className="text-right">{tAdmin("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No time entries for pre-bill review.
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{format(new Date(line.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {line.matterTitle || matterMap.get(line.matterId ?? "") || "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{line.narrative ?? "—"}</TableCell>
                      <TableCell className="text-right">{line.hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${line.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          className="h-8 w-20 ml-auto"
                          placeholder="0"
                          value={lineWriteDowns[line.id] ?? ""}
                          onChange={(e) =>
                            setLineWriteDowns((prev) => ({
                              ...prev,
                              [line.id]: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{line.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {line.status !== "APPROVED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approvingId === line.id}
                            onClick={() => handleApprove(line.id)}
                          >
                            {approvingId === line.id ? "Approving…" : "Approve"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("approved")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
