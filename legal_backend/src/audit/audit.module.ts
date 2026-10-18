import { Global, Module } from '@nestjs/common';
import { GovernanceModule } from '@/governance/governance.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { SecurityReviewScheduler } from './security-review.scheduler';
import { DataRetentionWorker } from './data-retention.worker';

@Global()
@Module({
  imports: [GovernanceModule],
  controllers: [AuditController],
  providers: [AuditService, SecurityReviewScheduler, DataRetentionWorker],
  exports: [AuditService],
})
export class AuditModule {}
