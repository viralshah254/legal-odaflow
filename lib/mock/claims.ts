import { Claim, ClaimStatus, ClaimCategory } from "@/lib/types/claims"

export const mockClaims: Claim[] = [
  {
    id: "claim-1",
    submittedBy: "4",
    submittedByName: "David Kim",
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    description: "Court filing fees for Smith vs. Jones case",
    amount: 5000,
    category: "Travel",
    receiptUrl: "/receipts/claim-1.pdf",
    receiptFileName: "receipt-court-fees.pdf",
    status: "APPROVED",
    financeApprovedBy: "6",
    financeApprovedByName: "James Thompson",
    financeApprovedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    adminApprovedBy: "1",
    adminApprovedByName: "Sarah Johnson",
    adminApprovedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    paidBy: "6",
    paidByName: "James Thompson",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "claim-2",
    submittedBy: "3",
    submittedByName: "Emily Rodriguez",
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    description: "Client lunch meeting - ABC Corp",
    amount: 15000,
    category: "Client Entertainment",
    receiptUrl: "/receipts/claim-2.pdf",
    receiptFileName: "receipt-lunch.pdf",
    status: "PENDING",
    financeApprovedBy: "6",
    financeApprovedByName: "James Thompson",
    financeApprovedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "claim-3",
    submittedBy: "5",
    submittedByName: "Lisa Wang",
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    description: "Office supplies - printer paper and folders",
    amount: 8000,
    category: "Office Supplies",
    receiptUrl: "/receipts/claim-3.pdf",
    receiptFileName: "receipt-office-supplies.pdf",
    status: "PENDING",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
]

export function getClaimsByStatus(status: ClaimStatus): Claim[] {
  return mockClaims.filter((c) => c.status === status)
}

export function getClaimsBySubmitter(userId: string): Claim[] {
  return mockClaims.filter((c) => c.submittedBy === userId)
}

export function getPendingClaims(): Claim[] {
  return mockClaims.filter((c) => c.status === "PENDING")
}

export function getClaimsPendingFinanceApproval(): Claim[] {
  return mockClaims.filter((c) => c.status === "PENDING" && !c.financeApprovedBy)
}

export function getClaimsPendingAdminApproval(): Claim[] {
  return mockClaims.filter((c) => c.status === "PENDING" && c.financeApprovedBy && !c.adminApprovedBy)
}

export function createClaim(claim: Omit<Claim, "id" | "createdAt" | "updatedAt" | "status">): Claim {
  const newClaim: Claim = {
    ...claim,
    id: `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  mockClaims.push(newClaim)
  return newClaim
}

export function approveClaimByFinance(claimId: string, approverId: string, approverName: string): Claim | null {
  const claim = mockClaims.find((c) => c.id === claimId)
  if (!claim || claim.status !== "PENDING") return null

  claim.financeApprovedBy = approverId
  claim.financeApprovedByName = approverName
  claim.financeApprovedAt = new Date()
  claim.updatedAt = new Date()

  return claim
}

export function approveClaimByAdmin(claimId: string, approverId: string, approverName: string): Claim | null {
  const claim = mockClaims.find((c) => c.id === claimId)
  if (!claim || claim.status !== "PENDING" || !claim.financeApprovedBy) return null

  claim.adminApprovedBy = approverId
  claim.adminApprovedByName = approverName
  claim.adminApprovedAt = new Date()
  claim.status = "APPROVED"
  claim.updatedAt = new Date()

  return claim
}

export function rejectClaim(claimId: string, rejectorId: string, rejectorName: string, reason: string): Claim | null {
  const claim = mockClaims.find((c) => c.id === claimId)
  if (!claim || claim.status !== "PENDING") return null

  claim.status = "REJECTED"
  claim.rejectedBy = rejectorId
  claim.rejectedByName = rejectorName
  claim.rejectedAt = new Date()
  claim.rejectionReason = reason
  claim.updatedAt = new Date()

  return claim
}

export function markClaimAsPaid(claimId: string, paidBy: string, paidByName: string): Claim | null {
  const claim = mockClaims.find((c) => c.id === claimId)
  if (!claim || claim.status !== "APPROVED") return null

  claim.status = "PAID"
  claim.paidAt = new Date()
  claim.paidBy = paidBy
  claim.paidByName = paidByName
  claim.updatedAt = new Date()

  return claim
}

export function getClaimById(id: string): Claim | undefined {
  return mockClaims.find((c) => c.id === id)
}




