import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveAppUrl } from '@/common/app-url';

export const PORTAL_PAYMENT_EXPIRES_IN = '90d';

interface PortalPaymentPayload {
  type: 'PORTAL_PAYMENT';
  invoiceId: string;
  tenantId: string;
  sub: string;
}

export function signPortalPaymentToken(
  jwtService: JwtService,
  invoiceId: string,
  tenantId: string,
): string {
  return jwtService.sign(
    {
      type: 'PORTAL_PAYMENT',
      invoiceId,
      tenantId,
      sub: invoiceId,
    } satisfies PortalPaymentPayload,
    { expiresIn: PORTAL_PAYMENT_EXPIRES_IN },
  );
}

export function verifyPortalPaymentToken(
  jwtService: JwtService,
  token: string,
  invoiceId: string,
): PortalPaymentPayload {
  try {
    const payload = jwtService.verify<PortalPaymentPayload>(token);
    if (
      payload.type !== 'PORTAL_PAYMENT' ||
      !payload.invoiceId ||
      !payload.tenantId ||
      payload.invoiceId !== invoiceId
    ) {
      throw new UnauthorizedException('Invalid payment link token');
    }
    return payload;
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }
    throw new UnauthorizedException('Invalid or expired payment link token');
  }
}

export function buildPortalPaymentPath(invoiceId: string, token: string): string {
  return `/pay/${invoiceId}?token=${encodeURIComponent(token)}`;
}

export function buildPortalPaymentUrl(
  configService: ConfigService,
  invoiceId: string,
  token: string,
): string {
  const appUrl = resolveAppUrl(configService.get<string>('APP_URL'));
  return `${appUrl}${buildPortalPaymentPath(invoiceId, token)}`;
}
