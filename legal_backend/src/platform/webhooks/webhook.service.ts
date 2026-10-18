import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PlatformWebhook } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  type: string;
  tenantId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly DELIVERY_TIMEOUT_MS = 10_000;
  private readonly MAX_FAILURE_COUNT = 10;

  constructor(private readonly prisma: PrismaService) {}

  async createWebhook(
    tenantId: string,
    userId: string,
    dto: { url: string; events: string[]; secret?: string },
  ): Promise<PlatformWebhook> {
    const secret = dto.secret ?? randomBytes(32).toString('hex');
    return this.prisma.platformWebhook.create({
      data: {
        tenantId,
        userId,
        url: dto.url,
        secret,
        events: dto.events,
        status: 'active',
      },
    });
  }

  async listWebhooks(tenantId: string): Promise<PlatformWebhook[]> {
    return this.prisma.platformWebhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteWebhook(id: string, tenantId: string): Promise<void> {
    const hook = await this.prisma.platformWebhook.findFirst({
      where: { id, tenantId },
    });
    if (!hook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    await this.prisma.platformWebhook.delete({ where: { id } });
  }

  async deliver(
    webhook: PlatformWebhook,
    event: DomainEvent,
  ): Promise<{ success: boolean }> {
    const body = {
      id: uuidv4(),
      type: event.type,
      tenantId: event.tenantId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    };

    const bodyStr = JSON.stringify(body);
    const signature = createHmac('sha256', webhook.secret)
      .update(bodyStr)
      .digest('hex');

    try {
      const resp = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event.type,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(this.DELIVERY_TIMEOUT_MS),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      await this.prisma.platformWebhook.update({
        where: { id: webhook.id },
        data: {
          lastDeliveredAt: new Date(),
          failureCount: 0,
          status: 'active',
        },
      });

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook delivery failed for ${webhook.id}: ${message}`);

      const newFailureCount = webhook.failureCount + 1;
      await this.prisma.platformWebhook.update({
        where: { id: webhook.id },
        data: {
          failureCount: newFailureCount,
          status: newFailureCount >= this.MAX_FAILURE_COUNT ? 'error' : webhook.status,
        },
      });

      return { success: false };
    }
  }

  async deliverToAll(event: DomainEvent, tenantId: string): Promise<void> {
    const webhooks = await this.prisma.platformWebhook.findMany({
      where: {
        tenantId,
        status: 'active',
        events: { has: event.type },
      },
    });

    await Promise.allSettled(webhooks.map((hook) => this.deliver(hook, event)));

    this.logger.log(
      `Delivered event ${event.type} to ${webhooks.length} webhook(s) for tenant ${tenantId}`,
    );
  }
}
