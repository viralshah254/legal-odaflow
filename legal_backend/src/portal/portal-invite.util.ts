import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveAppUrl } from '@/common/app-url';

export const PORTAL_INVITE_EXPIRES_IN = '7d';

interface PortalInvitePayload {
  type: 'PORTAL_INVITE';
  clientId: string;
  tenantId: string;
  sub: string;
}

export function signPortalInviteToken(
  jwtService: JwtService,
  clientId: string,
  tenantId: string,
): string {
  return jwtService.sign(
    {
      type: 'PORTAL_INVITE',
      clientId,
      tenantId,
      sub: clientId,
    } satisfies PortalInvitePayload,
    { expiresIn: PORTAL_INVITE_EXPIRES_IN },
  );
}

export function buildPortalInviteUrl(
  configService: ConfigService,
  inviteToken: string,
): string {
  const appUrl = resolveAppUrl(configService.get<string>('APP_URL'));
  return `${appUrl}/portal/sign-in?token=${encodeURIComponent(inviteToken)}`;
}
