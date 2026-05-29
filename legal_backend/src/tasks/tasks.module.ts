import { Module, forwardRef } from '@nestjs/common';
import { AutomationsModule } from '@/automations/automations.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TaskDueScheduler } from './task-due.scheduler';
import { TasksService } from './tasks.service';

@Module({
  imports: [NotificationsModule, forwardRef(() => AutomationsModule)],
  controllers: [TasksController],
  providers: [TasksService, TaskDueScheduler],
  exports: [TasksService],
})
export class TasksModule {}
