import { Injectable } from '@nestjs/common';
import { WebhookTestDto } from './dto/webhook-test.dto';

@Injectable()
export class PublicApiService {
  getHealth() {
    return {
      status: 'ok',
      service: 'legal-public-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  testWebhook(dto: WebhookTestDto) {
    const event = dto.event ?? 'test.event';

    return {
      received: true,
      event,
      payload: dto.payload ?? {},
      message: 'Webhook test accepted — use POST /webhooks/subscriptions for live delivery.',
      processedAt: new Date().toISOString(),
    };
  }
}
