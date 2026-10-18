import { Injectable } from '@nestjs/common';
import { WebhookTestDto } from './dto/webhook-test.dto';
import { WebhooksDeliveryService } from './webhooks-delivery.service';

@Injectable()
export class PublicApiService {
  constructor(private readonly webhooksDelivery: WebhooksDeliveryService) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'legal-public-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  async testWebhook(tenantId: string, dto: WebhookTestDto) {
    const event = dto.event ?? 'test.event';
    const payload = dto.payload ?? { test: true, source: 'webhook-test' };

    const delivery = await this.webhooksDelivery.dispatch(
      tenantId,
      event,
      payload,
    );

    return {
      received: true,
      event,
      payload,
      delivery,
      processedAt: new Date().toISOString(),
    };
  }
}
