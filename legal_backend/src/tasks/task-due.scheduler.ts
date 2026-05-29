import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TaskDueScheduler {
  private readonly logger = new Logger(TaskDueScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scanDueAndOverdueTasks() {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { not: null, lt: endOfToday },
        assigneeId: { not: null },
        status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
      },
      select: {
        id: true,
        title: true,
        tenantId: true,
        assigneeId: true,
        dueDate: true,
      },
    });

    let sent = 0;
    for (const task of tasks) {
      if (!task.assigneeId || !task.dueDate) {
        continue;
      }

      const overdue = task.dueDate < startOfToday;
      await this.notificationsService.createAndDispatch({
        tenantId: task.tenantId,
        userId: task.assigneeId,
        title: overdue ? 'Task overdue' : 'Task due today',
        body: overdue
          ? `"${task.title}" is overdue. Please update it today.`
          : `"${task.title}" is due today.`,
        type: overdue ? 'TASK_OVERDUE' : 'TASK_DUE',
        metadata: {
          taskId: task.id,
          dueDate: task.dueDate.toISOString(),
          overdue,
        },
      });
      sent += 1;
    }

    this.logger.log(`Task due cron completed: ${sent} notifications sent`);
  }
}
