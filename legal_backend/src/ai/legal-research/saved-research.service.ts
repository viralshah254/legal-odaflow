import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import { AuditService } from '@/audit/audit.service';
import { ClientsService } from '@/clients/clients.service';
import { MattersService } from '@/matters/matters.service';
import {
  FeatureFlagsService,
  RESEARCH_FEATURE_FLAGS,
} from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TimelineService } from '@/timeline/timeline.service';
import { SmartWorkspaceService } from '@/smart-workspace/smart-workspace.service';
import { PromoteSavedResearchDto, SaveResearchDto } from '../dto/save-research.dto';
import { ResearchCachePromotionService } from './research-cache-promotion.service';

interface ResearchActor {
  tenantId: string;
  userId: string;
  tenantRole?: string;
}

const savedResearchSelect = {
  id: true,
  userId: true,
  clientId: true,
  matterId: true,
  aiOutputId: true,
  title: true,
  query: true,
  countryCode: true,
  researchJson: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  matter: { select: { id: true, title: true } },
} as const;

@Injectable()
export class SavedResearchService {
  private readonly logger = new Logger(SavedResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly clients: ClientsService,
    private readonly matters: MattersService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly smartWorkspace: SmartWorkspaceService,
    private readonly researchCachePromotion: ResearchCachePromotionService,
  ) {}

  async save(actor: ResearchActor, dto: SaveResearchDto) {
    this.assertFilingAvailable(actor);
    await this.ensureClientReadable(actor, dto.clientId);
    const matter = dto.matterId
      ? await this.ensureMatterReadable(actor, dto.matterId)
      : null;

    if (matter && matter.clientId !== dto.clientId) {
      throw new BadRequestException('Matter does not belong to the selected client');
    }

    const output = dto.aiOutputId
      ? await this.ensureOutputReadable(actor, dto.aiOutputId)
      : null;
    if (output?.matterId && dto.matterId && output.matterId !== dto.matterId) {
      throw new BadRequestException('Research output belongs to a different matter');
    }
    if (output?.matterId) {
      const outputMatter = await this.ensureMatterReadable(actor, output.matterId);
      if (outputMatter.clientId !== dto.clientId) {
        throw new BadRequestException('Research output belongs to a different client');
      }
    }

    const saved = await this.prisma.savedResearch.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        clientId: dto.clientId,
        matterId: dto.matterId,
        aiOutputId: dto.aiOutputId,
        title: dto.title,
        query: dto.query,
        countryCode: dto.countryCode,
        researchJson: dto.researchJson as Prisma.InputJsonValue,
      },
      select: savedResearchSelect,
    });
    if (saved.aiOutputId) {
      await this.researchCachePromotion
        .promote({
          aiOutputId: saved.aiOutputId,
          tenantId: actor.tenantId,
          reason: 'save',
        })
        .catch((error) =>
          this.logger.warn(
            `Saved research ${saved.id} could not be promoted to reusable cache: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
    }

    await this.audit.logDomainEvent({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'saved_research.filed',
      entityType: 'SavedResearch',
      entityId: saved.id,
      metadata: {
        clientId: saved.clientId,
        matterId: saved.matterId,
        aiOutputId: saved.aiOutputId,
        title: saved.title,
      },
    });

    if (saved.matterId) {
      await this.timeline.create(
        actor.tenantId,
        saved.matterId,
        actor.userId,
        actor.tenantRole,
        {
          eventType: 'RESEARCH_FILED',
          title: 'Legal research filed',
          description: saved.title,
          metadata: {
            savedResearchId: saved.id,
            clientId: saved.clientId,
            aiOutputId: saved.aiOutputId,
          },
        },
      );

      try {
        const research = this.asObject(saved.researchJson);
        const answer =
          typeof research.answer === 'string'
            ? research.answer
            : typeof research.summary === 'string'
              ? research.summary
              : '';
        await this.smartWorkspace.pinSavedResearchToCanvas(
          actor.tenantId,
          saved.matterId,
          actor.userId,
          {
            savedResearchId: saved.id,
            title: saved.title,
            query: saved.query,
            summary: answer.slice(0, 300),
            aiOutputId: saved.aiOutputId,
          },
        );
      } catch (error) {
        this.logger.warn(
          `Failed to pin saved research ${saved.id} to matter canvas: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const { outputs, reviews } = await this.loadMetadata(actor.tenantId, [saved]);
    return this.decorate(saved, outputs, reviews);
  }

  async list(
    actor: ResearchActor,
    filters: { clientId?: string; matterId?: string },
  ) {
    if (filters.clientId) {
      await this.ensureClientReadable(actor, filters.clientId);
    }
    if (filters.matterId) {
      const matter = await this.ensureMatterReadable(actor, filters.matterId);
      if (filters.clientId && matter.clientId !== filters.clientId) {
        throw new BadRequestException('Matter does not belong to the selected client');
      }
    }

    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      actor.tenantId,
      actor.userId,
      actor.tenantRole,
    );
    const accessibleClientIds = await this.matterAccess.getAccessibleClientIds(
      actor.tenantId,
      actor.userId,
      actor.tenantRole,
    );

    const rows = await this.prisma.savedResearch.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId: filters.clientId ?? (
          accessibleClientIds ? { in: accessibleClientIds } : undefined
        ),
        matterId: filters.matterId ?? undefined,
        ...(accessibleMatterIds
          ? {
              OR: [
                { matterId: null },
                { matterId: { in: accessibleMatterIds } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: savedResearchSelect,
    });

    const { outputs, reviews } = await this.loadMetadata(actor.tenantId, rows);
    return rows.map((row) => this.decorate(row, outputs, reviews));
  }

  async get(actor: ResearchActor, id: string) {
    const saved = await this.prisma.savedResearch.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: savedResearchSelect,
    });
    if (!saved) throw new NotFoundException('Saved research not found');

    await this.ensureClientReadable(actor, saved.clientId);
    if (saved.matterId) {
      await this.ensureMatterReadable(actor, saved.matterId);
    }

    const { outputs, reviews } = await this.loadMetadata(actor.tenantId, [saved]);
    return this.decorate(saved, outputs, reviews);
  }

  async promote(
    actor: ResearchActor,
    id: string,
    dto: PromoteSavedResearchDto,
  ) {
    this.assertFilingAvailable(actor);
    const saved = await this.get(actor, id);
    if (!saved.matterId) {
      throw new BadRequestException('Research must be filed to a matter before promotion');
    }

    return {
      supported: false as const,
      code: 'SERVER_SIDE_DOCUMENT_PROMOTION_UNSUPPORTED' as const,
      reason:
        'DocumentsService requires an uploaded file URL and queues OCR; it has no atomic API for server-generated markdown documents.',
      savedResearchId: saved.id,
      matterId: saved.matterId,
      requestedFormat: dto.format,
      preservationRequirements: {
        markdownBody: true,
        verificationJsonAppendix: true,
        provenance: {
          savedResearchId: saved.id,
          aiOutputId: saved.aiOutputId,
          filedAt: saved.createdAt,
        },
      },
    };
  }

  private assertFilingAvailable(actor: ResearchActor): void {
    this.featureFlags.assertEnabled(RESEARCH_FEATURE_FLAGS.MATTER_FILING, {
      tenantId: actor.tenantId,
      userId: actor.userId,
    });
  }

  private async ensureClientReadable(actor: ResearchActor, clientId: string) {
    return this.clients.findOne(
      actor.tenantId,
      clientId,
      actor.userId,
      actor.tenantRole,
    );
  }

  private async ensureMatterReadable(actor: ResearchActor, matterId: string) {
    try {
      await this.matterAccess.ensureMatterAccess(
        actor.tenantId,
        actor.userId,
        matterId,
        actor.tenantRole,
      );
    } catch {
      throw new ForbiddenException('Matter access denied');
    }
    return this.matters.findOne(
      actor.tenantId,
      matterId,
      actor.userId,
      actor.tenantRole,
    );
  }

  private async ensureOutputReadable(actor: ResearchActor, outputId: string) {
    const output = await this.prisma.aIOutput.findFirst({
      where: {
        id: outputId,
        tenantId: actor.tenantId,
        taskType: 'LEGAL_RESEARCH',
      },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        matterId: true,
        verified: true,
        requiresLawyerReview: true,
        approvedByLawyerId: true,
        citationAudit: true,
        citations: true,
      },
    });
    if (!output) throw new NotFoundException('Research output not found');

    if (output.matterId) {
      await this.ensureMatterReadable(actor, output.matterId);
    } else if (output.userId !== actor.userId) {
      throw new ForbiddenException('Research output access denied');
    }
    return output;
  }

  private async loadMetadata(
    tenantId: string,
    rows: Array<{ aiOutputId: string | null }>,
  ) {
    const outputIds = [
      ...new Set(rows.flatMap((row) => row.aiOutputId ? [row.aiOutputId] : [])),
    ];
    if (outputIds.length === 0) {
      return { outputs: new Map<string, OutputMetadata>(), reviews: [] as ReviewMetadata[] };
    }
    const [outputRows, reviews] = await Promise.all([
      this.prisma.aIOutput.findMany({
        where: { id: { in: outputIds }, tenantId },
        select: {
          id: true,
          userId: true,
          tenantId: true,
          matterId: true,
          verified: true,
          requiresLawyerReview: true,
          approvedByLawyerId: true,
          citationAudit: true,
          citations: true,
        },
      }),
      this.prisma.manualCitationReviewTask.findMany({
        where: { tenantId, aiOutputId: { in: outputIds } },
        select: { aiOutputId: true, status: true },
      }),
    ]);
    return {
      outputs: new Map(outputRows.map((output) => [output.id, output])),
      reviews,
    };
  }

  private decorate<
    T extends {
      aiOutputId: string | null;
      researchJson: Prisma.JsonValue;
    },
  >(saved: T, outputs: Map<string, OutputMetadata>, reviews: ReviewMetadata[]) {
    const output = saved.aiOutputId ? outputs.get(saved.aiOutputId) : undefined;
    const outputReviews = saved.aiOutputId
      ? reviews.filter((review) => review.aiOutputId === saved.aiOutputId)
      : [];
    const research = this.asObject(saved.researchJson);
    const citationAudit = this.asObject(output?.citationAudit);
    const pending = outputReviews.filter((review) =>
      review.status === 'PENDING' || review.status === 'IN_REVIEW'
    ).length;

    return {
      ...saved,
      verification: {
        status:
          (typeof research.verificationStatus === 'string'
            ? research.verificationStatus
            : undefined) ?? (output?.verified ? 'verified' : 'unverified'),
        verified: output?.verified ?? false,
        safeForReliance: citationAudit.safeForReliance === true,
        requiresLawyerReview: output?.requiresLawyerReview ?? false,
        approvedByLawyerId: output?.approvedByLawyerId ?? null,
        manualReview: {
          total: outputReviews.length,
          pending,
          complete: outputReviews.length > 0 && pending === 0,
        },
      },
    };
  }

  private asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}

type OutputMetadata = {
  id: string;
  userId: string | null;
  tenantId: string | null;
  matterId: string | null;
  verified: boolean;
  requiresLawyerReview: boolean;
  approvedByLawyerId: string | null;
  citationAudit: Prisma.JsonValue | null;
  citations: Prisma.JsonValue | null;
};

type ReviewMetadata = {
  aiOutputId: string;
  status: string;
};
