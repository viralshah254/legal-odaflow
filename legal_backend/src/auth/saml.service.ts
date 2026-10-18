import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SAML, Profile } from '@node-saml/node-saml';
import Redis from 'ioredis';

const SAML_REPLAY_TTL_SECONDS = 86_400;

@Injectable()
export class SamlService implements OnModuleDestroy {
  private redis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
      this.redis = null;
    }
  }

  getApiUrl(): string {
    return this.configService
      .get<string>('API_URL', 'http://localhost:4000')
      .replace(/\/$/, '');
  }

  buildSpEntityId(tenantId: string, ssoConfig?: Record<string, unknown>): string {
    const override = ssoConfig?.spEntityId;
    if (typeof override === 'string' && override.trim()) {
      return override.trim();
    }
    return `${this.getApiUrl()}/api/v1/auth/saml/sp/${tenantId}`;
  }

  buildAcsUrl(): string {
    return `${this.getApiUrl()}/api/v1/auth/saml/acs`;
  }

  normalizeIdpCert(cert: string): string {
    const trimmed = cert.trim();
    if (trimmed.includes('BEGIN CERTIFICATE')) {
      return trimmed;
    }
    const body = trimmed.replace(/\s/g, '');
    const lines = body.match(/.{1,64}/g) ?? [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
  }

  assertSsoConfigReady(ssoConfig: Record<string, unknown> | null | undefined): void {
    if (!ssoConfig?.enabled) {
      throw new BadRequestException('SAML SSO is not enabled for this tenant');
    }
    if (typeof ssoConfig.idpEntityId !== 'string' || !ssoConfig.idpEntityId.trim()) {
      throw new BadRequestException('Tenant SSO config is missing idpEntityId');
    }
    if (typeof ssoConfig.ssoUrl !== 'string' || !ssoConfig.ssoUrl.trim()) {
      throw new BadRequestException('Tenant SSO config is missing ssoUrl');
    }
    if (typeof ssoConfig.idpCert !== 'string' || !ssoConfig.idpCert.trim()) {
      throw new BadRequestException(
        'Tenant SSO config is missing idpCert (IdP signing certificate)',
      );
    }
  }

  async validateAssertionAndExtractEmail(
    tenantId: string,
    samlResponse: string,
    ssoConfig: Record<string, unknown>,
  ): Promise<string> {
    this.assertSsoConfigReady(ssoConfig);

    const idpEntityId = (ssoConfig.idpEntityId as string).trim();
    const ssoUrl = (ssoConfig.ssoUrl as string).trim();
    const idpCert = this.normalizeIdpCert(ssoConfig.idpCert as string);
    const spEntityId = this.buildSpEntityId(tenantId, ssoConfig);

    const saml = new SAML({
      entryPoint: ssoUrl,
      issuer: spEntityId,
      callbackUrl: this.buildAcsUrl(),
      audience: spEntityId,
      idpCert,
      idpIssuer: idpEntityId,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      acceptedClockSkewMs: 5 * 60 * 1000,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    });

    let profile: Profile | null;
    try {
      const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
      profile = result.profile;
    } catch {
      throw new UnauthorizedException('Invalid SAML assertion');
    }

    if (!profile) {
      throw new UnauthorizedException('Invalid SAML assertion');
    }

    if (profile.issuer && profile.issuer !== idpEntityId) {
      throw new UnauthorizedException('SAML assertion issuer does not match configured IdP');
    }

    if (profile.ID) {
      await this.assertNotReplayed(profile.ID);
    }

    const email = this.extractEmailFromProfile(profile);
    if (!email) {
      throw new BadRequestException('Could not extract user email from SAML assertion');
    }

    return email;
  }

  private extractEmailFromProfile(profile: Profile): string | null {
    const candidates = [
      profile.email,
      profile.mail,
      profile['urn:oid:0.9.2342.19200300.100.1.3'],
      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      profile.nameID,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.includes('@')) {
        return candidate.trim().toLowerCase();
      }
    }

    return null;
  }

  private getRedis(): Redis | null {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      return null;
    }

    if (!this.redis) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }

    return this.redis;
  }

  private async assertNotReplayed(assertionId: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('SAML replay protection unavailable');
      }
      return;
    }

    const key = `saml:replay:${assertionId}`;

    try {
      if (redis.status !== 'ready') {
        await redis.connect();
      }

      const stored = await redis.set(key, '1', 'EX', SAML_REPLAY_TTL_SECONDS, 'NX');
      if (stored !== 'OK') {
        throw new UnauthorizedException('SAML assertion has already been used');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('SAML replay protection unavailable');
      }
    }
  }
}
