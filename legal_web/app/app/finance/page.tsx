"use client"
import { useTranslations } from "next-intl"

import { useState, useMemo } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import {
  getFinanceDashboard,
  getOutstandingInvoices,
  getOverdueInvoices,
  listFinanceInvoices,
  listExpenses,
  listFixedCosts,
  listClaims,
  listPayments,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  createClaim,
  updateClaim,
  type ApiExpense,
  type ApiFixedCost,
  type ApiClaim,
} from "@/lib/api/finance"
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
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog"
import { Receipt, TrendingDown, AlertCircle, User, CheckCircle2, XCircle, Clock, Download, Upload, Scale } from "lucide-react"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { formatDate } from "@/lib/utils"
import { calculatePnL, calculateBalanceSheet, getOutstandingFinanceAlerts, type FinanceStatementInput } from "@/lib/utils/financial-statements"
import { ClaimStatus } from "@/lib/types/claims"
import { Textarea } from "@/components/ui/textarea"
import React from "react"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import type { ApiInvoice } from "@/lib/api/types"

function invoiceAmount(inv: ApiInvoice): number {
  return typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount
}

export default function FinancePage() {
  const toFixed = useTranslations("billing")
  const t = useTranslations("billing")
  const tCommon = useTranslations("common")
  const tDashboard = useTranslations("dashboard")
  const { currentRole, currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { currency } = useCurrency()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<ApiFixedCost | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createExpenseDialogOpen, setCreateExpenseDialogOpen] = useState(false)
  const [createClaimDialogOpen, setCreateClaimDialogOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<"month" | "quarter" | "year">("month")

  const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey: ["finance"] })
    queryClient.invalidateQueries({ queryKey: ["expenses", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["fixed-costs", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["claims", activeTenantId] })
  }

  const { data: dashboard, isLoading: dashboardLoading, error: dashboardError } = useApiData(
    ["finance", "dashboard", activeTenantId],
    { apiFn: () => getFinanceDashboard(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: outstandingInvoices = [] } = useApiData(
    ["finance", "outstanding", activeTenantId],
    { apiFn: () => getOutstandingInvoices(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: overdueInvoices = [] } = useApiData(
    ["finance", "overdue", activeTenantId],
    { apiFn: () => getOverdueInvoices(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: allInvoices = [] } = useApiData(
    ["finance", "invoices", activeTenantId],
    { apiFn: () => listFinanceInvoices(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: expenses = [] } = useApiData<ApiExpense[]>(
    ["expenses", activeTenantId],
    { apiFn: () => listExpenses(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: fixedCosts = [] } = useApiData<ApiFixedCost[]>(
    ["fixed-costs", activeTenantId],
    { apiFn: () => listFixedCosts(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: claims = [] } = useApiData<ApiClaim[]>(
    ["claims", activeTenantId],
    { apiFn: () => listClaims(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: payments = [] } = useApiData(
    ["payments", activeTenantId],
    { apiFn: () => listPayments(activeTenantId!), enabled: !!activeTenantId },
  )

  const financeStatementInput: FinanceStatementInput = useMemo(
    () => ({ invoices: allInvoices, payments, expenses, fixedCosts, claims }),
    [allInvoices, payments, expenses, fixedCosts, claims],
  )

  const collectionsThisMonth = dashboard?.collectionsThisMonth ?? 0
  const originatorStats = dashboard?.originatorStats ?? []
  const invoiceAgingBuckets = dashboard?.invoiceAging ?? []
  const activeFixedCosts = fixedCosts.filter((fc) => fc.active)

  const handleEditCost = (cost: ApiFixedCost) => {
    setEditingCost(cost)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (editingCost && activeTenantId) {
      await updateFixedCost(activeTenantId, editingCost.id, editingCost)
      invalidateFinance()
      setEditDialogOpen(false)
      setEditingCost(null)
    }
  }

  const handleDeleteCost = async (id: string) => {
    if (confirm(t("delete_fixed_cost_confirm")) && activeTenantId) {
      await deleteFixedCost(activeTenantId, id)
      invalidateFinance()
    }
  }

  const handleCreateCost = async (costData: Record<string, unknown>) => {
    if (!activeTenantId) return
    await createFixedCost(activeTenantId, {
      ...costData,
      amount: typeof costData.amount === "string" ? parseCommaNumber(costData.amount as string) : (costData.amount as number),
    })
    invalidateFinance()
    setCreateDialogOpen(false)
  }

  const handleExpenseCreated = () => {
    invalidateFinance()
    setCreateExpenseDialogOpen(false)
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const thisMonthExpenses = expenses.filter(
    (e) => {
      const d = new Date(e.createdAt)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    },
  ).reduce((sum, e) => sum + e.amount, 0)

  const pnl = calculatePnL(financeStatementInput, selectedPeriod)
  const balanceSheet = calculateBalanceSheet(financeStatementInput)
  const financeAlerts = getOutstandingFinanceAlerts(financeStatementInput)

  const pendingClaims = claims.filter((c) => c.status === "PENDING")
  const pendingFinanceApproval = claims.filter((c) => c.status === "PENDING_FINANCE")
  const pendingAdminApproval = claims.filter((c) => c.status === "PENDING_ADMIN")
  const userClaims = currentUser ? claims.filter((c) => c.submittedById === currentUser.id) : []
  const financeControlStats = [
    {
      label: t("overdue_exposure"),
      value: formatCurrencyShort(
        overdueInvoices.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0),
        currency,
      ),
      helper: t("overdue_invoices_count", { count: overdueInvoices.length }),
      icon: AlertTriangle,
    },
    {
      label: t("approval_queue"),
      value: (pendingFinanceApproval.length + pendingAdminApproval.length).toLocaleString(),
      helper: t("claims_awaiting_review"),
      icon: CheckCircle2,
    },
    {
      label: t("payment_records_label"),
      value: payments.length.toLocaleString(),
      helper: t("collections_trail"),
      icon: Receipt,
    },
    {
      label: t("trust_controls"),
      value: t("enabled"),
      helper: t("trust_controls_helper"),
      icon: Scale,
    },
  ]

  if (dashboardLoading) {
    return (
      <RoleGate
        allowedRoles={["PARTNER_ADMIN", "FINANCE", "READ_ONLY"]}
        requiredPermission="canViewFinance"
      >
        <div className="p-6" data-tour="finance-dashboard">
          <PageSkeleton rows={8} />
        </div>
      </RoleGate>
    )
  }

  return (
    <RoleGate
      allowedRoles={["PARTNER_ADMIN", "FINANCE", "READ_ONLY"]}
      requiredPermission="canViewFinance"
    >
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("finance_dashboard")}</h1>
          <p className="text-muted-foreground">{t("monitor_collections_billings_and_financial_performance")}</p>
        </div>
        <div className="flex gap-2">
          <OpenCopilotButton />
          <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
            <Link href="/app/accounting/invoices/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("create_invoice")}
              </Button>
            </Link>
          </RoleGate>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {financeControlStats.map(({ label, value, helper, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{helper}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("invoices")}</TabsTrigger>
          <TabsTrigger value="pnl">{t("pl")}</TabsTrigger>
          <TabsTrigger value="balance-sheet">{t("balance_sheet")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("expenses")}</TabsTrigger>
          <TabsTrigger value="claims">{t("claims")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Outstanding Alerts */}
          {financeAlerts.length > 0 && (
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <CardTitle>{t("outstanding_alerts")}</CardTitle>
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
                            {tCommon("view")}
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
          label={t("collections_this_month_label")}
          value={formatCurrencyShort(collectionsThisMonth, currency)}
          delta={{ value: 15, positive: true }}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("outstanding_invoices_label")}
          value={formatCurrencyShort(outstandingInvoices.reduce((sum, inv) => sum + invoiceAmount(inv), 0), currency)}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("overdue_invoices_label")}
          value={overdueInvoices.length}
        />
        <KpiCard
          icon={FileText}
          label={t("total_invoices_label")}
          value={outstandingInvoices.length}
        />
      </div>

      {/* Top Originators - Advanced Reporting Feature */}
      <PlanGate
        requiredPlan="PROFESSIONAL"
        feature="Advanced Reporting"
        description={tDashboard("planAdvancedReportingDescription")}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("top_originators")}</CardTitle>
            <CardDescription>{t("partners_and_associates_ranked_by_collections")}</CardDescription>
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
                      <div className="text-sm text-muted-foreground">{t("invoices_count", { count: stat.invoiceCount })}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatCurrencyShort(stat.collectedAmount, currency)}</div>
                    <div className="text-xs text-muted-foreground">{t("collected")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("invoiced_amount", { amount: formatCurrencyShort(stat.invoicedAmount, currency) })}
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
        description={tDashboard("planInvoiceAgingDescription")}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("invoice_aging")}</CardTitle>
            <CardDescription>{t("outstanding_invoices_by_age")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoiceAgingBuckets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("no_aging_data_available")}</p>
              ) : (
                invoiceAgingBuckets.map((bucket) => (
                  <div key={bucket.bucket} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                    <span className="text-sm font-medium">{bucket.bucket}</span>
                    <span className="font-bold">{formatCurrencyShort(bucket.amount, currency)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </PlanGate>

      {/* Payment Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("payment_queue")}</CardTitle>
              <CardDescription>{t("invoices_pending_payment")}</CardDescription>
            </div>
            <Link href="/app/accounting/invoices">
              <Button variant="outline" size="sm">
                {tCommon("viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
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
                    <Badge variant={invoice.status === "OVERDUE" ? "destructive" : "outline"}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("due_label", { date: invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "—" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCurrencyShort(invoiceAmount(invoice), currency)}</div>
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
                <CardTitle>{t("fixed_costs")}</CardTitle>
                <CardDescription>{t("manage_recurring_fixed_costs_and_expenses")}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("add_fixed_cost")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activeFixedCosts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">{t("no_fixed_costs_configured")}</p>
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("add_first_fixed_cost")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeFixedCosts.map((cost) => (
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
                        {t("started_on", { date: format(cost.startDate, "MMM d, yyyy") })}
                        {cost.endDate && ` • ${t("ends_on", { date: format(cost.endDate, "MMM d, yyyy") })}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <div className="font-bold text-lg">{formatCurrencyWithSymbol(cost.amount, currency)}</div>
                        <div className="text-xs text-muted-foreground">{t("per_frequency", { frequency: cost.frequency.toLowerCase() })}</div>
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
              <h2 className="text-2xl font-bold">{t("expenses")}</h2>
              <p className="text-muted-foreground">{t("track_and_manage_firm_expenses")}</p>
            </div>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
              <Button onClick={() => setCreateExpenseDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("new_expense")}
              </Button>
            </RoleGate>
          </div>

          {/* Expense Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("total_expenses")}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyWithSymbol(totalExpenses, currency)}</div>
                <p className="text-xs text-muted-foreground">{t("all_time")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("this_month")}</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyWithSymbol(thisMonthExpenses, currency)}</div>
                <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("total_count")}</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expenses.length}</div>
                <p className="text-xs text-muted-foreground">{t("expense_records")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <CardTitle>{t("recent_expenses")}</CardTitle>
              <CardDescription>{t("all_expense_records")}</CardDescription>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t("no_expenses_recorded_yet")}</p>
                  <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
                    <Button className="mt-4" onClick={() => setCreateExpenseDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("create_first_expense")}
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
                            {format(new Date(expense.createdAt), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {t("created_by", { name: expense.createdByName })}
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
                  <CardTitle>{t("all_invoices")}</CardTitle>
                  <CardDescription>{t("complete_invoice_list_with_responsible_parties")}</CardDescription>
                </div>
                <Link href="/app/accounting/invoices/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("create_invoice")}
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{invoice.invoiceNumber}</span>
                        <Badge variant={invoice.status === "OVERDUE" ? "destructive" : invoice.status === "PAID" ? "default" : "outline"}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Due: {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "—"}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrencyShort(invoiceAmount(invoice), currency)}</div>
                      <Link href={`/app/accounting/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm" className="mt-2">
                          {t("view_details")}
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
              <h2 className="text-2xl font-bold">{t("profit_loss_statement")}</h2>
              <p className="text-muted-foreground">{t("financial_performance_overview")}</p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{t("this_month")}</SelectItem>
                  <SelectItem value="quarter">{t("this_quarter")}</SelectItem>
                  <SelectItem value="year">{t("this_year")}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t("export")}
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
                <h3 className="font-semibold text-lg">{t("revenue")}</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("invoiced")}</span>
                    <span className="font-medium">{formatCurrencyWithSymbol(pnl.revenue.invoiced, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("collected")}</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrencyWithSymbol(pnl.revenue.collected, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("outstanding")}</span>
                    <span className="font-medium">{formatCurrencyWithSymbol(pnl.revenue.outstanding, currency)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                {/* Expenses */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{t("expenses")}</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("operating_expenses")}</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.operating, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("fixed_costs")}</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.fixed, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("claims")}</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(pnl.expenses.claims, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>{t("total_expenses")}</span>
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
                  <h3 className="font-semibold text-lg">{t("profit")}</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("net_profit")}</span>
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
                      <span className="text-muted-foreground">{t("profit_margin")}</span>
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
              <h2 className="text-2xl font-bold">{t("balance_sheet")}</h2>
              <p className="text-muted-foreground">{t("balance_sheet_as_of", { date: format(balanceSheet.asOf, "MMM d, yyyy") })}</p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t("export")}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Assets */}
            <Card>
              <CardHeader>
                <CardTitle>{t("assets")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{t("current_assets")}</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("cash")}</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.assets.current.cash, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("accounts_receivable")}</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.assets.current.receivables, currency)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>{t("total_current_assets")}</span>
                      <span>{formatCurrencyWithSymbol(balanceSheet.assets.current.total, currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t("total_assets")}</span>
                    <span>{formatCurrencyWithSymbol(balanceSheet.assets.total, currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity */}
            <Card>
              <CardHeader>
                <CardTitle>{t("liabilities_equity")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{t("current_liabilities")}</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("accounts_payable")}</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.liabilities.current.payables, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("pending_claims")}</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.liabilities.current.claims, currency)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>{t("total_current_liabilities")}</span>
                      <span>{formatCurrencyWithSymbol(balanceSheet.liabilities.current.total, currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("total_liabilities")}</span>
                    <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.liabilities.total, currency)}</span>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">{t("equity")}</h4>
                  <div className="pl-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("retained_earnings")}</span>
                      <span className="font-medium">{formatCurrencyWithSymbol(balanceSheet.equity.retained, currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t("total_liabilities_equity")}</span>
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
              <h2 className="text-2xl font-bold">{t("expense_claims")}</h2>
              <p className="text-muted-foreground">{t("submit_and_manage_reimbursement_claims")}</p>
            </div>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "FINANCE"]}>
              <Button onClick={() => setCreateClaimDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("submit_claim")}
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
                      <CardTitle>{t("pending_finance_approval")}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingFinanceApproval.map((claim) => (
                        <ClaimCard
                          key={claim.id}
                          claim={claim}
                          onApprove={async () => {
                            if (currentRole === "FINANCE" && currentUser && activeTenantId) {
                              await updateClaim(activeTenantId, claim.id, { status: "APPROVED" })
                              invalidateFinance()
                            }
                          }}
                          onReject={async () => {
                            if ((currentRole === "FINANCE" || currentRole === "PARTNER_ADMIN") && activeTenantId) {
                              await updateClaim(activeTenantId, claim.id, { status: "REJECTED" })
                              invalidateFinance()
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
                      <CardTitle>{t("pending_admin_approval")}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingAdminApproval.map((claim) => (
                        <ClaimCard
                          key={claim.id}
                          claim={claim}
                          onApprove={async () => {
                            if (currentRole === "PARTNER_ADMIN" && activeTenantId) {
                              await updateClaim(activeTenantId, claim.id, { status: "APPROVED" })
                              invalidateFinance()
                            }
                          }}
                          onReject={async () => {
                            if (currentRole === "PARTNER_ADMIN" && activeTenantId) {
                              await updateClaim(activeTenantId, claim.id, { status: "REJECTED" })
                              invalidateFinance()
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
              <CardTitle>{t("all_claims")}</CardTitle>
              <CardDescription>{t("view_all_submitted_expense_claims")}</CardDescription>
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
            tenantId={activeTenantId}
            onSave={() => {
              invalidateFinance()
              setCreateClaimDialogOpen(false)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
    </RoleGate>
  )
}

function ClaimCard({
  claim,
  onApprove,
  onReject,
  canApprove,
  canReject,
}: {
  claim: ApiClaim
  onApprove: () => void
  onReject: (reason: string) => void
  canApprove: boolean
  canReject: boolean
}) {
  const t = useTranslations("billing")
  const tCommon = useTranslations("common")
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
            {t("submitted_on", { date: format(new Date(claim.createdAt), "MMM d, yyyy") })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("status_label", { status: claim.status })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-bold text-lg">{formatCurrencyWithSymbol(claim.amount, currency)}</div>
          </div>
          {canApprove && claim.status === "PENDING" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={onApprove}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t("approve")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                {tCommon("reject")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reject_claim")}</DialogTitle>
            <DialogDescription>{t("provide_a_reason_for_rejecting_this_claim")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{t("rejection_reason")}</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t("enter_reason_for_rejection")}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {tCommon("cancel")}
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
              {t("reject_claim_button")}
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
  tenantId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
  tenantId: string | null
}) {
  const t = useTranslations("billing")
  const tCommon = useTranslations("common")
  const { currentUser } = useRole()
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Travel")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptFileName, setReceiptFileName] = useState("")
  const [saving, setSaving] = useState(false)

  const categories = [
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

  const handleSave = async () => {
    if (!description || !amount || !receiptFile || !currentUser || !tenantId) return
    setSaving(true)
    try {
      await createClaim(tenantId, {
        description,
        amount: parseCommaNumber(amount),
        status: "PENDING",
        submittedById: currentUser.id,
      })
      setDescription("")
      setAmount("")
      setCategory("Travel")
      setReceiptFile(null)
      setReceiptFileName("")
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("submit_expense_claim")}</DialogTitle>
          <DialogDescription>{t("submit_a_reimbursement_claim_with_receipt_attachment")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t("description_2")}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("eg_client_lunch_meeting_-_abc_corp")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount_2")}</Label>
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
                placeholder={t("000")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t("category")}</Label>
              <Select value={category} onValueChange={setCategory}>
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
            <Label htmlFor="receipt">{t("receipt_required_for_approval")}</Label>
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
              {t("upload_receipt_hint")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!description || !amount || !receiptFile}>
            <Upload className="mr-2 h-4 w-4" />
            {t("submit_claim")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditFixedCostDialog({ open, onOpenChange, cost, onSave, onCostChange }: any) {
  const t = useTranslations("billing")
  const tCommon = useTranslations("common")
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
          <DialogTitle>{t("edit_fixed_cost")}</DialogTitle>
          <DialogDescription>{t("update_fixed_cost_details")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name_2")}</Label>
            <Input
              id="name"
              value={cost.name}
              onChange={(e) => onCostChange({ ...cost, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Input
              id="description"
              value={cost.description || ""}
              onChange={(e) => onCostChange({ ...cost, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount_kes")}</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(String(cost.amount))}
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
              <Label htmlFor="frequency">{t("frequency")}</Label>
              <Select
                value={cost.frequency}
                onValueChange={(value) => onCostChange({ ...cost, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">{t("monthly")}</SelectItem>
                  <SelectItem value="Quarterly">{t("quarterly")}</SelectItem>
                  <SelectItem value="Yearly">{t("yearly")}</SelectItem>
                  <SelectItem value="One-time">{t("one-time")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{t("category")}</Label>
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
            {tCommon("cancel")}
          </Button>
          <Button onClick={onSave}>{t("save_changes")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateFixedCostDialog({ open, onOpenChange, onSave }: any) {
  const t = useTranslations("billing")
  const tCommon = useTranslations("common")
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
          <DialogTitle>{t("create_fixed_cost")}</DialogTitle>
          <DialogDescription>{t("add_a_new_recurring_fixed_cost")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name_2")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount_kes")}</Label>
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
              <Label htmlFor="frequency">{t("frequency")}</Label>
              <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">{t("monthly")}</SelectItem>
                  <SelectItem value="Quarterly">{t("quarterly")}</SelectItem>
                  <SelectItem value="Yearly">{t("yearly")}</SelectItem>
                  <SelectItem value="One-time">{t("one-time")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{t("category")}</Label>
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
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name || !amount}>
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



