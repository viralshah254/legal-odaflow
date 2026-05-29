import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { ConsumerReportsService } from './consumer-reports.service';

@Controller('consumer-reports')
export class ConsumerReportsController {
  constructor(private readonly consumerReportsService: ConsumerReportsService) {}

  @Post('cases/:caseId/full')
  generateFullReport(
    @CurrentUser() user: RequestUser,
    @Param('caseId') caseId: string,
  ) {
    return this.consumerReportsService.generateFullReport(user.id, caseId);
  }

  @Get('lawyer-review-queue')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('FIRM_ADMIN', 'PARTNER', 'PARTNER_ADMIN', 'JUNIOR_PARTNER', 'ASSOCIATE')
  listLawyerReviewQueue(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
  ) {
    return this.consumerReportsService.listLawyerReviewQueue(tenantId, user.id);
  }
}

/** Legacy path alias for consumer case full reports. */
@Controller('consumer-cases')
export class ConsumerCasesReportsController {
  constructor(private readonly consumerReportsService: ConsumerReportsService) {}

  @Post(':caseId/reports/full')
  generateFullReportLegacy(
    @CurrentUser() user: RequestUser,
    @Param('caseId') caseId: string,
  ) {
    return this.consumerReportsService.generateFullReport(user.id, caseId);
  }
}
