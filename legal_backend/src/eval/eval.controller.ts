import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { EvalService } from './eval.service';

@Controller('eval')
@UseGuards(RolesGuard)
@Roles('FIRM_ADMIN', 'PARTNER')
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  @Post('run')
  runSuite() {
    return this.evalService.runSuite();
  }

  @Get('runs')
  listRuns() {
    return this.evalService.listRuns();
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.evalService.getRun(runId) ?? { error: 'Run not found' };
  }
}
