import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { ConflictsService } from '@/conflicts/conflicts.service';
import { CreateConflictCheckDto } from '@/conflicts/dto/conflicts.dto';
import { MatterAutonomyService } from '@/matter-autonomy/matter-autonomy.service';
import { PlaybooksService } from '@/playbooks/playbooks.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';
import { SearchIndexService } from '@/search/search-index.service';
import { resolvePlaybookKeysFromTaskGraph } from '@/ai/matter-intelligence/playbook-registry';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import type { MatterListFilters, MatterListPage } from './matter-list.types';
import {
  MATTER_STATUSES,
  matterStageFilterValues,
  matterStatusFilterValues,
  normalizeMatterStage,
  normalizeMatterStatus,
} from './matter-lifecycle.constants';

@Injectable()
export class MattersService {
  private readonly logger = new Logger(MattersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly playbooksService: PlaybooksService,
    private readonly conflictsService: ConflictsService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    private readonly realtime: RealtimePublisherService,
    @Optional()
    private readonly matterAutonomy: MatterAutonomyService | null = null,
    private readonly searchIndex: SearchIndexService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly matterMemory: MatterMemoryService,
  ) {}

  async create(tenantId: string, dto: CreateMatterDto, createdByUserId?: string) {
    await this.ensureClientBelongsToTenant(tenantId, dto.clientId);
    if (dto.leadAttorneyId) {
      await this.ensureActiveTenantUser(tenantId, dto.leadAttorneyId);
    }

    const matter = await this.prisma.matter.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        leadAttorneyId: dto.leadAttorneyId,
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
        status: MATTER_STATUSES.OPEN,
      },
      include: { client: true },
    });

    if (createdByUserId) {
      const creator = await this.prisma.user.findUnique({
        where: { id: createdByUserId },
        select: { id: true, name: true, email: true },
      });
      await this.prisma.timelineEvent.create({
        data: {
          tenantId,
          matterId: matter.id,
          eventType: 'MATTER_CREATED',
          title: 'Matter created',
          description: matter.title,
          metadata: {
            userId: createdByUserId,
            userName: creator?.name ?? creator?.email?.split('@')[0] ?? 'User',
          },
          occurredAt: matter.createdAt,
        },
      });
    }

    const { taskCount: autoTaskCount, playbookName } = await this.playbooksService.executePlaybook(
      tenantId,
      matter.id,
      dto.matterType,
      dto.countryCode,
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
      practiceArea: matter.practiceArea,
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

    // Autonomous matter brain — fire-and-forget
    if (createdByUserId) {
      this.matterAutonomy?.triggerOnCreate(matter.id, tenantId, createdByUserId);
    }

    this.searchIndex.indexEntity(tenantId, 'matter', result.id);

    if (dto.factsSummary?.trim()) {
      void this.matterPipeline
        .run({
          facts: dto.factsSummary,
          countryCode: dto.countryCode.toUpperCase(),
          jurisdiction: dto.jurisdiction,
          skipRetrieval: true,
        })
        .then((miResult) =>
          this.matterMemory.persist(
            'matter',
            matter.id,
            {
              profile: miResult.profile,
              graph: miResult.graph,
              taskGraph: miResult.taskGraph,
            },
            dto.factsSummary,
          ).then(() => {
            const playbookKeys = resolvePlaybookKeysFromTaskGraph(miResult.taskGraph);
            if (playbookKeys.length > 0) {
              void this.playbooksService
                .executeByRegistryKeys(tenantId, matter.id, playbookKeys, createdByUserId)
                .catch((err) => {
                  this.logger.warn(
                    `MI playbook execution failed for matter ${matter.id}: ${
                      err instanceof Error ? err.message : 'unknown'
                    }`,
                  );
                });
            }
          }),
        )
        .catch((err) => {
          this.logger.warn(
            `MI pipeline failed for matter ${matter.id}: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        });
    }

    return {
      ...result,
      playbookApplied: playbookName
        ? { name: playbookName, tasksCreated: autoTaskCount }
        : null,
    };
  }

  /**
   * Post-commit side-effects for a matter that was created atomically inside
   * a transaction (e.g. StartWork).  The transaction guarantees the row exists;
   * this method fires playbooks, automation, realtime events, and matter-brain.
   */
  async onMatterCreated(
    tenantId: string,
    matterId: string,
    countryCode: string,
    matterType: string,
    createdByUserId?: string,
  ): Promise<void> {
    const matter = await this.prisma.matter.findUnique({
      where: { id: matterId },
      select: {
        id: true,
        title: true,
        clientId: true,
        matterType: true,
        practiceArea: true,
        factsSummary: true,
        createdAt: true,
      },
    });
    if (!matter) return;

    // Timeline event
    if (createdByUserId) {
      const creator = await this.prisma.user.findUnique({
        where: { id: createdByUserId },
        select: { id: true, name: true, email: true },
      });
      await this.prisma.timelineEvent.create({
        data: {
          tenantId,
          matterId: matter.id,
          eventType: 'MATTER_CREATED',
          title: 'Matter created',
          description: matter.title,
          metadata: {
            userId: createdByUserId,
            userName: creator?.name ?? creator?.email?.split('@')[0] ?? 'User',
          },
          occurredAt: matter.createdAt,
        },
      });
    }

    // Playbook
    const { taskCount: autoTaskCount, playbookName } =
      await this.playbooksService.executePlaybook(
        tenantId,
        matter.id,
        matterType,
        countryCode,
        createdByUserId,
      );

    if (playbookName) {
      await this.prisma.matter.update({
        where: { id: matter.id },
        data: { stage: 'Intake' },
      }).catch(() => undefined);
    }

    // Automation
    await this.automationEngine.dispatch(tenantId, 'matter.created', {
      matterId: matter.id,
      matterTitle: matter.title,
      matterType: matter.matterType,
      practiceArea: matter.practiceArea,
      clientId: matter.clientId,
      userId: createdByUserId,
      autoTaskCount,
      playbookName,
    }).catch((e) => this.logger.warn(`Automation dispatch failed: ${String(e)}`));

    // Realtime
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.MATTER_CREATED, {
      entityId: matter.id,
      action: 'created',
      data: { title: matter.title, clientId: matter.clientId, playbookName },
    });
    this.realtime.publishDashboardRefresh(tenantId, matter.id);

    // Autonomous matter brain
    if (createdByUserId) {
      this.matterAutonomy?.triggerOnCreate(matter.id, tenantId, createdByUserId);
    }

    this.searchIndex.indexEntity(tenantId, 'matter', matter.id);
  }

  /** Returns the set of matterIds that have at least one auto-triggered analysis run. */
  async getAutoAnalyzedIds(tenantId: string): Promise<string[]> {
    const runs = await this.prisma.matterAnalysisRun.findMany({
      where: { tenantId, trigger: 'auto', status: 'COMPLETED' },
      select: { matterId: true },
      distinct: ['matterId'],
    });
    return runs.map((r: { matterId: string }) => r.matterId);
  }

  async findAll(
    tenantId: string,
    userId: string,
    role?: string,
    filters: MatterListFilters = {},
  ) {
    const where = await this.buildListWhere(tenantId, userId, role, filters);
    const matters = await this.prisma.matter.findMany({
      where,
      include: { client: true },
      orderBy: { updatedAt: 'desc' },
    });
    return matters.map((matter) => this.normalizeLifecycle(matter));
  }

  async findAllPaginated(
    tenantId: string,
    userId: string,
    role?: string,
    filters: MatterListFilters = {},
  ): Promise<MatterListPage> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);
    const skip = (page - 1) * limit;
    const where = await this.buildListWhere(tenantId, userId, role, filters);

    const [total, items] = await Promise.all([
      this.prisma.matter.count({ where }),
      this.prisma.matter.findMany({
        where,
        include: { client: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map((matter) => this.normalizeLifecycle(matter)),
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

  private async buildListWhere(
    tenantId: string,
    userId: string,
    role: string | undefined,
    filters: MatterListFilters,
  ) {
    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      tenantId,
      userId,
      role,
    );

    const and: Record<string, unknown>[] = [{ tenantId }];

    if (filters.clientId) and.push({ clientId: filters.clientId });
    if (filters.status) and.push({ status: { in: matterStatusFilterValues(filters.status) } });
    if (filters.stage) and.push({ stage: { in: matterStageFilterValues(filters.stage) } });
    if (accessibleMatterIds) and.push({ id: { in: accessibleMatterIds } });
    if (filters.assignee) {
      and.push({
        tasks: {
          some: { assigneeId: filters.assignee },
        },
      });
    }

    if (filters.dateFrom || filters.dateTo) {
      and.push({
        createdAt: {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        },
      });
    }

    const search = filters.search?.trim();
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { caseNumber: { contains: search, mode: 'insensitive' } },
          { opposingParty: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  runConflictCheck(tenantId: string, userId: string, dto: CreateConflictCheckDto) {
    return this.conflictsService.create(tenantId, userId, dto);
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

    return this.normalizeLifecycle(matter);
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
    if (dto.leadAttorneyId) {
      await this.ensureActiveTenantUser(tenantId, dto.leadAttorneyId);
    }

    const existing = (dto.stage || dto.status)
      ? await this.prisma.matter.findFirst({
          where: { id: matterId, tenantId },
          select: { stage: true, status: true },
        })
      : null;

    const matter = await this.prisma.matter.update({
      where: { id: matterId },
      data: dto,
      include: { client: true },
    });

    if (dto.stage && existing && existing.stage !== dto.stage) {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      await this.prisma.timelineEvent.create({
        data: {
          tenantId,
          matterId,
          eventType: 'STAGE_CHANGED',
          title: `Stage changed to ${dto.stage}`,
          description: existing.stage
            ? `Moved from ${existing.stage} to ${dto.stage}`
            : undefined,
          metadata: {
            userId,
            userName: actor?.name ?? actor?.email?.split('@')[0] ?? 'User',
            fromStage: existing.stage,
            toStage: dto.stage,
          },
          occurredAt: new Date(),
        },
      });
    }

    const statusChanged = dto.status && existing && existing.status !== dto.status;
    if (statusChanged) {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      await this.prisma.timelineEvent.create({
        data: {
          tenantId,
          matterId,
          eventType: 'STATUS_CHANGED',
          title: `Status changed to ${dto.status}`,
          description: existing.status
            ? `Status moved from ${existing.status} to ${dto.status}`
            : undefined,
          metadata: {
            userId,
            userName: actor?.name ?? actor?.email?.split('@')[0] ?? 'User',
            fromStatus: existing.status,
            toStatus: dto.status,
          },
          occurredAt: new Date(),
        },
      });
    }

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.MATTER_UPDATED, {
      entityId: matterId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, matterId);

    // Autonomous matter brain — fire-and-forget strategy refresh on status change
    if (statusChanged) {
      this.matterAutonomy?.triggerOnStatusChange(matterId, tenantId, userId);
    }

    this.searchIndex.indexEntity(tenantId, 'matter', matterId);

    return this.normalizeLifecycle(matter);
  }

  async remove(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true, title: true },
    });

    if (!matter) throw new NotFoundException('Matter not found');

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const actorName = actor?.name ?? actor?.email?.split('@')[0] ?? 'User';

    // Log to AuditLog (timeline events are cascade-deleted with the matter).
    await this.prisma.auditLog.create({
      data: {
        userId,
        tenantId,
        action: 'MATTER_DELETED',
        entityType: 'Matter',
        entityId: matterId,
        metadata: { matterTitle: matter.title, deletedBy: actorName },
      },
    });

    await this.prisma.matter.delete({ where: { id: matterId } });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.MATTER_DELETED, {
      entityId: matterId,
      action: 'deleted',
      data: { title: matter.title },
    });
    this.realtime.publishDashboardRefresh(tenantId, matterId);

    return { success: true };
  }

  /**
   * Persist questionnaire answers into matter.planningNotes as JSON,
   * merging with any previously saved answers.
   */
  async saveQuestionnaireAnswers(
    tenantId: string,
    matterId: string,
    answers: Record<string, unknown>,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true, planningAnswers: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const existing =
      matter.planningAnswers && typeof matter.planningAnswers === 'object'
        ? (matter.planningAnswers as Record<string, unknown>)
        : {};

    const merged = { ...existing, ...answers, _savedAt: new Date().toISOString() };

    await this.prisma.matter.update({
      where: { id: matterId },
      data: { planningAnswers: merged },
    });

    return { success: true, savedAnswers: Object.keys(answers).length };
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

  private async ensureActiveTenantUser(tenantId: string, userId: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { tenantId, userId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!tenantUser) {
      throw new NotFoundException('Lead attorney not found for tenant');
    }
  }

  private normalizeLifecycle<T extends { status: string; stage?: string | null }>(matter: T): T {
    return {
      ...matter,
      status: normalizeMatterStatus(matter.status),
      stage: matter.stage ? normalizeMatterStage(matter.stage) : matter.stage,
    };
  }
}
