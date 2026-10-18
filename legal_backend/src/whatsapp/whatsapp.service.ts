import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsappTemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters: Array<{ type: 'text'; text: string }>;
  sub_type?: string;
  index?: number;
}

export interface SendTemplateResult {
  waMessageId: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly phoneNumberId: string;
  private readonly apiToken: string;
  private readonly apiBase = 'https://graph.facebook.com/v19.0';

  constructor(private readonly config: ConfigService) {
    this.phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.apiToken = this.config.getOrThrow<string>('WHATSAPP_API_TOKEN');
  }

  async sendTemplate(
    to: string,
    templateName: string,
    components: WhatsappTemplateComponent[],
    languageCode = 'en',
  ): Promise<SendTemplateResult> {
    const url = `${this.apiBase}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Meta API error sending template to ${to}: ${errText}`);
      throw new Error(`Meta WhatsApp API error: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    const waMessageId = data.messages?.[0]?.id;
    if (!waMessageId) {
      throw new Error('Meta API returned no message ID');
    }
    return { waMessageId };
  }

  async sendText(to: string, text: string): Promise<SendTemplateResult> {
    const url = `${this.apiBase}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Meta API error sending text to ${to}: ${errText}`);
      throw new Error(`Meta WhatsApp API error: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    const waMessageId = data.messages?.[0]?.id;
    if (!waMessageId) {
      throw new Error('Meta API returned no message ID');
    }
    return { waMessageId };
  }
}
