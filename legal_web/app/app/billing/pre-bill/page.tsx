"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Download, ClipboardCheck, Receipt } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PageEnter } from "@/components/ui/motion"
import { format } from "date-fns"

interface TimeEntry {
  id: string
  matterTitle: string
  matterId: string
  narrative?: string | null
  minutes: number
  rate?: number | null
  amount?: number | null
  date?: string | null
  status: string
}

interface PreBillReview {
  lines: TimeEntry[]
  summary: {
    entryCount: number
    billableHours: number
    totalAmount: number
    pendingApproval: number
  }
  matterId: string | null
}

export default function PreBillPage() {
  const toISOString = useTranslations("billing")
  const toFixed = useTranslations("billing")
  const t = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const tErr = useTranslations("errors")
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const [matterId, setMatterId] = useState<string>("")
  const [exporting, setExporting] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useApiData<PreBillReview>(
    ["pre-bill", activeTenantId, matterId],
    {
      apiFn: () =>
        apiFetch<PreBillReview>(
          `/billing/pre-bill${matterId ? `?matterId=${matterId}` : ""}`,
        ),
      enabled: !!activeTenantId,
    },
  )

  async function handleLedesExport() {
    setExporting(true)
    try {
      // Use apiFetch and download as blob; the endpoint returns CSV text
      const csv = await apiFetch<string>(
        `/billing/pre-bill/ledes${matterId ? `?matterId=${matterId}` : ""}`,
      )
      const content = typeof csv === "string" ? csv : JSON.stringify(csv)
      const blob = new Blob([content], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ledes-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: tErr("toast.ledesExportDownloaded") })
    } catch {
      toast({ title: tErr("toast.exportFailed"), variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const entries = data?.lines ?? []
  const matterOptions = entries
    .map((e) => ({ id: e.matterId ?? "", title: e.matterTitle }))
    .filter((m, i, arr) => m.id && arr.findIndex((x) => x.id === m.id) === i)

  return (
    <PageEnter className="p-6 space-y-6" data-tour="prebill-workspace">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Pre-Bill Review
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review unbilled time entries, apply write-downs, and export LEDES for submission
          </p>
        </div>
        <Button onClick={handleLedesExport} disabled={exporting || entries.length === 0} variant="outline">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Export LEDES
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex gap-4 items-end flex-wrap">
          <div className="space-y-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground font-medium">{t("filter_by_matter")}</label>
            <Select value={matterId} onValueChange={setMatterId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t("all_matters")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("all_matters")}</SelectItem>
                {matterOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{data?.summary?.entryCount ?? entries.length}</strong> entries
            </span>
            {data?.summary?.billableHours !== undefined && (
              <span>
                <strong className="text-foreground">{data.summary.billableHours.toFixed(1)}h</strong> billable
              </span>
            )}
            {data?.summary?.totalAmount !== undefined && (
              <span>
                <strong className="text-foreground">
                  USD {data.summary.totalAmount.toFixed(2)}
                </strong>{" "}
                total
              </span>
            )}
            {data?.summary?.pendingApproval ? (
              <Badge variant="destructive" className="text-xs">{data.summary.pendingApproval} pending</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("no_unbilled_time_entries_found")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("unbilled_time_entries")}</CardTitle>
            <CardDescription>
              Review and approve entries before generating invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("matter")}</th>
                    <th className="pb-2 font-medium">{t("narrative")}</th>
                    <th className="pb-2 font-medium text-right">{t("duration")}</th>
                    <th className="pb-2 font-medium text-right">{t("rate")}</th>
                    <th className="pb-2 font-medium text-right">{t("amount")}</th>
                    <th className="pb-2 font-medium">{tAdmin("status")}</th>
                    <th className="pb-2 font-medium">{t("date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-3 font-medium max-w-[160px] truncate">
                        {entry.matterTitle}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground max-w-[200px] truncate">
                        {entry.narrative ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {(entry.minutes / 60).toFixed(2)}h
                      </td>
                      <td className="py-2.5 pr-3 text-right text-muted-foreground">
                        {entry.rate ? `USD ${entry.rate}/h` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium">
                        {entry.amount != null
                          ? `USD ${entry.amount.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={entry.status === "APPROVED" ? "default" : "secondary"} className="text-xs">
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-muted-foreground text-xs">
                        {entry.date ? format(new Date(entry.date), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageEnter>
  )
}
