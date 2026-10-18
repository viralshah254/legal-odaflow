import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PRACTICE_AREAS } from '@/config/practice-areas';
import { JURISDICTION_TEMPLATE_SEEDS } from '@/config/jurisdiction-clause-library.seed';

const GENERAL_CATEGORIES = ['GENERAL_TEMPLATE', 'GENERAL'];
const AUTO_PROVISION_LIMIT = 5;

@Injectable()
export class TemplateLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  listPracticeAreas() {
    return PRACTICE_AREAS;
  }

  async resolveCountryCode(tenantId: string, countryCode?: string) {
    if (countryCode) {
      return countryCode.toUpperCase();
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { primaryCountry: true },
    });
    return tenant?.primaryCountry ?? 'US';
  }

  async listLibrary(params: {
    countryCode: string;
    practiceArea?: string;
    allPracticeAreas?: boolean;
    tenantId?: string;
  }) {
    const where = {
      countryCode: params.countryCode.toUpperCase(),
      isActive: true,
      ...(params.allPracticeAreas || !params.practiceArea
        ? {}
        : { practiceArea: params.practiceArea }),
    };

    const systemTemplates = await this.prisma.systemDocumentTemplate.findMany({
      where,
      orderBy: [{ practiceArea: 'asc' }, { sortOrder: 'asc' }],
    });

    if (!params.tenantId) {
      return systemTemplates.map((t) => ({ ...t, provisioned: false }));
    }

    const provisionedIds = new Set(
      (
        await this.prisma.documentTemplate.findMany({
          where: {
            tenantId: params.tenantId,
            systemTemplateId: { not: null },
          },
          select: { systemTemplateId: true },
        })
      )
        .map((r) => r.systemTemplateId)
        .filter(Boolean) as string[],
    );

    return systemTemplates.map((t) => ({
      ...t,
      provisioned: provisionedIds.has(t.id),
    }));
  }

  async provisionTemplates(
    tenantId: string,
    input: {
      systemTemplateIds?: string[];
      practiceArea?: string;
      countryCode?: string;
      limit?: number;
    },
  ) {
    let templates = await this.prisma.systemDocumentTemplate.findMany({
      where: {
        isActive: true,
        ...(input.systemTemplateIds?.length
          ? { id: { in: input.systemTemplateIds } }
          : {
              countryCode: (input.countryCode ?? 'US').toUpperCase(),
              practiceArea: input.practiceArea,
            }),
      },
      orderBy: { sortOrder: 'asc' },
      take: input.limit ?? undefined,
    });

    const created: string[] = [];
    for (const system of templates) {
      const existing = await this.prisma.documentTemplate.findFirst({
        where: { tenantId, systemTemplateId: system.id },
      });
      if (existing) continue;

      const row = await this.prisma.documentTemplate.create({
        data: {
          tenantId,
          name: system.name,
          content: system.content,
          category: system.category,
          matterType: system.matterType,
          countryCode: system.countryCode,
          practiceArea: system.practiceArea,
          documentKind: system.documentKind,
          jurisdiction: system.jurisdiction,
          conditionalFields: system.conditionalFields ?? undefined,
          source: 'SYSTEM',
          systemTemplateId: system.id,
          isActive: true,
        },
      });
      created.push(row.id);
    }

    return { provisionedCount: created.length, templateIds: created };
  }

  async maybeAutoProvisionOnFirstVisit(
    tenantId: string,
    userId: string,
  ): Promise<number> {
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    if (prefs?.templatesLibraryProvisionedAt) {
      return 0;
    }
    if (!prefs?.primaryPracticeArea) {
      return 0;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { primaryCountry: true },
    });
    if (!tenant) return 0;

    const generalCount = await this.prisma.documentTemplate.count({
      where: {
        tenantId,
        OR: [
          { category: { in: GENERAL_CATEGORIES } },
          { category: null },
        ],
      },
    });
    if (generalCount > 0) {
      return 0;
    }

    const result = await this.provisionTemplates(tenantId, {
      practiceArea: prefs.primaryPracticeArea,
      countryCode: tenant.primaryCountry,
      limit: AUTO_PROVISION_LIMIT,
    });

    if (result.provisionedCount > 0) {
      await this.prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          primaryPracticeArea: prefs.primaryPracticeArea,
          templatesLibraryProvisionedAt: new Date(),
        },
        update: { templatesLibraryProvisionedAt: new Date() },
      });
    }

    return result.provisionedCount;
  }

  /**
   * Seed multi-jurisdiction clause library templates into SystemDocumentTemplate.
   * Idempotent — skips templates already present.
   */
  async seedJurisdictionTemplates(): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const seed of JURISDICTION_TEMPLATE_SEEDS) {
      const existing = await this.prisma.systemDocumentTemplate.findFirst({
        where: {
          name: seed.name,
          countryCode: seed.countryCode,
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.systemDocumentTemplate.create({
        data: {
          name: seed.name,
          content: seed.content,
          countryCode: seed.countryCode,
          practiceArea: seed.practiceArea,
          documentKind: seed.documentKind,
          jurisdiction: seed.jurisdiction,
          category: 'JURISDICTION_SPECIFIC',
          sortOrder: seed.sortOrder + 100,
          isActive: true,
        },
      });
      seeded++;
    }

    return { seeded, skipped };
  }
}
