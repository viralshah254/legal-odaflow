export type AssistanceType =
  | "LEGAL_RESEARCH"
  | "DRAFTING"
  | "FILING"
  | "CLIENT_COMMUNICATION"
  | "NEGOTIATION"
  | "OTHER"

export type AssistanceAccessScope = "MATTER_ONLY" | "MATTER_CLIENT_DOCS" | "FULL_CASE_SUPPORT"

export type AssistanceRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface AssistanceRequest {
  id: string
  matterId: string
  matterTitle: string
  requestedBy: string
  requestedByName: string
  requestedAt: Date
  helperIds: string[]
  helperNames: string[]
  assistanceType: AssistanceType
  accessScope: AssistanceAccessScope
  dueDate?: Date
  notes?: string
  status: AssistanceRequestStatus
  approvedBy?: string
  approvedByName?: string
  approvedAt?: Date
  rejectedReason?: string
}

export const getAssistanceTypeLabel = (type: AssistanceType): string => {
  const labels: Record<AssistanceType, string> = {
    LEGAL_RESEARCH: "Legal Research",
    DRAFTING: "Drafting",
    FILING: "Filing",
    CLIENT_COMMUNICATION: "Client Communication",
    NEGOTIATION: "Negotiation",
    OTHER: "Other",
  }
  return labels[type]
}

export const getAccessScopeLabel = (scope: AssistanceAccessScope): string => {
  const labels: Record<AssistanceAccessScope, string> = {
    MATTER_ONLY: "Matter Only",
    MATTER_CLIENT_DOCS: "Matter + Client Documents",
    FULL_CASE_SUPPORT: "Full Case Support (Client + KYC + Matter)",
  }
  return labels[scope]
}

