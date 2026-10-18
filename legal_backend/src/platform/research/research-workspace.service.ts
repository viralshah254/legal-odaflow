import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import {
  FeatureFlagsService,
  RESEARCH_FEATURE_FLAGS,
} from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AppendResearchContextDto,
  CreateResearchWorkspaceDto,
  UpdateResearchWorkspaceDto,
} from './research-workspace.dto';

@Injectable()
export class ResearchWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    tenantRole: string | undefined,
    dto: CreateResearchWorkspaceDto,
  ) {
    this.assertAvailable(tenantId, userId);
    if (dto.matterId) {
      await this.ensureMatterAccess(tenantId, userId, dto.matterId, tenantRole);
    }

    return this.prisma.researchWorkspace.create({
      data: {
        tenantId,
        userId,
        matterId: dto.matterId,
        title: dto.title?.trim() || undefined,
        objective: dto.objective.trim(),
        jurisdiction: dto.jurisdiction,
        region: dto.region,
        mode: dto.mode ?? 'quick',
        status: 'pending',
      },
      include: {
        contextItems: { orderBy: { ordinal: 'asc' } },
      },
    });
  }

  async get(
    workspaceId: string,
    tenantId: string,
    userId: string,
    tenantRole?: string,
  ) {
    this.assertAvailable(tenantId, userId);
    const workspace = await this.prisma.researchWorkspace.findFirst({
      where: { id: workspaceId, tenantId, userId },
      include: {
        contextItems: { orderBy: { ordinal: 'asc' } },
      },
    });
    if (!workspace) {
      throw new NotFoundException({
        code: 'RESEARCH_WORKSPACE_NOT_FOUND',
        message: 'Research workspace not found',
      });
    }
    if (workspace.matterId) {
      await this.ensureMatterAccess(tenantId, userId, workspace.matterId, tenantRole);
    }
    return workspace;
  }

  async update(
    workspaceId: string,
    tenantId: string,
    userId: string,
    tenantRole: string | undefined,
    dto: UpdateResearchWorkspaceDto,
  ) {
    this.assertAvailable(tenantId, userId);
    const workspace = await this.get(workspaceId, tenantId, userId, tenantRole);
    const nextMatterId = dto.matterId ?? workspace.matterId;
    if (dto.matterId && dto.matterId !== workspace.matterId) {
      await this.ensureMatterAccess(tenantId, userId, dto.matterId, tenantRole);
    }

    const mutableData: Prisma.ResearchWorkspaceUpdateManyMutationInput = {
      ...(dto.title !== undefined ? { title: dto.title.trim() || null } : {}),
      ...(dto.objective !== undefined ? { objective: dto.objective.trim() } : {}),
      ...(dto.jurisdiction !== undefined ? { jurisdiction: dto.jurisdiction } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.matterId !== undefined ? { matterId: dto.matterId } : {}),
      ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    if (Object.keys(mutableData).length === 0 && !dto.revision) {
      throw new BadRequestException({
        code: 'RESEARCH_WORKSPACE_UPDATE_EMPTY',
        message: 'At least one workspace field or AI output revision is required',
      });
    }

    if (dto.revision) {
      await this.ensureScopedAiOutput(
        dto.revision.aiOutputId,
        tenantId,
        userId,
        nextMatterId,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.researchWorkspace.updateMany({
        where: {
          id: workspaceId,
          tenantId,
          userId,
          revision: dto.expectedRevision,
        },
        data: {
          ...mutableData,
          revision: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw this.revisionConflict();
      }

      if (dto.revision) {
        const latest = await tx.researchWorkspaceRevision.aggregate({
          where: { workspaceId, tenantId, userId },
          _max: { revision: true },
        });
        await tx.researchWorkspaceRevision.create({
          data: {
            workspaceId,
            aiOutputId: dto.revision.aiOutputId,
            tenantId,
            userId,
            matterId: nextMatterId,
            revision: (latest._max.revision ?? 0) + 1,
            affectedIssueIds: this.json(dto.revision.affectedIssueIds),
            provenance: this.json(dto.revision.provenance),
          },
        });
      }

      return tx.researchWorkspace.findFirstOrThrow({
        where: { id: workspaceId, tenantId, userId },
        include: {
          contextItems: { orderBy: { ordinal: 'asc' } },
        },
      });
    });
  }

  async appendContext(
    workspaceId: string,
    tenantId: string,
    userId: string,
    tenantRole: string | undefined,
    dto: AppendResearchContextDto,
  ) {
    this.assertAvailable(tenantId, userId);
    const workspace = await this.get(workspaceId, tenantId, userId, tenantRole);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.researchWorkspace.updateMany({
          where: {
            id: workspaceId,
            tenantId,
            userId,
            revision: dto.expectedRevision,
          },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw this.revisionConflict();
        }

        const item = await tx.researchWorkspaceContextItem.create({
          data: {
            id: dto.id,
            workspaceId,
            tenantId,
            userId,
            matterId: workspace.matterId,
            ordinal: dto.expectedRevision + 1,
            kind: dto.kind,
            label: dto.label,
            content: dto.content as Prisma.InputJsonValue,
            provenance: dto.provenance as unknown as Prisma.InputJsonValue,
            affectedIssueIds: this.json(dto.affectedIssueIds),
          },
        });
        return { item, workspaceRevision: dto.expectedRevision + 1 };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'RESEARCH_CONTEXT_CONFLICT',
          message: 'Research context could not be appended because it already exists',
        });
      }
      throw error;
    }
  }

  async listRevisions(
    workspaceId: string,
    tenantId: string,
    userId: string,
    tenantRole?: string,
  ) {
    this.assertAvailable(tenantId, userId);
    await this.get(workspaceId, tenantId, userId, tenantRole);
    return this.prisma.researchWorkspaceRevision.findMany({
      where: { workspaceId, tenantId, userId },
      orderBy: { revision: 'asc' },
      include: {
        aiOutput: {
          select: {
            id: true,
            mode: true,
            taskType: true,
            outputMarkdown: true,
            citations: true,
            citationAudit: true,
            verified: true,
            confidenceScore: true,
            createdAt: true,
          },
        },
      },
    });
  }

  private assertAvailable(tenantId: string, userId: string): void {
    this.featureFlags.assertEnabled(
      RESEARCH_FEATURE_FLAGS.WORKSPACE_FOLLOW_ON,
      { tenantId, userId },
    );
  }

  private async ensureScopedAiOutput(
    aiOutputId: string,
    tenantId: string,
    userId: string,
    matterId: string | null,
  ): Promise<void> {
    const output = await this.prisma.aIOutput.findFirst({
      where: { id: aiOutputId, tenantId, userId },
      select: { matterId: true },
    });
    if (!output || output.matterId !== matterId) {
      throw new NotFoundException({
        code: 'RESEARCH_AI_OUTPUT_NOT_FOUND',
        message: 'AI output was not found in this workspace scope',
      });
    }
  }

  private async ensureMatterAccess(
    tenantId: string,
    userId: string,
    matterId: string,
    tenantRole?: string,
  ): Promise<void> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true },
    });
    if (!matter) {
      throw new NotFoundException({
        code: 'RESEARCH_MATTER_NOT_FOUND',
        message: 'Matter not found',
      });
    }
    if (this.matterAccess.hasFullAccess(tenantRole)) return;
    try {
      await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, tenantRole);
    } catch {
      throw new ForbiddenException({
        code: 'RESEARCH_MATTER_ACCESS_DENIED',
        message: 'Matter access denied',
      });
    }
  }

  private revisionConflict(): ConflictException {
    return new ConflictException({
      code: 'RESEARCH_WORKSPACE_REVISION_CONFLICT',
      message: 'Research workspace changed; reload it and retry with the latest revision',
    });
  }

  private json(
    value: Record<string, unknown> | string[] | undefined,
  ): Prisma.InputJsonValue | undefined {
    return value as Prisma.InputJsonValue | undefined;
  }
}
