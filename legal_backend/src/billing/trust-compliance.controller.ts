import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TrustComplianceService } from './trust-compliance.service';

@Controller('billing/trust-compliance')
@UseGuards(TenantGuard)
export class TrustComplianceController {
  constructor(private readonly trustComplianceService: TrustComplianceService) {}

  @Get('packs')
  getAllPacks() {
    return this.trustComplianceService.getAllPacks();
  }

  @Get('packs/:countryCode')
  getPack(@Param('countryCode') countryCode: string) {
    return this.trustComplianceService.getPack(countryCode);
  }

  @Get('packs/:countryCode/rules')
  getRulesByCountry(@Param('countryCode') countryCode: string) {
    return this.trustComplianceService.getRulesByCountry(countryCode);
  }

  @Get('reconciliation-status')
  getReconciliationStatus(@TenantId() tenantId: string) {
    return this.trustComplianceService.getReconciliationStatus(tenantId);
  }

  @Post('check/:countryCode')
  runComplianceCheck(
    @TenantId() tenantId: string,
    @Param('countryCode') countryCode: string,
  ) {
    return this.trustComplianceService.runComplianceCheck(tenantId, countryCode);
  }
}
