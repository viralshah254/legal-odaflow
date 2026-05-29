import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { UpdateGovernancePoliciesDto } from './dto/governance.dto';
import { GovernanceService } from './governance.service';

@Controller('tenants/:tenantId/governance/policies')
@UseGuards(TenantGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get()
  getPolicies(@Param('tenantId') tenantId: string) {
    return this.governanceService.getPolicies(tenantId);
  }

  @Patch()
  updatePolicies(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateGovernancePoliciesDto,
  ) {
    return this.governanceService.updatePolicies(tenantId, dto);
  }
}
