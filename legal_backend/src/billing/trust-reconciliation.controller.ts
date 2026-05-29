import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { TrustReconciliationService } from './trust-reconciliation.service';

@Controller('billing/trust/reconciliation')
@UseGuards(TenantGuard)
export class TrustReconciliationController {
  constructor(private readonly reconciliation: TrustReconciliationService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('accountId') accountId?: string) {
    return this.reconciliation.list(tenantId, accountId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: { accountId: string; periodStart: string; periodEnd: string },
  ) {
    return this.reconciliation.create(
      tenantId,
      body.accountId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
      user.id,
    );
  }

  @Patch(':id/close')
  close(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.reconciliation.close(tenantId, id, user.id, body.notes);
  }
}
