import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiGatewayService,
} from '@/ai/ai-gateway.service';
import { AI_TASK_TYPES } from '@/ai/constants';
import {
  getAnalysisQuota,
  normalizeBillingPlan,
  planIncludesDeepAnalysis,
  type AnalysisQuotaKind,
} from '@/config/billing-plans';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { PrismaService } from '@/prisma/prisma.service';
import { hashPrompt } from '@/common/utils/prompt-hash.util';

const RUN_TYPE_TO_QUOTA: Record<string, AnalysisQuotaKind> = {
  SIMILAR_CASES: 'similarCases',
  OPPONENT: 'opponentAngles',
  STRATEGY: 'strategyMemo',
};

export const ANALYSIS_RUN_TYPES = {
  PREVIEW: 'PREVIEW',
  SIMILAR_CASES: 'SIMILAR_CASES',
  OPPONENT: 'OPPONENT',
  STRATEGY: 'STRATEGY',
  DOC_REFRESH: 'DOC_REFRESH',
} as const;

@Injectable()
export class IntakeAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly hybridSearch: HybridSearchService,
  ) {}

  async verifyLeadAccess(userId: string, leadId: string) {
    return this.requireLeadAccess(userId, leadId);
  }

  async getAnalysisRuns(userId: string, leadId: string) {
    const lead = await this.requireLeadAccess(userId, leadId);
    return this.prisma.caseAnalysisRun.findMany({
      where: { lawyerLeadId: lead.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async runSimilarCases(userId: string, leadId: string) {
    const lead = await this.requireLeadAccess(userId, leadId);
    await this.assertQuota(lead.tenantId!, 'SIMILAR_CASES');

    const context = await this.loadLeadContext(lead);
    const searchQuery = [context.issueType, context.title, context.facts]
      .filter(Boolean)
      .join(' ');

    const authorities = await this.hybridSearch.search(searchQuery, {
      countryCode: context.countryCode,
      jurisdiction: context.jurisdiction,
      limit: 8,
    });

    const authorityBlock = authorities
      .map(
        (row) =>
          `- ${row.title}${row.citation ? ` (${row.citation})` : ''}: ${row.summary ?? row.sourceName}`,
      )
      .join('\n');

    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId: lead.tenantId!,
      taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
      systemPrompt:
        'You are a legal research assistant for licensed attorneys. Analyze similar cases with binding vs persuasive weight. Note outcomes favoring the client side when possible and distinguish unfavorable cases.',
      userPrompt: [
        `Find and analyze similar cases in ${context.jurisdiction ?? context.countryCode}.`,
        `Issue: ${context.issueType}`,
        `Facts: ${context.facts ?? 'Not provided'}`,
        `Client side: ${context.clientSide ?? 'Not specified'}`,
        authorityBlock
          ? `\nRetrieved authorities:\n${authorityBlock}`
          : '\nNo authorities retrieved — note limitations.',
        '',
        'Return markdown analysis then append JSON:',
        '```json',
        '{"cases":[{"title":"","citation":"","outcome":"","favoredSide":"","relevance":"","excerpt":""}]}',
        '```',
      ].join('\n'),
    });

    const structured = this.parseSimilarCasesJson(aiResult.outputMarkdown);

    return this.persistRun({
      tenantId: lead.tenantId!,
      consumerCaseId: lead.consumerCaseId!,
      lawyerLeadId: lead.id,
      runType: ANALYSIS_RUN_TYPES.SIMILAR_CASES,
      trigger: 'manual',
      structuredOutput: structured as Prisma.InputJsonValue,
      contentMarkdown: this.stripJsonBlock(aiResult.outputMarkdown),
      citations: authorities.map((row) => ({
        authorityId: row.id,
        citation: row.citation ?? row.title,
        sourceName: row.sourceName,
      })),
      createdByUserId: userId,
      inputHash: hashPrompt(searchQuery),
    });
  }

  async runOpponentAngles(userId: string, leadId: string) {
    const lead = await this.requireLeadAccess(userId, leadId);
    await this.assertQuota(lead.tenantId!, 'OPPONENT');

    const context = await this.loadLeadContext(lead);
    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId: lead.tenantId!,
      taskType: AI_TASK_TYPES.OPPONENT_ANALYZER,
      systemPrompt:
        'Analyze likely opponent arguments for licensed attorneys. Be direct and actionable.',
      userPrompt: [
        `Map opponent arguments for this intake matter.`,
        `Issue: ${context.issueType}`,
        `Facts: ${context.facts ?? 'Not provided'}`,
        `Our client side: ${context.clientSide ?? 'Not specified'}`,
        '',
        'Sections: Likely opponent claims, Evidence they may rely on, Weaknesses in our position, Counterarguments.',
        'Append JSON:',
        '```json',
        '{"opponentClaims":[],"opponentEvidence":[],"weaknesses":[],"counterarguments":[]}',
        '```',
      ].join('\n'),
      reasoningModel: true,
    });

    const structured = this.parseGenericJson(aiResult.outputMarkdown, {
      opponentClaims: [],
      opponentEvidence: [],
      weaknesses: [],
      counterarguments: [],
    });

    return this.persistRun({
      tenantId: lead.tenantId!,
      consumerCaseId: lead.consumerCaseId!,
      lawyerLeadId: lead.id,
      runType: ANALYSIS_RUN_TYPES.OPPONENT,
      trigger: 'manual',
      structuredOutput: structured as Prisma.InputJsonValue,
      contentMarkdown: this.stripJsonBlock(aiResult.outputMarkdown),
      createdByUserId: userId,
    });
  }

  async runStrategyMemo(userId: string, leadId: string) {
    const lead = await this.requireLeadAccess(userId, leadId);
    await this.assertQuota(lead.tenantId!, 'STRATEGY');

    const context = await this.loadLeadContext(lead);
    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId: lead.tenantId!,
      taskType: AI_TASK_TYPES.STRATEGY_MEMO,
      systemPrompt:
        'Draft a strategy memo for licensed attorneys with options and recommended path.',
      userPrompt: [
        `Generate strategy options for counsel.`,
        `Issue: ${context.issueType}`,
        `Facts: ${context.facts ?? 'Not provided'}`,
        `Desired outcome: ${context.desiredOutcome ?? 'Not specified'}`,
        '',
        'Sections: Short answer, Options A/B/C, Recommended path, Deadlines, Evidence to gather.',
        'Append JSON:',
        '```json',
        '{"shortAnswer":"","options":[],"recommendedPath":"","deadlines":[],"evidenceToGather":[]}',
        '```',
      ].join('\n'),
    });

    const structured = this.parseGenericJson(aiResult.outputMarkdown, {
      shortAnswer: '',
      options: [],
      recommendedPath: '',
      deadlines: [],
      evidenceToGather: [],
    });

    return this.persistRun({
      tenantId: lead.tenantId!,
      consumerCaseId: lead.consumerCaseId!,
      lawyerLeadId: lead.id,
      runType: ANALYSIS_RUN_TYPES.STRATEGY,
      trigger: 'manual',
      structuredOutput: structured as Prisma.InputJsonValue,
      contentMarkdown: this.stripJsonBlock(aiResult.outputMarkdown),
      createdByUserId: userId,
    });
  }

  async triggerDocRefresh(consumerCaseId: string, userId?: string) {
    const lead = await this.prisma.lawyerLead.findFirst({
      where: { consumerCaseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lead?.tenantId || !lead.consumerCaseId) {
      return null;
    }

    const context = await this.loadLeadContext(lead);
    const documents = await this.prisma.consumerDocument.findMany({
      where: { consumerCaseId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const docSummaries = documents
      .map(
        (doc) =>
          `- ${doc.fileName}${doc.aiSummary ? `: ${doc.aiSummary.slice(0, 500)}` : ''}`,
      )
      .join('\n');

    const previewRun = await this.prisma.caseAnalysisRun.findFirst({
      where: { lawyerLeadId: lead.id, runType: ANALYSIS_RUN_TYPES.PREVIEW },
      orderBy: { createdAt: 'desc' },
    });

    const priorStructured: Record<string, unknown> =
      (previewRun?.structuredOutput as Record<string, unknown> | null) ?? {
        situation: context.facts ?? '',
        legalIssues: [context.issueType],
        strengths: [],
        risksAndGaps: [],
        recommendedNextSteps: [],
        sourcesCited: [],
      };

    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId: userId ?? lead.userId ?? lead.tenantId,
      tenantId: lead.tenantId,
      taskType: AI_TASK_TYPES.DOCUMENT_EXPLAINER,
      systemPrompt:
        'Update a client matter intake workspace with new document context for licensed attorneys.',
      userPrompt: [
        `Refresh intake analysis after new documents uploaded.`,
        `Prior situation: ${String(priorStructured.situation ?? '')}`,
        `New documents:\n${docSummaries || 'No extracted summaries yet.'}`,
        '',
        'Update strengths, risks, and next steps. Append JSON matching intake workspace schema:',
        '```json',
        '{"situation":"","legalIssues":[],"strengths":[],"risksAndGaps":[],"recommendedNextSteps":[],"sourcesCited":[]}',
        '```',
      ].join('\n'),
      skipDebit: true,
    });

    const structured = this.parseGenericJson(
      aiResult.outputMarkdown,
      priorStructured,
    );

    return this.persistRun({
      tenantId: lead.tenantId,
      consumerCaseId: lead.consumerCaseId,
      lawyerLeadId: lead.id,
      runType: ANALYSIS_RUN_TYPES.DOC_REFRESH,
      trigger: 'document_upload',
      structuredOutput: structured as Prisma.InputJsonValue,
      contentMarkdown: this.stripJsonBlock(aiResult.outputMarkdown),
      createdByUserId: userId,
    });
  }

  async getQuotaStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true },
    });

    const plan = normalizeBillingPlan(tenant?.billingPlan);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const usage = await this.prisma.caseAnalysisRun.groupBy({
      by: ['runType'],
      where: {
        tenantId,
        createdAt: { gte: monthStart },
        runType: {
          in: [
            ANALYSIS_RUN_TYPES.SIMILAR_CASES,
            ANALYSIS_RUN_TYPES.OPPONENT,
            ANALYSIS_RUN_TYPES.STRATEGY,
          ],
        },
      },
      _count: { _all: true },
    });

    const used = Object.fromEntries(
      usage.map((row) => [row.runType, row._count._all]),
    ) as Record<string, number>;

    return {
      plan,
      includesDeepAnalysis: planIncludesDeepAnalysis(tenant?.billingPlan),
      quotas: {
        similarCases: getAnalysisQuota(tenant?.billingPlan, 'similarCases'),
        opponentAngles: getAnalysisQuota(tenant?.billingPlan, 'opponentAngles'),
        strategyMemo: getAnalysisQuota(tenant?.billingPlan, 'strategyMemo'),
      },
      used: {
        similarCases: used[ANALYSIS_RUN_TYPES.SIMILAR_CASES] ?? 0,
        opponentAngles: used[ANALYSIS_RUN_TYPES.OPPONENT] ?? 0,
        strategyMemo: used[ANALYSIS_RUN_TYPES.STRATEGY] ?? 0,
      },
    };
  }

  private async persistRun(data: {
    tenantId: string;
    consumerCaseId: string;
    lawyerLeadId: string;
    runType: string;
    trigger: string;
    structuredOutput?: Prisma.InputJsonValue;
    contentMarkdown?: string;
    citations?: Prisma.InputJsonValue;
    createdByUserId?: string;
    inputHash?: string;
  }) {
    return this.prisma.caseAnalysisRun.create({
      data: {
        tenantId: data.tenantId,
        consumerCaseId: data.consumerCaseId,
        lawyerLeadId: data.lawyerLeadId,
        runType: data.runType,
        trigger: data.trigger,
        structuredOutput: data.structuredOutput ?? Prisma.JsonNull,
        contentMarkdown: data.contentMarkdown,
        citations: data.citations ?? Prisma.JsonNull,
        createdByUserId: data.createdByUserId,
        inputHash: data.inputHash,
      },
    });
  }

  private async assertQuota(tenantId: string, runType: string) {
    const quotaKind = RUN_TYPE_TO_QUOTA[runType];
    if (!quotaKind) return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true },
    });

    const limit = getAnalysisQuota(tenant?.billingPlan, quotaKind);
    if (limit <= 0) {
      throw new ForbiddenException(
        'Deep case analysis requires Professional or Enterprise plan. Upgrade in billing settings.',
      );
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const used = await this.prisma.caseAnalysisRun.count({
      where: {
        tenantId,
        runType,
        createdAt: { gte: monthStart },
      },
    });

    if (used >= limit) {
      throw new ForbiddenException(
        `Monthly ${quotaKind} quota exhausted (${limit}/${limit}). Resets next month or upgrade your plan.`,
      );
    }
  }

  private async requireLeadAccess(userId: string, leadId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    const tenantId = user?.tenantUsers[0]?.tenantId;
    const lead = await this.prisma.lawyerLead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (user?.userType === 'LAWYER') {
      if (!tenantId || lead.tenantId !== tenantId) {
        throw new ForbiddenException('Lead not accessible for this firm');
      }
      return lead;
    }

    if (lead.userId !== userId) {
      throw new ForbiddenException('Lead not accessible');
    }

    return lead;
  }

  private async loadLeadContext(lead: {
    consumerCaseId: string | null;
    issueType: string;
    summary: string | null;
    countryCode: string;
    jurisdiction: string | null;
  }) {
    const consumerCase = lead.consumerCaseId
      ? await this.prisma.consumerCase.findUnique({
          where: { id: lead.consumerCaseId },
        })
      : null;

    const partiesMatch = consumerCase?.facts?.match(/Parties involved: (.+)/i);

    return {
      issueType: lead.issueType,
      title: consumerCase?.title ?? lead.issueType,
      facts: consumerCase?.facts ?? lead.summary ?? undefined,
      desiredOutcome: consumerCase?.desiredOutcome ?? undefined,
      countryCode: lead.countryCode,
      jurisdiction: lead.jurisdiction ?? consumerCase?.jurisdiction ?? undefined,
      clientSide: partiesMatch?.[1],
    };
  }

  private parseSimilarCasesJson(content: string) {
    const parsed = this.parseGenericJson(content, { cases: [] as unknown[] });
    return parsed;
  }

  private parseGenericJson<T extends Record<string, unknown>>(
    content: string,
    fallback: T,
  ): T {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    if (!jsonMatch?.[1]) return fallback;
    try {
      return { ...fallback, ...(JSON.parse(jsonMatch[1]) as T) };
    } catch {
      return fallback;
    }
  }

  private stripJsonBlock(content: string): string {
    return content.replace(/```json[\s\S]*?```/gi, '').trim();
  }
}
