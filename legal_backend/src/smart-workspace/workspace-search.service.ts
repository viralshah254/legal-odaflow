import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface WorkspaceSearchHit {
  documentId: string
  fileName: string
  page?: number
  startOffset: number
  endOffset: number
  excerpt: string
  score: number
}

@Injectable()
export class WorkspaceSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full-text search over all documents in a workspace using Postgres ilike.
   * Phase 2+ can upgrade to pgvector for semantic search.
   */
  async search(
    tenantId: string,
    workspaceId: string,
    query: string,
    limit = 20,
  ): Promise<WorkspaceSearchHit[]> {
    const workspace = await this.prisma.smartWorkspace.findFirst({
      where: { id: workspaceId, tenantId },
      include: {
        workspaceDocs: {
          include: {
            document: {
              select: { id: true, fileName: true, extractedText: true },
            },
          },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const hits: WorkspaceSearchHit[] = [];
    const needle = query.toLowerCase()

    for (const wd of workspace.workspaceDocs) {
      const text = wd.document.extractedText ?? ''
      if (!text) continue

      const lower = text.toLowerCase()
      let pos = 0
      let found = 0

      while (found < 5) {
        const idx = lower.indexOf(needle, pos)
        if (idx === -1) break

        const start = Math.max(0, idx - 80)
        const end = Math.min(text.length, idx + needle.length + 80)
        hits.push({
          documentId: wd.documentId,
          fileName: wd.document.fileName,
          startOffset: idx,
          endOffset: idx + needle.length,
          excerpt: `...${text.slice(start, end)}...`,
          score: 1,
        })

        pos = idx + needle.length
        found++
      }
    }

    return hits.slice(0, limit)
  }
}
