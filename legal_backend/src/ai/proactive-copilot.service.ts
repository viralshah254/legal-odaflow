import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ResearchCachePromotionService } from './legal-research/research-cache-promotion.service';

export interface PendingAiReviewItem {
  id: string;
  taskType: string;
  mode: string;
  title: string;
  preview: string;
  outputMarkdown: string;
  matterId: string | null;
  matterTitle: string | null;
  riskLevel: string | null;
  jurisdiction: string | null;
  legalDomain: string | null;
  verified: boolean;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
}

export interface MorningBriefDeadline {
  taskId: string;
  title: string;
  dueDate: string;
  matterId: string | null;
  matterTitle: string | null;
}

export interface MorningBrief {
  generatedAt: string;
  matterDeadlines: MorningBriefDeadline[];
  pendingApprovals: number;
  leadCount: number;
}

@Injectable()
export class ProactiveCopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly researchCachePromotion: ResearchCachePromotionService,
  ) {}

  async getMorningBrief(tenantId: string, userId: string): Promise<MorningBrief> {
    const now = new Date();
    const weekOut = new Date(now);
    weekOut.setDate(weekOut.getDate() + 7);

    const [deadlineTasks, pendingApprovals, leadCount] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          tenantId,
          assigneeId: userId,
          dueDate: { gte: now, lte: weekOut },
          status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          matterId: true,
          matter: { select: { title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      this.prisma.aIOutput.count({
        where: {
          tenantId,
          requiresLawyerReview: true,
        },
      }),
      this.prisma.lawyerLead.count({
        where: {
          tenantId,
          status: { in: ['NEW', 'OPEN'] },
        },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      matterDeadlines: deadlineTasks
        .filter((task) => task.dueDate)
        .map((task) => ({
          taskId: task.id,
          title: task.title,
          dueDate: task.dueDate!.toISOString(),
          matterId: task.matterId,
          matterTitle: task.matter?.title ?? null,
        })),
      pendingApprovals,
      leadCount,
    };
  }

  async listPendingReview(
    tenantId: string,
    limit = 50,
  ): Promise<PendingAiReviewItem[]> {
    const rows = await this.prisma.aIOutput.findMany({
      where: {
        tenantId,
        requiresLawyerReview: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        taskType: true,
        mode: true,
        inputQuery: true,
        outputMarkdown: true,
        matterId: true,
        userId: true,
        riskLevel: true,
        jurisdiction: true,
        legalDomain: true,
        verified: true,
        createdAt: true,
      },
    });

    return this.mapPendingReviewRows(rows);
  }

  async getPendingReviewItem(
    tenantId: string,
    outputId: string,
  ): Promise<PendingAiReviewItem> {
    const row = await this.prisma.aIOutput.findFirst({
      where: {
        id: outputId,
        tenantId,
        approvedByLawyerId: null,
      },
      select: {
        id: true,
        taskType: true,
        mode: true,
        inputQuery: true,
        outputMarkdown: true,
        matterId: true,
        userId: true,
        riskLevel: true,
        jurisdiction: true,
        legalDomain: true,
        verified: true,
        createdAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException('AI output not found or already reviewed');
    }

    const [mapped] = await this.mapPendingReviewRows([row]);
    return mapped;
  }

  async approveOutput(
    tenantId: string,
    lawyerId: string,
    outputId: string,
  ): Promise<{ id: string; approved: true }> {
    const output = await this.prisma.aIOutput.findFirst({
      where: {
        id: outputId,
        tenantId,
        requiresLawyerReview: true,
      },
      select: { id: true, taskType: true },
    });
    if (!output) {
      throw new NotFoundException('AI output not found or already reviewed');
    }

    await this.prisma.aIOutput.update({
      where: { id: outputId },
      data: {
        requiresLawyerReview: false,
        approvedByLawyerId: lawyerId,
      },
    });
    if (output.taskType === 'LEGAL_RESEARCH') {
      await this.researchCachePromotion.promote({
        aiOutputId: outputId,
        tenantId,
        reason: 'approval',
      });
    }

    return { id: outputId, approved: true };
  }

  private async mapPendingReviewRows(
    rows: Array<{
      id: string;
      taskType: string;
      mode: string;
      inputQuery: string | null;
      outputMarkdown: string;
      matterId: string | null;
      userId: string | null;
      riskLevel: string | null;
      jurisdiction: string | null;
      legalDomain: string | null;
      verified: boolean;
      createdAt: Date;
    }>,
  ): Promise<PendingAiReviewItem[]> {
    const matterIds = [...new Set(rows.map((row) => row.matterId).filter(Boolean))] as string[];
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))] as string[];

    const [matters, users] = await Promise.all([
      matterIds.length
        ? this.prisma.matter.findMany({
            where: { id: { in: matterIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const matterTitleById = new Map(matters.map((matter) => [matter.id, matter.title]));
    const userById = new Map(users.map((user) => [user.id, user]));

    return rows.map((row) => {
      const query = row.inputQuery?.trim();
      const previewSource = query || row.outputMarkdown || '';
      const author = row.userId ? userById.get(row.userId) : undefined;
      return {
        id: row.id,
        taskType: row.taskType,
        mode: row.mode,
        title: query || this.formatTaskType(row.taskType),
        preview: previewSource.slice(0, 200),
        outputMarkdown: row.outputMarkdown,
        matterId: row.matterId,
        matterTitle: row.matterId ? matterTitleById.get(row.matterId) ?? null : null,
        riskLevel: row.riskLevel,
        jurisdiction: row.jurisdiction,
        legalDomain: row.legalDomain,
        verified: row.verified,
        createdAt: row.createdAt.toISOString(),
        authorName: author?.name ?? null,
        authorEmail: author?.email ?? null,
      };
    });
  }

  private formatTaskType(taskType: string): string {
    return taskType
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }
}
