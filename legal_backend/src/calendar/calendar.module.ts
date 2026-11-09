import { NotificationsModule } from '@/notifications/notifications.module';
import { CalendarReminderScheduler } from './calendar-reminder.scheduler';
import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarReminderScheduler],
  exports: [CalendarService],
})
export class CalendarModule {}
