import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthDetailGuard } from './health-detail.guard';
import { HealthService } from './health.service';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';

@Module({
  imports: [LegalSourcesModule],
  controllers: [HealthController],
  providers: [HealthService, HealthDetailGuard],
})
export class HealthModule {}
