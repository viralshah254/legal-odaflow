"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, TrendingDown, Loader2 } from "lucide-react"
import { listExpenses, type ApiExpense } from "@/lib/api/finance"
import { formatCurrencyWithSymbol } from "@/lib/utils"
import { format } from "date-fns"
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useCurrency } from "@/lib/contexts/currency-context"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"

export default function ExpensesPage() {
  const tBilling = useTranslations("billing")
  const { currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const { currency } = useCurrency()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const { data: expenses = [], isLoading, error } = useApiData<ApiExpense[]>(
    ["expenses", activeTenantId],
    {
      apiFn: () => listExpenses(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  )

  const thisMonthExpenses = useMemo(() => {
    const now = new Date()
    return expenses
      .filter((e) => {
        const d = new Date(e.createdAt)
        return (
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        )
      })
      .reduce((sum, e) => sum + e.amount, 0)
  }, [expenses])

  const handleExpenseCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["expenses", activeTenantId] })
    setCreateDialogOpen(false)
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
          <h1 className="text-3xl font-bold">{tBilling("expenses")}</h1>
          <p className="text-muted-foreground">{tBilling("track_and_manage_firm_expenses")}</p>
        </div>
        <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
          <Button onClick={() => setCreateDialogOpen(true)} data-tour="expenses-create">
            <Plus className="mr-2 h-4 w-4" />
            New Expense
          </Button>
        </RoleGate>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-destructive">
            Failed to load expenses
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tBilling("total_expenses")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyWithSymbol(totalExpenses, currency)}
            </div>
            <p className="text-xs text-muted-foreground">{tBilling("all_time")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tBilling("this_month")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyWithSymbol(thisMonthExpenses, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tBilling("total_count")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses.length}</div>
            <p className="text-xs text-muted-foreground">{tBilling("expense_records")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tBilling("recent_expenses")}</CardTitle>
          <CardDescription>{tBilling("all_expense_records")}</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{tBilling("no_expenses_recorded_yet")}</p>
              <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Expense
                </Button>
              </RoleGate>
            </div>
          ) : (
            <div className="space-y-3">
              {[...expenses]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )
                .map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{expense.description}</span>
                        <Badge variant="outline">{expense.category}</Badge>
                        <Badge variant="secondary">{expense.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(expense.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {formatCurrencyWithSymbol(expense.amount, currency)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateExpenseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={handleExpenseCreated}
      />
    </div>
  )
}
