"use client"

import { useRole } from "@/lib/contexts/role-context"
import { getCollectionsThisMonth, getOutstandingInvoices, getOverdueInvoices, getOriginatorStats, getInvoiceAging, mockInvoices } from "@/lib/mock/finance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DollarSign, TrendingUp, AlertTriangle, FileText, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { RoleGate } from "@/components/dashboard/role-gate"
import { cn } from "@/lib/utils"

export default function FinancePage() {
  const { currentRole } = useRole()
  const collectionsThisMonth = getCollectionsThisMonth()
  const outstandingInvoices = getOutstandingInvoices()
  const overdueInvoices = getOverdueInvoices()
  const originatorStats = getOriginatorStats()
  const invoiceAging = getInvoiceAging()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Finance Dashboard</h1>
          <p className="text-muted-foreground">Monitor collections, billings, and financial performance</p>
        </div>
        <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
          <Link href="/app/accounting/invoices/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </Link>
        </RoleGate>
      </div>

      {/* Finance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Collections This Month"
          value={`KSH ${(collectionsThisMonth / 1000).toFixed(0)}K`}
          delta={{ value: 15, positive: true }}
        />
        <KpiCard
          icon={TrendingUp}
          label="Outstanding Invoices"
          value={`KSH ${(outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0) / 1000).toFixed(0)}K`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue Invoices"
          value={overdueInvoices.length}
        />
        <KpiCard
          icon={FileText}
          label="Total Invoices"
          value={outstandingInvoices.length}
        />
      </div>

      {/* Top Originators */}
      <Card>
        <CardHeader>
          <CardTitle>Top Originators</CardTitle>
          <CardDescription>Partners and associates ranked by collections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {originatorStats.map((stat, index) => (
              <div key={stat.userId} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                    index === 0 ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                    index === 1 ? "bg-gray-400/20 text-gray-700 dark:text-gray-400" :
                    index === 2 ? "bg-orange-500/20 text-orange-700 dark:text-orange-400" :
                    "bg-primary/10 text-primary"
                  )}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{stat.userName}</div>
                    <div className="text-sm text-muted-foreground">{stat.invoiceCount} invoices</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">KSH {(stat.collectedAmount / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-muted-foreground">Collected</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    KSH {(stat.invoicedAmount / 1000).toFixed(0)}K invoiced
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Aging */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Aging</CardTitle>
          <CardDescription>Outstanding invoices by age</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <span className="text-sm font-medium">Current (Not Due)</span>
              <span className="font-bold">KSH {(invoiceAging.current / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <span className="text-sm font-medium">1-30 Days</span>
              <span className="font-bold">KSH {(invoiceAging.days30 / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <span className="text-sm font-medium">31-60 Days</span>
              <span className="font-bold">KSH {(invoiceAging.days60 / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <span className="text-sm font-medium">61-90 Days</span>
              <span className="font-bold">KSH {(invoiceAging.days90 / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
              <span className="text-sm font-medium">Over 90 Days</span>
              <span className="font-bold text-red-600 dark:text-red-400">KSH {(invoiceAging.over90 / 1000).toFixed(0)}K</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Queue</CardTitle>
              <CardDescription>Invoices pending payment</CardDescription>
            </div>
            <Link href="/app/accounting/invoices">
              <Button variant="outline" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {outstandingInvoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{invoice.invoiceNumber}</span>
                    <Badge variant={invoice.status === "Overdue" ? "destructive" : "outline"}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {invoice.clientName} • {invoice.matterTitle}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">KSH {(invoice.amount / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-muted-foreground">Originator: {invoice.originatorName}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


