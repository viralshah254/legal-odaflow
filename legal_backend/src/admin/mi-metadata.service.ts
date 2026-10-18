import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import {
  buildFormEmbedText,
  JURISDICTION_FORM_SOURCE_TYPE,
} from '@/legal-forms/form-embed-text.util';
import { SYSTEM_TASK_PATTERNS } from '@/task-patterns/task-patterns.catalog';
import {
  buildCoverageMatrix,
  coverageSummary,
  missingCells,
} from '@/config/taxonomy/coverage-matrix';
import { TEMPLATE_LEGAL_ASSET_METADATA } from '@/config/templates/template-legal-asset-metadata';

export interface MiMetadataAssetListResult {
  items: Array<{
    id: string;
    formName: string;
    practiceArea: string;
    countryCode: string;
    jurisdiction: string | null;
    metadata: Prisma.JsonValue | null;
    source: 'jurisdiction_form' | 'template_kind';
  }>;
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class MiMetadataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async listAssets(params: {
    page?: number;
    pageSize?: number;
    practiceArea?: string;
    countryCode?: string;
  }): Promise<MiMetadataAssetListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);
    const skip = (page - 1) * pageSize;

    const where: Prisma.JurisdictionFormWhereInput = {
      isSystem: true,
      ...(params.practiceArea ? { practiceArea: params.practiceArea } : {}),
      ...(params.countryCode ? { countryCode: params.countryCode.toUpperCase() } : {}),
    };

    const [forms, total] = await Promise.all([
      this.prisma.jurisdictionForm.findMany({
        where,
        orderBy: { formName: 'asc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          formName: true,
          practiceArea: true,
          countryCode: true,
          jurisdiction: true,
          metadata: true,
        },
      }),
      this.prisma.jurisdictionForm.count({ where }),
    ]);

    return {
      items: forms.map((form) => ({
        ...form,
        source: 'jurisdiction_form' as const,
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateAssetMetadata(
    assetId: string,
    metadata: Record<string, unknown>,
  ): Promise<{ updated: boolean; reEmbedded: boolean }> {
    const form = await this.prisma.jurisdictionForm.findUnique({ where: { id: assetId } });
    if (!form) {
      throw new NotFoundException('Asset not found');
    }

    await this.prisma.jurisdictionForm.update({
      where: { id: assetId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });

    let reEmbedded = false;
    if (this.embeddingService.isRagEnabled()) {
      await this.embeddingService.storeChunks([
        {
          sourceType: JURISDICTION_FORM_SOURCE_TYPE,
          sourceId: form.id,
          chunkIndex: 0,
          content: buildFormEmbedText({ ...form, metadata: metadata as Prisma.JsonValue }),
          countryCode: form.countryCode,
          jurisdiction: form.jurisdiction ?? undefined,
          modelName: this.embeddingService.getEmbeddingModel(),
          metadata: {
            formNumber: form.formNumber,
            practiceArea: form.practiceArea,
            formName: form.formName,
            ...(metadata as Record<string, unknown>),
          },
        },
      ]);
      reEmbedded = true;
    }

    return { updated: true, reEmbedded };
  }

  async taxonomyCoverage() {
    const patternInputs = SYSTEM_TASK_PATTERNS.map((p) => ({
      domainSlug: p.domainSlug,
      jurisdiction: p.jurisdiction,
      targetFeature: p.targetFeature,
    }));
    const cells = buildCoverageMatrix(patternInputs);
    const summary = coverageSummary(cells);
    const missing = missingCells(cells);

    const untaggedForms = await this.prisma.jurisdictionForm.count({
      where: { isSystem: true, metadata: { equals: Prisma.DbNull } },
    });

    const templateKindCount = Object.keys(TEMPLATE_LEGAL_ASSET_METADATA).length;

    return {
      coverage: summary,
      missingCells: missing.slice(0, 50),
      untaggedCount: untaggedForms,
      templateKindOverrides: templateKindCount,
      lowConfidenceCount: missing.length,
    };
  }

  async listMiAuditLogs(params: {
    consumer?: string;
    practiceArea?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(200, params.limit ?? 50);
    const offset = params.offset ?? 0;

    const where: Prisma.AuditLogWhereInput = {
      action: 'matter_intelligence.classify',
      ...(params.consumer
        ? {
            metadata: {
              path: ['consumer'],
              equals: params.consumer,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const filtered = params.practiceArea
      ? items.filter((row) => {
          const meta = row.metadata as { practiceArea?: string } | null;
          return meta?.practiceArea === params.practiceArea;
        })
      : items;

    return { items: filtered, total, limit, offset };
  }
}
