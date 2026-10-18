import { apiFetch, buildAuthHeaders, ApiClientError } from "./client"
import { usesCookieSession } from "@/lib/auth/session-config"

export interface SubscriptionCheckoutResult {
  checkoutSessionId: string
  provider: string
  status: string
  subscriptionId: string
  planId: string
  amount: number
  currency: string
  checkoutUrl?: string
  introOfferDiscount?: boolean
  /** @deprecated Use introOfferDiscount */
  referralDiscount?: boolean
  /** @deprecated Use introOfferDiscount */
  firstPurchaseDiscount?: boolean
  discountedAmount?: number
  originalAmount?: number
}

export interface ConfirmCheckoutResult {
  activated: boolean
  alreadyActive: boolean
  planId: string
  planLabel: string
  aiCredits: number
  creditsGranted: number
  amount: number
  currency: string
  currentPeriodEnd: string | null
  billing: import("./billing").CurrentBilling
}

export interface RefereeStatus {
  hasReferral: boolean
  eligibleForDiscount: boolean
  discountPercent: number
  referrerDisplayName?: string
  attributedAt?: string
}

export async function startSubscriptionCheckout(params: {
  planId: string
  countryCode: string
  userType?: "LAW_FIRM" | "CONSUMER"
  tenantId?: string
  deviceFingerprint?: string
  /** Page path to return to after Stripe completes (e.g. /app/us-drafting/draft?kind=...) */
  returnPath?: string
  /** Billing interval — defaults to monthly. Annual applies a 20% discount. */
  billingCycle?: "monthly" | "annual"
}): Promise<SubscriptionCheckoutResult> {
  const body: Record<string, string> = {
    planId: params.planId,
    countryCode: params.countryCode,
    userType: params.userType ?? "LAW_FIRM",
  }
  if (params.deviceFingerprint) {
    body.deviceFingerprint = params.deviceFingerprint
  }
  if (params.returnPath) {
    body.returnPath = params.returnPath
  }
  if (params.billingCycle === "annual") {
    body.billingCycle = "annual"
  }

  return apiFetch<SubscriptionCheckoutResult>("/subscriptions/checkout", {
    method: "POST",
    body,
    tenantId: params.tenantId,
  })
}

export async function confirmSubscriptionCheckout(params: {
  sessionId: string
  tenantId?: string
}): Promise<ConfirmCheckoutResult> {
  const headers = await buildAuthHeaders(true, params.tenantId)
  headers.set("Content-Type", "application/json")

  const response = await fetch("/api/subscriptions/confirm-checkout/", {
    method: "POST",
    headers,
    credentials: usesCookieSession() ? "include" : undefined,
    body: JSON.stringify({ sessionId: params.sessionId }),
  })

  const text = await response.text()
  let data: ConfirmCheckoutResult | { message?: string } = {}
  if (text) {
    try {
      data = JSON.parse(text) as ConfirmCheckoutResult | { message?: string }
    } catch {
      data = { message: text.slice(0, 240) }
    }
  }

  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      response.statusText ??
      "Could not confirm subscription"
    throw new ApiClientError(message, response.status, data)
  }

  return data as ConfirmCheckoutResult
}

export async function getRefereeStatus(): Promise<RefereeStatus> {
  return apiFetch<RefereeStatus>("/referrals/me/referee-status")
}
