import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
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
        status: dto.status ?? 'TODO',
        priority: dto.priority ?? 'MEDIUM',
        dueDate: dto.dueDate,
        assigneeId: dto.assigneeId,
      },
      include: { matter: true },
    });

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

    return task;
  }

  async findAll(tenantId: string, matterId?: string, status?: string) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        status: status || undefined,
      },
      include: { matter: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: { matter: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(tenantId: string, taskId: string, dto: UpdateTaskDto) {
    await this.findOne(tenantId, taskId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: dto,
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TASK_UPDATED, {
      entityId: taskId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, taskId);

    return updated;
  }

  async remove(tenantId: string, taskId: string) {
    await this.findOne(tenantId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TASK_DELETED, {
      entityId: taskId,
      action: 'deleted',
    });
    this.realtime.publishDashboardRefresh(tenantId, taskId);
    return { success: true };
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
