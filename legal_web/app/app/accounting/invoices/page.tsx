"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import Link from "next/link"
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
import { listInvoices } from "@/lib/api/billing"
import type { ApiInvoice } from "@/lib/api/types"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatCurrencyWithSymbol, formatDate } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { Plus, Search, Loader2, Download } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api/client"
import { authorizedFetch } from "@/lib/api/client"

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
]

type InvoiceRow = {
  id: string
  number: string
  status: string
  clientName?: string
  issueDate: Date
  dueDate: Date
  total: number
  paidAmount: number
}

function apiInvoiceToRow(inv: ApiInvoice): InvoiceRow {
  const amount = typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount
  return {
    id: inv.id,
    number: inv.invoiceNumber,
    status: inv.status,
    clientName: undefined,
    issueDate: new Date(inv.createdAt),
    dueDate: inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt),
    total: amount,
    paidAmount: inv.status === "PAID" ? amount : 0,
  }
}

async function downloadLedes98B(tenantId: string, invoiceId: string, invoiceNumber: string) {
  const res = await authorizedFetch(`/billing/invoices/${invoiceId}/ledes98b`, {
    tenantId,
  })
  if (!res.ok) throw new Error("Failed to generate LEDES export")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${invoiceNumber}-ledes98b.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function InvoicesPage() {
  const t = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const { currency } = useCurrency()
  const { activeTenantId } = useTenant()
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [ledesLoading, setLedesLoading] = useState<string | null>(null)

  const { data: apiInvoices = [], isLoading, error } = useApiData<ApiInvoice[]>(
    ["invoices", activeTenantId, statusFilter],
    {
      apiFn: () =>
        listInvoices(
          activeTenantId!,
          statusFilter !== "all" ? statusFilter : undefined,
        ),
      enabled: !!activeTenantId,
    },
  )

  const invoices = useMemo(() => (apiInvoices ?? []).map(apiInvoiceToRow), [apiInvoices])

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return invoices
    const q = searchQuery.toLowerCase()
    return invoices.filter(
      (inv) =>
        inv.number.toLowerCase().includes(q) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(q)),
    )
  }, [invoices, searchQuery])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between" data-tour="billing-header">
        <div>
          <h1 className="text-3xl font-bold">{t("invoices")}</h1>
          <p className="text-muted-foreground">{t("manage_client_invoices")}</p>
        </div>
        <Link href="/app/accounting/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search_by_number_or_client")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={tAdmin("status")} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Failed to load invoices
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredBySearch.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No invoices found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4" data-tour="billing-invoices">
          {filteredBySearch.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{invoice.number}</h3>
                      <Badge>{invoice.status}</Badge>
                    </div>
                    {invoice.clientName && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {invoice.clientName}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Issued: {formatDate(invoice.issueDate)} • Due:{" "}
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-lg font-semibold">
                      {formatCurrencyWithSymbol(invoice.total, currency)}
                    </div>
                    {invoice.paidAmount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Paid: {formatCurrencyWithSymbol(invoice.paidAmount, currency)}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ledesLoading === invoice.id}
                      onClick={async () => {
                        if (!activeTenantId) return
                        setLedesLoading(invoice.id)
                        try {
                          await downloadLedes98B(activeTenantId, invoice.id, invoice.number)
                        } finally {
                          setLedesLoading(null)
                        }
                      }}
                    >
                      {ledesLoading === invoice.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      LEDES 98B
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
