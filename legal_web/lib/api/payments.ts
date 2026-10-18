import { apiFetch } from "./client"

export interface CreatePaymentInput {
  amount: number
  currency: string
  countryCode: string
  purpose: string
  paymentProvider: string
  metadata?: Record<string, unknown>
}

export interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: string
  purpose: string
  paymentProvider: string
  createdAt: string
}

export interface PaymentIntentResponse {
  payment: PaymentRecord
  intent: {
    provider: string
    providerPaymentId: string
    clientSecret?: string
    checkoutUrl?: string
    status: string
  }
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentIntentResponse> {
  return apiFetch<PaymentIntentResponse>("/payments/intent", {
    method: "POST",
    body: input,
  })
}

export async function listPayments(): Promise<PaymentRecord[]> {
  return apiFetch<PaymentRecord[]>("/payments")
}
