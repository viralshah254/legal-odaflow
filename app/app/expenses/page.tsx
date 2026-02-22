"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, TrendingDown } from "lucide-react"
import { mockExpenses, getExpensesByMatter, getExpensesByClient } from "@/lib/mock/expenses"
import { formatCurrencyWithSymbol, formatDate } from "@/lib/utils"
import { format } from "date-fns"
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog"
import { useRole } from "@/lib/contexts/role-context"
import { useCurrency } from "@/lib/contexts/currency-context"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ExpensesPage() {
  const { currentRole } = useRole()
  const { currency } = useCurrency()
  const [expenses, setExpenses] = useState(mockExpenses)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const thisMonthExpenses = expenses.filter(
    (e) => e.date.getMonth() === new Date().getMonth() && e.date.getFullYear() === new Date().getFullYear()
  ).reduce((sum, e) => sum + e.amount, 0)

  const handleExpenseCreated = () => {
    setExpenses([...mockExpenses])
    setCreateDialogOpen(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage firm expenses</p>
        </div>
        <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
          <Button onClick={() => setCreateDialogOpen(true)}>
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
            <p className="text-xs text-muted-foreground">January 2026</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Count</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
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
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
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

      <CreateExpenseDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSave={handleExpenseCreated} />
    </div>
  )
}

