import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from '@/jobs/jobs.service';
import { PrismaService } from '@/prisma/prisma.service';

/** Database-backed dispatch intent survives Redis/enqueue outages. Delivery is
 * at least once: providers can accept a push before a worker loses its lease. */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService) {}

  async enqueue(notificationId: string): Promise<void> {
    const now = new Date();
    const claimed = await this.prisma.notificationDelivery.updateMany({
      where: { notificationId, status: { in: ['PENDING', 'QUEUING', 'QUEUED'] }, nextAttemptAt: { lte: now }, attempts: { lt: 10 } },
      data: { status: 'QUEUING', nextAttemptAt: new Date(now.getTime() + 120_000), attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) return;
    let queued = false;
    try {
      const result = await this.jobs.enqueueNotificationDispatch({ notificationId, tenantId: notification.tenantId, userId: notification.userId });
      queued = result.status === 'QUEUED';
    } catch (error) {
      this.logger.warn(`Notification enqueue deferred: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
    await this.prisma.notificationDelivery.updateMany({
      where: { notificationId, status: 'QUEUING' },
      data: { status: queued ? 'QUEUED' : 'PENDING', nextAttemptAt: new Date(Date.now() + (queued ? 600_000 : 30_000)), lastErrorClass: queued ? null : 'QUEUE_UNAVAILABLE' },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile(): Promise<void> {
    const now = new Date();
    await this.prisma.notificationDelivery.updateMany({
      where: { status: { in: ['PENDING', 'QUEUING', 'QUEUED'] }, attempts: { gte: 10 }, nextAttemptAt: { lte: now } },
      data: { status: 'FAILED', lastErrorClass: 'DISPATCH_RETRY_EXHAUSTED', completedAt: now },
    });
    const pending = await this.prisma.notificationDelivery.findMany({
      where: { status: { in: ['PENDING', 'QUEUING', 'QUEUED'] }, nextAttemptAt: { lte: now }, attempts: { lt: 10 } },
      orderBy: { nextAttemptAt: 'asc' }, take: 100, select: { notificationId: true },
    });
    for (const row of pending) {
      try { await this.enqueue(row.notificationId); }
      catch (error) { this.logger.warn(`Notification dispatch reconciliation deferred: ${error instanceof Error ? error.name : 'unknown error'}`); }
    }
  }
}
