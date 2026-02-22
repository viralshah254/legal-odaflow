export interface Invoice {
  id: string
  invoiceNumber: string
  matterId: string
  matterTitle: string
  clientId: string
  clientName: string
  amount: number
  status: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled"
  dueDate: Date
  sentDate?: Date
  paidDate?: Date
  originatorId: string
  originatorName: string
  createdAt: Date
}

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string
  amount: number
  paidAt: Date
  clientId: string
  clientName: string
}

export interface OriginatorStats {
  userId: string
  userName: string
  role: string
  invoicedAmount: number
  collectedAmount: number
  invoiceCount: number
}

export const mockInvoices: Invoice[] = [
  {
    id: "inv1",
    invoiceNumber: "INV-2024-001",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    clientId: "c1",
    clientName: "Acme Corporation",
    amount: 500000,
    status: "Overdue",
    dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    sentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    originatorId: "1",
    originatorName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
  },
  {
    id: "inv2",
    invoiceNumber: "INV-2024-002",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    clientId: "c2",
    clientName: "Smith Industries",
    amount: 250000,
    status: "Paid",
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    sentDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    originatorId: "4",
    originatorName: "David Kim",
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
  },
  {
    id: "inv3",
    invoiceNumber: "INV-2024-003",
    matterId: "m3",
    matterTitle: "TechStart Inc - Series B Funding",
    clientId: "c3",
    clientName: "TechStart Inc",
    amount: 300000,
    status: "Sent",
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    sentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    originatorId: "2",
    originatorName: "Michael Chen",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    id: "inv4",
    invoiceNumber: "INV-2024-004",
    matterId: "m4",
    matterTitle: "Estate Planning - Johnson Family Trust",
    clientId: "c4",
    clientName: "Johnson Family",
    amount: 75000,
    status: "Draft",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    originatorId: "3",
    originatorName: "Emily Rodriguez",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]

export const mockPayments: Payment[] = [
  {
    id: "p1",
    invoiceId: "inv2",
    invoiceNumber: "INV-2024-002",
    amount: 250000,
    paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    clientId: "c2",
    clientName: "Smith Industries",
  },
]

export function getInvoiceById(id: string): Invoice | undefined {
  return mockInvoices.find((inv) => inv.id === id)
}

export function getInvoicesByClient(clientId: string): Invoice[] {
  return mockInvoices.filter((inv) => inv.clientId === clientId)
}

export function getInvoicesByMatter(matterId: string): Invoice[] {
  return mockInvoices.filter((inv) => inv.matterId === matterId)
}

export function getOverdueInvoices(): Invoice[] {
  const now = new Date()
  return mockInvoices.filter((inv) => inv.dueDate < now && inv.status !== "Paid" && inv.status !== "Cancelled")
}

export function getOutstandingInvoices(): Invoice[] {
  return mockInvoices.filter((inv) => inv.status === "Sent" || inv.status === "Overdue")
}

export function getCollectionsThisMonth(): number {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return mockPayments
    .filter((p) => p.paidAt >= startOfMonth)
    .reduce((sum, p) => sum + p.amount, 0)
}

export function getOriginatorStats(): OriginatorStats[] {
  const statsMap = new Map<string, OriginatorStats>()

  mockInvoices.forEach((inv) => {
    const existing = statsMap.get(inv.originatorId) || {
      userId: inv.originatorId,
      userName: inv.originatorName,
      role: "",
      invoicedAmount: 0,
      collectedAmount: 0,
      invoiceCount: 0,
    }

    existing.invoicedAmount += inv.amount
    existing.invoiceCount += 1

    if (inv.status === "Paid" && inv.paidDate) {
      existing.collectedAmount += inv.amount
    }

    statsMap.set(inv.originatorId, existing)
  })

  return Array.from(statsMap.values()).sort((a, b) => b.collectedAmount - a.collectedAmount)
}

export function getInvoiceAging(): {
  current: number
  days30: number
  days60: number
  days90: number
  over90: number
} {
  const now = new Date()
  const outstanding = getOutstandingInvoices()

  return {
    current: outstanding.filter((inv) => inv.dueDate >= now).reduce((sum, inv) => sum + inv.amount, 0),
    days30: outstanding
      .filter((inv) => {
        const daysDiff = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
        return daysDiff > 0 && daysDiff <= 30
      })
      .reduce((sum, inv) => sum + inv.amount, 0),
    days60: outstanding
      .filter((inv) => {
        const daysDiff = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
        return daysDiff > 30 && daysDiff <= 60
      })
      .reduce((sum, inv) => sum + inv.amount, 0),
    days90: outstanding
      .filter((inv) => {
        const daysDiff = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
        return daysDiff > 60 && daysDiff <= 90
      })
      .reduce((sum, inv) => sum + inv.amount, 0),
    over90: outstanding
      .filter((inv) => {
        const daysDiff = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
        return daysDiff > 90
      })
      .reduce((sum, inv) => sum + inv.amount, 0),
  }
}

export function createInvoice(invoiceData: Omit<Invoice, "id" | "invoiceNumber" | "createdAt">): Invoice {
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(mockInvoices.length + 1).padStart(3, "0")}`
  const newInvoice: Invoice = {
    ...invoiceData,
    id: `inv${Date.now()}`,
    invoiceNumber,
    createdAt: new Date(),
  }
  mockInvoices.push(newInvoice)
  return newInvoice
}

