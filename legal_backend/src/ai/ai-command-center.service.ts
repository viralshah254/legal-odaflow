import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  getOpenAiApiMode,
  isDeepSeekConfigured,
  isOpenAiConfigured,
} from './openai-transport';
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
  providerHealth: { status: string; provider: string; mode?: string };
}


@Injectable()
export class AiCommandCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiUsage: AiUsageService,
    private readonly creditWallet: CreditWalletService,
    private readonly configService: ConfigService,
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
      tenantWallet,
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
      this.creditWallet.getTenantWallet(tenantId),
    ]);

    const wallet = tenantWallet?.wallet;
    const aiCreditsIncluded = wallet?.planCreditsMonthly ?? 0;
    const aiCreditsUsed = wallet?.usedCreditsThisCycle ?? 0;

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
      aiCreditsUsed,
      aiCreditsIncluded,
      providerHealth: {
        status:
          isOpenAiConfigured(this.configService) ||
          isDeepSeekConfigured(this.configService)
            ? 'ok'
            : 'degraded',
        provider: this.configService.get<string>('AI_PROVIDER', 'openai') ?? 'openai',
        mode: getOpenAiApiMode(this.configService),
      },
    };
  }
}
