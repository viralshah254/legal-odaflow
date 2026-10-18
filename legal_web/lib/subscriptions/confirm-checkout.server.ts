import { createHmac } from "crypto"
import { type CurrentBilling } from "@/lib/api/billing"
import { type ConfirmCheckoutResult } from "@/lib/api/subscriptions"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"

const PLAN_LABELS: Record<string, string> = {
  consumer_free: "Free",
  consumer_plus: "Plus",
  lawyer_solo: "Solo",
  firm_starter: "Starter",
  firm_professional: "Professional",
  firm_pro_plus: "Pro Plus",
  firm_enterprise: "Enterprise",
}

type StripeCheckoutSession = {
  id: string
  status?: string
  payment_status?: string
  customer?: string | { id?: string }
  subscription?: string | { id?: string }
  currency?: string
  metadata?: Record<string, string>
}

function stripeWebhookSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signed = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex")
  return `t=${timestamp},v1=${signed}`
}

async function retrieveStripeCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured on the web server")
  }

  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[0]=subscription`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )

  const text = await response.text()
  if (!response.ok) {
    throw new Error(text.slice(0, 240) || "Failed to retrieve Stripe checkout session")
  }

  return JSON.parse(text) as StripeCheckoutSession
}

async function fetchBackendJson<T>(
  path: string,
  init: RequestInit & { token: string; tenantId?: string },
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${init.token}`,
    ...(init.headers as Record<string, string>),
  }
  if (init.tenantId) headers["X-Tenant-Id"] = init.tenantId

  const response = await fetch(backendApiUrl(path), {
    ...init,
    headers,
  })

  const text = await response.text()
  let data: T | null = null
  if (text) {
    try {
      data = JSON.parse(text) as T
    } catch {
      data = null
    }
  }

  return { ok: response.ok, status: response.status, data, text }
}

async function resolvePlanCredits(planId: string, countryCode: string): Promise<number> {
  const publicRes = await fetch(
    backendApiUrl(
      `/pricing/plans?countryCode=${encodeURIComponent(countryCode)}&userType=LAW_FIRM`,
    ),
  )
  const publicData = (await publicRes.json().catch(() => null)) as {
    plans?: Array<{ planId: string; aiCredits?: number }>
  } | null
  const match = publicData?.plans?.find((p) => p.planId === planId)
  return match?.aiCredits ?? 0
}

async function activateViaWebhookReplay(session: StripeCheckoutSession): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured on the web server")
  }

  const event = {
    id: `evt_confirm_${session.id}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: session },
  }

  const payload = JSON.stringify(event)
  const signature = stripeWebhookSignature(payload, webhookSecret)

  const response = await fetch(backendApiUrl("/subscriptions/webhooks/stripe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text.slice(0, 240) || "Failed to activate subscription via webhook replay")
  }
}

function sessionIsPaid(session: StripeCheckoutSession): boolean {
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    session.status === "complete"
  )
}

export async function confirmCheckoutOnServer(input: {
  sessionId: string
  token: string
  tenantId?: string
}): Promise<ConfirmCheckoutResult> {
  const sessionId = input.sessionId.trim()
  if (!sessionId.startsWith("cs_")) {
    throw new Error("Invalid checkout session id")
  }

  const backendConfirm = await fetchBackendJson<ConfirmCheckoutResult>(
    "/subscriptions/confirm-checkout",
    {
      method: "POST",
      token: input.token,
      tenantId: input.tenantId,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    },
  )

  if (backendConfirm.ok && backendConfirm.data) {
    return backendConfirm.data
  }

  if (backendConfirm.status !== 404 && backendConfirm.status !== 405) {
    const message =
      (backendConfirm.data as { message?: string } | null)?.message ??
      backendConfirm.text.slice(0, 240) ??
      "Could not confirm subscription"
    throw new Error(message)
  }

  const session = await retrieveStripeCheckoutSession(sessionId)
  if (!sessionIsPaid(session)) {
    throw new Error("Checkout session is not paid yet")
  }

  const normalizedSession: StripeCheckoutSession = {
    ...session,
    subscription:
      typeof session.subscription === "object" && session.subscription !== null
        ? (session.subscription as { id?: string }).id
        : session.subscription,
    customer:
      typeof session.customer === "object" && session.customer !== null
        ? (session.customer as { id?: string }).id
        : session.customer,
  }

  const meta = normalizedSession.metadata ?? {}
  const metaTenantId = meta.tenantId?.trim()
  if (input.tenantId && metaTenantId && metaTenantId !== input.tenantId) {
    throw new Error("Checkout session does not belong to this workspace")
  }

  const billingBefore = await fetchBackendJson<CurrentBilling>("/billing/current", {
    method: "GET",
    token: input.token,
    tenantId: input.tenantId,
  })
  const wasAlreadyActive = billingBefore.data?.subscriptionStatus === "ACTIVE"

  await activateViaWebhookReplay(normalizedSession)

  const billingResult = await fetchBackendJson<CurrentBilling>("/billing/current", {
    method: "GET",
    token: input.token,
    tenantId: input.tenantId,
  })

  const billing = billingResult.data
  if (!billing) {
    throw new Error("Subscription activated but billing status could not be loaded")
  }

  const planId = meta.planId ?? billing.planId ?? ""
  const countryCode = meta.countryCode ?? billing.countryCode ?? "US"
  const aiCredits = planId ? await resolvePlanCredits(planId, countryCode) : 0

  return {
    activated: true,
    alreadyActive: wasAlreadyActive,
    planId,
    planLabel: PLAN_LABELS[planId] ?? planId.replace(/_/g, " "),
    aiCredits,
    creditsGranted: wasAlreadyActive ? 0 : aiCredits,
    amount: 0,
    currency: (normalizedSession.currency ?? "").toUpperCase(),
    currentPeriodEnd: null,
    billing,
  }
}
