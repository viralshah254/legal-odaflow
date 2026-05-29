import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import {
  CreatePaymentIntentInput,
  PaymentGateway,
  PaymentIntentResult,
} from './payment-gateway.interface';

type MpesaTokenResponse = {
  access_token?: string;
};

type MpesaStkResponse = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
};

@Injectable()
export class MpesaProvider implements PaymentGateway {
  readonly providerName = 'mpesa';

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    const env = this.configService.get<string>('MPESA_ENV', 'sandbox');
    return env === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    const consumerKey = this.configService.get<string>('MPESA_CONSUMER_KEY', '');
    const consumerSecret = this.configService.get<string>('MPESA_CONSUMER_SECRET', '');
    const shortcode = this.configService.get<string>('MPESA_SHORTCODE', '');
    const passkey = this.configService.get<string>('MPESA_PASSKEY', '');
    const callbackUrl =
      this.configService.get<string>('MPESA_CALLBACK_URL') ??
      `${this.configService.get<string>('API_URL', 'http://localhost:4000')}/api/v1/payments/webhooks/mpesa`;

    const phone = input.metadata?.phone ?? input.metadata?.msisdn;
    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      return {
        provider: this.providerName,
        providerPaymentId: `mpesa_mock_${randomBytes(8).toString('hex')}`,
        checkoutUrl: undefined,
        status: 'pending_customer_action',
        raw: {
          mock: true,
          amount: input.amount,
          currency: input.currency,
          purpose: input.purpose,
          message: 'Configure MPESA_* env vars for live STK push',
        },
      };
    }

    if (!phone) {
      throw new Error('M-Pesa STK push requires metadata.phone (2547XXXXXXXX)');
    }

    const token = await this.fetchAccessToken(consumerKey, consumerSecret);
    const timestamp = this.formatTimestamp(new Date());
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const amount = Math.round(input.amount);

    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: this.normalizePhone(phone),
          PartyB: shortcode,
          PhoneNumber: this.normalizePhone(phone),
          CallBackURL: callbackUrl,
          AccountReference: (input.metadata?.reference ?? input.purpose).slice(0, 12),
          TransactionDesc: input.purpose.slice(0, 13),
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`M-Pesa STK push failed: ${errorText}`);
    }

    const payload = (await response.json()) as MpesaStkResponse;
    const checkoutRequestId =
      payload.CheckoutRequestID ?? `mpesa_${randomBytes(6).toString('hex')}`;

    return {
      provider: this.providerName,
      providerPaymentId: checkoutRequestId,
      status:
        payload.ResponseCode === '0' ? 'pending_customer_action' : 'failed',
      raw: payload,
    };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return true;
  }

  parseCallbackPayload(payload: string): MpesaCallbackBody {
    return JSON.parse(payload) as MpesaCallbackBody;
  }

  isSuccessfulCallback(body: MpesaCallbackBody): boolean {
    const resultCode =
      body.Body?.stkCallback?.ResultCode ??
      body.ResultCode;
    return resultCode === 0 || resultCode === '0';
  }

  getCallbackCheckoutRequestId(body: MpesaCallbackBody): string | undefined {
    return body.Body?.stkCallback?.CheckoutRequestID;
  }

  private async fetchAccessToken(
    consumerKey: string,
    consumerSecret: string,
  ): Promise<string> {
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64',
    );
    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: { Authorization: `Basic ${credentials}` },
      },
    );

    if (!response.ok) {
      throw new Error('M-Pesa OAuth token request failed');
    }

    const data = (await response.json()) as MpesaTokenResponse;
    if (!data.access_token) {
      throw new Error('M-Pesa OAuth token missing in response');
    }
    return data.access_token;
  }

  private formatTimestamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) {
      return digits;
    }
    if (digits.startsWith('0')) {
      return `254${digits.slice(1)}`;
    }
    if (digits.length === 9) {
      return `254${digits}`;
    }
    return digits;
  }
}

export type MpesaCallbackBody = {
  ResultCode?: number | string;
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: string | number }>;
      };
    };
  };
};

export function mpesaCallbackSignatureValid(
  payload: string,
  secret: string,
  signature: string,
): boolean {
  if (!secret || !signature) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return expected === signature;
}
