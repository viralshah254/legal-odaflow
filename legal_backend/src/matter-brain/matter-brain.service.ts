import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from '@/access/matter-access.service';

@Injectable()
export class MatterBrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
  ) {}

  async getBrain(
    tenantId: string,
    matterId: string,
    userId: string,
    tenantRole?: string,
  ) {
    try {
      await this.matterAccess.ensureMatterAccess(
        tenantId,
        userId,
        matterId,
        tenantRole,
      );
    } catch {
      throw new ForbiddenException('Matter access denied');
    }

    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    const [facts, issues, timelineEvents, documents, strategyMemos] = await Promise.all([
      this.prisma.matterFact.findMany({
        where: { tenantId, matterId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.matterIssue.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.timelineEvent.findMany({
        where: { tenantId, matterId },
        orderBy: { occurredAt: 'desc' },
        take: 50,
      }),
      this.prisma.document.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          visibility: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.matterStrategyMemo.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      matterId: matter.id,
      title: matter.title,
      status: matter.status,
      countryCode: matter.countryCode,
      jurisdiction: matter.jurisdiction,
      practiceArea: matter.practiceArea,
      client: matter.client,
      generatedAt: new Date().toISOString(),
      facts,
      issues,
      timeline: timelineEvents,
      documents,
      strategyMemos,
      summary: {
        factCount: facts.length,
        openIssueCount: issues.filter((issue) => issue.status === 'OPEN').length,
        documentCount: documents.length,
        strategyMemoCount: strategyMemos.length,
        latestTimelineEvent: timelineEvents[0] ?? null,
      },
    };
  }
}
