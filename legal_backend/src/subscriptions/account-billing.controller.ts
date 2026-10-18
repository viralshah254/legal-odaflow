import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { SubscriptionsService } from './subscriptions.service';

@Controller('billing')
@UseGuards(TenantGuard)
export class AccountBillingController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  getCurrent(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
  ) {
    return this.subscriptionsService.getCurrentBilling(user.id, tenantId);
  }

  @Post('portal')
  openPortal(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
  ) {
    return this.subscriptionsService.createBillingPortal(user.id, tenantId);
  }
}
