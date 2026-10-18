import { Module } from '@nestjs/common';
import { GovernanceModule } from '@/governance/governance.module';
import { JobsModule } from '@/jobs/jobs.module';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';

@Module({
  imports: [JobsModule, GovernanceModule],
  controllers: [MigrationController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
