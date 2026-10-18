import { AssistanceRequest, AssistanceRequestStatus } from "@/lib/types/assistance"

export const mockAssistanceRequests: AssistanceRequest[] = [
  {
    id: "ar1",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    requestedBy: "3",
    requestedByName: "Emily Rodriguez",
    requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    helperIds: ["2"],
    helperNames: ["Michael Chen"],
    assistanceType: "DRAFTING",
    accessScope: "MATTER_CLIENT_DOCS",
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    notes: "Need help drafting the merger agreement Section 4.2",
    status: "PENDING",
  },
  {
    id: "ar2",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    requestedBy: "4",
    requestedByName: "David Kim",
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    helperIds: ["1"],
    helperNames: ["Sarah Johnson"],
    assistanceType: "LEGAL_RESEARCH",
    accessScope: "FULL_CASE_SUPPORT",
    notes: "Research precedents for contract breach cases",
    status: "APPROVED",
    approvedBy: "1",
    approvedByName: "Sarah Johnson",
    approvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
]

export function getAssistanceRequestById(id: string): AssistanceRequest | undefined {
  return mockAssistanceRequests.find((r) => r.id === id)
}

export function getAssistanceRequestsByMatter(matterId: string): AssistanceRequest[] {
  return mockAssistanceRequests.filter((r) => r.matterId === matterId)
}

export function getPendingAssistanceRequests(): AssistanceRequest[] {
  return mockAssistanceRequests.filter((r) => r.status === "PENDING")
}

export function getAssistanceRequestsForHelper(helperId: string): AssistanceRequest[] {
  return mockAssistanceRequests.filter((r) => r.helperIds.includes(helperId))
}

export function createAssistanceRequest(request: Omit<AssistanceRequest, "id">): AssistanceRequest {
  const newRequest: AssistanceRequest = {
    ...request,
    id: `ar-${Date.now()}`,
  }
  mockAssistanceRequests.push(newRequest)
  return newRequest
}

export function approveAssistanceRequest(
  requestId: string,
  approvedBy: string,
  approvedByName: string
): void {
  const request = mockAssistanceRequests.find((r) => r.id === requestId)
  if (request) {
    request.status = "APPROVED"
    request.approvedBy = approvedBy
    request.approvedByName = approvedByName
    request.approvedAt = new Date()
  }
}

export function rejectAssistanceRequest(
  requestId: string,
  rejectedReason?: string
): void {
  const request = mockAssistanceRequests.find((r) => r.id === requestId)
  if (request) {
    request.status = "REJECTED"
    request.rejectedReason = rejectedReason
  }
}




