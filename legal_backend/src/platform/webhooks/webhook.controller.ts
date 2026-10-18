import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly svc: WebhookService) {}

  @Post()
  createWebhook(
    @Body() body: { tenantId: string; userId: string; url: string; events: string[]; secret?: string },
  ) {
    return this.svc.createWebhook(body.tenantId, body.userId, {
      url: body.url,
      events: body.events,
      secret: body.secret,
    });
  }

  @Get()
  listWebhooks(@Query('tenantId') tenantId: string) {
    return this.svc.listWebhooks(tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWebhook(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.svc.deleteWebhook(id, tenantId);
  }
}
