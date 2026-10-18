import { Injectable } from '@nestjs/common';
import { OpenSearchAdapterService } from '@/legal-sources/search/opensearch-adapter.service';
import { PrismaService } from '@/prisma/prisma.service';

export interface GlobalSearchResult {
  matters: Array<{ id: string; title: string; caseNumber: string | null; status: string }>;
  clients: Array<{ id: string; name: string; email: string | null; clientCode: string }>;
  documents: Array<{
    id: string;
    fileName: string;
    matterId: string | null;
    clientId: string | null;
    clientName: string | null;
    clientCode: string | null;
  }>;
  tasks: Array<{ id: string; title: string; status: string; matterId: string | null }>;
}

export interface UnifiedSearchResult extends GlobalSearchResult {
  query: string;
  provider: 'opensearch' | 'prisma';
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openSearch: OpenSearchAdapterService,
  ) {}

  async globalSearch(tenantId: string, query: string, limit = 8): Promise<GlobalSearchResult> {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { matters: [], clients: [], documents: [], tasks: [] };
    }

    if (this.openSearch.isEnabled) {
      const osResults = await this.openSearch.searchFirmEntities({
        tenantId,
        query: q,
        limit,
      });
      if (
        osResults.matters.length > 0 ||
        osResults.clients.length > 0 ||
        osResults.documents.length > 0 ||
        osResults.tasks.length > 0
      ) {
        return osResults;
      }
    }

    const contains = { contains: q, mode: 'insensitive' as const };

    const [matters, clients, documents, tasks] = await Promise.all([
      this.prisma.matter.findMany({
        where: {
          tenantId,
          OR: [
            { title: contains },
            { caseNumber: contains },
            { factsSummary: contains },
            { opposingParty: contains },
          ],
        },
        select: { id: true, title: true, caseNumber: true, status: true },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.client.findMany({
        where: {
          tenantId,
          OR: [
            { name: contains },
            { email: contains },
            { clientCode: contains },
          ],
        },
        select: { id: true, name: true, email: true, clientCode: true },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.document.findMany({
        where: {
          tenantId,
          OR: [
            { fileName: contains },
            { documentCode: contains },
            { extractedText: contains },
            {
              client: {
                OR: [
                  { name: contains },
                  { clientCode: contains },
                ],
              },
            },
          ],
        },
        select: {
          id: true,
          fileName: true,
          matterId: true,
          clientId: true,
          client: { select: { name: true, clientCode: true } },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          OR: [{ title: contains }],
        },
        select: { id: true, title: true, status: true, matterId: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      matters,
      clients,
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        matterId: doc.matterId,
        clientId: doc.clientId,
        clientName: doc.client?.name ?? null,
        clientCode: doc.client?.clientCode ?? null,
      })),
      tasks,
    };
  }

  async unifiedSearch(
    tenantId: string,
    query: string,
    limit = 8,
  ): Promise<UnifiedSearchResult> {
    const q = query.trim();
    const provider = this.openSearch.isEnabled ? 'opensearch' : 'prisma';
    const results = await this.globalSearch(tenantId, q, limit);
    return {
      query: q,
      provider,
      ...results,
    };
  }
}
