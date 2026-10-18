import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';

/**
 * Monitors contract obligations that are approaching their due dates
 * and sends notifications via the notification queue.
 *
 * Designed to be triggered by:
 * 1. OBLIGATION_CHECK queue worker (cron-driven)
 * 2. Event-driven triggers (e.g., new obligation created)
 */
@Injectable()
export class ObligationMonitorService {
  private readonly logger = new Logger(ObligationMonitorService.name);

  /** Warning windows in days before obligation due date */
  private readonly WARNING_WINDOWS = [1, 3, 7, 14, 30];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Check all active obligations across all tenants for upcoming due dates.
   * Called by the obligation check cron worker.
   */
  async checkAllTenants(): Promise<{ checked: number; notified: number }> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    }).catch(() => []);

    let checked = 0;
    let notified = 0;

    for (const tenant of tenants) {
      const result = await this.checkTenant(tenant.id);
      checked += result.checked;
      notified += result.notified;
    }

    return { checked, notified };
  }

  /**
   * Check obligations for a specific tenant.
   */
  async checkTenant(tenantId: string): Promise<{ checked: number; notified: number }> {
    const now = new Date();
    const maxWindow = new Date(now);
    maxWindow.setDate(maxWindow.getDate() + 30);

    // ContractObligation relates to ContractEntity via contractId.
    // Load obligations with their parent contract for title/matterId context.
    const obligations = await this.prisma.contractObligation.findMany({
      where: {
        tenantId,
        status: 'active',
        dueDate: { not: null, lte: maxWindow },
      },
      include: {
        contract: {
          select: {
            title: true,
            matterId: true,
          },
        },
      },
    });

    let notified = 0;

    for (const obligation of obligations) {
      if (!obligation.dueDate) continue;

      const daysUntilDue = Math.ceil(
        (obligation.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilDue < 0) {
        // Past due — mark as overdue
        await this.prisma.contractObligation.update({
          where: { id: obligation.id },
          data: { status: 'overdue' },
        }).catch(() => {});
        continue;
      }

      // Only notify at specific warning windows
      const matchingWindow = this.WARNING_WINDOWS.find(
        (w) => Math.abs(daysUntilDue - w) <= 0.5,
      );

      if (!matchingWindow) continue;

      // Check if we already sent this notification
      const alreadyNotified = await this.prisma.notification.findFirst({
        where: {
          tenantId,
          metadata: {
            path: ['obligationId'],
            equals: obligation.id,
          },
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }).catch(() => null);

      if (alreadyNotified) continue;

      // Use tenantId as fallback userId since ContractObligation has no userId.
      const userId = tenantId;
      const contractTitle = obligation.contract?.title ?? 'Contract';

      // Create notification record
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          tenantId,
          type: 'OBLIGATION_DUE',
          title: `Obligation due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
          body: `"${obligation.title}" from "${contractTitle}" is due on ${obligation.dueDate.toLocaleDateString()}`,
          isRead: false,
          metadata: {
            obligationId: obligation.id,
            contractId: obligation.contractId,
            dueDate: obligation.dueDate.toISOString(),
            daysUntilDue,
            obligationType: obligation.obligationType,
          } as any,
        },
      });

      // Dispatch via FCM/email
      await this.jobsService.enqueueNotificationDispatch({
        userId,
        tenantId,
        notificationId: notification.id,
        jobType: 'OBLIGATION_DUE',
      }).catch(() => {});

      notified++;
      this.logger.log(
        `Obligation reminder sent: "${obligation.title}" due in ${daysUntilDue} days`,
      );
    }

    return { checked: obligations.length, notified };
  }

  /**
   * Monitor a specific contract's obligations.
   */
  async checkContract(contractId: string, tenantId: string): Promise<{
    overdueCount: number;
    upcomingCount: number;
    notifiedCount: number;
  }> {
    const now = new Date();
    const maxWindow = new Date(now);
    maxWindow.setDate(maxWindow.getDate() + 30);

    const obligations = await this.prisma.contractObligation.findMany({
      where: { contractId, tenantId, status: { in: ['active', 'overdue'] } },
    });

    let overdueCount = 0;
    let upcomingCount = 0;
    const notifiedCount = 0;

    for (const obligation of obligations) {
      if (!obligation.dueDate) continue;

      const daysUntilDue = Math.ceil(
        (obligation.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilDue < 0) {
        overdueCount++;
        await this.prisma.contractObligation.update({
          where: { id: obligation.id },
          data: { status: 'overdue' },
        }).catch(() => {});
      } else if (obligation.dueDate <= maxWindow) {
        upcomingCount++;
      }
    }

    return { overdueCount, upcomingCount, notifiedCount };
  }
}
