import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { MeCountsService } from './me-counts.service';

@Controller('me')
@UseGuards(TenantGuard)
export class MeCountsController {
  constructor(private readonly meCountsService: MeCountsService) {}

  /** Aggregate counts for sidebar badges and the dashboard. */
  @Get('counts')
  getCounts(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.meCountsService.getCounts(tenantId, user.id);
  }
}
