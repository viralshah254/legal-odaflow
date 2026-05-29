import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('reports/firm')
  getFirmReport(@TenantId() tenantId: string) {
    return this.analyticsService.getFirmReport(tenantId);
  }

  @Get('queues/work')
  getWorkQueues(@TenantId() tenantId: string) {
    return this.analyticsService.getWorkQueues(tenantId);
  }
}
