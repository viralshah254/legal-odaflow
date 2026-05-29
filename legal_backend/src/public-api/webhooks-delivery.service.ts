import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class WebhooksDeliveryService {
  private readonly logger = new Logger(WebhooksDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async dispatch(tenantId: string, event: string, payload: Record<string, unknown>) {
    const subs = await this.prisma.webhookSubscription.findMany({
      where: { tenantId, isActive: true },
    });

    const matching = subs.filter((sub) => {
      const events = (sub.events as string[]) ?? [];
      return events.includes('*') || events.includes(event);
    });

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

    for (const sub of matching) {
      const signature = createHmac('sha256', sub.secret).update(body).digest('hex');
      try {
        const response = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-OdaFlow-Signature': signature,
            'X-OdaFlow-Event': event,
          },
          body,
        });
        if (!response.ok) {
          this.logger.warn(`Webhook ${sub.id} returned ${response.status}`);
        }
      } catch (err) {
        this.logger.error(`Webhook ${sub.id} failed: ${(err as Error).message}`);
      }
    }

    return { delivered: matching.length, event };
  }

  listSubscriptions(tenantId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSubscription(
    tenantId: string,
    data: { url: string; secret: string; events: string[] },
  ) {
    return this.prisma.webhookSubscription.create({
      data: {
        tenantId,
        url: data.url,
        secret: data.secret,
        events: data.events,
      },
    });
  }
}
