import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { MonitorScanScheduler } from './monitor-scan.scheduler';
import { AlertsModule } from '@/alerts/alerts.module';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [AlertsModule, AiModule],
  controllers: [MonitorsController],
  providers: [MonitorsService, MonitorScanScheduler],
  exports: [MonitorsService],
})
export class MonitorsModule {}
