import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { retryDb } from '@/common/utils/retry-db';
import { PrismaService } from '../prisma/prisma.service';
import { JURISDICTION_FORMS_SEED } from './legal-forms.seed';
import {
  JURISDICTION_FORMS_CATALOG_COUNT,
  JURISDICTION_FORMS_CATALOG_VERSION,
} from './catalog.generated';
import { Prisma } from '@prisma/client';
import { expandSearchTokens, tokenize } from '@/ai/draft-intent/draft-intent.helpers';

export interface LegalFormsQuery {
  countryCode?: string;
  practiceArea?: string;
  jurisdiction?: string;
  category?: string;
  search?: string;
  page?: string;
  limit?: string;
  matterType?: string;
}

export interface PaginatedLegalForms {
  items: Awaited<ReturnType<PrismaService['jurisdictionForm']['findMany']>>;
  total: number;
  page: number;
  limit: number;
  pages: number;
}

@Injectable()
export class LegalFormsService implements OnModuleInit {
  private readonly logger = new Logger(LegalFormsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await retryDb(() => this.seedSystemForms());
  }

  private async seedSystemForms() {
    const count = await this.prisma.jurisdictionForm.count({
      where: { isSystem: true },
    });

    if (count === 0) {
      this.logger.log(
        `Seeding jurisdiction forms library v${JURISDICTION_FORMS_CATALOG_VERSION}...`,
      );
      await this.batchInsertCatalog();
      return;
    }

    if (
      typeof JURISDICTION_FORMS_CATALOG_COUNT !== 'number' ||
      !JURISDICTION_FORMS_SEED?.length
    ) {
      this.logger.warn(
        'Legal forms catalog metadata unavailable — skipping drift check (fix catalog.generated.ts import)',
      );
      return;
    }

    if (
      count !== JURISDICTION_FORMS_CATALOG_COUNT ||
      process.env.LEGAL_FORMS_FORCE_RESEED === 'true'
    ) {
      if (process.env.LEGAL_FORMS_FORCE_RESEED === 'true') {
        this.logger.warn('LEGAL_FORMS_FORCE_RESEED=true — replacing system forms catalog');
      } else {
        this.logger.warn(
          `Legal forms catalog drift (DB=${count}, catalog=${JURISDICTION_FORMS_CATALOG_COUNT}) — reseeding v${JURISDICTION_FORMS_CATALOG_VERSION}`,
        );
      }
      await this.prisma.jurisdictionForm.deleteMany({ where: { isSystem: true } });
      await this.batchInsertCatalog();
    }
  }

  private async batchInsertCatalog() {
    if (!JURISDICTION_FORMS_SEED?.length) {
      this.logger.warn('Legal forms seed catalog unavailable — skipping reseed');
      return;
    }
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < JURISDICTION_FORMS_SEED.length; i += BATCH) {
      const batch = JURISDICTION_FORMS_SEED.slice(i, i + BATCH);
      const result =       await this.prisma.jurisdictionForm.createMany({
        data: batch.map((row) => ({
          ...row,
          metadata: row.metadata as Prisma.InputJsonValue | undefined,
        })),
        skipDuplicates: true,
      });
      inserted += result.count;
    }
    this.logger.log(
      `Seeded ${inserted} jurisdiction forms (${JURISDICTION_FORMS_SEED.length} in catalog).`,
    );
  }

  private buildWhere(query: LegalFormsQuery): Prisma.JurisdictionFormWhereInput {
    const { countryCode, practiceArea, jurisdiction, category, search, matterType } = query;
    return {
      ...(countryCode && { countryCode }),
      ...(practiceArea && { practiceArea }),
      ...(category && { category }),
      ...((jurisdiction || search || matterType) && {
        AND: [
          ...(jurisdiction
            ? [{ OR: [{ jurisdiction }, { jurisdiction: null }] }]
            : []),
          ...(search ? [this.buildSearchWhere(search)] : []),
          ...(matterType
            ? [{
                OR: [
                  { category: { contains: matterType, mode: 'insensitive' as const } },
                  { formName: { contains: matterType, mode: 'insensitive' as const } },
                  { description: { contains: matterType, mode: 'insensitive' as const } },
                ],
              }]
            : []),
        ],
      }),
    };
  }

  private buildSearchWhere(search: string): Prisma.JurisdictionFormWhereInput {
    const tokens = expandSearchTokens(search);
    if (tokens.length === 0) {
      return {
        OR: [
          { formName: { contains: search, mode: 'insensitive' } },
          { formNumber: { contains: search, mode: 'insensitive' } },
          { authority: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    return this.buildTokenOrWhere(tokens);
  }

  private buildTokenOrWhere(tokens: string[]): Prisma.JurisdictionFormWhereInput {
    return {
      OR: tokens.map((token) => ({
        OR: [
          { formName: { contains: token, mode: 'insensitive' } },
          { formNumber: { contains: token, mode: 'insensitive' } },
          { authority: { contains: token, mode: 'insensitive' } },
          { description: { contains: token, mode: 'insensitive' } },
          { practiceArea: { contains: token, mode: 'insensitive' } },
          { category: { contains: token, mode: 'insensitive' } },
        ],
      })),
    };
  }

  async searchByTokens(
    tokens: string[],
    options: { countryCode?: string; jurisdiction?: string; limit?: number } = {},
  ) {
    if (tokens.length === 0) return [];

    const where: Prisma.JurisdictionFormWhereInput = {
      ...(options.countryCode && { countryCode: options.countryCode }),
      ...(options.jurisdiction && {
        OR: [{ jurisdiction: options.jurisdiction }, { jurisdiction: null }],
      }),
      ...this.buildTokenOrWhere(tokens),
    };

    return this.prisma.jurisdictionForm.findMany({
      where,
      take: options.limit ?? 30,
      orderBy: [{ countryCode: 'asc' }, { practiceArea: 'asc' }, { formName: 'asc' }],
    });
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.jurisdictionForm.findMany({
      where: { id: { in: ids } },
    });
  }

  async findPaginated(query: LegalFormsQuery): Promise<PaginatedLegalForms> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    // Allow larger pages when searching so clients are not stuck with the first 100 alphabetically.
    const maxLimit = query.search?.trim() ? 500 : 100;
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit ?? '48', 10) || 48));
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.jurisdictionForm.findMany({
        where,
        orderBy: [{ countryCode: 'asc' }, { practiceArea: 'asc' }, { formName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.jurisdictionForm.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findAll(query: LegalFormsQuery) {
    return this.prisma.jurisdictionForm.findMany({
      where: this.buildWhere(query),
      orderBy: [{ countryCode: 'asc' }, { practiceArea: 'asc' }, { formName: 'asc' }],
    });
  }

  async findByMatter(matterId: string) {
    const matter = await this.prisma.matter.findUnique({
      where: { id: matterId },
      select: { countryCode: true, practiceArea: true, jurisdiction: true },
    });

    if (!matter) return [];

    return this.findAll({
      countryCode: matter.countryCode,
      practiceArea: matter.practiceArea,
      jurisdiction: matter.jurisdiction ?? undefined,
    });
  }

  async attachToMatter(
    tenantId: string,
    matterId: string,
    formIds: string[],
    attachedById?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const uniqueIds = [...new Set(formIds)].filter(Boolean);
    const forms = await this.prisma.jurisdictionForm.findMany({
      where: {
        id: { in: uniqueIds },
        OR: [{ tenantId: null }, { tenantId }],
      },
      select: { id: true },
    });
    if (forms.length !== uniqueIds.length) {
      throw new NotFoundException('One or more legal forms were not found');
    }

    await this.prisma.matterFormAttachment.createMany({
      data: forms.map((form) => ({
        tenantId,
        matterId,
        formId: form.id,
        attachedById,
      })),
      skipDuplicates: true,
    });

    return this.listMatterAttachments(tenantId, matterId);
  }

  async listMatterAttachments(tenantId: string, matterId: string) {
    return this.prisma.matterFormAttachment.findMany({
      where: { tenantId, matterId },
      include: { form: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.jurisdictionForm.findUnique({ where: { id } });
  }

  async getGroupedByPracticeArea(countryCode: string) {
    const forms = await this.findAll({ countryCode });

    const grouped: Record<string, typeof forms> = {};
    for (const form of forms) {
      if (!grouped[form.practiceArea]) {
        grouped[form.practiceArea] = [];
      }
      grouped[form.practiceArea].push(form);
    }
    return grouped;
  }
}
