import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

const RETENTION_DEFAULTS = {
  auditLogs: 7 * 365, // 7 years
  aiLogs: 2 * 365, // 2 years
  notifications: 90, // 90 days
} as const;

@Injectable()
export class DataRetentionWorker {
  private readonly logger = new Logger(DataRetentionWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every Sunday at 2am.
   * Enforces data retention windows for audit logs, AI logs, and notifications.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async enforceRetention() {
    this.logger.log('Data retention: starting weekly cleanup');

    const now = new Date();

    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Purge audit logs older than 7 years (regulatory minimum)
    const auditCutoff = daysAgo(RETENTION_DEFAULTS.auditLogs);
    const auditDeleted = await this.prisma.auditLog
      .deleteMany({ where: { createdAt: { lt: auditCutoff } } })
      .catch(() => ({ count: 0 }));

    // Purge AI usage logs older than 2 years
    const aiCutoff = daysAgo(RETENTION_DEFAULTS.aiLogs);
    const aiDeleted = await this.prisma.aIUsageLog
      .deleteMany({ where: { createdAt: { lt: aiCutoff } } })
      .catch(() => ({ count: 0 }));

    // Purge read notifications older than 90 days
    const notifCutoff = daysAgo(RETENTION_DEFAULTS.notifications);
    const notifDeleted = await this.prisma.notification
      .deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: notifCutoff },
        },
      })
      .catch(() => ({ count: 0 }));

    this.logger.log(
      `Data retention complete: audit=${auditDeleted.count}, aiLogs=${aiDeleted.count}, notifications=${notifDeleted.count}`,
    );
  }
}
