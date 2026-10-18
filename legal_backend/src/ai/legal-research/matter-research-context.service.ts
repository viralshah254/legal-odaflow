import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { DocumentsService } from '@/documents/documents.service';
import { PrismaService } from '@/prisma/prisma.service';

export const MATTER_RESEARCH_CONTEXT_CAPS = {
  profileChars: 6_000,
  documentChars: 6_000,
  documentsTotalChars: 16_000,
  savedResearchChars: 4_000,
  totalChars: 30_000,
} as const;

export interface MatterResearchActor {
  tenantId: string;
  userId: string;
  tenantRole?: string;
}

export interface MatterResearchSelection {
  matterId?: string;
  selectedDocumentIds?: string[];
  selectedSavedResearchIds?: string[];
}

@Injectable()
export class MatterResearchContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly documents: DocumentsService,
  ) {}

  async getSelectionOptions(actor: MatterResearchActor, matterId: string) {
    const matter = await this.getAuthorizedMatter(actor, matterId);
    const [documents, savedResearch] = await Promise.all([
      this.documents.listAccessibleMatterDocumentsForResearch(
        actor.tenantId,
        matterId,
        actor.userId,
        actor.tenantRole,
      ),
      this.prisma.savedResearch.findMany({
        where: { tenantId: actor.tenantId, matterId },
        select: { id: true, title: true, query: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      matter: {
        id: matter.id,
        title: matter.title,
        factsSummary: matter.factsSummary,
        updatedAt: matter.updatedAt,
      },
      documents,
      savedResearch,
    };
  }

  async buildPromptContext(
    actor: MatterResearchActor,
    selection: MatterResearchSelection,
  ): Promise<string | undefined> {
    const documentIds = [...new Set(selection.selectedDocumentIds ?? [])];
    const savedResearchIds = [...new Set(selection.selectedSavedResearchIds ?? [])];
    if (!selection.matterId) {
      if (documentIds.length || savedResearchIds.length) {
        throw new BadRequestException('A matter is required for selected research context');
      }
      return undefined;
    }

    const matter = await this.getAuthorizedMatter(actor, selection.matterId);
    const selectedDocuments = await this.documents.loadSelectedMatterDocumentsForResearch(
      actor.tenantId,
      matter.id,
      actor.userId,
      actor.tenantRole,
      documentIds,
      {
        perItemChars: MATTER_RESEARCH_CONTEXT_CAPS.documentChars,
        totalChars: MATTER_RESEARCH_CONTEXT_CAPS.documentsTotalChars,
      },
    );
    const selectedResearch = savedResearchIds.length
      ? await this.prisma.savedResearch.findMany({
          where: {
            id: { in: savedResearchIds },
            tenantId: actor.tenantId,
            matterId: matter.id,
          },
          select: {
            id: true,
            title: true,
            query: true,
            researchJson: true,
            createdAt: true,
          },
        })
      : [];
    if (selectedResearch.length !== savedResearchIds.length) {
      throw new ForbiddenException('Selected saved research is not available for this matter');
    }

    let remaining = MATTER_RESEARCH_CONTEXT_CAPS.totalChars;
    const append = (label: string, value: string, itemCap: number) => {
      const normalized = value.trim();
      if (!normalized || remaining <= 0) return '';
      const content = normalized.slice(0, Math.min(itemCap, remaining));
      remaining -= content.length;
      return `${label}\n${content}${content.length < normalized.length ? '\n[TRUNCATED]' : ''}`;
    };

    const profile = [
      `Title: ${matter.title}`,
      `Last updated: ${matter.updatedAt.toISOString()}`,
      matter.factsSummary ? `Facts summary: ${matter.factsSummary}` : '',
      matter.matterProfile ? `Matter profile: ${JSON.stringify(matter.matterProfile)}` : '',
      matter.matterGraph ? `Matter graph: ${JSON.stringify(matter.matterGraph)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const blocks = [
      append(
        `[MATTER PROFILE | matterId=${matter.id}]`,
        profile,
        MATTER_RESEARCH_CONTEXT_CAPS.profileChars,
      ),
    ];

    for (const document of selectedDocuments) {
      blocks.push(
        append(
          `[SELECTED MATTER DOCUMENT | documentId=${document.id} | name=${document.fileName} | updatedAt=${document.updatedAt.toISOString()}]`,
          document.extractedText,
          MATTER_RESEARCH_CONTEXT_CAPS.documentChars,
        ),
      );
    }

    const researchById = new Map(selectedResearch.map((item) => [item.id, item]));
    for (const id of savedResearchIds) {
      const item = researchById.get(id)!;
      blocks.push(
        append(
          `[SELECTED FILED RESEARCH | savedResearchId=${item.id} | title=${item.title} | filedAt=${item.createdAt.toISOString()}]`,
          this.savedResearchSnippet(item.query, item.researchJson),
          MATTER_RESEARCH_CONTEXT_CAPS.savedResearchChars,
        ),
      );
    }

    return [
      'AUTHORIZED MATTER CONTEXT — use only the explicitly selected artifacts below. Empty artifact sections mean no documents or filed research were authorized for this run.',
      ...blocks.filter(Boolean),
      'END AUTHORIZED MATTER CONTEXT',
    ].join('\n\n');
  }

  private async getAuthorizedMatter(actor: MatterResearchActor, matterId: string) {
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
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId: actor.tenantId },
      select: {
        id: true,
        title: true,
        factsSummary: true,
        updatedAt: true,
        matterProfile: true,
        matterGraph: true,
      },
    });
    if (!matter) throw new ForbiddenException('Matter access denied');
    return matter;
  }

  private savedResearchSnippet(query: string, researchJson: unknown): string {
    const value =
      researchJson && typeof researchJson === 'object'
        ? (researchJson as Record<string, unknown>)
        : {};
    const answer = [value.answer, value.outputMarkdown, value.summary].find(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
    );
    return [`Original query: ${query}`, answer ? `Research excerpt: ${answer}` : ''].filter(Boolean).join('\n');
  }
}
