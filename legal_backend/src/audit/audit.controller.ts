import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(TenantGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  findLogs(
    @TenantId() tenantId: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.findLogs({
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
