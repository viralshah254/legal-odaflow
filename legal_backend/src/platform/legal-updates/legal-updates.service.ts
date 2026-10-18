import { Injectable, NotFoundException } from '@nestjs/common';
import { LegalUpdateRecord } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LegalUpdatesService {
  constructor(private readonly prisma: PrismaService) {}

  async detectUpdates(jurisdiction: string): Promise<LegalUpdateRecord[]> {
    return this.prisma.legalUpdateRecord.findMany({
      where: { jurisdiction, status: 'pending' },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async recordUpdate(
    update: Omit<LegalUpdateRecord, 'id' | 'detectedAt' | 'createdAt' | 'updatedAt'>,
  ): Promise<LegalUpdateRecord> {
    return this.prisma.legalUpdateRecord.create({
      data: {
        tenantId: update.tenantId,
        updateType: update.updateType,
        jurisdiction: update.jurisdiction,
        title: update.title,
        summary: update.summary,
        significance: update.significance,
        sourceUrl: update.sourceUrl,
        affectedDocumentIds: update.affectedDocumentIds,
        affectedPropositionIds: update.affectedPropositionIds,
        status: update.status,
        publishedAt: update.publishedAt,
      },
    });
  }

  async getImpactedResearch(updateId: string, tenantId: string) {
    const update = await this.prisma.legalUpdateRecord.findUnique({ where: { id: updateId } });
    if (!update) throw new NotFoundException(`Update ${updateId} not found`);

    if (update.affectedDocumentIds.length === 0) return [];

    return this.prisma.researchWorkspace.findMany({
      where: {
        tenantId,
        status: 'completed',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listUpdates(jurisdiction?: string, status?: string): Promise<LegalUpdateRecord[]> {
    return this.prisma.legalUpdateRecord.findMany({
      where: {
        ...(jurisdiction ? { jurisdiction } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getUpdate(updateId: string): Promise<LegalUpdateRecord> {
    const update = await this.prisma.legalUpdateRecord.findUnique({ where: { id: updateId } });
    if (!update) throw new NotFoundException(`Update ${updateId} not found`);
    return update;
  }

  async reviewUpdate(updateId: string, status: string): Promise<LegalUpdateRecord> {
    const update = await this.getUpdate(updateId);
    return this.prisma.legalUpdateRecord.update({
      where: { id: update.id },
      data: { status },
    });
  }

  async getMatterLegalUpdates(matterId: string, tenantId: string): Promise<LegalUpdateRecord[]> {
    const workspaces = await this.prisma.researchWorkspace.findMany({
      where: { matterId, tenantId },
      select: { authorities: true },
    });

    const allDocIds = new Set<string>();
    for (const ws of workspaces) {
      const auths = ws.authorities as Array<{ id?: string }> | null;
      if (Array.isArray(auths)) {
        auths.forEach((a) => { if (a?.id) allDocIds.add(a.id); });
      }
    }

    if (allDocIds.size === 0) return [];

    return this.prisma.legalUpdateRecord.findMany({
      where: {
        affectedDocumentIds: {
          hasSome: Array.from(allDocIds),
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }
}
