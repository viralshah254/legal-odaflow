import { Module } from '@nestjs/common';
import { JobsModule } from '@/jobs/jobs.module';
import { AnonymizationController } from './anonymization.controller';
import { AnonymizationService } from './anonymization.service';

@Module({
  imports: [JobsModule],
  controllers: [AnonymizationController],
  providers: [AnonymizationService],
  exports: [AnonymizationService],
})
export class AnonymizationModule {}
