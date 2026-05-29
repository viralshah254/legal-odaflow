import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { MatterOutcomeService } from './matter-outcome.service';

@Controller('matters/:matterId/outcome')
@UseGuards(TenantGuard)
export class MatterOutcomeV2Controller {
  constructor(private readonly matterOutcomeService: MatterOutcomeService) {}

  @Get('benchmarks')
  getFirmBenchmarks(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('practiceArea') practiceArea?: string,
    @Query('countryCode') countryCode?: string,
  ) {
    return this.matterOutcomeService.getFirmBenchmarks(
      tenantId,
      user.id,
      user.tenantRole,
      { practiceArea, countryCode },
    );
  }

  @Post('solutions/:index/create-task')
  createTaskFromSolution(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: RequestUser,
    @Query('analysisId') analysisId?: string,
  ) {
    return this.matterOutcomeService.createTaskFromLatestSolution(
      tenantId,
      matterId,
      index,
      user.id,
      user.tenantRole,
      analysisId,
    );
  }
}
