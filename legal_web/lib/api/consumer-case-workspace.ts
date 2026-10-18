import { apiFetch } from "./client"

export interface ConsumerCaseDraft {
  id: string
  consumerCaseId: string
  title: string
  content: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ConsumerCaseMessage {
  id: string
  consumerCaseId: string
  direction: "INBOUND" | "OUTBOUND"
  subject?: string | null
  body: string
  createdAt: string
}

export interface ConsumerCasePayment {
  id: string
  consumerCaseId: string
  amount: number
  currency: string
  status: string
  description?: string | null
  createdAt: string
}

export async function listConsumerCaseDrafts(caseId: string): Promise<ConsumerCaseDraft[]> {
  return apiFetch<ConsumerCaseDraft[]>(`/consumers/cases/${caseId}/drafts`)
}

export async function listConsumerCaseMessages(caseId: string): Promise<ConsumerCaseMessage[]> {
  return apiFetch<ConsumerCaseMessage[]>(`/consumers/cases/${caseId}/messages`)
}

export async function listConsumerCasePayments(caseId: string): Promise<ConsumerCasePayment[]> {
  return apiFetch<ConsumerCasePayment[]>(`/consumers/cases/${caseId}/payments`)
}
