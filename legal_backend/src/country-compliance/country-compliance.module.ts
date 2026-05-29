import { Module } from '@nestjs/common';
import { ComplianceAliasController } from './compliance-alias.controller';
import { CountryComplianceController } from './country-compliance.controller';
import { CountryComplianceService } from './country-compliance.service';

@Module({
  controllers: [CountryComplianceController, ComplianceAliasController],
  providers: [CountryComplianceService],
  exports: [CountryComplianceService],
})
export class CountryComplianceModule {}
