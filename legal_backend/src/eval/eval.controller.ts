import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { EvalService } from './eval.service';
import { AccuracyReportService } from './accuracy-report.service';

@Controller('eval')
@UseGuards(TenantGuard, RolesGuard)
@Roles('FIRM_ADMIN', 'PARTNER')
export class EvalController {
  constructor(
    private readonly evalService: EvalService,
    private readonly accuracyReport: AccuracyReportService,
  ) {}

  @Post('run')
  runSuite() {
    return this.evalService.runSuite();
  }

  @Get('accuracy-report')
  getAccuracyReport() {
    return this.accuracyReport.buildAdminReport();
  }

  @Get('public-summary')
  getPublicSummary() {
    return this.accuracyReport.buildPublicSummary();
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
