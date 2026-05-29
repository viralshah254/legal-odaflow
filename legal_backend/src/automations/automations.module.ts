import { Module, forwardRef } from '@nestjs/common';
import { JobsModule } from '@/jobs/jobs.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { AutomationsController } from './automations.controller';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationsService } from './automations.service';

@Module({
  imports: [JobsModule, NotificationsModule],
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationEngineService],
  exports: [AutomationsService, AutomationEngineService],
})
export class AutomationsModule {}
