import { Expense, FixedCost } from "@/lib/types/expenses"

export const mockExpenses: Expense[] = [
  {
    id: "exp1",
    description: "Court filing fees - Smith vs. Jones",
    amount: 5000,
    category: "Court Fees",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    clientId: "c2",
    clientName: "Smith Industries",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    createdBy: "4",
    createdByName: "David Kim",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "exp2",
    description: "Office supplies - January",
    amount: 15000,
    category: "Office Supplies",
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    createdBy: "1",
    createdByName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
]

export const mockFixedCosts: FixedCost[] = [
  {
    id: "fc1",
    name: "Office Rent",
    description: "Monthly office space rental",
    amount: 150000,
    frequency: "Monthly",
    category: "Rent",
    startDate: new Date(2024, 0, 1),
    isActive: true,
    createdAt: new Date(2024, 0, 1),
    updatedAt: new Date(2024, 0, 1),
  },
  {
    id: "fc2",
    name: "Legal Research Subscription",
    description: "Annual subscription to legal research database",
    amount: 120000,
    frequency: "Yearly",
    category: "Technology",
    startDate: new Date(2024, 0, 1),
    endDate: new Date(2024, 11, 31),
    isActive: true,
    createdAt: new Date(2024, 0, 1),
    updatedAt: new Date(2024, 0, 1),
  },
  {
    id: "fc3",
    name: "Internet & Phone",
    description: "Monthly internet and phone services",
    amount: 25000,
    frequency: "Monthly",
    category: "Utilities",
    startDate: new Date(2024, 0, 1),
    isActive: true,
    createdAt: new Date(2024, 0, 1),
    updatedAt: new Date(2024, 0, 1),
  },
]

export function getExpenseById(id: string): Expense | undefined {
  return mockExpenses.find((e) => e.id === id)
}

export function getExpensesByMatter(matterId: string): Expense[] {
  return mockExpenses.filter((e) => e.matterId === matterId)
}

export function getExpensesByClient(clientId: string): Expense[] {
  return mockExpenses.filter((e) => e.clientId === clientId)
}

export function createExpense(expense: Omit<Expense, "id" | "createdAt" | "updatedAt">): Expense {
  const newExpense: Expense = {
    ...expense,
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  mockExpenses.push(newExpense)
  return newExpense
}

export function getFixedCostById(id: string): FixedCost | undefined {
  return mockFixedCosts.find((fc) => fc.id === id)
}

export function getActiveFixedCosts(): FixedCost[] {
  return mockFixedCosts.filter((fc) => fc.isActive)
}

export function createFixedCost(cost: Omit<FixedCost, "id" | "createdAt" | "updatedAt">): FixedCost {
  const newCost: FixedCost = {
    ...cost,
    id: `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  mockFixedCosts.push(newCost)
  return newCost
}

export function updateFixedCost(id: string, updates: Partial<FixedCost>): FixedCost {
  const index = mockFixedCosts.findIndex((fc) => fc.id === id)
  if (index === -1) throw new Error("Fixed cost not found")
  mockFixedCosts[index] = { ...mockFixedCosts[index], ...updates, updatedAt: new Date() }
  return mockFixedCosts[index]
}

export function deleteFixedCost(id: string): void {
  const index = mockFixedCosts.findIndex((fc) => fc.id === id)
  if (index !== -1) {
    mockFixedCosts.splice(index, 1)
  }
}




