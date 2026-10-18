"use client"
import { useTranslations } from "next-intl"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Plus, Receipt, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  listPayments,
  recordPayment,
  setPaymentReconciled,
  getOutstandingInvoices,
  type ApiPayment,
} from "@/lib/api/finance"
import { listClients } from "@/lib/api/clients"
import { formatCurrencyWithSymbol } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import Link from "next/link"
import type { ApiInvoice } from "@/lib/api/types"

function invoiceAmount(inv: ApiInvoice): number {
  return typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount
}

export default function PaymentsPage() {
  const t = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const { currency } = useCurrency()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [clientFilter, setClientFilter] = useState("all")
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordInvoiceId, setRecordInvoiceId] = useState("")
  const [recordAmount, setRecordAmount] = useState("")
  const [recordDate, setRecordDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [saving, setSaving] = useState(false)
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)

  const { data: payments = [], isLoading, error } = useApiData<ApiPayment[]>(
    ["payments", activeTenantId],
    {
      apiFn: () => listPayments(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: outstandingInvoices = [] } = useApiData<ApiInvoice[]>(
    ["outstanding-invoices", activeTenantId],
    {
      apiFn: () => getOutstandingInvoices(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: clients = [] } = useApiData(
    ["clients", activeTenantId],
    {
      apiFn: () => listClients(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (clientFilter !== "all" && p.clientId !== clientFilter) return false
      if (dateFrom) {
        const from = new Date(dateFrom)
        if (new Date(p.paidAt) < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(p.paidAt) > to) return false
      }
      return true
    })
  }, [payments, clientFilter, dateFrom, dateTo])

  const selectedInvoice = recordInvoiceId
    ? outstandingInvoices.find((inv) => inv.id === recordInvoiceId)
    : null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payments", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["outstanding-invoices", activeTenantId] })
  }

  const handleRecordPayment = async () => {
    if (!recordInvoiceId || !recordAmount || !recordDate || !activeTenantId) return
    const amount = parseFloat(recordAmount.replace(/,/g, ""))
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      await recordPayment(activeTenantId, recordInvoiceId, { amount })
      invalidate()
      setRecordOpen(false)
      setRecordInvoiceId("")
      setRecordAmount("")
      setRecordDate(format(new Date(), "yyyy-MM-dd"))
    } finally {
      setSaving(false)
    }
  }

  const handleReconcileToggle = async (payment: ApiPayment, reconciled: boolean) => {
    if (!activeTenantId) return
    setReconcilingId(payment.id)
    try {
      await setPaymentReconciled(activeTenantId, payment.id, reconciled)
      invalidate()
    } finally {
      setReconcilingId(null)
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
          <h1 className="text-3xl font-bold">{t("payments")}</h1>
          <p className="text-muted-foreground">{t("payment_records_linked_to_invoices")}</p>
        </div>
        <Button onClick={() => setRecordOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record payment
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4 text-destructive">{error.message}</CardContent>
        </Card>
      )}

      <Card data-tour="payments-list">
        <CardHeader>
          <CardTitle>
            Payment records
          </CardTitle>
          <CardDescription>
            Filter by date range or client. Record a payment against an outstanding invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              placeholder={tAdmin("from")}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-[140px]"
            />
            <Input
              type="date"
              placeholder={t("to")}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-[140px]"
            />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t("client")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_clients")}</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("invoice")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-center">{t("reconciled")}</TableHead>
                <TableHead>{tAdmin("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No payments match your filters. Record a payment against an outstanding invoice.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.paidAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Link
                        href="/app/accounting/invoices"
                        className="text-primary hover:underline font-medium"
                      >
                        {p.invoiceNumber ?? p.invoiceId}
                      </Link>
                    </TableCell>
                    <TableCell>{p.clientName ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyWithSymbol(p.amount, currency)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={!!p.reconciled}
                          disabled={reconcilingId === p.id}
                          onCheckedChange={(checked) => void handleReconcileToggle(p, checked)}
                          aria-label={`Mark payment ${p.invoiceNumber ?? p.id} as reconciled`}
                        />
                        {reconcilingId === p.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {p.reconciled ? "Reconciled" : "Pending"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={recordOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRecordInvoiceId("")
            setRecordAmount("")
          }
          setRecordOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("record_payment")}</DialogTitle>
            <DialogDescription>
              Record a payment against an outstanding invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("invoice")}</Label>
              <Select
                value={recordInvoiceId}
                onValueChange={(id) => {
                  setRecordInvoiceId(id)
                  const inv = outstandingInvoices.find((i) => i.id === id)
                  if (inv) setRecordAmount(String(invoiceAmount(inv)))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select_invoice")} />
                </SelectTrigger>
                <SelectContent>
                  {outstandingInvoices.length === 0 ? (
                    <SelectItem value="_none_" disabled>
                      No outstanding invoices
                    </SelectItem>
                  ) : (
                    outstandingInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {formatCurrencyWithSymbol(invoiceAmount(inv), currency)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("amount")}</Label>
              <Input
                type="text"
                placeholder={t("000")}
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
              />
              {selectedInvoice && (
                <p className="text-xs text-muted-foreground">
                  Invoice total: {formatCurrencyWithSymbol(invoiceAmount(selectedInvoice), currency)}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>{t("payment_date")}</Label>
              <Input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                saving ||
                !recordInvoiceId ||
                recordInvoiceId === "_none_" ||
                !recordAmount ||
                outstandingInvoices.length === 0
              }
              onClick={handleRecordPayment}
            >
              {saving ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
