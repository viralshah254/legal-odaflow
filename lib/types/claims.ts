export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID"
export type ClaimCategory = 
  | "Travel"
  | "Meals"
  | "Office Supplies"
  | "Professional Development"
  | "Client Entertainment"
  | "Technology"
  | "Other"

export interface Claim {
  id: string
  submittedBy: string
  submittedByName: string
  submittedAt: Date
  description: string
  amount: number // in cents
  category: ClaimCategory
  receiptUrl?: string
  receiptFileName?: string
  status: ClaimStatus
  financeApprovedBy?: string
  financeApprovedByName?: string
  financeApprovedAt?: Date
  adminApprovedBy?: string
  adminApprovedByName?: string
  adminApprovedAt?: Date
  rejectedBy?: string
  rejectedByName?: string
  rejectedAt?: Date
  rejectionReason?: string
  paidAt?: Date
  paidBy?: string
  paidByName?: string
  createdAt: Date
  updatedAt: Date
}




