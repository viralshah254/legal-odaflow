import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  INTEGRATION_PROVIDERS,
  isIntegrationProvider,
} from './integration-providers';

const OAUTH_ENV_KEYS: Record<string, string[]> = {
  google_calendar: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  google_gmail: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  microsoft_outlook: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  microsoft_calendar: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  docusign: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_SECRET'],
  quickbooks: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
  zoom: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async list(tenantId: string) {
    const connections = await this.prisma.integrationConnection.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
    });

    const byProvider = new Map(connections.map((row) => [row.provider, row]));

    return INTEGRATION_PROVIDERS.map((provider) => {
      const connection = byProvider.get(provider);
      return (
        connection ?? {
          provider,
          status: 'DISCONNECTED',
          tenantId,
        }
      );
    });
  }

  async connect(tenantId: string, provider: string) {
    this.assertProvider(provider);

    const oauthReady = this.isOAuthConfigured(provider);
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (isProd && !oauthReady) {
      throw new ServiceUnavailableException(
        `${provider} OAuth is not configured. Set provider credentials in environment.`,
      );
    }

    const config: Prisma.InputJsonValue = oauthReady
      ? {
          connectedAt: new Date().toISOString(),
          mode: 'oauth',
          oauthState: `state_${tenantId}_${Date.now()}`,
          authorizeUrl: this.buildAuthorizeUrl(provider, tenantId),
        }
      : { connectedAt: new Date().toISOString(), mode: 'development_stub' };

    const connection = await this.prisma.integrationConnection.upsert({
      where: {
        tenantId_provider: { tenantId, provider },
      },
      create: {
        tenantId,
        provider,
        status: oauthReady ? 'PENDING_OAUTH' : 'CONNECTED',
        scopes: oauthReady ? ['calendar', 'email'] : ['development'],
        config,
        lastSyncAt: oauthReady ? null : new Date(),
        lastError: null,
      },
      update: {
        status: oauthReady ? 'PENDING_OAUTH' : 'CONNECTED',
        lastSyncAt: oauthReady ? null : new Date(),
        lastError: null,
        config,
      },
    });

    await this.prisma.integrationSyncLog.create({
      data: {
        tenantId,
        provider,
        direction: 'OUTBOUND',
        status: oauthReady ? 'PENDING' : 'SUCCESS',
        recordsProcessed: oauthReady ? 0 : 1,
      },
    });

    return connection;
  }

  async completeOAuth(
    tenantId: string,
    provider: string,
    tokens: { accessToken: string; refreshToken?: string; expiresAt?: string },
  ) {
    this.assertProvider(provider);
    const encrypted = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };

    return this.prisma.integrationConnection.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        status: 'CONNECTED',
        scopes: ['sync'],
        config: {
          mode: 'oauth',
          tokens: encrypted,
          connectedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
      },
      update: {
        status: 'CONNECTED',
        config: {
          mode: 'oauth',
          tokens: encrypted,
          connectedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
  }

  async appendSyncLog(
    tenantId: string,
    provider: string,
    entry: { status: string; message: string; records?: number },
  ) {
    const conn = await this.prisma.integrationConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!conn) return null;

    const config =
      conn.config && typeof conn.config === 'object'
        ? (conn.config as Record<string, unknown>)
        : {};
    const logs = Array.isArray(config.syncLogs) ? [...config.syncLogs] : [];
    logs.unshift({ ...entry, at: new Date().toISOString() });

    return this.prisma.integrationConnection.update({
      where: { id: conn.id },
      data: {
        config: { ...config, syncLogs: logs.slice(0, 50) } as Prisma.InputJsonValue,
        lastSyncAt: entry.status === 'ok' ? new Date() : conn.lastSyncAt,
        lastError: entry.status === 'error' ? entry.message : null,
      },
    });
  }

  private isOAuthConfigured(provider: string): boolean {
    const keys = OAUTH_ENV_KEYS[provider];
    if (!keys) return false;
    return keys.every((key) => Boolean(this.configService.get<string>(key)));
  }

  private buildAuthorizeUrl(provider: string, tenantId: string): string {
    const base = this.configService.get<string>('API_PUBLIC_URL', 'http://localhost:4000');
    return `${base}/integrations/oauth/${provider}/authorize?tenantId=${tenantId}`;
  }

  async disconnect(tenantId: string, provider: string) {
    this.assertProvider(provider);

    const existing = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: { tenantId, provider },
      },
    });

    if (!existing) {
      throw new NotFoundException('Integration connection not found');
    }

    return this.prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        status: 'DISCONNECTED',
        lastSyncAt: null,
        config: { disconnectedAt: new Date().toISOString() },
      },
    });
  }

  private assertProvider(provider: string) {
    if (!isIntegrationProvider(provider)) {
      throw new BadRequestException(
        `Unknown provider. Supported: ${INTEGRATION_PROVIDERS.join(', ')}`,
      );
    }
  }
}
