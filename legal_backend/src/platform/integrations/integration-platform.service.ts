import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { ConnectorLink, IntegrationConnector } from '@prisma/client';

@Injectable()
export class IntegrationPlatformService {
  private readonly logger = new Logger(IntegrationPlatformService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listConnectors(): Promise<IntegrationConnector[]> {
    return this.prisma.integrationConnector.findMany({
      where: { status: { not: 'deprecated' } },
      orderBy: { name: 'asc' },
    });
  }

  async getConnector(connectorId: string): Promise<IntegrationConnector> {
    const connector = await this.prisma.integrationConnector.findUnique({
      where: { connectorId },
    });
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    return connector;
  }

  async connectOAuth(
    tenantId: string,
    userId: string,
    connectorId: string,
    code: string,
    redirectUri: string,
  ): Promise<ConnectorLink> {
    const connector = await this.getConnector(connectorId);
    if (connector.authType !== 'oauth2') {
      throw new BadRequestException(`Connector ${connectorId} does not use OAuth2`);
    }

    const tokenUrl = this.resolveTokenUrl(connectorId);
    const clientId = this.configService.get<string>(`${connectorId.toUpperCase()}_CLIENT_ID`);
    const clientSecret = this.configService.get<string>(`${connectorId.toUpperCase()}_CLIENT_SECRET`);

    let accessToken = '';
    let refreshToken: string | undefined;
    let expiresIn = 3600;

    if (tokenUrl && clientId && clientSecret) {
      try {
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        });
        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          signal: AbortSignal.timeout(10_000),
        });
        const data = (await resp.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        accessToken = data.access_token ?? '';
        refreshToken = data.refresh_token;
        expiresIn = data.expires_in ?? 3600;
      } catch (err) {
        this.logger.error(`OAuth token exchange failed for ${connectorId}`, err);
        throw new BadRequestException('OAuth token exchange failed');
      }
    } else {
      this.logger.warn(`OAuth credentials not configured for ${connectorId}, storing placeholder`);
      accessToken = `mock_${code}`;
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    return this.prisma.connectorLink.upsert({
      where: { tenantId_userId_connectorId: { tenantId, userId, connectorId } },
      create: {
        tenantId,
        userId,
        connectorId,
        status: 'active',
        accessToken,
        refreshToken,
        tokenExpiresAt,
        scopes: connector.requiredScopes,
      },
      update: {
        status: 'active',
        accessToken,
        refreshToken,
        tokenExpiresAt,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
  }

  async revokeConnection(
    tenantId: string,
    userId: string,
    connectorId: string,
  ): Promise<void> {
    const link = await this.prisma.connectorLink.findUnique({
      where: { tenantId_userId_connectorId: { tenantId, userId, connectorId } },
    });
    if (!link) {
      throw new NotFoundException(`Connection for ${connectorId} not found`);
    }
    await this.prisma.connectorLink.update({
      where: { id: link.id },
      data: { status: 'revoked', accessToken: null, refreshToken: null },
    });
  }

  async getConnections(tenantId: string, userId: string): Promise<ConnectorLink[]> {
    return this.prisma.connectorLink.findMany({
      where: { tenantId, userId, status: { not: 'revoked' } },
      include: { connector: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async importFromDrive(
    connectionId: string,
    tenantId: string,
    fileIds: string[],
  ): Promise<string[]> {
    const link = await this.prisma.connectorLink.findUnique({
      where: { id: connectionId },
    });
    if (!link || link.tenantId !== tenantId) {
      throw new NotFoundException(`Connection ${connectionId} not found`);
    }
    if (!link.accessToken) {
      throw new BadRequestException(`Connection ${connectionId} has no access token. Re-authenticate.`);
    }

    const createdIds: string[] = [];
    const driveApiBase = this.resolveDriveApiBase(link.connectorId);

    for (const fileId of fileIds) {
      try {
        // Step 1: Fetch file metadata
        const metaResp = await fetch(`${driveApiBase}/files/${fileId}?fields=id,name,mimeType,size`, {
          headers: { Authorization: `Bearer ${link.accessToken}` },
          signal: AbortSignal.timeout(15_000),
        });

        if (!metaResp.ok) {
          this.logger.warn(`Drive metadata fetch failed for ${fileId}: ${metaResp.status}`);
          continue;
        }

        const meta = await metaResp.json() as { id: string; name: string; mimeType: string; size?: string };

        // Step 2: Fetch file content (for supported types)
        let contentUrl = `${driveApiBase}/files/${fileId}?alt=media`;
        if (meta.mimeType.startsWith('application/vnd.google-apps')) {
          // Export Google Docs/Sheets to PDF
          contentUrl = `${driveApiBase}/files/${fileId}/export?mimeType=application/pdf`;
        }

        const contentResp = await fetch(contentUrl, {
          headers: { Authorization: `Bearer ${link.accessToken}` },
          signal: AbortSignal.timeout(30_000),
        });

        const contentBuffer = contentResp.ok
          ? Buffer.from(await contentResp.arrayBuffer())
          : Buffer.from('');

        // Step 3: Create document record with import metadata
        const doc = await this.prisma.document.create({
          data: {
            tenantId,
            fileName: meta.name,
            fileUrl: contentUrl,
            mimeType: meta.mimeType === 'application/vnd.google-apps.document' ? 'application/pdf' : meta.mimeType,
            aiDraftStatus: 'imported',
            sourceConsumerDocId: fileId,
          },
        });

        createdIds.push((doc as { id: string }).id);
        this.logger.log(`Imported Drive file: ${meta.name} → doc ${(doc as { id: string }).id}`);
      } catch (err) {
        this.logger.error(`Failed to import file ${fileId}: ${String(err)}`);
      }
    }

    await this.prisma.connectorLink.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    return createdIds;
  }

  async syncCalendar(
    connectionId: string,
    tenantId: string,
    matterId: string,
  ): Promise<{ synced: number; failed: number }> {
    const link = await this.prisma.connectorLink.findUnique({
      where: { id: connectionId },
    });
    if (!link || link.tenantId !== tenantId) {
      throw new NotFoundException(`Connection ${connectionId} not found`);
    }
    if (!link.accessToken) {
      throw new BadRequestException(`Connection ${connectionId} has no access token. Re-authenticate.`);
    }

    const deadlines = await this.prisma.matterDeadline.findMany({
      where: { matterId, tenantId, status: 'open' },
    });

    const calendarApiUrl = this.resolveCalendarApiUrl(link.connectorId);
    if (!calendarApiUrl) {
      this.logger.warn(`Calendar API not supported for connector ${link.connectorId}`);
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const deadline of deadlines) {
      try {
        const event = this.buildCalendarEvent(deadline, matterId);
        const externalId = (deadline as any).externalCalendarEventId as string | null;

        if (externalId) {
          // Update existing event
          const resp = await fetch(`${calendarApiUrl}/calendars/primary/events/${externalId}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${link.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
            signal: AbortSignal.timeout(10_000),
          });
          if (resp.ok) synced++;
          else failed++;
        } else {
          // Create new event
          const resp = await fetch(`${calendarApiUrl}/calendars/primary/events`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${link.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
            signal: AbortSignal.timeout(10_000),
          });

          if (resp.ok) {
            const created = await resp.json() as { id: string };
            // Persist external calendar event ID into sourceRef
            await this.prisma.matterDeadline.update({
              where: { id: deadline.id },
              data: { sourceRef: created.id },
            }).catch(() => {});
            synced++;
          } else {
            failed++;
          }
        }
      } catch (err) {
        this.logger.error(`Calendar sync failed for deadline ${deadline.id}: ${String(err)}`);
        failed++;
      }
    }

    await this.prisma.connectorLink.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    this.logger.log(`Calendar sync for matter ${matterId}: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  private buildCalendarEvent(deadline: { title: string; dueDate: Date; description?: string | null }, matterId: string): Record<string, unknown> {
    const dueDate = deadline.dueDate.toISOString().slice(0, 10);
    return {
      summary: deadline.title,
      description: deadline.description ?? `Legal deadline for matter ${matterId}`,
      start: { date: dueDate },
      end: { date: dueDate },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 3 * 24 * 60 },  // 3 days
          { method: 'popup', minutes: 24 * 60 },       // 1 day
        ],
      },
    };
  }

  private resolveDriveApiBase(connectorId: string): string {
    if (connectorId === 'onedrive') return 'https://graph.microsoft.com/v1.0/me/drive';
    return 'https://www.googleapis.com/drive/v3';
  }

  private resolveCalendarApiUrl(connectorId: string): string | null {
    if (connectorId === 'google_drive' || connectorId === 'google_calendar') {
      return 'https://www.googleapis.com/calendar/v3';
    }
    if (connectorId === 'onedrive' || connectorId === 'outlook_calendar') {
      return 'https://graph.microsoft.com/v1.0/me';
    }
    return null;
  }

  async seedDefaultConnectors(): Promise<void> {
    const defaults: Array<{
      connectorId: string;
      name: string;
      category: string;
      authType: string;
      capabilities: string[];
      requiredScopes: string[];
      logoUrl?: string;
    }> = [
      {
        connectorId: 'google_drive',
        name: 'Google Drive',
        category: 'storage',
        authType: 'oauth2',
        capabilities: ['import', 'export', 'sync'],
        requiredScopes: ['https://www.googleapis.com/auth/drive.readonly'],
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg',
      },
      {
        connectorId: 'onedrive',
        name: 'Microsoft OneDrive',
        category: 'storage',
        authType: 'oauth2',
        capabilities: ['import', 'export', 'sync'],
        requiredScopes: ['Files.Read'],
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg',
      },
      {
        connectorId: 'docusign',
        name: 'DocuSign',
        category: 'esign',
        authType: 'oauth2',
        capabilities: ['export', 'webhook'],
        requiredScopes: ['signature'],
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/DocuSign_logo.svg',
      },
      {
        connectorId: 'clio',
        name: 'Clio',
        category: 'practice_management',
        authType: 'oauth2',
        capabilities: ['import', 'export', 'sync'],
        requiredScopes: ['matters:read', 'contacts:read', 'documents:read'],
      },
      {
        connectorId: 'slack',
        name: 'Slack',
        category: 'communication',
        authType: 'oauth2',
        capabilities: ['webhook', 'realtime'],
        requiredScopes: ['chat:write', 'channels:read'],
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
      },
    ];

    for (const c of defaults) {
      await this.prisma.integrationConnector.upsert({
        where: { connectorId: c.connectorId },
        create: { ...c, status: 'active' },
        update: { name: c.name, capabilities: c.capabilities },
      });
    }

    this.logger.log(`Seeded ${defaults.length} default connectors`);
  }

  private resolveTokenUrl(connectorId: string): string | null {
    const urls: Record<string, string> = {
      google_drive: 'https://oauth2.googleapis.com/token',
      onedrive: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      docusign: 'https://account.docusign.com/oauth/token',
      clio: 'https://app.clio.com/oauth/token',
      slack: 'https://slack.com/api/oauth.v2.access',
    };
    return urls[connectorId] ?? null;
  }
}
