import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AiUsageService } from './ai-usage.service';

export interface CommandCenterSummary {
  newConsumerLeads: number;
  aiDraftsAwaitingReview: number;
  highRiskMatters: number;
  documentsNeedingClassification: number;
  missedUrgentDeadlines: number;
  suggestedTimeEntries: number;
  researchMemosGenerated: number;
  opponentFilingsNeedingResponse: number;
  aiCostThisMonthUsd: number;
  aiCreditsUsed: number;
  aiCreditsIncluded: number;
  providerHealth: { status: string; provider: string };
}

@Injectable()
export class AiCommandCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async getSummary(tenantId: string): Promise<CommandCenterSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      newConsumerLeads,
      aiDraftsAwaitingReview,
      highRiskMatters,
      documentsNeedingClassification,
      missedUrgentDeadlines,
      suggestedTimeEntries,
      researchMemosGenerated,
      opponentFilingsNeedingResponse,
      usageSummary,
      budgetPolicy,
    ] = await Promise.all([
      this.prisma.lawyerLead.count({
        where: { tenantId, status: { in: ['NEW', 'OPEN'] } },
      }),
      this.prisma.aIOutput.count({
        where: {
          tenantId,
          requiresLawyerReview: true,
        },
      }),
      this.prisma.matter.count({
        where: {
          tenantId,
          riskScore: { gte: 0.7 },
        },
      }),
      this.prisma.document.count({
        where: {
          tenantId,
          OR: [{ mimeType: null }, { mimeType: '' }],
        },
      }),
      this.prisma.task.count({
        where: {
          tenantId,
          dueDate: { lt: now },
          status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
        },
      }),
      this.prisma.timeEntry.count({
        where: {
          tenantId,
          status: 'DRAFT',
        },
      }),
      this.prisma.aIUsageLog.count({
        where: {
          tenantId,
          taskType: 'LEGAL_RESEARCH',
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.task.count({
        where: {
          tenantId,
          status: { in: ['TODO', 'IN_PROGRESS', 'OPEN'] },
          title: { contains: 'opponent', mode: 'insensitive' },
        },
      }),
      this.aiUsage.getUsageSummary({ tenantId, from: monthStart, to: now }),
      this.prisma.aIBudgetPolicy.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const aiCreditsIncluded = budgetPolicy?.monthlyBudgetUsd
      ? Math.floor(Number(budgetPolicy.monthlyBudgetUsd) / 0.05)
      : 100;
    const aiCreditsUsed = await this.prisma.aICreditLedger.aggregate({
      where: {
        tenantId,
        eventType: 'DEBIT',
        createdAt: { gte: monthStart },
      },
      _sum: { credits: true },
    });

    return {
      newConsumerLeads,
      aiDraftsAwaitingReview,
      highRiskMatters,
      documentsNeedingClassification,
      missedUrgentDeadlines,
      suggestedTimeEntries,
      researchMemosGenerated,
      opponentFilingsNeedingResponse,
      aiCostThisMonthUsd: usageSummary.totalCostUsd ?? 0,
      aiCreditsUsed: aiCreditsUsed._sum.credits ?? 0,
      aiCreditsIncluded,
      providerHealth: {
        status: process.env.OPENAI_API_KEY ? 'ok' : 'degraded',
        provider: process.env.AI_PROVIDER ?? 'openai',
      },
    };
  }
}
