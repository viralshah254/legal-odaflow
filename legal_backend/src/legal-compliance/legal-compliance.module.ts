import { Module } from '@nestjs/common';
import { DisclaimerService } from './disclaimer.service';

@Module({
  providers: [DisclaimerService],
  exports: [DisclaimerService],
})
export class LegalComplianceModule {}
