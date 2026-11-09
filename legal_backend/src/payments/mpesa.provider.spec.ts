import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { mpesaCallbackSignatureValid, MpesaProvider } from './mpesa.provider';

describe('mpesaCallbackSignatureValid', () => {
  const payload = JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: 'checkout_1' } } });
  const secret = 'webhook_secret';

  it('accepts a valid HMAC signature', () => {
    const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

    expect(mpesaCallbackSignatureValid(payload, secret, signature)).toBe(true);
  });

  it('rejects missing or invalid signatures', () => {
    expect(mpesaCallbackSignatureValid(payload, secret, '')).toBe(false);
    expect(mpesaCallbackSignatureValid(payload, secret, 'bad')).toBe(false);
    expect(mpesaCallbackSignatureValid(payload, '', 'bad')).toBe(false);
  });
});


describe('M-Pesa unavailable configuration', () => {
  const input = { amount: 100, currency: 'KES', purpose: 'subscription' } as Parameters<MpesaProvider['createPaymentIntent']>[0];
  it('fails closed in production instead of returning a fake checkout', async () => {
    const provider = new MpesaProvider({ get: (key: string, fallback?: unknown) => key === 'NODE_ENV' ? 'production' : fallback } as ConfigService);
    await expect(provider.createPaymentIntent(input)).rejects.toThrow('M-Pesa is unavailable');
  });
  it('retains the explicitly marked development fallback', async () => {
    const provider = new MpesaProvider({ get: (key: string, fallback?: unknown) => key === 'NODE_ENV' ? 'test' : fallback } as ConfigService);
    const result = await provider.createPaymentIntent(input);
    expect(result.raw).toMatchObject({ mock: true });
    expect(result.providerPaymentId).toMatch(/^mpesa_mock_/);
  });
});
