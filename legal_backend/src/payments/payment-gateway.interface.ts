export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  countryCode: string;
  purpose: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
}

export interface PaymentIntentResult {
  provider: string;
  providerPaymentId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  status: string;
  raw?: unknown;
}

export interface PaymentGateway {
  readonly providerName: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
