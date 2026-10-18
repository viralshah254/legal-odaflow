import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantPermission } from '@/common/decorators/tenant-permission.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantPermissionGuard } from '@/common/guards/tenant-permission.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { WebhookTestDto } from './dto/webhook-test.dto';
import { PublicApiService } from './public-api.service';
import { WebhooksDeliveryService } from './webhooks-delivery.service';

@Controller('webhooks')
@UseGuards(TenantGuard, TenantPermissionGuard)
@TenantPermission('canManageSettings')
export class WebhooksController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly delivery: WebhooksDeliveryService,
  ) {}

  @Post('test')
  testWebhook(@TenantId() tenantId: string, @Body() dto: WebhookTestDto) {
    return this.publicApiService.testWebhook(tenantId, dto);
  }

  @Get('subscriptions')
  listSubscriptions(@TenantId() tenantId: string) {
    return this.delivery.listSubscriptions(tenantId);
  }

  @Post('subscriptions')
  createSubscription(
    @TenantId() tenantId: string,
    @Body() body: { url: string; secret: string; events: string[] },
  ) {
    return this.delivery.createSubscription(tenantId, body);
  }

  @Post('dispatch')
  dispatch(
    @TenantId() tenantId: string,
    @Body() body: { event: string; payload: Record<string, unknown> },
  ) {
    return this.delivery.dispatch(tenantId, body.event, body.payload ?? {});
  }
}
