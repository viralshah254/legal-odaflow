import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  resolveDocumentKind,
  resolveMatterDocumentKind,
} from '@/config/templates/document-kinds';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { TemplateLibraryService } from './template-library.service';

export interface TemplateSelectionInput {
  tenantId: string;
  documentType?: string;
  countryCode: string;
  practiceAreaSlug: string;
  matterJurisdiction?: string | null;
  factsSummary?: string | null;
  planningAnswers?: Record<string, string>;
}

export interface SelectedTemplate {
  id: string;
  name: string;
  documentKind: string | null;
  countryCode: string | null;
  practiceArea: string | null;
  jurisdiction: string | null;
}

@Injectable()
export class TemplateSelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateLibrary: TemplateLibraryService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
  ) {}

  async selectTemplate(input: TemplateSelectionInput): Promise<SelectedTemplate> {
    let documentKind = resolveDocumentKind(
      input.documentType,
      input.factsSummary ?? undefined,
      input.planningAnswers,
    );

    if (input.factsSummary?.trim()) {
      const miResult = await this.matterPipeline.run({
        facts: input.factsSummary,
        countryCode: input.countryCode,
        jurisdiction: input.matterJurisdiction ?? undefined,
        skipRetrieval: true,
      });
      documentKind =
        resolveMatterDocumentKind(miResult.profile, input.factsSummary) ?? documentKind;
    }

    const countryCode = (input.countryCode ?? 'US').toUpperCase();
    const matterJurisdiction = input.matterJurisdiction?.trim() || null;

    let candidates = await this.queryCandidates(
      input.tenantId,
      documentKind,
      countryCode,
      input.practiceAreaSlug,
      matterJurisdiction,
    );

    if (!candidates.length) {
      await this.provisionForKind(input.tenantId, documentKind, countryCode, input.practiceAreaSlug);
      candidates = await this.queryCandidates(
        input.tenantId,
        documentKind,
        countryCode,
        input.practiceAreaSlug,
        matterJurisdiction,
      );
    }

    if (!candidates.length) {
      candidates = await this.queryCandidates(
        input.tenantId,
        documentKind,
        countryCode,
        undefined,
        matterJurisdiction,
      );
    }

    if (!candidates.length) {
      const fallback = await this.prisma.documentTemplate.findFirst({
        where: {
          tenantId: input.tenantId,
          isActive: true,
          OR: [
            { documentKind },
            { systemTemplate: { documentKind } },
            { name: { contains: documentKind.replace(/_/g, ' '), mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (fallback) {
        return this.toSelected(fallback);
      }
      throw new NotFoundException(
        `No template found for document kind "${documentKind}" in ${countryCode}. Please provision templates in Settings.`,
      );
    }

    const scored = candidates
      .map((t) => ({
        template: t,
        score: this.scoreTemplate(t, {
          documentKind,
          countryCode,
          practiceAreaSlug: input.practiceAreaSlug,
          matterJurisdiction,
        }),
      }))
      .sort((a, b) => b.score - a.score);

    return this.toSelected(scored[0].template);
  }

  private async queryCandidates(
    tenantId: string,
    documentKind: string,
    countryCode: string,
    practiceAreaSlug: string | undefined,
    matterJurisdiction: string | null,
  ) {
    return this.prisma.documentTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
        countryCode,
        OR: [{ documentKind }, { systemTemplate: { documentKind } }],
        ...(practiceAreaSlug ? { practiceArea: practiceAreaSlug } : {}),
      },
      include: { systemTemplate: { select: { documentKind: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  private scoreTemplate(
    template: {
      documentKind: string | null;
      countryCode: string | null;
      practiceArea: string | null;
      jurisdiction: string | null;
      systemTemplate?: { documentKind: string | null } | null;
    },
    ctx: {
      documentKind: string;
      countryCode: string;
      practiceAreaSlug: string;
      matterJurisdiction: string | null;
    },
  ): number {
    let score = 0;
    const kind = template.documentKind ?? template.systemTemplate?.documentKind;
    if (kind === ctx.documentKind) score += 100;
    if (template.countryCode === ctx.countryCode) score += 50;
    if (template.practiceArea === ctx.practiceAreaSlug) score += 30;
    if (ctx.matterJurisdiction && template.jurisdiction === ctx.matterJurisdiction) {
      score += 40;
    } else if (!template.jurisdiction) {
      score += 10;
    }
    return score;
  }

  private async provisionForKind(
    tenantId: string,
    documentKind: string,
    countryCode: string,
    practiceAreaSlug: string,
  ) {
    await this.templateLibrary.provisionTemplates(tenantId, {
      countryCode,
      practiceArea: practiceAreaSlug,
      limit: 10,
    });

    const systemForKind = await this.prisma.systemDocumentTemplate.findMany({
      where: { documentKind, countryCode, isActive: true },
      take: 5,
      select: { id: true },
    });
    if (systemForKind.length) {
      await this.templateLibrary.provisionTemplates(tenantId, {
        systemTemplateIds: systemForKind.map((s) => s.id),
      });
    }
  }

  private toSelected(template: {
    id: string;
    name: string;
    documentKind: string | null;
    countryCode: string | null;
    practiceArea: string | null;
    jurisdiction: string | null;
  }): SelectedTemplate {
    return {
      id: template.id,
      name: template.name,
      documentKind: template.documentKind,
      countryCode: template.countryCode,
      practiceArea: template.practiceArea,
      jurisdiction: template.jurisdiction,
    };
  }
}
