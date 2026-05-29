import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { EvidenceService } from './evidence.service';

@Controller('evidence')
@UseGuards(TenantGuard)
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get('matters/:matterId')
  list(@TenantId() tenantId: string, @Param('matterId') matterId: string) {
    return this.evidence.list(tenantId, matterId);
  }

  @Post('matters/:matterId')
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() body: { title: string; description?: string; documentId?: string },
  ) {
    return this.evidence.create(tenantId, matterId, body, user.id);
  }

  @Post(':evidenceId/access')
  logAccess(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('evidenceId') evidenceId: string,
    @Body() body: { action: string },
  ) {
    return this.evidence.logAccess(tenantId, evidenceId, user.id, body.action ?? 'VIEWED');
  }

  @Get(':evidenceId/custody-report')
  custodyReport(@TenantId() tenantId: string, @Param('evidenceId') evidenceId: string) {
    return this.evidence.exportCustodyReport(tenantId, evidenceId);
  }
}
