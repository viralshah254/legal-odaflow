"use client"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { getCollectionsThisMonth, getOutstandingInvoices, getOverdueInvoices, getOriginatorStats, getInvoiceAging, mockInvoices } from "@/lib/mock/finance"
import { getActiveFixedCosts, mockFixedCosts, updateFixedCost, createFixedCost, deleteFixedCost } from "@/lib/mock/expenses"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DollarSign, TrendingUp, AlertTriangle, FileText, Plus, ArrowRight, Settings, Edit, Trash2, X } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { RoleGate } from "@/components/dashboard/role-gate"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExpenseCategory } from "@/lib/types/expenses"
import { formatCurrencyWithSymbol, formatCurrencyShort, formatNumberWithCommas, parseCommaNumber } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { PlanGate } from "@/components/plan/plan-gate"
import { UpgradePrompt } from "@/components/plan/upgrade-prompt"
import { mockExpenses, getExpensesByMatter, getExpensesByClient, createExpense } from "@/lib/mock/expenses"
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog"
import { Receipt, TrendingDown, AlertCircle, User, CheckCircle2, XCircle, Clock, Download, Upload } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { calculatePnL, calculateBalanceSheet, getOutstandingFinanceAlerts } from "@/lib/utils/financial-statements"
import { 
  mockClaims, 
  getClaimsByStatus, 
  getClaimsPendingFinanceApproval, 
  getClaimsPendingAdminApproval,
  createClaim,
  approveClaimByFinance,
  approveClaimByAdmin,
  rejectClaim,
  markClaimAsPaid,
  getClaimsBySubmitter
} from "@/lib/mock/claims"
import { ClaimStatus, ClaimCategory } from "@/lib/types/claims"
import { Textarea } from "@/components/ui/textarea"
import React from "react"
import { mockUsers } from "@/lib/mock/users"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"

export default function FinancePage() {
  const { currentRole, currentUser } = useRole()
  const { currency } = useCurrency()
  const [fixedCosts, setFixedCosts] = useState(getActiveFixedCosts())
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<any>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [expenses, setExpenses] = useState(mockExpenses)
  const [createExpenseDialogOpen, setCreateExpenseDialogOpen] = useState(false)
  const [claims, setClaims] = useState(mockClaims)
  const [createClaimDialogOpen, setCreateClaimDialogOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<"month" | "quarter" | "year">("month")

  const collectionsThisMonth = getCollectionsThisMonth()
  const outstandingInvoices = getOutstandingInvoices()
  const overdueInvoices = getOverdueInvoices()
  const originatorStats = getOriginatorStats()
  const invoiceAging = getInvoiceAging()

  const handleEditCost = (cost: any) => {
    setEditingCost(cost)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editingCost) {
      updateFixedCost(editingCost.id, editingCost)
      setFixedCosts([...getActiveFixedCosts()])
      setEditDialogOpen(false)
      setEditingCost(null)
    }
  }

  const handleDeleteCost = (id: string) => {
    if (confirm("Are you sure you want to delete this fixed cost?")) {
      deleteFixedCost(id)
      setFixedCosts([...getActiveFixedCosts()])
    }
  }

  const handleCreateCost = (costData: any) => {
    createFixedCost({
      ...costData,
      amount: typeof costData.amount === "string" ? parseCommaNumber(costData.amount) * 100 : costData.amount,
    })
    setFixedCosts([...getActiveFixedCosts()])
    setCreateDialogOpen(false)
  }

  const handleExpenseCreated = () => {
    setExpenses([...mockExpenses])
    setCreateExpenseDialogOpen(false)
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const thisMonthExpenses = expenses.filter(
    (e) => e.date.getMonth() === new Date().getMonth() && e.date.getFullYear() === new Date().getFullYear()
  ).reduce((sum, e) => sum + e.amount, 0)

  // Financial statements
  const pnl = calculatePnL(selectedPeriod)
  const balanceSheet = calculateBalanceSheet()
  const financeAlerts = getOutstandingFinanceAlerts()

  // Claims
  const pendingClaims = getClaimsByStatus("PENDING")
  const pendingFinanceApproval = getClaimsPendingFinanceApproval()
  const pendingAdminApproval = getClaimsPendingAdminApproval()
  const userClaims = currentUser ? getClaimsBySubmitter(currentUser.id) : []

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Finance Dashboard</h1>
          <p className="text-muted-foreground">Monitor collections, billings, and financial performance</p>
        </div>
        <div className="flex gap-2">
          <OpenCopilotButton />
          <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
            <Link href="/app/accounting/invoices/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </Link>
          </RoleGate>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Outstanding Alerts */}
          {financeAlerts.length > 0 && (
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <CardTitle>Outstanding Alerts</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {financeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-orange-500/20 bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={alert.severity === "HIGH" ? "destructive" : alert.severity === "MEDIUM" ? "default" : "secondary"}
                        >
                          {alert.severity}
                        </Badge>
                        <div>
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm text-muted-foreground">{alert.description}</div>
                        </div>
                      </div>
                      {alert.actionUrl && (
                        <Link href={alert.actionUrl}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Finance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Collections This Month"
          value={formatCurrencyShort(collectionsThisMonth, currency)}
          delta={{ value: 15, positive: true }}
        />
        <KpiCard
          icon={TrendingUp}
          label="Outstanding Invoices"
          value={formatCurrencyShort(outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0), currency)}
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

      {/* Top Originators - Advanced Reporting Feature */}
      <PlanGate
        requiredPlan="PROFESSIONAL"
        feature="Advanced Reporting"
        description="Get detailed analytics and insights with the Professional plan"
      >
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
                    <div className="font-bold text-lg">{formatCurrencyShort(stat.collectedAmount, currency)}</div>
                    <div className="text-xs text-muted-foreground">Collected</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatCurrencyShort(stat.invoicedAmount, currency)} invoiced
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PlanGate>

      {/* Invoice Aging - Advanced Reporting Feature */}
      <PlanGate
        requiredPlan="PROFESSIONAL"
        feature="Invoice Aging Analysis"
        description="View detailed invoice aging breakdown with the Professional plan"
      >
        <Card>
          <CardHeader>
            <CardTitle>Invoice Aging</CardTitle>
            <CardDescription>Outstanding invoices by age</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <span className="text-sm font-medium">Current (Not Due)</span>
                <span className="font-bold">{formatCurrencyShort(invoiceAging.current, currency)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <span className="text-sm font-medium">1-30 Days</span>
                <span className="font-bold">{formatCurrencyShort(invoiceAging.days30, currency)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <span className="text-sm font-medium">31-60 Days</span>
                <span className="font-bold">{formatCurrencyShort(invoiceAging.days60, currency)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <span className="text-sm font-medium">61-90 Days</span>
                <span className="font-bold">{formatCurrencyShort(invoiceAging.days90, currency)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                <span className="text-sm font-medium">Over 90 Days</span>
                <span className="font-bold text-red-600 dark:text-red-400">{formatCurrencyShort(invoiceAging.over90, currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </PlanGate>

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
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Responsible: {invoice.originatorName}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCurrencyShort(invoice.amount, currency)}</div>
                  <div className="text-xs text-muted-foreground">Status: {invoice.status}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fixed Costs Management */}
      <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fixed Costs</CardTitle>
                <CardDescription>Manage recurring fixed costs and expenses</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Fixed Cost
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fixedCosts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No fixed costs configured</p>
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Fixed Cost
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {fixedCosts.map((cost) => (
                  <div
                    key={cost.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{cost.name}</span>
                        <Badge variant="outline">{cost.category}</Badge>
                        <Badge variant="outline">{cost.frequency}</Badge>
                      </div>
                      {cost.description && (
                        <p className="text-sm text-muted-foreground mb-1">{cost.description}</p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Started: {format(cost.startDate, "MMM d, yyyy")}
                        {cost.endDate && ` • Ends: ${format(cost.endDate, "MMM d, yyyy")}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <div className="font-bold text-lg">{formatCurrencyWithSymbol(cost.amount, currency)}</div>
                        <div className="text-xs text-muted-foreground">per {cost.frequency.toLowerCase()}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleEditCost(cost)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCost(cost.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </RoleGate>

      {/* Edit Fixed Cost Dialog */}
      {editingCost && (
        <EditFixedCostDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          cost={editingCost}
          onSave={handleSaveEdit}
          onCostChange={setEditingCost}
        />
      )}

      {/* Create Fixed Cost Dialog */}
      <CreateFixedCostDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSave={handleCreateCost} />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Expenses</h2>
              <p className="text-muted-foreground">Track and manage firm expenses</p>
            </div>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
              <Button onClick={() => setCreateExpenseDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Expense
              </Button>
            </RoleGate>
          </div>

          {/* Expense Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyWithSymbol(totalExpenses, currency)}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyWithSymbol(thisMonthExpenses, currency)}</div>
                <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Count</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expenses.length}</div>
                <p className="text-xs text-muted-foreground">Expense records</p>
              </CardContent>
            </Card>
          </div>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>All expense records</CardDescription>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No expenses recorded yet</p>
                  <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
                    <Button className="mt-4" onClick={() => setCreateExpenseDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Expense
                    </Button>
                  </RoleGate>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{expense.description}</span>
                            <Badge variant="outline">{expense.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {expense.matterTitle && `${expense.matterTitle} • `}
                            {expense.clientName && `${expense.clientName} • `}
                            {format(expense.date, "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created by {expense.createdByName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{formatCurrencyWithSymbol(expense.amount, currency)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <CreateExpenseDialog 
            open={createExpenseDialogOpen} 
            onOpenChange={setCreateExpenseDialogOpen} 
            onSave={handleExpenseCreated} 
          />
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Invoices</CardTitle>
                  <CardDescription>Complete invoice list with responsible parties</CardDescription>
                </div>
                <Link href="/app/accounting/invoices/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{invoice.invoiceNumber}</span>
                        <Badge variant={invoice.status === "Overdue" ? "destructive" : invoice.status === "Paid" ? "default" : "outline"}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {invoice.clientName} • {invoice.matterTitle}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Responsible: {invoice.originatorName}</span>
                        </div>
                        <span>Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}</span>
                        {invoice.sentDate && (
                          <span>Sent: {format(new Date(invoice.sentDate), "MMM d, yyyy")}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrencyShort(invoice.amount, currency)}</div>
                      <Link href={`/app/accounting/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm" className="mt-2">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* P&L Tab */}
        <TabsContent value="pnl" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Profit & Loss Statement</h2>
              <p className="text-muted-foreground">Financial performance overview</p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{pnl.period.label}</CardTitle>
              <CardDescription>
                {format(pnl.period.start, "MMM d, yyyy")} - {format(pnl.period.end, "MMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Revenue */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Revenue</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoiced</span>
                    <span className="font-medium">{formatCurrencyWithSymbol(pnl.revenue.invoiced, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrencyWithSymbol(pnl.revenue.collected, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-medium">{formatCurrencyWithSymbol(pnl.revenue.outstanding, currency)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                {/* Expenses */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Expenses</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Operating Expenses</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.operating, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fixed Costs</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.fixed, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Claims</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.claims, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>Total Expenses</span>
                      <span className="text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.total, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                {/* Profit */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Profit</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Profit</span>
                      <span
                        className={cn(
                          "font-bold text-lg",
                          pnl.profit.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {formatCurrencyWithSymbol(pnl.profit.net, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profit Margin</span>
                      <span
                        className={cn(
                          "font-medium",
                          pnl.profit.margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {pnl.profit.margin.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance-sheet" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Balance Sheet</h2>
              <p className="text-muted-foreground">As of {format(balanceSheet.asOf, "MMM d, yyyy")}</p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Assets */}
            <Card>
              <CardHeader>
                <CardTitle>Assets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Current Assets</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.assets.current.cash, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accounts Receivable</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.assets.current.receivables, currency)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>Total Current Assets</span>
                      <span>{formatCurrencyWithSymbol(balanceSheet.assets.current.total, currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Assets</span>
                    <span>{formatCurrencyWithSymbol(balanceSheet.assets.total, currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity */}
            <Card>
              <CardHeader>
                <CardTitle>Liabilities & Equity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Current Liabilities</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accounts Payable</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.liabilities.current.payables, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending Claims</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.liabilities.current.claims, currency)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>Total Current Liabilities</span>
                      <span>{formatCurrencyWithSymbol(balanceSheet.liabilities.current.total, currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Liabilities</span>
                    <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.liabilities.total, currency)}</span>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Equity</h4>
                  <div className="pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retained Earnings</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.equity.retained, currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Liabilities & Equity</span>
                    <span>{formatCurrencyWithSymbol(balanceSheet.liabilities.total + balanceSheet.equity.total, currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Claims Tab */}
        <TabsContent value="claims" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Expense Claims</h2>
              <p className="text-muted-foreground">Submit and manage reimbursement claims</p>
            </div>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "FINANCE"]}>
              <Button onClick={() => setCreateClaimDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Submit Claim
              </Button>
            </RoleGate>
          </div>

          {/* Pending Approvals (Finance & Admin) */}
          {(currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE") && (
            <>
              {pendingFinanceApproval.length > 0 && (
                <Card className="border-orange-500/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <CardTitle>Pending Finance Approval</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingFinanceApproval.map((claim) => (
                        <ClaimCard
                          key={claim.id}
                          claim={claim}
                          onApprove={() => {
                            if (currentRole === "FINANCE" && currentUser) {
                              approveClaimByFinance(claim.id, currentUser.id, currentUser.name)
                              setClaims([...mockClaims])
                            }
                          }}
                          onReject={(reason) => {
                            if ((currentRole === "FINANCE" || currentRole === "PARTNER_ADMIN") && currentUser) {
                              rejectClaim(claim.id, currentUser.id, currentUser.name, reason)
                              setClaims([...mockClaims])
                            }
                          }}
                          canApprove={currentRole === "FINANCE"}
                          canReject={currentRole === "FINANCE" || currentRole === "PARTNER_ADMIN"}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {pendingAdminApproval.length > 0 && (
                <Card className="border-blue-500/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <CardTitle>Pending Admin Approval</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingAdminApproval.map((claim) => (
                        <ClaimCard
                          key={claim.id}
                          claim={claim}
                          onApprove={() => {
                            if (currentRole === "PARTNER_ADMIN" && currentUser) {
                              approveClaimByAdmin(claim.id, currentUser.id, currentUser.name)
                              setClaims([...mockClaims])
                            }
                          }}
                          onReject={(reason) => {
                            if (currentRole === "PARTNER_ADMIN" && currentUser) {
                              rejectClaim(claim.id, currentUser.id, currentUser.name, reason)
                              setClaims([...mockClaims])
                            }
                          }}
                          canApprove={currentRole === "PARTNER_ADMIN"}
                          canReject={currentRole === "PARTNER_ADMIN"}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* All Claims */}
          <Card>
            <CardHeader>
              <CardTitle>All Claims</CardTitle>
              <CardDescription>View all submitted expense claims</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" ? claims : userClaims).map((claim) => (
                  <ClaimCard
                    key={claim.id}
                    claim={claim}
                    onApprove={() => {}}
                    onReject={() => {}}
                    canApprove={false}
                    canReject={false}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <CreateClaimDialog
            open={createClaimDialogOpen}
            onOpenChange={setCreateClaimDialogOpen}
            onSave={() => {
              setClaims([...mockClaims])
              setCreateClaimDialogOpen(false)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ClaimCard({
  claim,
  onApprove,
  onReject,
  canApprove,
  canReject,
}: {
  claim: any
  onApprove: () => void
  onReject: (reason: string) => void
  canApprove: boolean
  canReject: boolean
}) {
  const { currency } = useCurrency()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")

  const statusColors = {
    PENDING: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    APPROVED: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    PAID: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{claim.description}</span>
            <Badge className={statusColors[claim.status as keyof typeof statusColors]}>{claim.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Submitted by {claim.submittedByName} • {format(claim.submittedAt, "MMM d, yyyy")}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Category: {claim.category}
            {claim.receiptFileName && ` • Receipt: ${claim.receiptFileName}`}
          </div>
          {claim.financeApprovedByName && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              ✓ Approved by Finance: {claim.financeApprovedByName} on {format(claim.financeApprovedAt!, "MMM d, yyyy")}
            </div>
          )}
          {claim.adminApprovedByName && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              ✓ Approved by Admin: {claim.adminApprovedByName} on {format(claim.adminApprovedAt!, "MMM d, yyyy")}
            </div>
          )}
          {claim.rejectedByName && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              ✗ Rejected by {claim.rejectedByName}: {claim.rejectionReason}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-bold text-lg">{formatCurrencyWithSymbol(claim.amount, currency)}</div>
          </div>
          {canApprove && claim.status === "PENDING" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={onApprove}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this claim</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectionReason) {
                  onReject(rejectionReason)
                  setRejectDialogOpen(false)
                  setRejectionReason("")
                }
              }}
              disabled={!rejectionReason}
            >
              Reject Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreateClaimDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}) {
  const { currentUser } = useRole()
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ClaimCategory>("Travel")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptFileName, setReceiptFileName] = useState("")

  const categories: ClaimCategory[] = [
    "Travel",
    "Meals",
    "Office Supplies",
    "Professional Development",
    "Client Entertainment",
    "Technology",
    "Other",
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      setReceiptFileName(file.name)
    }
  }

  const handleSave = () => {
    if (!description || !amount || !receiptFile || !currentUser) return

    createClaim({
      submittedBy: currentUser.id,
      submittedByName: currentUser.name,
      submittedAt: new Date(),
      description,
      amount: parseCommaNumber(amount) * 100,
      category,
      receiptUrl: `/receipts/${Date.now()}-${receiptFileName}`,
      receiptFileName,
    })

    setDescription("")
    setAmount("")
    setCategory("Travel")
    setReceiptFile(null)
    setReceiptFileName("")
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit Expense Claim</DialogTitle>
          <DialogDescription>Submit a reimbursement claim with receipt attachment</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Client lunch meeting - ABC Corp"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(amount)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d,.]/g, "")
                  const parts = cleaned.split(".")
                  if (parts.length > 2) {
                    setAmount(parts[0] + "." + parts.slice(1).join(""))
                  } else {
                    setAmount(cleaned)
                  }
                }}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ClaimCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt">Receipt * (Required for approval)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {receiptFileName && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  {receiptFileName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload receipt (PDF, JPG, PNG). Receipt is required for claim approval.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!description || !amount || !receiptFile}>
            <Upload className="mr-2 h-4 w-4" />
            Submit Claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditFixedCostDialog({ open, onOpenChange, cost, onSave, onCostChange }: any) {
  const categories: ExpenseCategory[] = [
    "Office Supplies",
    "Travel",
    "Filing Fees",
    "Court Fees",
    "Professional Services",
    "Technology",
    "Utilities",
    "Rent",
    "Marketing",
    "Other",
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Fixed Cost</DialogTitle>
          <DialogDescription>Update fixed cost details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={cost.name}
              onChange={(e) => onCostChange({ ...cost, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={cost.description || ""}
              onChange={(e) => onCostChange({ ...cost, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas((cost.amount / 100).toFixed(2))}
                onChange={(e) => {
                  // Allow only numbers, commas, and one decimal point
                  const cleaned = e.target.value.replace(/[^\d,.]/g, "")
                  // Ensure only one decimal point
                  const parts = cleaned.split(".")
                  const finalValue = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned
                  onCostChange({ ...cost, amount: parseCommaNumber(finalValue) * 100 })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select
                value={cost.frequency}
                onValueChange={(value) => onCostChange({ ...cost, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                  <SelectItem value="One-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={cost.category}
              onValueChange={(value) => onCostChange({ ...cost, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateFixedCostDialog({ open, onOpenChange, onSave }: any) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState<"Monthly" | "Quarterly" | "Yearly" | "One-time">("Monthly")
  const [category, setCategory] = useState<ExpenseCategory>("Other")

  const categories: ExpenseCategory[] = [
    "Office Supplies",
    "Travel",
    "Filing Fees",
    "Court Fees",
    "Professional Services",
    "Technology",
    "Utilities",
    "Rent",
    "Marketing",
    "Other",
  ]

  const handleSave = () => {
    if (!name || !amount) return

    onSave({
      name,
      description: description || undefined,
      amount: parseCommaNumber(amount) * 100,
      frequency,
      category,
      startDate: new Date(),
      isActive: true,
    })

    setName("")
    setDescription("")
    setAmount("")
    setFrequency("Monthly")
    setCategory("Other")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Fixed Cost</DialogTitle>
          <DialogDescription>Add a new recurring fixed cost</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(amount)}
                onChange={(e) => {
                  // Allow only numbers, commas, and one decimal point
                  const cleaned = e.target.value.replace(/[^\d,.]/g, "")
                  // Ensure only one decimal point
                  const parts = cleaned.split(".")
                  if (parts.length > 2) {
                    setAmount(parts[0] + "." + parts.slice(1).join(""))
                  } else {
                    setAmount(cleaned)
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                  <SelectItem value="One-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !amount}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



