import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Keeps CalendarEvent rows in sync with Task due dates.
 * Each USER and CLIENT participant gets their own TASK_DEADLINE event.
 * When the due date changes or participants change, events are updated/removed.
 */
@Injectable()
export class TaskCalendarSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncForTask(
    taskId: string,
    tenantId: string,
    title: string,
    dueDate: Date | null | undefined,
    participants: Array<{
      participantType: string;
      userId?: string | null;
      clientId?: string | null;
    }>,
  ) {
    if (!dueDate) {
      // Clear all linked calendar events if due date removed
      await this.prisma.calendarEvent.deleteMany({
        where: { taskId, tenantId },
      });
      return;
    }

    const eventTitle = `📋 ${title}`;
    const eventEnd = new Date(dueDate);
    eventEnd.setHours(eventEnd.getHours() + 1);

    for (const p of participants) {
      if (p.participantType === 'USER' && p.userId) {
        await this.upsertForUser(
          taskId,
          tenantId,
          p.userId,
          eventTitle,
          dueDate,
          eventEnd,
        );
      } else if (p.participantType === 'CLIENT' && p.clientId) {
        await this.upsertForClient(
          taskId,
          tenantId,
          p.clientId,
          eventTitle,
          dueDate,
          eventEnd,
        );
      }
    }

    // Remove events for participants no longer on the task
    const userIds = participants
      .filter((p) => p.participantType === 'USER' && p.userId)
      .map((p) => p.userId!);
    const clientIds = participants
      .filter((p) => p.participantType === 'CLIENT' && p.clientId)
      .map((p) => p.clientId!);

    await this.prisma.calendarEvent.deleteMany({
      where: {
        taskId,
        tenantId,
        OR: [
          {
            userId: { not: null },
            NOT: { userId: { in: userIds.length ? userIds : ['__none__'] } },
          },
          {
            clientId: { not: null },
            NOT: {
              clientId: { in: clientIds.length ? clientIds : ['__none__'] },
            },
          },
        ],
      },
    });
  }

  async removeAllForTask(taskId: string, tenantId: string) {
    await this.prisma.calendarEvent.deleteMany({ where: { taskId, tenantId } });
  }

  private async upsertForUser(
    taskId: string,
    tenantId: string,
    userId: string,
    title: string,
    startAt: Date,
    endAt: Date,
  ) {
    const existing = await this.prisma.calendarEvent.findFirst({
      where: { taskId, tenantId, userId },
    });
    if (existing) {
      await this.prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { title, startAt, endAt },
      });
    } else {
      await this.prisma.calendarEvent.create({
        data: {
          tenantId,
          taskId,
          userId,
          title,
          type: 'TASK_DEADLINE',
          startAt,
          endAt,
        },
      });
    }
  }

  private async upsertForClient(
    taskId: string,
    tenantId: string,
    clientId: string,
    title: string,
    startAt: Date,
    endAt: Date,
  ) {
    const existing = await this.prisma.calendarEvent.findFirst({
      where: { taskId, tenantId, clientId },
    });
    if (existing) {
      await this.prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { title, startAt, endAt },
      });
    } else {
      await this.prisma.calendarEvent.create({
        data: {
          tenantId,
          taskId,
          clientId,
          title,
          type: 'TASK_DEADLINE',
          startAt,
          endAt,
        },
      });
    }
  }
}
