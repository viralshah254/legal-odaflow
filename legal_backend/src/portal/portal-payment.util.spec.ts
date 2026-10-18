import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  PORTAL_PAYMENT_EXPIRES_IN,
  signPortalPaymentToken,
  verifyPortalPaymentToken,
} from './portal-payment.util';

describe('portal-payment.util', () => {
  const jwtService = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: PORTAL_PAYMENT_EXPIRES_IN },
  });

  const invoiceId = 'inv-123';
  const tenantId = 'tenant-456';

  it('signs and verifies a token for the matching invoice', () => {
    const token = signPortalPaymentToken(jwtService, invoiceId, tenantId);
    const payload = verifyPortalPaymentToken(jwtService, token, invoiceId);
    expect(payload.type).toBe('PORTAL_PAYMENT');
    expect(payload.invoiceId).toBe(invoiceId);
    expect(payload.tenantId).toBe(tenantId);
  });

  it('rejects a token for a different invoice', () => {
    const token = signPortalPaymentToken(jwtService, invoiceId, tenantId);
    expect(() => verifyPortalPaymentToken(jwtService, token, 'other-invoice')).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token with the wrong type', () => {
    const token = jwtService.sign({
      type: 'PORTAL_INVITE',
      invoiceId,
      tenantId,
      sub: invoiceId,
    });
    expect(() => verifyPortalPaymentToken(jwtService, token, invoiceId)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const expiredJwt = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '1ms' },
    });
    const token = expiredJwt.sign({
      type: 'PORTAL_PAYMENT',
      invoiceId,
      tenantId,
      sub: invoiceId,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(() => verifyPortalPaymentToken(expiredJwt, token, invoiceId)).toThrow(
      UnauthorizedException,
    );
  });
});
