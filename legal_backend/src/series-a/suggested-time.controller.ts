import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { SuggestedTimeService } from './suggested-time.service';

@Controller('time/suggestions')
@UseGuards(TenantGuard)
export class SuggestedTimeController {
  constructor(private readonly suggestions: SuggestedTimeService) {}

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.suggestions.listPending(tenantId, user.id);
  }

  @Post()
  suggest(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      matterId?: string;
      source: string;
      minutes: number;
      narrative?: string;
    },
  ) {
    return this.suggestions.suggest(tenantId, user.id, body);
  }

  @Patch(':id/accept')
  accept(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.suggestions.accept(tenantId, user.id, id);
  }

  @Patch(':id/dismiss')
  dismiss(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.suggestions.dismiss(tenantId, user.id, id);
  }
}
