import type { ApiClaim, ApiExpense, ApiFixedCost, ApiPayment } from "@/lib/api/finance"
import type { ApiInvoice } from "@/lib/api/types"

export interface PnLStatement {
  period: {
    start: Date
    end: Date
    label: string
  }
  revenue: {
    invoiced: number
    collected: number
    outstanding: number
  }
  expenses: {
    operating: number
    fixed: number
    claims: number
    total: number
  }
  profit: {
    gross: number
    net: number
    margin: number
  }
}

export interface BalanceSheet {
  asOf: Date
  assets: {
    current: {
      cash: number
      receivables: number
      total: number
    }
    total: number
  }
  liabilities: {
    current: {
      payables: number
      claims: number
      total: number
    }
    total: number
  }
  equity: {
    retained: number
    total: number
  }
}

export interface FinanceStatementInput {
  invoices: ApiInvoice[]
  payments: ApiPayment[]
  expenses: ApiExpense[]
  fixedCosts: ApiFixedCost[]
  claims: ApiClaim[]
}

function invoiceAmount(inv: ApiInvoice): number {
  return typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount
}

export function calculatePnL(
  data: FinanceStatementInput,
  period: "month" | "quarter" | "year" = "month",
): PnLStatement {
  const now = new Date()
  let start: Date
  const end: Date = now
  let label: string

  if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    label = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`
  } else if (period === "quarter") {
    const quarter = Math.floor(now.getMonth() / 3)
    start = new Date(now.getFullYear(), quarter * 3, 1)
    label = `Q${quarter + 1} ${now.getFullYear()}`
  } else {
    start = new Date(now.getFullYear(), 0, 1)
    label = `${now.getFullYear()}`
  }

  const invoiced = data.invoices
    .filter((inv) => {
      const created = new Date(inv.createdAt)
      return created >= start && created <= end
    })
    .reduce((sum, inv) => sum + invoiceAmount(inv), 0)

  const collected = data.payments
    .filter((p) => {
      const paid = new Date(p.paidAt)
      return paid >= start && paid <= end
    })
    .reduce((sum, p) => sum + p.amount, 0)

  const outstanding = data.invoices
    .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + invoiceAmount(inv), 0)

  const operating = data.expenses
    .filter((e) => {
      const date = new Date(e.createdAt)
      return date >= start && date <= end
    })
    .reduce((sum, e) => sum + e.amount, 0)

  const fixed = data.fixedCosts
    .filter((fc) => fc.active)
    .reduce((sum, fc) => {
      if (fc.frequency === "Monthly") return sum + fc.amount
      if (fc.frequency === "Quarterly") return sum + fc.amount / 3
      if (fc.frequency === "Yearly") return sum + fc.amount / 12
      return sum
    }, 0)

  const claims = data.claims
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + c.amount, 0)

  const totalExpenses = operating + fixed + claims
  const gross = collected - totalExpenses
  const net = gross
  const margin = collected > 0 ? (net / collected) * 100 : 0

  return {
    period: { start, end, label },
    revenue: { invoiced, collected, outstanding },
    expenses: { operating, fixed, claims, total: totalExpenses },
    profit: { gross, net, margin },
  }
}

export function calculateBalanceSheet(data: FinanceStatementInput): BalanceSheet {
  const now = new Date()

  const cash = data.payments.reduce((sum, p) => sum + p.amount, 0)
  const receivables = data.invoices
    .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + invoiceAmount(inv), 0)

  const currentAssets = {
    cash,
    receivables,
    total: cash + receivables,
  }

  const claims = data.claims
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + c.amount, 0)

  const currentLiabilities = {
    payables: 0,
    claims,
    total: claims,
  }

  const retained = currentAssets.total - currentLiabilities.total

  return {
    asOf: now,
    assets: {
      current: currentAssets,
      total: currentAssets.total,
    },
    liabilities: {
      current: currentLiabilities,
      total: currentLiabilities.total,
    },
    equity: {
      retained,
      total: retained,
    },
  }
}

export function getOutstandingFinanceAlerts(data: FinanceStatementInput): Array<{
  id: string
  type: "OVERDUE_INVOICE" | "PENDING_CLAIM" | "LOW_CASH" | "HIGH_RECEIVABLES"
  severity: "HIGH" | "MEDIUM" | "LOW"
  title: string
  description: string
  actionUrl?: string
}> {
  const alerts: Array<{
    id: string
    type: "OVERDUE_INVOICE" | "PENDING_CLAIM" | "LOW_CASH" | "HIGH_RECEIVABLES"
    severity: "HIGH" | "MEDIUM" | "LOW"
    title: string
    description: string
    actionUrl?: string
  }> = []

  const overdue = data.invoices.filter(
    (inv) =>
      inv.status === "OVERDUE" ||
      (inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "PAID"),
  )
  if (overdue.length > 0) {
    alerts.push({
      id: "alert-overdue",
      type: "OVERDUE_INVOICE",
      severity: "HIGH",
      title: `${overdue.length} Overdue Invoice${overdue.length > 1 ? "s" : ""}`,
      description: `Total amount: ${overdue.reduce((sum, inv) => sum + invoiceAmount(inv), 0).toLocaleString()}`,
      actionUrl: "/app/finance?tab=invoices",
    })
  }

  const pendingClaims = data.claims.filter((c) => c.status === "PENDING")
  if (pendingClaims.length > 0) {
    alerts.push({
      id: "alert-claims",
      type: "PENDING_CLAIM",
      severity: "MEDIUM",
      title: `${pendingClaims.length} Pending Claim${pendingClaims.length > 1 ? "s" : ""}`,
      description: `Total amount: ${pendingClaims.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}`,
      actionUrl: "/app/finance?tab=claims",
    })
  }

  const receivables = data.invoices
    .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + invoiceAmount(inv), 0)
  if (receivables > 1000000) {
    alerts.push({
      id: "alert-receivables",
      type: "HIGH_RECEIVABLES",
      severity: "MEDIUM",
      title: "High Outstanding Receivables",
      description: `Total receivables: ${receivables.toLocaleString()}`,
      actionUrl: "/app/finance?tab=invoices",
    })
  }

  return alerts
}
