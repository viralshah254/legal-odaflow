import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { AI_TASK_TYPES } from '@/ai/constants';
import { STANDARD_DISCLAIMER } from '@/legal-compliance/disclaimer.constants';
import { PrismaService } from '@/prisma/prisma.service';
import { TasksService } from '@/tasks/tasks.service';
import { UpdateOutcomeAnalysisDto } from './dto/outcome-analysis.dto';

interface OutcomeBrainContext {
  matterTitle: string;
  countryCode: string;
  jurisdiction: string | null;
  practiceArea: string | null;
  facts: Array<{ factText: string; isDisputed: boolean; approvedByLawyer: boolean }>;
  issues: Array<{ title: string; status: string; priority: string }>;
  arguments: Array<{ title: string; side: string; strength: string | null }>;
  strategyMemos: Array<{ title: string; status: string }>;
}

interface StructuredOutcomeAnalysis {
  overallBand: string;
  confidence: string;
  winProbability: { low: number; mid: number; high: number };
  lossProbability: { low: number; mid: number; high: number };
  settlementProbability: { low: number; mid: number; high: number };
  scenarios: Array<{ label: string; description: string; likelihood: string }>;
  factorsFor: string[];
  factorsAgainst: string[];
  solutions: string[];
  missingEvidence: string[];
  citations: Array<{ title: string; citation?: string }>;
  disclaimers: string[];
}

@Injectable()
export class MatterOutcomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly aiGateway: AiGatewayService,
    private readonly tasksService: TasksService,
    private readonly configService: ConfigService,
  ) {}

  async generate(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);
    const context = await this.loadBrainContext(tenantId, matterId);

    const aiResult = await this.aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId,
      taskType: AI_TASK_TYPES.CASE_OUTCOME_ANALYSIS,
      systemPrompt:
        'You are a litigation outcome analyst for licensed attorneys. Provide probabilistic scenario analysis based on matter facts, issues, and arguments. Never guarantee outcomes.',
      userPrompt: this.buildAnalysisPrompt(context),
      reasoningModel: true,
      skipDebit: false,
    });

    const structured = this.parseStructuredOutput(aiResult.outputMarkdown, context);
    const latestVersion = await this.prisma.matterOutcomeAnalysis.findFirst({
      where: { tenantId, matterId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return this.prisma.matterOutcomeAnalysis.create({
      data: {
        tenantId,
        matterId,
        version: (latestVersion?.version ?? 0) + 1,
        status: 'NEEDS_REVIEW',
        portalVisible: false,
        overallBand: structured.overallBand,
        confidence: structured.confidence,
        winProbability: structured.winProbability as Prisma.InputJsonValue,
        lossProbability: structured.lossProbability as Prisma.InputJsonValue,
        settlementProbability: structured.settlementProbability as Prisma.InputJsonValue,
        scenarios: structured.scenarios as Prisma.InputJsonValue,
        factorsFor: structured.factorsFor as Prisma.InputJsonValue,
        factorsAgainst: structured.factorsAgainst as Prisma.InputJsonValue,
        solutions: structured.solutions as Prisma.InputJsonValue,
        missingEvidence: structured.missingEvidence as Prisma.InputJsonValue,
        citations: structured.citations as Prisma.InputJsonValue,
        disclaimers: structured.disclaimers as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
  }

  /**
   * Lightweight preview — returns the latest approved (or most recent) analysis
   * mapped to the compact OutcomePreviewData shape the matter card expects.
   * Returns null when no analysis has been run yet.
   */
  async preview(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    const latest = await this.prisma.matterOutcomeAnalysis.findFirst({
      where: { tenantId, matterId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // APPROVED first, then most recent
    });

    if (!latest) return null;

    const win = latest.winProbability as { mid?: number } | null;
    const settlement = latest.settlementProbability as { mid?: number } | null;
    const factorsFor = (latest.factorsFor as string[] | null) ?? [];
    const solutions = (latest.solutions as string[] | null) ?? [];

    // Map overall band to risk level expected by the frontend
    const band = (latest.overallBand ?? '').toLowerCase();
    const riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' =
      band.includes('strong') ? 'Low'
      : band.includes('moderate') ? 'Medium'
      : band.includes('weak') ? 'High'
      : 'Medium';

    return {
      winProbability: win?.mid ?? 0,
      settlementProbability: settlement?.mid ?? 0,
      riskLevel,
      headline: latest.overallBand ?? 'Analysis complete',
      recommendedStrategy: solutions[0] ?? 'Consult your lawyer for strategy recommendations.',
      keyRisks: factorsFor.slice(0, 3),
      requiresApproval: latest.status !== 'APPROVED',
    };
  }

  async findAll(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    return this.prisma.matterOutcomeAnalysis.findMany({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    matterId: string,
    analysisId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    const analysis = await this.prisma.matterOutcomeAnalysis.findFirst({
      where: { id: analysisId, tenantId, matterId },
    });

    if (!analysis) {
      throw new NotFoundException('Outcome analysis not found');
    }

    return analysis;
  }

  async update(
    tenantId: string,
    matterId: string,
    analysisId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateOutcomeAnalysisDto,
  ) {
    await this.findOne(tenantId, matterId, analysisId, userId, role);

    const data: Prisma.MatterOutcomeAnalysisUpdateInput = {
      portalVisible: dto.portalVisible,
      portalSummary: dto.portalSummary,
      portalOutlookLabel: dto.portalOutlookLabel,
    };

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'APPROVED') {
        data.reviewedBy = userId;
        data.reviewedAt = new Date();
      }
    }

    return this.prisma.matterOutcomeAnalysis.update({
      where: { id: analysisId },
      data,
    });
  }

  async getFirmOutcomeBenchmarks(tenantId: string, matterIds?: string[]) {
    const analyses = await this.prisma.matterOutcomeAnalysis.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        matterId: matterIds?.length ? { in: matterIds } : undefined,
      },
      orderBy: { reviewedAt: 'desc' },
    });

    const latestByMatter = new Map<string, (typeof analyses)[0]>();
    for (const row of analyses) {
      if (!latestByMatter.has(row.matterId)) {
        latestByMatter.set(row.matterId, row);
      }
    }

    if (latestByMatter.size === 0) {
      return {
        sampleSize: 0,
        bandDistribution: {
          FAVORABLE: 0,
          NEUTRAL: 0,
          UNFAVORABLE: 0,
          INSUFFICIENT_DATA: 0,
        },
        averageWinProbability: null as number | null,
        averageSettlementProbability: null as number | null,
        dominantBand: null as string | null,
        disclaimer:
          'Insufficient approved outcome analyses for firm benchmarks — approve analyses on closed matters to build comparisons.',
      };
    }

    const bands = { FAVORABLE: 0, NEUTRAL: 0, UNFAVORABLE: 0, INSUFFICIENT_DATA: 0 };
    const winMids: number[] = [];
    const settlementMids: number[] = [];

    for (const analysis of latestByMatter.values()) {
      const band = analysis.overallBand ?? 'INSUFFICIENT_DATA';
      if (band in bands) {
        bands[band as keyof typeof bands] += 1;
      }

      const win = analysis.winProbability as { mid?: number } | null;
      const settlement = analysis.settlementProbability as { mid?: number } | null;
      if (typeof win?.mid === 'number') {
        winMids.push(win.mid);
      }
      if (typeof settlement?.mid === 'number') {
        settlementMids.push(settlement.mid);
      }
    }

    const avg = (values: number[]) =>
      values.length
        ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) /
          100
        : null;

    const dominantBand =
      Object.entries(bands).sort((a, b) => b[1] - a[1]).find(([, count]) => count > 0)?.[0] ??
      null;

    return {
      sampleSize: latestByMatter.size,
      bandDistribution: bands,
      averageWinProbability: avg(winMids),
      averageSettlementProbability: avg(settlementMids),
      dominantBand,
      disclaimer: null as string | null,
    };
  }

  async getMatterOutcomeBenchmarks(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      tenantId,
      userId,
      role,
    );

    const firm = await this.getFirmOutcomeBenchmarks(
      tenantId,
      accessibleMatterIds ?? undefined,
    );

    const latestAnalysis = await this.prisma.matterOutcomeAnalysis.findFirst({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
    });

    const matterWinMid =
      (latestAnalysis?.winProbability as { mid?: number } | null)?.mid ?? null;
    const matterSettlementMid =
      (latestAnalysis?.settlementProbability as { mid?: number } | null)?.mid ?? null;

    const vsFirmAverage =
      firm.sampleSize > 0 && latestAnalysis
        ? {
            winProbabilityDelta:
              matterWinMid != null && firm.averageWinProbability != null
                ? Math.round((matterWinMid - firm.averageWinProbability) * 100) / 100
                : null,
            settlementProbabilityDelta:
              matterSettlementMid != null && firm.averageSettlementProbability != null
                ? Math.round((matterSettlementMid - firm.averageSettlementProbability) * 100) /
                  100
                : null,
            bandVsDominant:
              latestAnalysis.overallBand && firm.dominantBand
                ? latestAnalysis.overallBand === firm.dominantBand
                  ? 'aligned'
                  : 'different'
                : null,
          }
        : null;

    return {
      firm,
      matter: latestAnalysis
        ? {
            analysisId: latestAnalysis.id,
            overallBand: latestAnalysis.overallBand,
            winProbability: latestAnalysis.winProbability,
            settlementProbability: latestAnalysis.settlementProbability,
            status: latestAnalysis.status,
          }
        : null,
      vsFirmAverage,
      disclaimers: this.ensureDisclaimers(undefined),
    };
  }

  async getFirmBenchmarks(
    tenantId: string,
    userId: string,
    role: string | undefined,
    filters?: { practiceArea?: string; countryCode?: string },
  ) {
    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      tenantId,
      userId,
      role,
    );

    let scopedMatterIds = accessibleMatterIds ?? undefined;
    if (filters?.practiceArea || filters?.countryCode) {
      const filtered = await this.prisma.matter.findMany({
        where: {
          tenantId,
          id: scopedMatterIds ? { in: scopedMatterIds } : undefined,
          practiceArea: filters.practiceArea,
          countryCode: filters.countryCode?.toUpperCase(),
        },
        select: { id: true },
        take: 200,
      });
      scopedMatterIds = filtered.map((m) => m.id);
    }

    const firm = await this.getFirmOutcomeBenchmarks(tenantId, scopedMatterIds);

    if (firm.sampleSize === 0) {
      return {
        sampleSize: 0,
        benchmarks: [],
        disclaimer: firm.disclaimer,
      };
    }

    return {
      sampleSize: firm.sampleSize,
      filters: filters ?? {},
      benchmarks: [
        {
          metric: 'overall_band_distribution',
          value: firm.bandDistribution,
        },
        {
          metric: 'median_win_probability',
          value: firm.averageWinProbability,
        },
        {
          metric: 'median_settlement_probability',
          value: firm.averageSettlementProbability,
        },
      ],
      disclaimers: this.ensureDisclaimers(undefined),
    };
  }

  async createTaskFromLatestSolution(
    tenantId: string,
    matterId: string,
    solutionIndex: number,
    userId: string,
    role: string | undefined,
    analysisId?: string,
  ) {
    const analysis = analysisId
      ? await this.findOne(tenantId, matterId, analysisId, userId, role)
      : await this.prisma.matterOutcomeAnalysis.findFirst({
          where: { tenantId, matterId },
          orderBy: { createdAt: 'desc' },
        });

    if (!analysis) {
      throw new NotFoundException('Outcome analysis not found');
    }

    await this.ensureMatterAccess(tenantId, matterId, userId, role);

    return this.createTaskFromSolution(
      tenantId,
      matterId,
      analysis.id,
      solutionIndex,
      userId,
      role,
    );
  }

  async createTaskFromSolution(
    tenantId: string,
    matterId: string,
    analysisId: string,
    solutionIndex: number,
    userId: string,
    role: string | undefined,
  ) {
    const analysis = await this.findOne(tenantId, matterId, analysisId, userId, role);
    const solutions = Array.isArray(analysis.solutions)
      ? (analysis.solutions as unknown[]).filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        )
      : [];

    if (solutionIndex < 0 || solutionIndex >= solutions.length) {
      throw new NotFoundException('Solution index not found on outcome analysis');
    }

    const title = solutions[solutionIndex].trim();

    return this.tasksService.create(tenantId, {
      matterId,
      title: `Outcome action: ${title}`,
      priority: 'MEDIUM',
      status: 'TODO',
      assigneeId: userId,
    });
  }

  async getPortalOutcomeSummary(
    tenantId: string,
    matterId: string,
    clientId: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId, clientId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    const analysis = await this.prisma.matterOutcomeAnalysis.findFirst({
      where: {
        tenantId,
        matterId,
        portalVisible: true,
        status: 'APPROVED',
      },
      orderBy: { reviewedAt: 'desc' },
    });

    if (!analysis) {
      throw new NotFoundException('No portal-visible outcome summary available');
    }

    return {
      matterId: matter.id,
      matterTitle: matter.title,
      analysisId: analysis.id,
      version: analysis.version,
      outlookLabel: analysis.portalOutlookLabel ?? analysis.overallBand,
      summary: analysis.portalSummary,
      overallBand: analysis.overallBand,
      confidence: analysis.confidence,
      disclaimers: analysis.disclaimers,
      updatedAt: (analysis.reviewedAt ?? analysis.updatedAt).toISOString(),
    };
  }

  private async loadBrainContext(
    tenantId: string,
    matterId: string,
  ): Promise<OutcomeBrainContext> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    const [facts, issues, arguments_, strategyMemos] = await Promise.all([
      this.prisma.matterFact.findMany({
        where: { tenantId, matterId },
        orderBy: { createdAt: 'desc' },
        select: { factText: true, isDisputed: true, approvedByLawyer: true },
      }),
      this.prisma.matterIssue.findMany({
        where: { tenantId, matterId },
        select: { title: true, status: true, priority: true },
      }),
      this.prisma.matterArgument.findMany({
        where: { tenantId, matterId },
        select: { title: true, side: true, strength: true },
      }),
      this.prisma.matterStrategyMemo.findMany({
        where: { tenantId, matterId },
        select: { title: true, status: true },
      }),
    ]);

    return {
      matterTitle: matter.title,
      countryCode: matter.countryCode,
      jurisdiction: matter.jurisdiction,
      practiceArea: matter.practiceArea,
      facts,
      issues,
      arguments: arguments_,
      strategyMemos,
    };
  }

  private buildAnalysisPrompt(context: OutcomeBrainContext): string {
    const factsBlock = context.facts.length
      ? context.facts.map((f) => `- ${f.factText}${f.isDisputed ? ' (disputed)' : ''}`).join('\n')
      : 'No facts recorded.';

    const issuesBlock = context.issues.length
      ? context.issues.map((i) => `- [${i.status}] ${i.title} (${i.priority})`).join('\n')
      : 'No issues recorded.';

    const argumentsBlock = context.arguments.length
      ? context.arguments.map((a) => `- [${a.side}] ${a.title}${a.strength ? ` (${a.strength})` : ''}`).join('\n')
      : 'No arguments recorded.';

    const memosBlock = context.strategyMemos.length
      ? context.strategyMemos.map((m) => `- ${m.title} (${m.status})`).join('\n')
      : 'No strategy memos recorded.';

    return [
      `Analyze likely outcomes for matter: ${context.matterTitle}`,
      `Country: ${context.countryCode}`,
      context.jurisdiction ? `Jurisdiction: ${context.jurisdiction}` : '',
      context.practiceArea ? `Practice area: ${context.practiceArea}` : '',
      '',
      'Facts:',
      factsBlock,
      '',
      'Issues:',
      issuesBlock,
      '',
      'Arguments:',
      argumentsBlock,
      '',
      'Strategy memos:',
      memosBlock,
      '',
      'Return markdown analysis, then append JSON:',
      '```json',
      JSON.stringify(
        {
          overallBand: 'NEUTRAL',
          confidence: 'LOW',
          winProbability: { low: 20, mid: 35, high: 50 },
          lossProbability: { low: 15, mid: 30, high: 45 },
          settlementProbability: { low: 25, mid: 40, high: 55 },
          scenarios: [{ label: '', description: '', likelihood: 'MEDIUM' }],
          factorsFor: [''],
          factorsAgainst: [''],
          solutions: [''],
          missingEvidence: [''],
          citations: [{ title: '', citation: '' }],
          disclaimers: [''],
        },
        null,
        2,
      ),
      '```',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private parseStructuredOutput(
    markdown: string,
    context: OutcomeBrainContext,
  ): StructuredOutcomeAnalysis {
    const jsonMatch = markdown.match(/```json\s*([\s\S]*?)```/i);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim()) as Partial<StructuredOutcomeAnalysis>;
        return this.normalizeStructured(parsed, context);
      } catch {
        // fall through
      }
    }

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        'Outcome analysis could not parse structured AI output. Retry generation or contact support.',
      );
    }

    return this.buildMockAnalysis(context);
  }

  private normalizeStructured(
    parsed: Partial<StructuredOutcomeAnalysis>,
    context: OutcomeBrainContext,
  ): StructuredOutcomeAnalysis {
    const mock = this.buildMockAnalysis(context);
    return {
      ...mock,
      ...parsed,
      disclaimers: this.ensureDisclaimers(parsed.disclaimers),
      winProbability: parsed.winProbability ?? mock.winProbability,
      lossProbability: parsed.lossProbability ?? mock.lossProbability,
      settlementProbability: parsed.settlementProbability ?? mock.settlementProbability,
      scenarios: parsed.scenarios?.length ? parsed.scenarios : mock.scenarios,
      factorsFor: parsed.factorsFor?.length ? parsed.factorsFor : mock.factorsFor,
      factorsAgainst: parsed.factorsAgainst?.length ? parsed.factorsAgainst : mock.factorsAgainst,
      solutions: parsed.solutions?.length ? parsed.solutions : mock.solutions,
      missingEvidence: parsed.missingEvidence?.length
        ? parsed.missingEvidence
        : mock.missingEvidence,
      citations: parsed.citations?.length ? parsed.citations : mock.citations,
    };
  }

  private buildMockAnalysis(context: OutcomeBrainContext): StructuredOutcomeAnalysis {
    const approvedFacts = context.facts.filter((f) => f.approvedByLawyer);
    const openIssues = context.issues.filter((i) => i.status === 'OPEN');
    const clientArgs = context.arguments.filter((a) => a.side === 'CLIENT');
    const hasData =
      approvedFacts.length > 0 || context.issues.length > 0 || context.arguments.length > 0;

    const overallBand = !hasData
      ? 'INSUFFICIENT_DATA'
      : clientArgs.length >= openIssues.length
        ? 'FAVORABLE'
        : openIssues.length > clientArgs.length
          ? 'UNFAVORABLE'
          : 'NEUTRAL';

    const confidence =
      approvedFacts.length >= 3 && context.arguments.length >= 2
        ? 'MEDIUM'
        : hasData
          ? 'LOW'
          : 'LOW';

    return {
      overallBand,
      confidence,
      winProbability: { low: 20, mid: 35, high: hasData ? 48 : 25 },
      lossProbability: { low: 15, mid: 28, high: hasData ? 42 : 30 },
      settlementProbability: { low: 30, mid: 45, high: hasData ? 60 : 35 },
      scenarios: [
        {
          label: 'Favorable resolution',
          description: `Client-side arguments (${clientArgs.length}) support a negotiated or court outcome aligned with stated objectives.`,
          likelihood: overallBand === 'FAVORABLE' ? 'MEDIUM' : 'LOW',
        },
        {
          label: 'Settlement pathway',
          description: 'Parties may settle before final hearing if evidence gaps are addressed.',
          likelihood: 'MEDIUM',
        },
        {
          label: 'Adverse outcome risk',
          description: `${openIssues.length} open issue(s) may weaken position without additional evidence.`,
          likelihood: overallBand === 'UNFAVORABLE' ? 'MEDIUM' : 'LOW',
        },
      ],
      factorsFor: clientArgs.map((a) => a.title).slice(0, 5),
      factorsAgainst: openIssues.map((i) => i.title).slice(0, 5),
      solutions: [
        'Strengthen evidence on disputed facts',
        'Finalize strategy memo before next hearing',
        'Review opponent-side arguments for rebuttal gaps',
      ],
      missingEvidence:
        approvedFacts.length < context.facts.length
          ? ['Lawyer approval pending on one or more facts']
          : context.facts.length === 0
            ? ['No verified facts on record — intake documentation needed']
            : [],
      citations: [],
      disclaimers: this.ensureDisclaimers(undefined),
    };
  }

  private ensureDisclaimers(existing?: unknown): string[] {
    const base = [
      STANDARD_DISCLAIMER,
      'Outcome analysis is probabilistic and for attorney review only — not a guarantee of results.',
      'Client-facing summaries require explicit lawyer approval before portal publication.',
    ];

    if (Array.isArray(existing)) {
      const extras = existing.filter((item): item is string => typeof item === 'string');
      return [...new Set([...base, ...extras])];
    }

    return base;
  }

  private async ensureMatterAccess(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    try {
      await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
    } catch {
      throw new ForbiddenException('Matter access denied');
    }
  }
}
