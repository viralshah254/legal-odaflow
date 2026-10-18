import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { MatterAnalysisSnapshotService } from './matter-analysis-snapshot.service';

@Controller('matters/:matterId/analysis')
@UseGuards(TenantGuard)
export class MatterAnalysisSnapshotController {
  constructor(private readonly snapshots: MatterAnalysisSnapshotService) {}

  @Post('run')
  run(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() body: { scope?: 'full' | 'incremental' },
  ) {
    return this.snapshots.run(
      tenantId,
      matterId,
      user.id,
      body.scope === 'incremental' ? 'incremental' : 'full',
    );
  }

  @Get('latest')
  latest(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.snapshots.latest(tenantId, matterId);
  }
}
