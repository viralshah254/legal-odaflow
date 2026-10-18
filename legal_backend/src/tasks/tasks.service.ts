import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { TaskCalendarSyncService } from './task-calendar-sync.service';
import { CreateTaskDto, TaskParticipantDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddTaskCommentDto } from './dto/add-comment.dto';

const TASK_INCLUDE = {
  matter: true,
  participants: true,
  comments: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    private readonly notificationsService: NotificationsService,
    private readonly calendarSync: TaskCalendarSyncService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async create(tenantId: string, dto: CreateTaskDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const task = await this.prisma.task.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        status: dto.status ?? 'TODO',
        priority: dto.priority ?? 'MEDIUM',
        dueDate: dto.dueDate,
        assigneeId: dto.assigneeId,
      },
      include: TASK_INCLUDE,
    });

    // Sync participants
    const participants = await this.syncParticipants(tenantId, task.id, dto.participants ?? [], dto.assigneeId);

    // Calendar sync
    await this.calendarSync.syncForTask(task.id, tenantId, task.title, task.dueDate ?? null, participants);

    // Notify all participants
    await this.notifyParticipants(tenantId, task.id, task.title, participants, 'TASK_ASSIGNED', 'assigned to');

    await this.automationEngine.dispatch(tenantId, 'task.created', {
      taskId: task.id,
      taskTitle: task.title,
      matterId: task.matterId,
      assigneeId: task.assigneeId,
      userId: task.assigneeId,
      priority: task.priority,
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TASK_CREATED, {
      entityId: task.id,
      action: 'created',
      data: { title: task.title, matterId: task.matterId },
    });
    this.realtime.publishDashboardRefresh(tenantId, task.id);

    return this.findOne(tenantId, task.id);
  }

  async findAll(tenantId: string, matterId?: string, status?: string, userId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (matterId) where.matterId = matterId;
    if (status) where.status = status;

    if (userId) {
      // Show tasks where user is primary assignee OR a participant
      (where as any).OR = [
        { assigneeId: userId },
        { participants: { some: { userId } } },
      ];
    }

    return this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(tenantId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.findOne(tenantId, taskId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const { participants: dtoParticipants, ...taskFields } = dto;

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: taskFields,
      include: TASK_INCLUDE,
    });

    // Sync participants if provided
    let participants = existing.participants;
    if (dtoParticipants !== undefined) {
      participants = await this.syncParticipants(tenantId, taskId, dtoParticipants, updated.assigneeId ?? undefined);
    }

    // Re-sync calendar whenever due date or participants change
    if (dto.dueDate !== undefined || dtoParticipants !== undefined) {
      const allParticipants = await this.prisma.taskParticipant.findMany({
        where: { taskId, tenantId },
      });
      await this.calendarSync.syncForTask(
        taskId,
        tenantId,
        updated.title,
        updated.dueDate ?? null,
        allParticipants,
      );
    }

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TASK_UPDATED, {
      entityId: taskId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, taskId);

    return this.findOne(tenantId, taskId);
  }

  async remove(tenantId: string, taskId: string) {
    await this.findOne(tenantId, taskId);
    await this.calendarSync.removeAllForTask(taskId, tenantId);
    await this.prisma.task.delete({ where: { id: taskId } });
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TASK_DELETED, {
      entityId: taskId,
      action: 'deleted',
    });
    this.realtime.publishDashboardRefresh(tenantId, taskId);
    return { success: true };
  }

  async addComment(tenantId: string, taskId: string, authorUserId: string, dto: AddTaskCommentDto) {
    await this.findOne(tenantId, taskId);
    const comment = await this.prisma.taskComment.create({
      data: {
        tenantId,
        taskId,
        body: dto.body,
        authorUserId,
      },
    });
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TASK_UPDATED, {
      entityId: taskId,
      action: 'comment_added',
    });
    return comment;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async syncParticipants(
    tenantId: string,
    taskId: string,
    incoming: TaskParticipantDto[],
    assigneeId?: string,
  ) {
    // Always ensure primary assignee is in participants as ASSIGNEE
    const all: TaskParticipantDto[] = [...incoming];
    if (
      assigneeId &&
      !all.some((p) => p.participantType === 'USER' && p.userId === assigneeId)
    ) {
      all.unshift({ participantType: 'USER', userId: assigneeId, role: 'ASSIGNEE' });
    }

    // Delete all existing participants and re-insert
    await this.prisma.taskParticipant.deleteMany({ where: { taskId } });

    if (all.length === 0) return [];

    const data = all
      .filter((p) => p.userId || p.clientId)
      .map((p) => ({
        id: `${taskId}_${p.userId ?? p.clientId}`,
        tenantId,
        taskId,
        participantType: p.participantType as 'USER' | 'CLIENT',
        userId: p.userId ?? null,
        clientId: p.clientId ?? null,
        role: p.role,
      }));

    await this.prisma.taskParticipant.createMany({ data, skipDuplicates: true });
    return data;
  }

  private async notifyParticipants(
    tenantId: string,
    taskId: string,
    taskTitle: string,
    participants: Array<{ userId?: string | null; participantType: string }>,
    type: string,
    verb: string,
  ) {
    const userIds = participants
      .filter((p) => p.participantType === 'USER' && p.userId)
      .map((p) => p.userId!);

    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.createAndDispatch({
          tenantId,
          userId,
          title: `Task ${verb}: ${taskTitle}`,
          body: `You have been ${verb} a task: "${taskTitle}"`,
          type,
          metadata: {
            taskId,
            link: `/app/tasks?highlight=${taskId}`,
          },
        }),
      ),
    );
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
  }
}
