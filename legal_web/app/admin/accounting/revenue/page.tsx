"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ChevronLeft, ChevronRight, Wallet } from "lucide-react"
import {
  getAccountingRevenueList,
  type PlatformRevenueEntry,
} from "@/lib/api/admin-extended"

const SOURCE_LABELS: Record<string, string> = {
  subscription: "Subscription",
  credit_topup: "Credit Top-up",
  marketplace: "Marketplace",
  lawyer_review: "Lawyer Review",
  other: "Other",
}

const SOURCE_BADGE: Record<string, string> = {
  subscription: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  credit_topup: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  marketplace: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  lawyer_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  other: "bg-muted text-muted-foreground",
}

function fmt(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

export default function RevenueListPage() {
  const [items, setItems] = useState<PlatformRevenueEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [source, setSource] = useState("all")
  const limit = 50

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getAccountingRevenueList({
      from: from || undefined,
      to: to || undefined,
      source: source !== "all" ? source : undefined,
      page,
      limit,
    })
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }, [from, to, source, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Revenue Ledger</h1>
          <p className="text-sm text-muted-foreground">{total} entries</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="w-40 text-sm"
          placeholder="From"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="w-40 text-sm"
          placeholder="To"
        />
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(1) }}>
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); setSource("all"); setPage(1) }}>
          Reset
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Date</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Source</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Provider</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Ref</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Gross</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Tax</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Net</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          No revenue entries found
                        </td>
                      </tr>
                    ) : (
                      items.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {fmtDate(row.occurredAt)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={`text-xs border-0 ${SOURCE_BADGE[row.source] ?? "bg-muted text-muted-foreground"}`}>
                              {SOURCE_LABELS[row.source] ?? row.source}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground capitalize">{row.paymentProvider}</td>
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-[160px] truncate" title={row.providerRef}>
                            {row.providerRef}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium text-foreground">
                            {fmt(row.grossAmount)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                            {fmt(row.taxAmount)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                            {fmt(row.netAmount)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs uppercase">{row.currency}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} &middot; {total} entries
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
