import { Module, forwardRef } from '@nestjs/common';
import { AutomationsModule } from '@/automations/automations.module';
import { AnonymizationModule } from '@/anonymization/anonymization.module';
import { JobsModule } from '@/jobs/jobs.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { TrainingConsentModule } from '@/training-consent/training-consent.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    JobsModule,
    AutomationsModule,
    TrainingConsentModule,
    AnonymizationModule,
    forwardRef(() => MarketplaceModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
