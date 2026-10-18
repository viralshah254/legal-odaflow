import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService, EncryptedPayload } from '@/security/encryption.service';
import {
  INTEGRATION_PROVIDERS,
  IntegrationProvider,
  isIntegrationProvider,
} from './integration-providers';

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface IntegrationSyncResult {
  provider: string;
  recordsProcessed: number;
  message: string;
  stub: boolean;
}

const CALENDAR_PROVIDERS = new Set<IntegrationProvider>([
  'google_calendar',
  'outlook_calendar',
  'google_meet',
]);

const EMAIL_PROVIDERS = new Set<IntegrationProvider>(['gmail', 'outlook_email']);

@Injectable()
export class IntegrationSyncService {
  private readonly logger = new Logger(IntegrationSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  async syncConnection(
    tenantId: string,
    provider: string,
  ): Promise<IntegrationSyncResult> {
    this.assertProvider(provider);

    const connection = await this.prisma.integrationConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });

    if (!connection || connection.status === 'DISCONNECTED') {
      throw new BadRequestException(`${provider} is not connected`);
    }

    const config =
      connection.config && typeof connection.config === 'object'
        ? (connection.config as Record<string, unknown>)
        : {};

    const mode = typeof config.mode === 'string' ? config.mode : 'unknown';

    if (mode === 'development_stub') {
      return {
        provider,
        recordsProcessed: 0,
        message: `${provider} is in development stub mode — configure OAuth credentials and reconnect for live sync.`,
        stub: true,
      };
    }

    if (connection.status !== 'CONNECTED') {
      throw new BadRequestException(
        `${provider} OAuth is pending — complete authorization before syncing.`,
      );
    }

    const tokens = this.decryptTokens(tenantId, provider, config);
    if (!tokens?.accessToken) {
      throw new ServiceUnavailableException(
        `${provider} has no stored OAuth tokens. Disconnect and reconnect the integration.`,
      );
    }

    const accessToken = await this.ensureFreshAccessToken(
      provider as IntegrationProvider,
      tokens,
      tenantId,
    );

    if (CALENDAR_PROVIDERS.has(provider as IntegrationProvider)) {
      return this.syncCalendarProvider(
        tenantId,
        provider as IntegrationProvider,
        accessToken,
      );
    }

    if (EMAIL_PROVIDERS.has(provider as IntegrationProvider)) {
      return this.syncEmailProvider(
        tenantId,
        provider as IntegrationProvider,
        accessToken,
      );
    }

    return {
      provider,
      recordsProcessed: 0,
      message: `${provider} connected — no inbound sync adapter yet.`,
      stub: false,
    };
  }

  private async syncCalendarProvider(
    tenantId: string,
    provider: IntegrationProvider,
    accessToken: string,
  ): Promise<IntegrationSyncResult> {
    if (provider === 'google_calendar' || provider === 'google_meet') {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 7);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30);

      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new ServiceUnavailableException(
          `Google Calendar sync failed (${response.status}): ${err.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as { items?: Array<Record<string, unknown>> };
      const items = payload.items ?? [];
      let imported = 0;

      for (const item of items) {
        const title = String(item.summary ?? 'Calendar event');
        const startRaw =
          (item.start as { dateTime?: string; date?: string } | undefined)?.dateTime ??
          (item.start as { date?: string } | undefined)?.date;
        const endRaw =
          (item.end as { dateTime?: string; date?: string } | undefined)?.dateTime ??
          (item.end as { date?: string } | undefined)?.date;

        if (!startRaw) continue;

        const startAt = new Date(startRaw);
        const endAt = endRaw ? new Date(endRaw) : new Date(startAt.getTime() + 60 * 60 * 1000);

        const existing = await this.prisma.calendarEvent.findFirst({
          where: {
            tenantId,
            title,
            startAt,
            type: 'EXTERNAL',
          },
        });

        if (existing) continue;

        await this.prisma.calendarEvent.create({
          data: {
            tenantId,
            title,
            description: String(item.description ?? `Imported from ${provider}`),
            type: 'EXTERNAL',
            startAt,
            endAt,
          },
        });
        imported += 1;
      }

      return {
        provider,
        recordsProcessed: imported,
        message: `Synced ${imported} new event(s) from Google Calendar (${items.length} fetched).`,
        stub: false,
      };
    }

    if (provider === 'outlook_calendar') {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 7);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30);

      const params = new URLSearchParams({
        startDateTime: timeMin.toISOString(),
        endDateTime: timeMax.toISOString(),
        $top: '50',
        $orderby: 'start/dateTime',
      });

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new ServiceUnavailableException(
          `Outlook Calendar sync failed (${response.status}): ${err.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as { value?: Array<Record<string, unknown>> };
      const items = payload.value ?? [];
      let imported = 0;

      for (const item of items) {
        const title = String(item.subject ?? 'Calendar event');
        const startRaw = (item.start as { dateTime?: string } | undefined)?.dateTime;
        const endRaw = (item.end as { dateTime?: string } | undefined)?.dateTime;
        if (!startRaw) continue;

        const startAt = new Date(startRaw);
        const endAt = endRaw ? new Date(endRaw) : new Date(startAt.getTime() + 60 * 60 * 1000);

        const existing = await this.prisma.calendarEvent.findFirst({
          where: { tenantId, title, startAt, type: 'EXTERNAL' },
        });
        if (existing) continue;

        await this.prisma.calendarEvent.create({
          data: {
            tenantId,
            title,
            description: String(item.bodyPreview ?? `Imported from ${provider}`),
            type: 'EXTERNAL',
            startAt,
            endAt,
          },
        });
        imported += 1;
      }

      return {
        provider,
        recordsProcessed: imported,
        message: `Synced ${imported} new event(s) from Outlook Calendar (${items.length} fetched).`,
        stub: false,
      };
    }

    return {
      provider,
      recordsProcessed: 0,
      message: `${provider} calendar sync not implemented.`,
      stub: false,
    };
  }

  private async syncEmailProvider(
    tenantId: string,
    provider: IntegrationProvider,
    accessToken: string,
  ): Promise<IntegrationSyncResult> {
    if (provider === 'gmail') {
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=newer_than:7d',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new ServiceUnavailableException(
          `Gmail sync failed (${response.status}): ${err.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as {
        messages?: Array<{ id: string }>;
        resultSizeEstimate?: number;
      };
      const count = payload.messages?.length ?? payload.resultSizeEstimate ?? 0;

      return {
        provider,
        recordsProcessed: count,
        message: `Gmail sync fetched ${count} recent message(s).`,
        stub: false,
      };
    }

    if (provider === 'outlook_email') {
      const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/messages?$top=25&$filter=receivedDateTime ge ' +
          encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString()),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new ServiceUnavailableException(
          `Outlook email sync failed (${response.status}): ${err.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as { value?: unknown[] };
      const count = payload.value?.length ?? 0;

      return {
        provider,
        recordsProcessed: count,
        message: `Outlook email sync fetched ${count} recent message(s).`,
        stub: false,
      };
    }

    return {
      provider,
      recordsProcessed: 0,
      message: `${provider} email sync not implemented.`,
      stub: false,
    };
  }

  private decryptTokens(
    tenantId: string,
    provider: string,
    config: Record<string, unknown>,
  ): OAuthTokens | null {
    const encrypted = config.encryptedTokens;
    if (!encrypted || typeof encrypted !== 'object') {
      return null;
    }

    if (!this.encryption.isEncryptedPayload(encrypted)) {
      return null;
    }

    try {
      return this.encryption.decryptJson<OAuthTokens>(
        encrypted as EncryptedPayload,
        `integration:${tenantId}:${provider}:tokens`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt tokens for ${provider}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private async ensureFreshAccessToken(
    provider: IntegrationProvider,
    tokens: OAuthTokens,
    tenantId: string,
  ): Promise<string> {
    if (tokens.expiresAt) {
      const expires = new Date(tokens.expiresAt).getTime();
      if (Number.isFinite(expires) && expires > Date.now() + 60_000) {
        return tokens.accessToken;
      }
    }

    if (!tokens.refreshToken) {
      return tokens.accessToken;
    }

    const refreshed = await this.refreshOAuthToken(provider, tokens.refreshToken);
    if (!refreshed) {
      return tokens.accessToken;
    }

    const encrypted = this.encryption.encryptJson(
      {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        expiresAt: refreshed.expiresAt,
      },
      `integration:${tenantId}:${provider}:tokens`,
    );

    await this.prisma.integrationConnection.update({
      where: { tenantId_provider: { tenantId, provider } },
      data: {
        config: {
          mode: 'oauth',
          encryptedTokens: encrypted,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return refreshed.accessToken;
  }

  private async refreshOAuthToken(
    provider: IntegrationProvider,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string } | null> {
    if (
      provider === 'google_calendar' ||
      provider === 'gmail' ||
      provider === 'google_meet'
    ) {
      const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID', '');
      const clientSecret = this.configService.get<string>(
        'GOOGLE_OAUTH_CLIENT_SECRET',
        '',
      );
      if (!clientId || !clientSecret) return null;

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!payload.access_token) return null;

      return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresAt: payload.expires_in
          ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
          : undefined,
      };
    }

    if (
      provider === 'outlook_calendar' ||
      provider === 'outlook_email' ||
      provider === 'teams'
    ) {
      const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID', '');
      const clientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET', '');
      if (!clientId || !clientSecret) return null;

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'offline_access openid profile',
      });

      const response = await fetch(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );

      if (!response.ok) return null;

      const payload = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!payload.access_token) return null;

      return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresAt: payload.expires_in
          ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
          : undefined,
      };
    }

    return null;
  }

  private assertProvider(provider: string) {
    if (!isIntegrationProvider(provider)) {
      throw new BadRequestException(
        `Unknown provider. Supported: ${INTEGRATION_PROVIDERS.join(', ')}`,
      );
    }
  }
}
