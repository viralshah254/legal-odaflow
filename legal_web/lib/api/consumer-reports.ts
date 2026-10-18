import { apiFetch } from "./client"

export type LawyerReviewSlaStatus = "ON_TRACK" | "AT_RISK" | "BREACHED"

export interface LawyerReviewQueueItem {
  id: string
  title: string
  countryCode: string
  lawyerReviewStatus: string
  riskLevel: string | null
  requiresLawyer: boolean
  createdAt: string
  consumerCase: {
    id: string
    title: string
    issueType: string
    status: string
    jurisdiction: string | null
  }
  user: { id: string; name: string | null; email: string }
  sla: {
    status: LawyerReviewSlaStatus
    targetHours: number
    hoursElapsed: number
    hoursRemaining: number
    dueAt: string
  }
}

export async function listLawyerReviewQueue(): Promise<LawyerReviewQueueItem[]> {
  return apiFetch<LawyerReviewQueueItem[]>("/consumer-reports/lawyer-review-queue")
}
