import { Module } from '@nestjs/common';
import { TrainingConsentModule } from '@/training-consent/training-consent.module';
import { GovernanceController } from './governance.controller';
import { GovernanceSettingsController } from './governance-settings.controller';
import { GovernanceSettingsService } from './governance-settings.service';
import { GovernanceService } from './governance.service';
import { TenantRolePermissionsController } from './tenant-role-permissions.controller';
import { TenantRolePermissionsService } from './tenant-role-permissions.service';

@Module({
  imports: [TrainingConsentModule],
  controllers: [
    GovernanceController,
    GovernanceSettingsController,
    TenantRolePermissionsController,
  ],
  providers: [GovernanceService, GovernanceSettingsService, TenantRolePermissionsService],
  exports: [GovernanceService, GovernanceSettingsService, TenantRolePermissionsService],
})
export class GovernanceModule {}
