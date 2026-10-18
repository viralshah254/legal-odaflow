import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { Public } from '@/common/decorators/public.decorator';

interface MetaWebhookEntry {
  changes?: Array<{
    value?: {
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        errors?: Array<{ code: number; title: string }>;
        timestamp: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
      }>;
    };
  }>;
}

interface MetaWebhookPayload {
  object: string;
  entry?: MetaWebhookEntry[];
}

@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Meta challenge verification — one-time setup */
  @Public()
  @Get()
  challenge(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?? '';
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      this.logger.warn('WhatsApp webhook verification failed');
      res.status(403).send('Forbidden');
    }
  }

  /** Delivery receipts + inbound messages */
  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Body() payload: MetaWebhookPayload) {
    if (payload.object !== 'whatsapp_business_account') return { ok: true };

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        // Handle delivery status updates
        for (const status of value.statuses ?? []) {
          await this.handleStatusUpdate(status);
        }

        // Handle inbound messages (replies / opt-out)
        for (const msg of value.messages ?? []) {
          await this.handleInboundMessage(msg);
        }
      }
    }

    return { ok: true };
  }

  private async handleStatusUpdate(status: {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    errors?: Array<{ code: number; title: string }>;
    timestamp: string;
  }) {
    const waMessageId = status.id;
    const message = await this.prisma.whatsappMessage.findFirst({
      where: { waMessageId },
    });
    if (!message) return;

    const ts = new Date(Number(status.timestamp) * 1000);

    if (status.status === 'delivered') {
      await this.prisma.whatsappMessage.update({
        where: { id: message.id },
        data: { status: 'DELIVERED', deliveredAt: ts },
      });
      await this.prisma.whatsappCampaign.update({
        where: { id: message.campaignId },
        data: { totalDelivered: { increment: 1 } },
      });
    } else if (status.status === 'read') {
      await this.prisma.whatsappMessage.update({
        where: { id: message.id },
        data: { status: 'READ', readAt: ts },
      });
      await this.prisma.whatsappCampaign.update({
        where: { id: message.campaignId },
        data: { totalRead: { increment: 1 } },
      });
    } else if (status.status === 'failed') {
      const errorCode = status.errors?.[0]?.title ?? 'unknown';
      await this.prisma.whatsappMessage.update({
        where: { id: message.id },
        data: { status: 'FAILED', errorCode },
      });
      await this.prisma.whatsappCampaign.update({
        where: { id: message.campaignId },
        data: { totalFailed: { increment: 1 } },
      });
    }
  }

  private async handleInboundMessage(msg: {
    from: string;
    id: string;
    type: string;
    text?: { body: string };
  }) {
    const from = msg.from;
    const body = msg.text?.body?.trim().toUpperCase() ?? '';

    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL'];
    const isOptOut = optOutKeywords.some((kw) => body.includes(kw));

    if (isOptOut) {
      await this.prisma.lawyerProspect.updateMany({
        where: { OR: [{ whatsapp: from }, { whatsapp: `+${from}` }, { phone: from }, { phone: `+${from}` }] },
        data: { outreachStatus: 'DO_NOT_CONTACT' },
      });
      await this.prisma.user.updateMany({
        where: {
          OR: [{ phone: from }, { phone: `+${from}` }],
        },
        data: {
          whatsappMarketingOptIn: false,
          whatsappOptOutAt: new Date(),
        },
      });
      this.logger.log(`Opt-out from ${from}`);
      return;
    }

    // Mark as REPLIED
    await this.prisma.lawyerProspect.updateMany({
      where: { OR: [{ whatsapp: from }, { whatsapp: `+${from}` }] },
      data: { outreachStatus: 'REPLIED' },
    });

    // Also update the WhatsappMessage status
    await this.prisma.whatsappMessage.updateMany({
      where: { to: from, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
      data: { status: 'READ' },
    });

    this.logger.log(`Inbound reply from ${from}: "${msg.text?.body?.slice(0, 50)}"`);
  }
}
