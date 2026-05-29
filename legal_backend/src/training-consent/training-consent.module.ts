import { Module } from '@nestjs/common';
import { DocumentTrainingPermissionService } from './document-training-permission.service';
import { TrainingConsentController } from './training-consent.controller';
import { TrainingConsentService } from './training-consent.service';

export { DEFAULT_TRAINING_CONSENT_STATUS } from './training-consent.constants';

@Module({
  controllers: [TrainingConsentController],
  providers: [TrainingConsentService, DocumentTrainingPermissionService],
  exports: [TrainingConsentService, DocumentTrainingPermissionService],
})
export class TrainingConsentModule {}
