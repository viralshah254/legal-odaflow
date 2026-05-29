import { ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';

interface PlaybookTaskTemplate {
  title: string;
  priority?: string;
  dueInDays?: number;
  status?: string;
  assigneeId?: string;
}

@Injectable()
export class MattersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async create(tenantId: string, dto: CreateMatterDto, createdByUserId?: string) {
    if (dto.clientId) {
      await this.ensureClientBelongsToTenant(tenantId, dto.clientId);
    }

    const matter = await this.prisma.matter.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        title: dto.title,
        countryCode: dto.countryCode.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        courtName: dto.courtName,
        courtLevel: dto.courtLevel,
        caseNumber: dto.caseNumber,
        practiceArea: dto.practiceArea,
        matterType: dto.matterType,
        factsSummary: dto.factsSummary,
        desiredOutcome: dto.desiredOutcome,
        opposingParty: dto.opposingParty,
        status: 'OPEN',
      },
      include: { client: true },
    });

    const { taskCount: autoTaskCount, playbookName } = await this.createPlaybookTasks(
      tenantId,
      matter.id,
      dto,
      createdByUserId,
    );

    let result = matter;
    if (playbookName) {
      result = await this.prisma.matter.update({
        where: { id: matter.id },
        data: { stage: 'Intake' },
        include: { client: true },
      });
    }

    await this.automationEngine.dispatch(tenantId, 'matter.created', {
      matterId: matter.id,
      matterTitle: matter.title,
      matterType: matter.matterType,
      clientId: matter.clientId,
      userId: createdByUserId,
      autoTaskCount,
      playbookName,
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.MATTER_CREATED, {
      entityId: matter.id,
      action: 'created',
      data: { title: matter.title, clientId: matter.clientId, playbookName },
    });
    this.realtime.publishDashboardRefresh(tenantId, matter.id);

    return {
      ...result,
      playbookApplied: playbookName
        ? { name: playbookName, tasksCreated: autoTaskCount }
        : null,
    };
  }

  async findAll(
    tenantId: string,
    userId: string,
    role?: string,
    status?: string,
  ) {
    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      tenantId,
      userId,
      role,
    );

    return this.prisma.matter.findMany({
      where: {
        tenantId,
        status: status || undefined,
        id: accessibleMatterIds ? { in: accessibleMatterIds } : undefined,
      },
      include: { client: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, matterId: string, userId: string, role?: string) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: {
        client: true,
        documents: true,
        tasks: true,
        timelineEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    return matter;
  }

  async update(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateMatterDto,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    if (dto.clientId) {
      await this.ensureClientBelongsToTenant(tenantId, dto.clientId);
    }

    const matter = await this.prisma.matter.update({
      where: { id: matterId },
      data: dto,
      include: { client: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.MATTER_UPDATED, {
      entityId: matterId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, matterId);

    return matter;
  }

  async remove(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);
    await this.prisma.matter.delete({ where: { id: matterId } });
    return { success: true };
  }

  private async ensureMatterReadable(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: {
        matterId_userId: { matterId, userId },
      },
    });

    if (!access) {
      throw new ForbiddenException('Matter access denied');
    }
  }

  private async ensureClientBelongsToTenant(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Client not found for tenant');
    }
  }

  private async createPlaybookTasks(
    tenantId: string,
    matterId: string,
    dto: CreateMatterDto,
    createdByUserId?: string,
  ): Promise<{ taskCount: number; playbookName: string | null }> {
    const countryCode = dto.countryCode.toUpperCase();
    const candidates = await this.prisma.matterPlaybook.findMany({
      where: {
        tenantId,
        isEnabled: true,
        OR: [
          { matterType: dto.matterType, countryCode },
          { matterType: dto.matterType, countryCode: null },
          { matterType: null, countryCode },
          { matterType: null, countryCode: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const playbook =
      candidates.find(
        (row) => row.matterType === dto.matterType && row.countryCode === countryCode,
      ) ??
      candidates.find(
        (row) => row.matterType === dto.matterType && !row.countryCode,
      ) ??
      candidates.find((row) => !row.matterType && row.countryCode === countryCode) ??
      candidates[0];

    if (!playbook) {
      return { taskCount: 0, playbookName: null };
    }

    const templates = this.parseTaskTemplates(playbook.taskTemplates);
    if (templates.length === 0) {
      return { taskCount: 0, playbookName: playbook.name };
    }

    const now = new Date();
    await this.prisma.task.createMany({
      data: templates.map((template) => ({
        tenantId,
        matterId,
        title: template.title,
        priority: template.priority ?? 'MEDIUM',
        status: template.status ?? 'TODO',
        assigneeId: template.assigneeId ?? createdByUserId,
        dueDate: template.dueInDays
          ? new Date(now.getTime() + template.dueInDays * 24 * 60 * 60 * 1000)
          : undefined,
      })),
    });

    return { taskCount: templates.length, playbookName: playbook.name };
  }

  private parseTaskTemplates(raw: unknown): PlaybookTaskTemplate[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((item): item is PlaybookTaskTemplate => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const title = (item as { title?: unknown }).title;
      return typeof title === 'string' && title.trim().length > 0;
    });
  }
}
