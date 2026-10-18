import { ForbiddenException } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { DocumentsService } from '@/documents/documents.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  MATTER_RESEARCH_CONTEXT_CAPS,
  MatterResearchContextService,
} from './matter-research-context.service';

jest.mock('@/documents/documents.service', () => ({
  DocumentsService: class DocumentsService {},
}));

describe('MatterResearchContextService', () => {
  const actor = { tenantId: 'tenant-1', userId: 'user-1', tenantRole: 'ASSOCIATE' };
  const matter = {
    id: 'matter-1',
    title: 'Acme dispute',
    factsSummary: 'A concise fact summary',
    updatedAt: new Date('2026-07-27T00:00:00.000Z'),
    matterProfile: { issues: ['breach'] },
    matterGraph: { nodes: [] },
  };

  function setup() {
    const prisma = {
      matter: { findFirst: jest.fn().mockResolvedValue(matter) },
      savedResearch: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const access = { ensureMatterAccess: jest.fn().mockResolvedValue(undefined) };
    const documents = {
      listAccessibleMatterDocumentsForResearch: jest.fn().mockResolvedValue([]),
      loadSelectedMatterDocumentsForResearch: jest.fn().mockResolvedValue([]),
    };
    const service = new MatterResearchContextService(
      prisma as unknown as PrismaService,
      access as unknown as MatterAccessService,
      documents as unknown as DocumentsService,
    );
    return { service, prisma, access, documents };
  }

  it('builds provenance-labelled context from explicitly selected artifacts', async () => {
    const { service, prisma, documents } = setup();
    documents.loadSelectedMatterDocumentsForResearch.mockResolvedValue([
      {
        id: 'doc-1',
        fileName: 'pleading.pdf',
        updatedAt: matter.updatedAt,
        extractedText: 'Selected pleading text',
        truncated: false,
      },
    ]);
    prisma.savedResearch.findMany.mockResolvedValue([
      {
        id: 'saved-1',
        title: 'Earlier memo',
        query: 'Earlier question',
        researchJson: { answer: 'Earlier researched conclusion' },
        createdAt: matter.updatedAt,
      },
    ]);

    const context = await service.buildPromptContext(actor, {
      matterId: matter.id,
      selectedDocumentIds: ['doc-1'],
      selectedSavedResearchIds: ['saved-1'],
    });

    expect(context).toContain('[MATTER PROFILE | matterId=matter-1]');
    expect(context).toContain('[SELECTED MATTER DOCUMENT | documentId=doc-1');
    expect(context).toContain('Selected pleading text');
    expect(context).toContain('[SELECTED FILED RESEARCH | savedResearchId=saved-1');
    expect(context).toContain('Earlier researched conclusion');
  });

  it('uses only matter profile and graph for an empty selection', async () => {
    const { service, prisma, documents } = setup();

    const context = await service.buildPromptContext(actor, { matterId: matter.id });

    expect(context).toContain('Facts summary: A concise fact summary');
    expect(context).not.toContain('SELECTED MATTER DOCUMENT');
    expect(context).not.toContain('SELECTED FILED RESEARCH');
    expect(documents.loadSelectedMatterDocumentsForResearch).toHaveBeenCalledWith(
      actor.tenantId,
      matter.id,
      actor.userId,
      actor.tenantRole,
      [],
      expect.any(Object),
    );
    expect(prisma.savedResearch.findMany).not.toHaveBeenCalled();
  });

  it('rejects callers without matter access', async () => {
    const { service, access } = setup();
    access.ensureMatterAccess.mockRejectedValue(new Error('denied'));

    await expect(
      service.buildPromptContext(actor, { matterId: matter.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects selected research from another matter or tenant', async () => {
    const { service, prisma } = setup();
    prisma.savedResearch.findMany.mockResolvedValue([]);

    await expect(
      service.buildPromptContext(actor, {
        matterId: matter.id,
        selectedSavedResearchIds: ['cross-matter-id'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces per-item and total prompt character caps', async () => {
    const { service, prisma, documents } = setup();
    documents.loadSelectedMatterDocumentsForResearch.mockResolvedValue([
      {
        id: 'doc-1',
        fileName: 'large.pdf',
        updatedAt: matter.updatedAt,
        extractedText: 'd'.repeat(MATTER_RESEARCH_CONTEXT_CAPS.documentChars),
        truncated: true,
      },
    ]);
    prisma.savedResearch.findMany.mockResolvedValue([
      {
        id: 'saved-1',
        title: 'Large memo',
        query: 'q',
        researchJson: { answer: 'r'.repeat(MATTER_RESEARCH_CONTEXT_CAPS.savedResearchChars * 2) },
        createdAt: matter.updatedAt,
      },
    ]);

    const context = await service.buildPromptContext(actor, {
      matterId: matter.id,
      selectedDocumentIds: ['doc-1'],
      selectedSavedResearchIds: ['saved-1'],
    });

    expect(context).toContain('[TRUNCATED]');
    expect(context!.length).toBeLessThan(MATTER_RESEARCH_CONTEXT_CAPS.totalChars + 2_000);
  });
});
