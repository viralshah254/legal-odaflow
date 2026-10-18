import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { resolveRequestLocale } from '@/config/locales';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { ConsumerReportsService } from './consumer-reports.service';
import { UsersService } from '@/users/users.service';

@Controller('consumer-reports')
export class ConsumerReportsController {
  constructor(
    private readonly consumerReportsService: ConsumerReportsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('cases/:caseId/sections/costs')
  getSectionCosts(@Param('caseId') _caseId: string) {
    return this.consumerReportsService.getSectionCreditCosts();
  }

  @Post('cases/:caseId/sections')
  async generateReportSection(
    @CurrentUser() user: RequestUser,
    @Param('caseId') caseId: string,
    @Body() body: { sectionTitle: string },
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.consumerReportsService.generateReportSection(
      user.id,
      caseId,
      body.sectionTitle,
      resolveRequestLocale(acceptLanguage, preferredLocale),
    );
  }

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
