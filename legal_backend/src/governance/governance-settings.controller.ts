import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  GovernanceSettings,
  GovernanceSettingsService,
} from './governance-settings.service';

@Controller('governance/settings')
@UseGuards(TenantGuard)
export class GovernanceSettingsController {
  constructor(private readonly governanceSettingsService: GovernanceSettingsService) {}

  @Get()
  getSettings(@TenantId() tenantId: string): Promise<GovernanceSettings> {
    return this.governanceSettingsService.getSettings(tenantId);
  }

  @Patch()
  updateSettings(
    @TenantId() tenantId: string,
    @Body() patch: Partial<GovernanceSettings>,
    @CurrentUser() user: RequestUser,
  ): Promise<GovernanceSettings> {
    return this.governanceSettingsService.updateSettings(tenantId, patch, user.id);
  }
}
