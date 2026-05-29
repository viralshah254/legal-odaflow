import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { WebhookTestDto } from './dto/webhook-test.dto';
import { PublicApiService } from './public-api.service';
import { WebhooksDeliveryService } from './webhooks-delivery.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly delivery: WebhooksDeliveryService,
  ) {}

  @Public()
  @Post('test')
  testWebhook(@Body() dto: WebhookTestDto) {
    return this.publicApiService.testWebhook(dto);
  }

  @Get('subscriptions')
  @UseGuards(TenantGuard)
  listSubscriptions(@TenantId() tenantId: string) {
    return this.delivery.listSubscriptions(tenantId);
  }

  @Post('subscriptions')
  @UseGuards(TenantGuard)
  createSubscription(
    @TenantId() tenantId: string,
    @Body() body: { url: string; secret: string; events: string[] },
  ) {
    return this.delivery.createSubscription(tenantId, body);
  }

  @Post('dispatch')
  @UseGuards(TenantGuard)
  dispatch(
    @TenantId() tenantId: string,
    @Body() body: { event: string; payload: Record<string, unknown> },
  ) {
    return this.delivery.dispatch(tenantId, body.event, body.payload ?? {});
  }
}
