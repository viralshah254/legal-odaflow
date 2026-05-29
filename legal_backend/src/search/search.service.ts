import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface GlobalSearchResult {
  matters: Array<{ id: string; title: string; caseNumber: string | null; status: string }>;
  clients: Array<{ id: string; name: string; email: string | null }>;
  tasks: Array<{ id: string; title: string; status: string; matterId: string | null }>;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(tenantId: string, query: string, limit = 8): Promise<GlobalSearchResult> {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { matters: [], clients: [], tasks: [] };
    }

    const contains = { contains: q, mode: 'insensitive' as const };

    const [matters, clients, tasks] = await Promise.all([
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
          OR: [{ name: contains }, { email: contains }],
        },
        select: { id: true, name: true, email: true },
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

    return { matters, clients, tasks };
  }
}
