"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { invoicesApi } from "@/lib/mock-api"
import { formatCurrencyWithSymbol, formatDate } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import type { Invoice } from "@/lib/types"
import { Plus } from "lucide-react"

export default function InvoicesPage() {
  const { currency } = useCurrency()
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    async function loadInvoices() {
      const data = await invoicesApi.listInvoices()
      setInvoices(data)
    }
    loadInvoices()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage client invoices</p>
        </div>
        <Link href="/app/accounting/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No invoices found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{invoice.number}</h3>
                      <Badge>{invoice.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {invoice.client?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Issued: {formatDate(invoice.issueDate)} • Due: {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatCurrencyWithSymbol(invoice.total, currency)}</div>
                    {invoice.paidAmount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Paid: {formatCurrencyWithSymbol(invoice.paidAmount, currency)}
                      </div>
                    )}
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

