import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { assertProductionConfigured } from '@/common/utils/production-guard';
import { PrismaService } from '@/prisma/prisma.service';
import {
  getHeaderValue,
  verifyAdobeSignWebhookClientId,
  verifyDocuSignWebhookSignature,
} from './esign-webhook.util';

/**
 * E-Sign service — DocuSign and Adobe Sign integration.
 *
 * Architecture:
 *  1. User selects a document from a matter, adds recipients, and clicks "Send for Signature".
 *  2. We create an ESignEnvelope record (status=DRAFT) and call the provider's API to create
 *     an envelope. We store the remote envelopeId.
 *  3. On webhook events (status changes) we update the local ESignEnvelope.
 *  4. When the envelope is complete, we auto-attach the signed document back to the matter.
 *
 * Note: In dev/staging mode (no API keys configured), the service falls back to a mock
 * flow so the UI can be exercised without real credentials.
 */
export interface Signer {
  name: string;
  email: string;
  routingOrder?: number;
}

export interface SendForSignatureDto {
  matterId?: string;
  documentId?: string;
  documentUrl?: string;
  documentName: string;
  signers: Signer[];
  subject: string;
  message?: string;
  provider?: 'docusign' | 'adobe_sign';
}

export interface ESignEnvelopeStatus {
  id: string;
  remoteEnvelopeId: string;
  provider: string;
  status: string;
  documentName: string;
  subject: string;
  signers: Signer[];
  sentAt?: Date | null;
  completedAt?: Date | null;
  signedDocumentUrl?: string | null;
  matterId?: string | null;
  documentId?: string | null;
}

@Injectable()
export class ESignService implements OnModuleInit {
  private readonly logger = new Logger(ESignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const hasDocuSign =
      !!this.config.get<string>('DOCUSIGN_ACCOUNT_ID') ||
      !!this.config.get<string>('DOCUSIGN_ACCESS_TOKEN');
    if (hasDocuSign) {
      assertProductionConfigured(
        this.config,
        ['DOCUSIGN_WEBHOOK_SECRET'],
        'DocuSign webhooks',
      );
    }

    const hasAdobeSign = !!this.config.get<string>('ADOBE_SIGN_ACCESS_TOKEN');
    if (hasAdobeSign) {
      assertProductionConfigured(
        this.config,
        ['ADOBE_SIGN_INTEGRATION_KEY'],
        'Adobe Sign webhooks',
      );
    }
  }

  private assertDevMockAllowed(): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        'E-sign provider is not configured. Connect DocuSign or Adobe Sign before sending envelopes.',
      );
    }
  }

  async sendForSignature(
    tenantId: string,
    userId: string,
    dto: SendForSignatureDto,
  ): Promise<ESignEnvelopeStatus> {
    const provider = dto.provider ?? 'docusign';

    let remoteEnvelopeId: string;
    try {
      remoteEnvelopeId = await this.createRemoteEnvelope(tenantId, provider, dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'E-sign provider unavailable';
      this.logger.warn(`${provider} API unavailable (${message})`);
      this.assertDevMockAllowed();
      remoteEnvelopeId = `mock-${Date.now()}`;
    }

    const envelope = await this.prisma.eSignEnvelope.create({
      data: {
        tenantId,
        createdBy: userId,
        provider,
        remoteEnvelopeId,
        status: 'SENT',
        documentName: dto.documentName,
        subject: dto.subject,
        message: dto.message,
        signers: dto.signers as unknown as Prisma.InputJsonValue,
        matterId: dto.matterId,
        documentId: dto.documentId,
        sentAt: new Date(),
      },
    });

    return this.toStatus(envelope);
  }

  async list(tenantId: string, matterId?: string): Promise<ESignEnvelopeStatus[]> {
    const envelopes = await this.prisma.eSignEnvelope.findMany({
      where: { tenantId, ...(matterId ? { matterId } : {}) },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    return envelopes.map((e) => this.toStatus(e));
  }

  async getById(
    tenantId: string,
    envelopeId: string,
  ): Promise<ESignEnvelopeStatus> {
    const envelope = await this.prisma.eSignEnvelope.findFirst({
      where: { id: envelopeId, tenantId },
    });
    if (!envelope) throw new NotFoundException('Envelope not found');

    // Optionally refresh status from provider
    if (
      envelope.status !== 'COMPLETED' &&
      envelope.status !== 'VOIDED' &&
      !envelope.remoteEnvelopeId.startsWith('mock-')
    ) {
      await this.refreshStatusFromProvider(tenantId, envelope);
    }

    return this.toStatus(
      await this.prisma.eSignEnvelope.findFirst({
        where: { id: envelopeId, tenantId },
      }) ?? envelope,
    );
  }

  async handleWebhook(
    provider: string,
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    this.assertWebhookAuthentic(provider, rawBody, headers);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const remoteId = this.extractRemoteId(provider, payload);
    const status = this.extractStatus(provider, payload);
    const signedUrl = this.extractSignedUrl(provider, payload);

    if (!remoteId || !status) return;

    const envelope = await this.prisma.eSignEnvelope.findFirst({
      where: { remoteEnvelopeId: remoteId },
    });

    if (!envelope) return;

    await this.prisma.eSignEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: status.toUpperCase(),
        ...(status.toLowerCase() === 'completed' && {
          completedAt: new Date(),
          signedDocumentUrl: signedUrl,
        }),
      },
    });

    // Auto-attach signed document to matter when completed
    if (
      status.toLowerCase() === 'completed' &&
      envelope.matterId &&
      signedUrl
    ) {
      await this.attachSignedDocument(envelope.tenantId, envelope.matterId, {
        name: `[Signed] ${envelope.documentName}`,
        url: signedUrl,
        envelopeId: envelope.id,
      });
    }
  }

  async void(
    tenantId: string,
    envelopeId: string,
    reason?: string,
  ): Promise<ESignEnvelopeStatus> {
    const envelope = await this.prisma.eSignEnvelope.findFirst({
      where: { id: envelopeId, tenantId },
    });
    if (!envelope) throw new NotFoundException('Envelope not found');
    if (envelope.status === 'COMPLETED') {
      throw new BadRequestException('Cannot void a completed envelope');
    }

    await this.prisma.eSignEnvelope.update({
      where: { id: envelopeId },
      data: { status: 'VOIDED', voidedReason: reason },
    });

    // Attempt to void on provider side (best-effort)
    if (!envelope.remoteEnvelopeId.startsWith('mock-')) {
      this.voidRemoteEnvelope(tenantId, envelope.provider, envelope.remoteEnvelopeId, reason).catch(
        (err) => this.logger.warn(`Failed to void remote envelope: ${err.message}`),
      );
    }

    return this.getById(tenantId, envelopeId);
  }

  // ─── Provider integration ────────────────────────────────────────────────

  private async createRemoteEnvelope(
    tenantId: string,
    provider: string,
    dto: SendForSignatureDto,
  ): Promise<string> {
    if (provider === 'docusign') {
      return this.createDocuSignEnvelope(tenantId, dto);
    } else if (provider === 'adobe_sign') {
      return this.createAdobeSignEnvelope(tenantId, dto);
    }
    throw new BadRequestException(`Unknown provider: ${provider}`);
  }

  private async createDocuSignEnvelope(
    tenantId: string,
    dto: SendForSignatureDto,
  ): Promise<string> {
    const accessToken = await this.getDocuSignToken(tenantId);
    const accountId = this.config.get<string>('DOCUSIGN_ACCOUNT_ID');
    const baseUrl = this.config.get<string>('DOCUSIGN_BASE_URL', 'https://demo.docusign.net');

    const recipients = dto.signers.map((s, i) => ({
      email: s.email,
      name: s.name,
      recipientId: String(i + 1),
      routingOrder: s.routingOrder ?? i + 1,
    }));

    const envelopeBody = {
      emailSubject: dto.subject,
      emailBlurb: dto.message ?? '',
      documents: [
        {
          documentId: '1',
          name: dto.documentName,
          documentBase64: '',
          remoteUrl: dto.documentUrl,
        },
      ],
      recipients: { signers: recipients },
      status: 'sent',
    };

    const res = await fetch(
      `${baseUrl}/restapi/v2.1/accounts/${accountId}/envelopes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(envelopeBody),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DocuSign API error: ${err}`);
    }

    const data = (await res.json()) as { envelopeId: string };
    return data.envelopeId;
  }

  private async createAdobeSignEnvelope(
    tenantId: string,
    dto: SendForSignatureDto,
  ): Promise<string> {
    const accessToken = await this.getAdobeSignToken(tenantId);
    const baseUrl = this.config.get<string>('ADOBE_SIGN_BASE_URL', 'https://api.na4.adobesign.com');

    const participants = dto.signers.map((s) => ({
      memberInfos: [{ email: s.email, name: s.name }],
      order: s.routingOrder ?? 1,
      role: 'SIGNER',
    }));

    const body = {
      name: dto.subject,
      participantSetsInfo: participants,
      signatureType: 'ESIGN',
      state: 'IN_PROCESS',
      message: dto.message ?? '',
      fileInfos: [
        {
          transientDocumentId: dto.documentId ?? '',
          label: dto.documentName,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/rest/v6/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Adobe Sign API error: ${err}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  private async getDocuSignToken(tenantId: string): Promise<string> {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'docusign', status: 'ACTIVE' },
    });

    const config = connection?.config as Record<string, string> | null;
    if (config?.accessToken) return config.accessToken;

    const envToken = this.config.get<string>('DOCUSIGN_ACCESS_TOKEN');
    if (envToken) return envToken;

    throw new Error('DocuSign not connected — OAuth token not found.');
  }

  private async getAdobeSignToken(tenantId: string): Promise<string> {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'adobe_sign', status: 'ACTIVE' },
    });

    const config = connection?.config as Record<string, string> | null;
    if (config?.accessToken) return config.accessToken;

    const envToken = this.config.get<string>('ADOBE_SIGN_ACCESS_TOKEN');
    if (envToken) return envToken;

    throw new Error('Adobe Sign not connected — OAuth token not found.');
  }

  private async refreshStatusFromProvider(tenantId: string, envelope: { id: string; provider: string; remoteEnvelopeId: string }) {
    try {
      let status: string | undefined;

      if (envelope.provider === 'docusign') {
        const token = await this.getDocuSignToken(tenantId).catch(() => null);
        if (!token) return;
        const accountId = this.config.get<string>('DOCUSIGN_ACCOUNT_ID');
        const baseUrl = this.config.get<string>('DOCUSIGN_BASE_URL', 'https://demo.docusign.net');
        const res = await fetch(
          `${baseUrl}/restapi/v2.1/accounts/${accountId}/envelopes/${envelope.remoteEnvelopeId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = (await res.json()) as { status: string };
          status = data.status.toUpperCase();
        }
      }

      if (status) {
        await this.prisma.eSignEnvelope.update({
          where: { id: envelope.id },
          data: {
            status,
            ...(status === 'COMPLETED' && { completedAt: new Date() }),
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Status refresh failed: ${(err as Error).message}`);
    }
  }

  private async voidRemoteEnvelope(
    tenantId: string,
    provider: string,
    remoteId: string,
    reason?: string,
  ) {
    if (provider === 'docusign') {
      const token = await this.getDocuSignToken(tenantId);
      const accountId = this.config.get<string>('DOCUSIGN_ACCOUNT_ID');
      const baseUrl = this.config.get<string>('DOCUSIGN_BASE_URL', 'https://demo.docusign.net');
      await fetch(
        `${baseUrl}/restapi/v2.1/accounts/${accountId}/envelopes/${remoteId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'voided', voidedReason: reason }),
        },
      );
    }
  }

  private async attachSignedDocument(
    tenantId: string,
    matterId: string,
    doc: { name: string; url: string; envelopeId: string },
  ) {
    try {
      await this.prisma.document.create({
        data: {
          tenantId,
          matterId,
          fileName: doc.name,
          fileUrl: doc.url,
          mimeType: 'application/pdf',
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to attach signed doc: ${(err as Error).message}`);
    }
  }

  // ─── Webhook helpers ─────────────────────────────────────────────────────

  private assertWebhookAuthentic(
    provider: string,
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (provider === 'docusign') {
      const secret = this.config.get<string>('DOCUSIGN_WEBHOOK_SECRET', '');
      const signature = getHeaderValue(headers, 'x-docusign-signature-1');

      if (!secret) {
        if (isProduction) {
          throw new UnauthorizedException('DocuSign webhook secret not configured');
        }
        this.logger.warn(
          'DocuSign webhook accepted without signature verification (dev)',
        );
        return;
      }

      if (!verifyDocuSignWebhookSignature(rawBody, signature, secret)) {
        throw new UnauthorizedException('Invalid DocuSign webhook signature');
      }
      return;
    }

    if (provider === 'adobe_sign') {
      const expectedClientId = this.config.get<string>(
        'ADOBE_SIGN_INTEGRATION_KEY',
        '',
      );
      const clientId = getHeaderValue(headers, 'x-adobesign-clientid');

      if (!expectedClientId) {
        if (isProduction) {
          throw new UnauthorizedException('Adobe Sign integration key not configured');
        }
        this.logger.warn(
          'Adobe Sign webhook accepted without client ID verification (dev)',
        );
        return;
      }

      if (!verifyAdobeSignWebhookClientId(clientId, expectedClientId)) {
        throw new UnauthorizedException('Invalid Adobe Sign webhook client ID');
      }
      return;
    }

    throw new BadRequestException(`Unknown e-sign provider: ${provider}`);
  }

  private extractRemoteId(
    provider: string,
    payload: Record<string, unknown>,
  ): string | null {
    if (provider === 'docusign') {
      const env = payload['envelopeId'] ?? (payload['data'] as Record<string, unknown>)?.['envelopeId'];
      return env ? String(env) : null;
    }
    if (provider === 'adobe_sign') {
      return payload['agreementId'] ? String(payload['agreementId']) : null;
    }
    return null;
  }

  private extractStatus(
    provider: string,
    payload: Record<string, unknown>,
  ): string | null {
    if (provider === 'docusign') {
      const data = payload['data'] as Record<string, unknown> | undefined;
      const status = data?.['envelopeSummary']
        ? (data['envelopeSummary'] as Record<string, unknown>)['status']
        : payload['status'];
      return status ? String(status) : null;
    }
    if (provider === 'adobe_sign') {
      return payload['status'] ? String(payload['status']) : null;
    }
    return null;
  }

  private extractSignedUrl(
    provider: string,
    payload: Record<string, unknown>,
  ): string | null {
    if (provider === 'docusign') {
      const data = payload['data'] as Record<string, unknown> | undefined;
      return data?.['signedDocumentUrl']
        ? String(data['signedDocumentUrl'])
        : null;
    }
    return null;
  }

  // ─── Serializer ──────────────────────────────────────────────────────────

  private toStatus(envelope: Record<string, unknown>): ESignEnvelopeStatus {
    return {
      id: String(envelope['id']),
      remoteEnvelopeId: String(envelope['remoteEnvelopeId']),
      provider: String(envelope['provider']),
      status: String(envelope['status']),
      documentName: String(envelope['documentName']),
      subject: String(envelope['subject']),
      signers: (envelope['signers'] as Signer[]) ?? [],
      sentAt: envelope['sentAt'] as Date | null,
      completedAt: envelope['completedAt'] as Date | null,
      signedDocumentUrl: envelope['signedDocumentUrl'] as string | null,
      matterId: envelope['matterId'] as string | null,
      documentId: envelope['documentId'] as string | null,
    };
  }
}
