import { mockInvoices, mockPayments, getCollectionsThisMonth } from "@/lib/mock/finance"
import { mockExpenses, getActiveFixedCosts } from "@/lib/mock/expenses"
import { mockClaims, getClaimsByStatus } from "@/lib/mock/claims"

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

export function calculatePnL(period: "month" | "quarter" | "year" = "month"): PnLStatement {
  const now = new Date()
  let start: Date
  let end: Date = now
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

  // Revenue
  const invoiced = mockInvoices
    .filter((inv) => inv.createdAt >= start && inv.createdAt <= end)
    .reduce((sum, inv) => sum + inv.amount, 0)

  const collected = mockPayments
    .filter((p) => p.paidAt >= start && p.paidAt <= end)
    .reduce((sum, p) => sum + p.amount, 0)

  const outstanding = mockInvoices
    .filter((inv) => inv.status === "Sent" || inv.status === "Overdue")
    .reduce((sum, inv) => sum + inv.amount, 0)

  // Expenses
  const operating = mockExpenses
    .filter((e) => e.date >= start && e.date <= end)
    .reduce((sum, e) => sum + e.amount, 0)

  const fixedCosts = getActiveFixedCosts()
  const fixed = fixedCosts.reduce((sum, fc) => {
    if (fc.frequency === "Monthly") {
      return sum + fc.amount
    } else if (fc.frequency === "Quarterly") {
      return sum + fc.amount / 3
    } else if (fc.frequency === "Yearly") {
      return sum + fc.amount / 12
    }
    return sum
  }, 0)

  const approvedClaims = getClaimsByStatus("APPROVED")
  const claims = approvedClaims.reduce((sum, c) => sum + c.amount, 0)

  const totalExpenses = operating + fixed + claims

  // Profit
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

export function calculateBalanceSheet(): BalanceSheet {
  const now = new Date()

  // Assets
  const cash = mockPayments.reduce((sum, p) => sum + p.amount, 0) // Simplified
  const receivables = mockInvoices
    .filter((inv) => inv.status === "Sent" || inv.status === "Overdue")
    .reduce((sum, inv) => sum + inv.amount, 0)

  const currentAssets = {
    cash,
    receivables,
    total: cash + receivables,
  }

  // Liabilities
  const approvedClaims = getClaimsByStatus("APPROVED")
  const claims = approvedClaims.reduce((sum, c) => sum + c.amount, 0)

  const currentLiabilities = {
    payables: 0, // Would come from vendor invoices
    claims,
    total: claims,
  }

  // Equity (simplified - would normally track retained earnings over time)
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

export function getOutstandingFinanceAlerts(): Array<{
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

  // Overdue invoices
  const overdue = mockInvoices.filter(
    (inv) => inv.status === "Overdue" || (inv.dueDate < new Date() && inv.status !== "Paid")
  )
  if (overdue.length > 0) {
    alerts.push({
      id: "alert-overdue",
      type: "OVERDUE_INVOICE",
      severity: "HIGH",
      title: `${overdue.length} Overdue Invoice${overdue.length > 1 ? "s" : ""}`,
      description: `Total amount: ${overdue.reduce((sum, inv) => sum + inv.amount, 0).toLocaleString()}`,
      actionUrl: "/app/finance?tab=invoices",
    })
  }

  // Pending claims
  const pendingClaims = getClaimsByStatus("PENDING")
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

  // High receivables (if > 1M)
  const receivables = mockInvoices
    .filter((inv) => inv.status === "Sent" || inv.status === "Overdue")
    .reduce((sum, inv) => sum + inv.amount, 0)
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




