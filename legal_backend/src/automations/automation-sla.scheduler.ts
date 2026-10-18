import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { retryDb } from '@/common/utils/retry-db';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AutomationSlaScheduler {
  private readonly logger = new Logger(AutomationSlaScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSlaBreaches() {
    try {
      await this.runSlaCheck();
    } catch (err) {
      this.logger.error(
        'Automation SLA cron failed',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async runSlaCheck() {
    const now = new Date();
    const activeRuns = await retryDb(() =>
      this.prisma.automationRun.findMany({
        where: {
          status: { in: ['QUEUED', 'RUNNING', 'PENDING'] },
          completedAt: null,
        },
        include: { rule: true },
      }),
    );

    let breached = 0;

    for (const run of activeRuns) {
      if (!run.rule.slaMinutes) {
        continue;
      }

      const result =
        run.result && typeof run.result === 'object' && !Array.isArray(run.result)
          ? (run.result as Record<string, unknown>)
          : {};

      if (result.slaBreached === true) {
        continue;
      }

      const deadlineRaw = result.slaDeadline;
      const deadline =
        typeof deadlineRaw === 'string' ? new Date(deadlineRaw) : null;

      if (!deadline || deadline > now) {
        continue;
      }

      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          result: {
            ...result,
            slaBreached: true,
            breachedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      const admin = await this.prisma.tenantUser.findFirst({
        where: {
          tenantId: run.tenantId,
          status: 'ACTIVE',
          role: { in: ['FIRM_ADMIN', 'PARTNER'] },
        },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      });

      if (admin?.userId) {
        await this.notificationsService.createAndDispatch({
          tenantId: run.tenantId,
          userId: admin.userId,
          title: 'Automation SLA breached',
          body: `Rule "${run.rule.name}" exceeded its ${run.rule.slaMinutes} minute SLA.`,
          type: 'AUTOMATION_SLA',
          metadata: {
            runId: run.id,
            ruleId: run.ruleId,
            slaMinutes: run.rule.slaMinutes,
          } as Prisma.InputJsonValue,
        });
      }

      breached += 1;
    }

    if (breached > 0) {
      this.logger.warn(`Automation SLA cron: ${breached} breach(es) detected`);
    }
  }
}
