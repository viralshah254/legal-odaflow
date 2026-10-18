import { Module } from '@nestjs/common';
import { ComplianceAliasController } from './compliance-alias.controller';
import { CountryComplianceController } from './country-compliance.controller';
import { CountryComplianceService } from './country-compliance.service';
import { PrivacyControlsService } from './privacy-controls.service';

@Module({
  controllers: [CountryComplianceController, ComplianceAliasController],
  providers: [CountryComplianceService, PrivacyControlsService],
  exports: [CountryComplianceService, PrivacyControlsService],
})
export class CountryComplianceModule {}
