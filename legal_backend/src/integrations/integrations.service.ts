import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrivacyControlsService } from '@/country-compliance/privacy-controls.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import {
  INTEGRATION_PROVIDERS,
  IntegrationProvider,
  isIntegrationProvider,
} from './integration-providers';
import { IntegrationSyncService } from './integration-sync.service';

const EMAIL_PROVIDERS = new Set<IntegrationProvider>(['gmail', 'outlook_email']);

const OAUTH_ENV_KEYS: Record<IntegrationProvider, string[]> = {
  google_calendar: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  outlook_calendar: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  gmail: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  outlook_email: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  zoom: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
  google_meet: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  teams: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  docusign: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_SECRET'],
  quickbooks: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
  word_addin: ['ADDIN_DEV_SECRET'],
  outlook_addin: ['ADDIN_DEV_SECRET'],
};

const OAUTH_SCOPES: Partial<Record<IntegrationProvider, string>> = {
  google_calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  google_meet: 'https://www.googleapis.com/auth/calendar.events.readonly',
  outlook_calendar: 'Calendars.Read',
  outlook_email: 'Mail.Read',
  teams: 'OnlineMeetings.Read',
  zoom: 'meeting:read',
  docusign: 'signature',
  quickbooks: 'com.intuit.quickbooks.accounting',
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly integrationSync: IntegrationSyncService,
    private readonly privacyControls: PrivacyControlsService,
  ) {}

  async list(tenantId: string) {
    const [connections, syncLogs] = await Promise.all([
      this.prisma.integrationConnection.findMany({
        where: { tenantId },
        orderBy: { provider: 'asc' },
      }),
      this.prisma.integrationSyncLog.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: 100,
      }),
    ]);

    const byProvider = new Map(connections.map((row) => [row.provider, row]));
    const logsByProvider = new Map<string, typeof syncLogs>();
    for (const log of syncLogs) {
      const existing = logsByProvider.get(log.provider) ?? [];
      if (existing.length < 10) {
        existing.push(log);
        logsByProvider.set(log.provider, existing);
      }
    }

    return INTEGRATION_PROVIDERS.map((provider) => {
      const connection = byProvider.get(provider);
      const config =
        connection?.config && typeof connection.config === 'object'
          ? (connection.config as Record<string, unknown>)
          : {};
      const configLogs = Array.isArray(config.syncLogs) ? config.syncLogs : [];
      const dbLogs = (logsByProvider.get(provider) ?? []).map((log) => ({
        status: log.status.toLowerCase(),
        message:
          log.error ??
          `${log.direction} sync — ${log.recordsProcessed} record(s)`,
        records: log.recordsProcessed,
        at: (log.completedAt ?? log.startedAt).toISOString(),
      }));

      const mergedLogs = [...dbLogs, ...configLogs].slice(0, 10);

      return {
        ...this.safeConnection(
          connection ?? {
            provider,
            status: 'DISCONNECTED',
            tenantId,
          config: null,
          },
        ),
        connectionMode:
          typeof config.mode === 'string' ? config.mode : undefined,
        syncLogs: mergedLogs,
      };
    });
  }

  async connect(tenantId: string, provider: string) {
    this.assertProvider(provider);
    await this.privacyControls.assertTenantProcessingAllowed(
      tenantId,
      'integration',
    );

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

    if (
      !oauthReady &&
      EMAIL_PROVIDERS.has(provider as IntegrationProvider)
    ) {
      await this.syncEmailIntegration(tenantId, provider);
    }

    return connection;
  }

  async getOAuthAuthorizeUrl(tenantId: string, provider: string) {
    this.assertProvider(provider);
    await this.privacyControls.assertTenantProcessingAllowed(
      tenantId,
      'integration',
    );

    const oauthReady = this.isOAuthConfigured(provider);
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (isProd && !oauthReady) {
      throw new ServiceUnavailableException(
        `${provider} OAuth is not configured. Set provider credentials in environment.`,
      );
    }

    const state = `state_${tenantId}_${Date.now()}`;
    const authorizeUrl = oauthReady
      ? this.buildProviderAuthorizeUrl(provider as IntegrationProvider, tenantId, state)
      : `${this.apiPublicBase()}/integrations/${provider}/oauth/callback?tenantId=${tenantId}&stub=1`;

    return {
      provider,
      authorizeUrl,
      state,
      oauthConfigured: oauthReady,
      mode: oauthReady ? 'oauth' : 'development_stub',
    };
  }

  async completeOAuth(
    tenantId: string,
    provider: string,
    params: { code: string; state?: string },
  ) {
    this.assertProvider(provider);
    await this.privacyControls.assertTenantProcessingAllowed(
      tenantId,
      'integration',
    );
    this.assertOAuthState(tenantId, params.state);

    const tokens = await this.exchangeOAuthCode(
      provider as IntegrationProvider,
      params.code,
      tenantId,
    );

    const encrypted = this.encryption.encryptJson(
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      this.integrationTokenAad(tenantId, provider),
    );

    const connection = await this.prisma.integrationConnection.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        status: 'CONNECTED',
        scopes: ['sync'],
        config: {
          mode: 'oauth',
          encryptedTokens: encrypted,
          connectedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
      },
      update: {
        status: 'CONNECTED',
        config: {
          mode: 'oauth',
          encryptedTokens: encrypted,
          connectedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    if (EMAIL_PROVIDERS.has(provider as IntegrationProvider)) {
      await this.syncEmailIntegration(tenantId, provider);
    }

    return this.safeConnection(connection);
  }

  /** Sync email integration via OAuth adapters (or explicit stub in dev). */
  async syncEmailIntegration(
    tenantId: string,
    provider: string,
    matterId?: string,
  ) {
    this.assertProvider(provider);
    await this.privacyControls.assertTenantProcessingAllowed(
      tenantId,
      'integration',
    );

    if (!EMAIL_PROVIDERS.has(provider as IntegrationProvider)) {
      throw new BadRequestException(
        'Email sync is only supported for gmail and outlook_email',
      );
    }

    const syncResult = await this.integrationSync.syncConnection(tenantId, provider);

    await this.appendSyncLog(tenantId, provider, {
      status: syncResult.stub ? 'warning' : 'ok',
      message: syncResult.message,
      records: syncResult.recordsProcessed,
    });

    const targetMatterId =
      matterId ??
      (
        await this.prisma.matter.findFirst({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      )?.id;

    if (targetMatterId && !syncResult.stub && syncResult.recordsProcessed > 0) {
      await this.prisma.timelineEvent.create({
        data: {
          tenantId,
          matterId: targetMatterId,
          eventType: 'INTEGRATION_EMAIL_SYNC',
          title: `${provider.replace('_', ' ')} email sync completed`,
          description: syncResult.message,
          metadata: {
            provider,
            recordsProcessed: syncResult.recordsProcessed,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return {
      synced: !syncResult.stub,
      provider,
      matterId: targetMatterId ?? null,
      stub: syncResult.stub,
      recordsProcessed: syncResult.recordsProcessed,
      message: syncResult.message,
    };
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
    if (!isIntegrationProvider(provider)) {
      return false;
    }
    const keys = OAUTH_ENV_KEYS[provider];
    return keys.every((key) => Boolean(this.configService.get<string>(key)));
  }

  private apiPublicBase(): string {
    return this.configService.get<string>('API_PUBLIC_URL', 'http://localhost:4000');
  }

  private oauthRedirectUri(provider: string): string {
    const base = this.apiPublicBase().replace(/\/+$/, '');
    const withApiPrefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
    return `${withApiPrefix}/integrations/${provider}/oauth/callback`;
  }

  private assertOAuthState(tenantId: string, state?: string): void {
    if (!state) {
      return;
    }

    const expectedPrefix = `state_${tenantId}_`;
    if (!state.startsWith(expectedPrefix)) {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  private async exchangeOAuthCode(
    provider: IntegrationProvider,
    code: string,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string }> {
    if (!code.trim()) {
      throw new BadRequestException('Authorization code is required');
    }

    if (!this.isOAuthConfigured(provider)) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          `${provider} OAuth is not configured. Set provider credentials in environment.`,
        );
      }

      if (code !== 'dev_stub') {
        throw new BadRequestException(
          'Authorization code is required; OAuth tokens cannot be supplied directly',
        );
      }

      return this.createDevStubTokens(tenantId, provider);
    }

    const redirectUri = this.oauthRedirectUri(provider);
    const tokenResponse = await this.requestProviderTokens(provider, code, redirectUri);
    return this.parseTokenResponse(tokenResponse);
  }

  private createDevStubTokens(
    tenantId: string,
    provider: string,
  ): { accessToken: string; refreshToken?: string; expiresAt?: string } {
    const seed = createHash('sha256')
      .update(`${tenantId}:${provider}:${randomUUID()}`)
      .digest('hex');

    return {
      accessToken: `dev_stub_access_${seed.slice(0, 32)}`,
      refreshToken: `dev_stub_refresh_${seed.slice(32, 64)}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
  }

  private async requestProviderTokens(
    provider: IntegrationProvider,
    code: string,
    redirectUri: string,
  ): Promise<Record<string, unknown>> {
    if (
      provider === 'google_calendar' ||
      provider === 'gmail' ||
      provider === 'google_meet'
    ) {
      return this.postFormTokenRequest('https://oauth2.googleapis.com/token', {
        client_id: this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID', ''),
        client_secret: this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET', ''),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });
    }

    if (
      provider === 'outlook_calendar' ||
      provider === 'outlook_email' ||
      provider === 'teams'
    ) {
      return this.postFormTokenRequest(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        {
          client_id: this.configService.get<string>('MICROSOFT_CLIENT_ID', ''),
          client_secret: this.configService.get<string>('MICROSOFT_CLIENT_SECRET', ''),
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: OAUTH_SCOPES[provider] ?? 'openid',
        },
      );
    }

    if (provider === 'zoom') {
      const clientId = this.configService.get<string>('ZOOM_CLIENT_ID', '');
      const clientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET', '');
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      return this.postFormTokenRequest(
        'https://zoom.us/oauth/token',
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        },
        { Authorization: `Basic ${basic}` },
      );
    }

    if (provider === 'docusign') {
      return this.postFormTokenRequest('https://account.docusign.com/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.configService.get<string>('DOCUSIGN_INTEGRATION_KEY', ''),
        client_secret: this.configService.get<string>('DOCUSIGN_SECRET', ''),
      });
    }

    if (provider === 'quickbooks') {
      const clientId = this.configService.get<string>('QUICKBOOKS_CLIENT_ID', '');
      const clientSecret = this.configService.get<string>('QUICKBOOKS_CLIENT_SECRET', '');
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      return this.postFormTokenRequest(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        },
        { Authorization: `Basic ${basic}` },
      );
    }

    throw new BadRequestException(`OAuth token exchange is not supported for ${provider}`);
  }

  private async postFormTokenRequest(
    url: string,
    body: Record<string, string>,
    headers: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...headers,
      },
      body: new URLSearchParams(body),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        typeof payload.error_description === 'string'
          ? payload.error_description
          : typeof payload.error === 'string'
            ? payload.error
            : 'OAuth token exchange failed';
      throw new BadRequestException(message);
    }

    return payload;
  }

  private parseTokenResponse(payload: Record<string, unknown>): {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  } {
    const accessToken = payload.access_token;
    if (typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new BadRequestException('OAuth provider did not return an access token');
    }

    const refreshToken =
      typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined;
    const expiresIn =
      typeof payload.expires_in === 'number'
        ? payload.expires_in
        : typeof payload.expires_in === 'string'
          ? Number(payload.expires_in)
          : undefined;

    return {
      accessToken,
      refreshToken,
      expiresAt:
        expiresIn && Number.isFinite(expiresIn)
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : undefined,
    };
  }

  private buildAuthorizeUrl(provider: string, tenantId: string): string {
    const state = `state_${tenantId}_${Date.now()}`;
    if (this.isOAuthConfigured(provider)) {
      return this.buildProviderAuthorizeUrl(
        provider as IntegrationProvider,
        tenantId,
        state,
      );
    }
    return `${this.apiPublicBase()}/integrations/${provider}/oauth/callback?tenantId=${tenantId}&stub=1`;
  }

  private buildProviderAuthorizeUrl(
    provider: IntegrationProvider,
    tenantId: string,
    state: string,
  ): string {
    const redirectUri = this.oauthRedirectUri(provider);
    const scope = OAUTH_SCOPES[provider] ?? 'openid';

    if (
      provider === 'google_calendar' ||
      provider === 'gmail' ||
      provider === 'google_meet'
    ) {
      const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID', '');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
        access_type: 'offline',
        prompt: 'consent',
      });
      params.set('tenantId', tenantId);
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    if (
      provider === 'outlook_calendar' ||
      provider === 'outlook_email' ||
      provider === 'teams'
    ) {
      const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID', '');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
      });
      params.set('tenantId', tenantId);
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    }

    if (provider === 'zoom') {
      const clientId = this.configService.get<string>('ZOOM_CLIENT_ID', '');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
      });
      return `https://zoom.us/oauth/authorize?${params.toString()}`;
    }

    if (provider === 'docusign') {
      const clientId = this.configService.get<string>('DOCUSIGN_INTEGRATION_KEY', '');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
      });
      return `https://account.docusign.com/oauth/auth?${params.toString()}`;
    }

    if (provider === 'quickbooks') {
      const clientId = this.configService.get<string>('QUICKBOOKS_CLIENT_ID', '');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
      });
      return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
    }

    return `${redirectUri}?tenantId=${tenantId}&state=${state}`;
  }

  async triggerSync(tenantId: string, provider: string) {
    this.assertProvider(provider);

    const connection = await this.prisma.integrationConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });

    if (!connection || connection.status === 'DISCONNECTED') {
      throw new BadRequestException(`${provider} is not connected`);
    }

    const startedAt = new Date();
    const syncLog = await this.prisma.integrationSyncLog.create({
      data: {
        tenantId,
        provider,
        direction: 'INBOUND',
        status: 'RUNNING',
        recordsProcessed: 0,
        startedAt,
      },
    });

    try {
      const syncResult = await this.integrationSync.syncConnection(tenantId, provider);

      await this.appendSyncLog(tenantId, provider, {
        status: syncResult.stub ? 'warning' : 'ok',
        message: syncResult.message,
        records: syncResult.recordsProcessed,
      });

      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          lastError: syncResult.stub ? syncResult.message : null,
        },
      });

      const completed = await this.prisma.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: syncResult.stub ? 'SUCCESS' : 'SUCCESS',
          recordsProcessed: syncResult.recordsProcessed,
          completedAt: new Date(),
          error: syncResult.stub ? syncResult.message : null,
        },
      });

      return {
        provider,
        synced: !syncResult.stub,
        stub: syncResult.stub,
        message: syncResult.message,
        syncLog: {
          id: completed.id,
          status: completed.status,
          recordsProcessed: completed.recordsProcessed,
          startedAt: completed.startedAt.toISOString(),
          completedAt: completed.completedAt?.toISOString() ?? null,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Integration sync failed';

      await this.prisma.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          error: message,
          completedAt: new Date(),
        },
      });

      await this.appendSyncLog(tenantId, provider, {
        status: 'error',
        message,
      });

      throw error;
    }
  }

  async exportQuickBooksInvoices(tenantId: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'quickbooks' } },
    });
    if (!connection || connection.status === 'DISCONNECTED') {
      throw new BadRequestException('QuickBooks is not connected');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: { in: ['SENT', 'PAID', 'DRAFT'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    await this.appendSyncLog(tenantId, 'quickbooks', {
      status: 'ok',
      message: `Exported ${invoices.length} invoice(s) to QuickBooks format`,
      records: invoices.length,
    });

    return {
      provider: 'quickbooks',
      exported: invoices.length,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.amount.toString()),
        currency: inv.currency,
        status: inv.status,
        billingModel: inv.billingModel ?? 'HOURLY',
      })),
    };
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

  private integrationTokenAad(tenantId: string, provider: string) {
    return `integration:${tenantId}:${provider}:tokens`;
  }

  private safeConnection<T extends object>(connection: T): T {
    const source = connection as T & { config?: unknown };
    const config =
      source.config && typeof source.config === 'object'
        ? { ...(source.config as Record<string, unknown>) }
        : source.config;

    if (config && typeof config === 'object') {
      if ('tokens' in config) {
        config.tokens = { redacted: true, legacyPlaintext: true };
      }
      if ('encryptedTokens' in config) {
        config.encryptedTokens = { redacted: true, encrypted: true };
      }
    }

    return { ...source, config } as T;
  }
}
