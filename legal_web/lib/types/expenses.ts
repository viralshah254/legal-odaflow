export interface Expense {
  id: string
  description: string
  amount: number
  category: ExpenseCategory
  matterId?: string
  matterTitle?: string
  clientId?: string
  clientName?: string
  date: Date
  createdBy: string
  createdByName: string
  receiptUrl?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export type ExpenseCategory = 
  | "Office Supplies"
  | "Travel"
  | "Filing Fees"
  | "Court Fees"
  | "Professional Services"
  | "Technology"
  | "Utilities"
  | "Rent"
  | "Marketing"
  | "Other"

export interface FixedCost {
  id: string
  name: string
  description?: string
  amount: number
  frequency: "Monthly" | "Quarterly" | "Yearly" | "One-time"
  category: ExpenseCategory
  startDate: Date
  endDate?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}




