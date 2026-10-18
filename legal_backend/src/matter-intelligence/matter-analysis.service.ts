import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from '@/access/matter-access.service';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { SimilarCasesService } from '@/ai/legal-research/similar-cases.service';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import { getIndiaCaselawCorpusEdition } from '@/legal-sources/load-india-caselaw-corpus';
import type { Prisma } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class RunMatterAnalysisDto {
  @IsOptional()
  @IsString()
  focusPrompt?: string;
}

export class CreateOpponentAnalysisDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  focusPrompt?: string;
}

export class UpdateOpponentAnalysisDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

@Injectable()
export class MatterAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly aiGateway: AiGatewayService,
    private readonly legalRetrieval: LegalRetrievalOrchestrator,
    private readonly similarCases: SimilarCasesService,
  ) {}

  private async withMatterAccess<T>(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
    } catch {
      throw new ForbiddenException('Matter access denied');
    }
    return fn();
  }

  private async loadMatterContext(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      include: { client: { select: { name: true } } },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const [facts, issues] = await Promise.all([
      this.prisma.matterFact.findMany({
        where: { tenantId, matterId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.matterIssue.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      }),
    ]);

    return { matter, facts, issues };
  }

  // ---------------------------------------------------------------------------
  // Similar Cases
  // ---------------------------------------------------------------------------

  async runSimilarCases(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto?: RunMatterAnalysisDto,
    trigger: 'manual' | 'auto' = 'manual',
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const { matter, facts, issues } = await this.loadMatterContext(tenantId, matterId);

      const factsText = facts.map((f) => `- ${f.factText}`).join('\n') || 'No facts recorded.';
      const issuesText =
        issues.map((i) => `- ${i.title}: ${i.description ?? ''}`).join('\n') ||
        'No issues recorded.';

      const query = [
        `Matter: ${matter.title}`,
        `Practice Area: ${matter.practiceArea}`,
        `Country: ${matter.countryCode}`,
        matter.jurisdiction ? `Jurisdiction: ${matter.jurisdiction}` : '',
        matter.client ? `Client: ${matter.client.name}` : '',
        `\nFacts:\n${factsText}`,
        `\nLegal Issues:\n${issuesText}`,
        dto?.focusPrompt ? `\nFocus: ${dto.focusPrompt}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const retrieval = await this.legalRetrieval.retrieve({
        query,
        countryCode: matter.countryCode,
        jurisdiction: matter.jurisdiction ?? undefined,
        practiceArea: matter.practiceArea ?? undefined,
        tenantId,
        userId,
        matterId,
        knowledgeSources: ['case_law', 'statutes'],
        researchMode: 'DEEP',
      });
      const similarCases = this.similarCases.extractAndRank(
        retrieval.authorities,
        query,
        matter.countryCode,
      );
      const contentMarkdown =
        similarCases.length === 0
          ? 'No verified similar cases were retrieved for this matter. Refine the facts or issues and run the analysis again.'
          : similarCases
              .map(
                (item, index) =>
                  `## ${index + 1}. ${item.title}\n\n` +
                  `**Citation:** ${item.citation ?? 'Citation pending verification'}  \n` +
                  `**Court:** ${item.court ?? 'Court not supplied'} · **Weight:** ${item.bindingWeight ?? 'informational'}  \n\n` +
                  `${item.summary ?? 'No holding summary is available.'}`,
              )
              .join('\n\n');

      const run = await this.prisma.matterAnalysisRun.create({
        data: {
          tenantId,
          matterId,
          runType: 'similar_cases',
          trigger,
          title: `Similar Cases — ${matter.title}`,
          contentMarkdown,
          structuredOutput: JSON.parse(
            JSON.stringify({
              similarCases,
              corpusEdition: getIndiaCaselawCorpusEdition(),
            }),
          ) as Prisma.InputJsonValue,
          status: 'COMPLETED',
          createdByUserId: userId,
        },
      });

      return run;
    });
  }

  async listSimilarCases(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterAnalysisRun.findMany({
        where: { tenantId, matterId, runType: 'similar_cases' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Opponent Analysis (persisted)
  // ---------------------------------------------------------------------------

  async runOpponentAnalysis(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto?: RunMatterAnalysisDto,
    trigger: 'manual' | 'auto' = 'manual',
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const { matter, facts, issues } = await this.loadMatterContext(tenantId, matterId);

      const factsText = facts.map((f) => `- ${f.factText}`).join('\n') || 'No facts recorded.';
      const issuesText =
        issues.map((i) => `- ${i.title}: ${i.description ?? ''}`).join('\n') ||
        'No issues recorded.';

      const systemPrompt =
        'You are an expert litigation strategist. Analyze this matter from the opposing side\'s perspective. Identify their strongest arguments, vulnerabilities in our position, anticipated motions, evidence they will likely present, and suggest counter-strategies.';

      const userPrompt = [
        `Matter: ${matter.title}`,
        `Practice Area: ${matter.practiceArea}`,
        `Country: ${matter.countryCode}`,
        matter.jurisdiction ? `Jurisdiction: ${matter.jurisdiction}` : '',
        matter.opposingParty ? `Opposing party: ${matter.opposingParty}` : '',
        `\nFacts:\n${factsText}`,
        `\nLegal Issues:\n${issuesText}`,
        dto?.focusPrompt ? `\nFocus: ${dto.focusPrompt}` : '',
        '\nStructure your response with: ## Opposing Strategy | ## Their Strongest Arguments | ## Our Weaknesses to Address | ## Anticipated Motions/Evidence | ## Recommended Counter-Strategies',
      ]
        .filter(Boolean)
        .join('\n');

      const result = await this.aiGateway.runIntakeDeepAnalysis({
        userId,
        tenantId,
        taskType: 'OPPONENT_ANALYZER',
        systemPrompt,
        userPrompt,
        reasoningModel: true,
        countryCode: matter.countryCode,
        modelMode: 'PREMIUM',
      });

      const run = await this.prisma.matterAnalysisRun.create({
        data: {
          tenantId,
          matterId,
          runType: 'opponent_analysis',
          trigger,
          title: `Opponent Analysis — ${matter.title}`,
          contentMarkdown: result.outputMarkdown,
          status: 'COMPLETED',
          createdByUserId: userId,
        },
      });

      return run;
    });
  }

  async listOpponentAnalyses(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterAnalysisRun.findMany({
        where: { tenantId, matterId, runType: 'opponent_analysis' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async deleteAnalysisRun(
    tenantId: string,
    matterId: string,
    runId: string,
    userId: string,
    role: string | undefined,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const run = await this.prisma.matterAnalysisRun.findFirst({
        where: { id: runId, tenantId, matterId },
      });
      if (!run) throw new NotFoundException('Analysis run not found');
      return this.prisma.matterAnalysisRun.delete({ where: { id: runId } });
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-generate strategy memo from matter brain context
  // ---------------------------------------------------------------------------

  async autoGenerateStrategyMemo(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    focusPrompt?: string,
    trigger: 'manual' | 'auto' = 'manual',
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const { matter, facts, issues } = await this.loadMatterContext(tenantId, matterId);

      const factsText = facts.map((f) => `- ${f.factText}`).join('\n') || 'No facts recorded.';
      const issuesText =
        issues.map((i) => `- ${i.title}: ${i.description ?? ''}`).join('\n') ||
        'No issues recorded.';

      const systemPrompt =
        'You are a senior litigation partner. Create a comprehensive strategic memo for this matter covering recommended legal approach, key risks, evidence priorities, procedural considerations, and next actions. Write in professional legal memo style.';

      const userPrompt = [
        `Matter: ${matter.title}`,
        `Practice Area: ${matter.practiceArea}`,
        `Country: ${matter.countryCode}`,
        matter.jurisdiction ? `Jurisdiction: ${matter.jurisdiction}` : '',
        matter.desiredOutcome ? `Desired outcome: ${matter.desiredOutcome}` : '',
        matter.opposingParty ? `Opposing party: ${matter.opposingParty}` : '',
        `\nFacts:\n${factsText}`,
        `\nLegal Issues:\n${issuesText}`,
        focusPrompt ? `\nFocus: ${focusPrompt}` : '',
        '\nFormat as a legal strategy memo with: ## Executive Summary | ## Legal Strategy | ## Key Risks | ## Evidence Priorities | ## Procedural Considerations | ## Recommended Next Actions',
      ]
        .filter(Boolean)
        .join('\n');

      const result = await this.aiGateway.runIntakeDeepAnalysis({
        userId,
        tenantId,
        taskType: 'STRATEGY_MEMO',
        systemPrompt,
        userPrompt,
        reasoningModel: true,
        countryCode: matter.countryCode,
        modelMode: 'PREMIUM',
      });

      // Save as a MatterStrategyMemo
      const memo = await this.prisma.matterStrategyMemo.create({
        data: {
          tenantId,
          matterId,
          title: `AI Strategy — ${matter.title} (${trigger === 'auto' ? 'Auto-generated' : new Date().toLocaleDateString()})`,
          content: result.outputMarkdown,
          status: 'DRAFT',
          createdBy: userId,
        },
      });

      return memo;
    });
  }
}
