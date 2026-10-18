import { apiFetch } from "./client"

export type IntroOfferReason = "not_started" | "expired" | "subscribed"

export interface IntroOfferStatus {
  eligible: boolean
  discountPercent: number
  firstLoginAt: string | null
  expiresAt: string | null
  daysRemaining: number
  hoursRemaining: number
  reason?: IntroOfferReason
  userType: "CONSUMER" | "LAW_FIRM"
}

export async function getIntroOfferStatus(
  tenantId?: string,
): Promise<IntroOfferStatus> {
  return apiFetch<IntroOfferStatus>("/subscriptions/intro-offer", {
    tenantId,
  })
}
