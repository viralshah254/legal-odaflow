import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/notifications/notifications.service';

@Injectable()
export class CalendarReminderScheduler {
  private readonly logger = new Logger(CalendarReminderScheduler.name);
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async deliverDue(): Promise<void> {
    const now = new Date();
    const events = await this.prisma.calendarEvent.findMany({
      where: { reminderAt: { lte: now }, startAt: { gte: new Date(now.getTime() - 86_400_000) }, userId: { not: null } },
      orderBy: { reminderAt: 'asc' }, take: 100,
    });
    for (const event of events) {
      try {
        await this.notifications.createAndDispatch({
          tenantId: event.tenantId, userId: event.userId!, title: event.startAt > now ? 'Upcoming calendar event' : 'Calendar event started',
          body: `${event.title} starts at ${event.startAt.toISOString()}.`, type: 'CALENDAR_REMINDER',
          idempotencyKey: `calendar-${event.id}-${event.startAt.toISOString()}`,
          metadata: { calendarEventId: event.id, expectedStartAt: event.startAt.toISOString(), ...(event.matterId ? { matterId: event.matterId } : {}), link: '/app/calendar' },
        });
      } catch (error) {
        if (!(error instanceof ForbiddenException)) {
          this.logger.warn(`Calendar reminder deferred: ${error instanceof Error ? error.name : 'unknown error'}`);
          continue;
        }
      }
      // Compare the source version: a concurrent reschedule must retain its new reminder.
      await this.prisma.calendarEvent.updateMany({
        where: { id: event.id, startAt: event.startAt, reminderAt: event.reminderAt }, data: { reminderAt: null },
      });
    }
  }
}
