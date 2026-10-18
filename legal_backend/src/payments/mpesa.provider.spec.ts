import { createHmac } from 'crypto';
import { mpesaCallbackSignatureValid } from './mpesa.provider';

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
