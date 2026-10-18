import { Module } from '@nestjs/common';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSyncScheduler } from './integration-sync.scheduler';
import { IntegrationSyncService } from './integration-sync.service';
import { IntegrationsService } from './integrations.service';
import { OfficeModule } from './office/office.module';

@Module({
  imports: [CountryComplianceModule, OfficeModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationSyncService, IntegrationSyncScheduler],
  exports: [IntegrationsService, IntegrationSyncService, OfficeModule],
})
export class IntegrationsModule {}
