import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { CacheService } from '@/cache/cache.service';
import { getCountryConfig } from '@/config/countries';
import { CreditReservationService } from '@/credits/credit-reservation.service';
import {
  estimateCostUsd,
  estimateTokens,
  hashPrompt,
} from '@/common/utils/prompt-hash.util';
import { FirmMemoryService } from '@/firm-memory/firm-memory.service';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { LegalSearchPlanService } from '@/legal-search/legal-search-plan.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AiComplianceGuardService } from './ai-compliance-guard.service';
import { AiPolicyService } from './ai-policy.service';
import { AiUsageService } from './ai-usage.service';
import { CitationVerificationService } from './citations/citation-verification.service';
import { AiCostService } from './costs/ai-cost.service';
import {
  AI_MODES,
  AI_TASK_TYPES,
  CONSUMER_DISCLAIMER,
} from './constants';
import { ModelRouterService, type ResolvedModelRoute } from './model-router/model-router.service';

export interface ConsumerPreviewInput {
  userId: string;
  consumerCaseId: string;
  countryCode: string;
  jurisdiction?: string;
  issueType: string;
  title: string;
  facts?: string;
  desiredOutcome?: string;
  creditTaskType?: string;
  tenantId?: string;
  intakeMode?: 'SELF' | 'FIRM_INTAKE';
  clientName?: string;
  clientReference?: string;
  internalNotes?: string;
  parties?: string;
}

export interface FirmIntakeStructuredOutput {
  situation: string;
  legalIssues: string[];
  strengths: string[];
  risksAndGaps: string[];
  recommendedNextSteps: string[];
  sourcesCited: string[];
}

export interface AiPreviewResult {
  outputMarkdown: string;
  citations: Prisma.InputJsonValue;
  riskLevel: string;
  riskScore: number;
  requiresLawyerReview: boolean;
  disclaimer: string;
  mode: string;
  provider: string;
  modelName: string;
  structuredOutput?: FirmIntakeStructuredOutput;
}

export interface IssueClassificationResult {
  issueType: string;
  suggestedTitle: string;
  urgencyLevel: string;
  confidence: number;
}

export interface IssueCheckerTeaserInput {
  countryCode: string;
  jurisdiction?: string;
  issueType: string;
  title: string;
  facts: string;
  desiredOutcome?: string;
  parties?: string;
  urgencyLevel?: string;
}

export interface IssueCheckerTeaserResult {
  detectedIssueType: string;
  suggestedTitle: string;
  teaserMarkdown: string;
  keyBullets: string[];
  requiresLawyer: boolean;
  disclaimer: string;
  mode: string;
  provider: string;
}

export interface StoredIssueCheckerSession {
  countryCode: string;
  jurisdiction?: string;
  issueType: string;
  title: string;
  facts: string;
  desiredOutcome?: string;
  parties?: string;
  urgencyLevel?: string;
  mode?: string;
  clientName?: string;
  clientReference?: string;
  internalNotes?: string;
  createdAt: string;
}

export interface LawyerResearchInput {
  userId: string;
  tenantId?: string;
  matterId?: string;
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  query: string;
}

export interface LawyerResearchResult {
  outputMarkdown: string;
  citations: Prisma.InputJsonValue;
  mode: string;
  provider: string;
  modelName: string;
  countryCode: string;
  jurisdiction?: string;
}

export interface MatterSummaryInput {
  userId: string;
  tenantId: string;
  matterId?: string;
  matterTitle?: string;
  matterStatus?: string;
  practiceArea?: string;
  clientName?: string;
  openTasks?: Array<{ title: string; status?: string }>;
}

export interface MatterSummaryResult {
  outputMarkdown: string;
  provider: string;
  modelName: string;
}

export interface DocumentDraftInput {
  userId: string;
  tenantId: string;
  matterId?: string;
  matterTitle?: string;
  documentType?: string;
  instructions?: string;
}

export interface DocumentDraftResult {
  outputMarkdown: string;
  provider: string;
  modelName: string;
}

export interface AgentTaskInput {
  userId: string;
  tenantId: string;
  matterId?: string;
}

export interface DocumentExplainInput extends AgentTaskInput {
  documentId: string;
  documentText: string;
}

export interface OpponentAnalysisInput extends AgentTaskInput {
  filingText: string;
}

export interface EvidenceGapInput extends AgentTaskInput {
  matterTitle?: string;
  factsSummary: string;
}

export interface DeadlineExtractionInput extends AgentTaskInput {
  matterTitle?: string;
}

export interface ConsumerFullReportInput {
  userId: string;
  consumerCaseId: string;
  countryCode: string;
  jurisdiction?: string;
  issueType: string;
  title: string;
  facts?: string;
  desiredOutcome?: string;
  documentSummaries?: string[];
  sections: string[];
}

interface OpenAiUsage {
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiPolicy: AiPolicyService,
    private readonly aiUsage: AiUsageService,
    private readonly cacheService: CacheService,
    private readonly hybridSearch: HybridSearchService,
    private readonly aiCreditLedger: AICreditLedgerService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly modelRouter: ModelRouterService,
    private readonly aiCostService: AiCostService,
    private readonly citationVerification: CitationVerificationService,
    private readonly legalSearchPlan: LegalSearchPlanService,
    private readonly creditReservation: CreditReservationService,
    private readonly firmMemory: FirmMemoryService,
  ) {}

  async runConsumerFreePreview(input: ConsumerPreviewInput): Promise<AiPreviewResult> {
    const countryPolicy = await this.complianceGuard.assertConsumerGuidanceAllowed(
      input.countryCode,
    );

    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId: input.userId },
    });

    const creditBalance = await this.aiCreditLedger.getBalance({
      userId: input.userId,
      tenantId: input.tenantId,
    });

    if (creditBalance <= 0) {
      const reason = input.tenantId
        ? 'No AI credits remaining on your firm wallet. Please top up to continue.'
        : profile
          ? 'No free preview credits remaining'
          : 'No AI credits remaining. Please top up to continue.';
      throw new ForbiddenException(reason);
    }

    const creditTaskType = input.creditTaskType ?? AI_TASK_TYPES.ISSUE_CHECKER;
    const route = this.modelRouter.resolveRoute(creditTaskType);
    const country = getCountryConfig(input.countryCode);
    const searchQuery = [input.issueType, input.title, input.facts].filter(Boolean).join(' ');
    const searchCacheKey = this.cacheService.buildKey('legal:search', [
      'preview',
      country.code,
      input.jurisdiction ?? 'all',
      hashPrompt(searchQuery),
    ]);

    let authorities = await this.cacheService.get<
      Array<{
        id: string;
        title: string;
        citation: string | null;
        sourceName: string;
        summary: string | null;
      }>
    >(searchCacheKey);

    if (!authorities) {
      const searchResults = await this.hybridSearch.search(searchQuery, {
        countryCode: country.code,
        jurisdiction: input.jurisdiction,
        limit: 5,
      });
      authorities = searchResults.map((row) => ({
        id: row.id,
        title: row.title,
        citation: row.citation,
        sourceName: row.sourceName,
        summary: row.summary,
      }));
      await this.cacheService.set(searchCacheKey, authorities);
    }

    const isFirmIntake = input.intakeMode === 'FIRM_INTAKE';
    const prompt = isFirmIntake
      ? this.buildFirmIntakePreviewPrompt(input, authorities)
      : this.buildPreviewPrompt(input, authorities);
    const promptHash = hashPrompt(prompt);
    const cacheKey = this.cacheService.buildKey('ai:preview', [
      input.userId,
      promptHash,
    ]);
    const cached = await this.cacheService.get<AiPreviewResult>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.assertMarginAllowed({
      taskType: creditTaskType,
      route,
      countryCode: country.code,
      estimatedInputTokens: estimateTokens(prompt),
      estimatedOutputTokens: route.maxOutputTokens,
      isFreePreview: true,
    });

    let reservationId: string | undefined;
    if (this.creditReservation.isEnabled()) {
      const reservation = await this.creditReservation.reserve({
        userId: input.userId,
        tenantId: input.tenantId,
        taskType: creditTaskType,
        metadata: { consumerCaseId: input.consumerCaseId },
      });
      reservationId = reservation.id;
    } else {
      await this.aiCreditLedger.assertAndDebit({
        userId: input.userId,
        tenantId: input.tenantId,
        taskType: creditTaskType,
        metadata: { consumerCaseId: input.consumerCaseId },
      });
    }

    const monthlySpend = await this.aiUsage.getMonthlyConsumerSpend(input.userId);
    const estimatedInputTokens = estimateTokens(prompt);
    const estimatedOutputTokens = route.maxOutputTokens;
    const estimatedCost = estimateCostUsd(estimatedInputTokens, estimatedOutputTokens);

    const budgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
      input.tenantId,
      input.userId,
      estimatedCost,
    );
    if (!budgetCheck.allowed) {
      throw new ForbiddenException(budgetCheck.reason ?? 'AI budget check failed');
    }

    const costDecision = this.aiPolicy.evaluateEstimatedCostCap(
      monthlySpend,
      estimatedCost,
      this.aiPolicy.getMonthlyConsumerCostCap(),
    );
    if (!costDecision.allowed) {
      throw new ForbiddenException(costDecision.reason ?? 'AI cost cap exceeded');
    }

    const capDecision = this.aiPolicy.evaluateConsumerCostCap(monthlySpend);
    if (!capDecision.allowed) {
      throw new ForbiddenException(capDecision.reason ?? 'AI cost cap exceeded');
    }

    const startedAt = Date.now();
    this.aiPolicy.assertOpenAiConfigured();
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    const requireDisclaimer =
      this.configService.get<string>('AI_CONSUMER_DISCLAIMER_REQUIRED', 'true') === 'true';
    const disclaimer = requireDisclaimer ? CONSUMER_DISCLAIMER : '';

    let result: AiPreviewResult;
    let usage: OpenAiUsage = { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens };

    if (openAiKey) {
      const generated = await this.generateWithOpenAi(
        input,
        country.name,
        disclaimer,
        prompt,
        authorities,
        route,
        isFirmIntake,
      );
      result = generated.result;
      usage = generated.usage;
    } else if (this.aiPolicy.shouldUseMockResponses()) {
      result = this.generateMockPreview(input, country.name, disclaimer, authorities, isFirmIntake);
      usage = {
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(result.outputMarkdown),
      };
    } else {
      this.aiPolicy.assertOpenAiConfigured();
      throw new Error('Unreachable');
    }

    const sanitized = this.complianceGuard.sanitizeOutput(
      result.outputMarkdown,
      countryPolicy,
      'consumer',
      result.disclaimer || disclaimer,
    );

    result = {
      ...result,
      outputMarkdown: sanitized.outputMarkdown,
      disclaimer: sanitized.disclaimer,
      requiresLawyerReview:
        result.requiresLawyerReview || sanitized.requiresLawyerReview,
      citations:
        authorities.length > 0
          ? authorities.map((authority) => ({
              authorityId: authority.id,
              sourceName: authority.sourceName,
              citation: authority.citation ?? authority.title,
              confidence: 0.7,
            }))
          : result.citations,
    };

    await this.prisma.aIOutput.create({
      data: {
        userId: input.userId,
        consumerCaseId: input.consumerCaseId,
        mode: isFirmIntake ? AI_MODES.FIRM_INTAKE_PREVIEW : AI_MODES.CONSUMER_FREE_PREVIEW,
        taskType: AI_TASK_TYPES.ISSUE_CHECKER,
        promptHash,
        outputMarkdown: result.outputMarkdown,
        citations: result.citations,
        confidenceScore: result.riskScore,
        riskLevel: result.riskLevel,
        requiresLawyerReview: result.requiresLawyerReview,
      },
    });

    const costUsd = openAiKey
      ? await this.aiCostService.computeActualCostUsd({
          provider: result.provider,
          modelName: result.modelName,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        })
      : 0;

    const chargedCredits = getCreditCost(creditTaskType);
    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      chargedCredits,
      country.code,
    );
    const { platformMarginUsd } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: costUsd,
    });

    if (reservationId) {
      await this.creditReservation.release(reservationId);
    }

    await this.aiUsage.logUsage({
      userId: input.userId,
      consumerCaseId: input.consumerCaseId,
      taskType: creditTaskType,
      mode: result.mode,
      modelProvider: result.provider,
      modelName: result.modelName,
      modelTier: route.tier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      retrievalCount: authorities.length,
      costUsd,
      estimatedCostUsd: estimatedCost,
      chargedCredits,
      creditValueUsd,
      platformMarginUsd,
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
    });

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async runLawyerLegalResearch(
    input: LawyerResearchInput,
  ): Promise<LawyerResearchResult> {
    const countryPolicy = await this.complianceGuard.getPolicyForCountry(input.countryCode);

    if (input.tenantId) {
      const monthlySpend = await this.aiUsage.getMonthlyTenantSpend(input.tenantId);
      const capDecision = this.aiPolicy.evaluateTenantCostCap(monthlySpend);
      if (!capDecision.allowed) {
        throw new ForbiddenException(capDecision.reason ?? 'Tenant AI cost cap exceeded');
      }
    }

    const country = getCountryConfig(input.countryCode);
    const searchPlan = this.legalSearchPlan.buildSearchPlan({
      query: input.query,
      jurisdiction: input.jurisdiction,
      practiceArea: input.practiceArea,
      limit: 10,
    });
    const searchCacheKey = this.cacheService.buildKey('legal:search', [
      country.code,
      input.jurisdiction ?? 'all',
      hashPrompt(searchPlan.primaryQuery),
    ]);

    let authorities = await this.cacheService.get<
      Array<{
        id: string;
        title: string;
        citation: string | null;
        sourceName: string;
        summary: string | null;
      }>
    >(searchCacheKey);

    if (!authorities) {
      const searchResults = await this.hybridSearch.search(searchPlan.primaryQuery, {
        countryCode: country.code,
        jurisdiction: input.jurisdiction,
        practiceArea: input.practiceArea,
        limit: searchPlan.limit,
      });
      authorities = searchResults.map((row) => ({
        id: row.id,
        title: row.title,
        citation: row.citation,
        sourceName: row.sourceName,
        summary: row.summary,
      }));
      await this.cacheService.set(searchCacheKey, authorities);
    }

    const firmMemoryHits =
      input.tenantId
        ? (
            await this.firmMemory.search(
              input.tenantId,
              input.userId,
              (
                await this.prisma.tenantUser.findFirst({
                  where: { tenantId: input.tenantId, userId: input.userId },
                })
              )?.role,
              input.query,
              8,
            )
          ).hits
        : [];

    const prompt = this.buildResearchPrompt(input, country.name, authorities, firmMemoryHits);
    const promptHash = hashPrompt(prompt);
    const cacheKey = this.cacheService.buildKey('ai:research', [
      input.userId,
      input.tenantId ?? 'none',
      promptHash,
    ]);
    const cached = await this.cacheService.get<LawyerResearchResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const route = this.modelRouter.resolveRoute(AI_TASK_TYPES.LEGAL_RESEARCH);

    await this.assertMarginAllowed({
      taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
      route,
      countryCode: country.code,
      estimatedInputTokens: estimateTokens(prompt),
      estimatedOutputTokens: route.maxOutputTokens,
    });

    let reservationId: string | undefined;
    if (this.creditReservation.isEnabled()) {
      const reservation = await this.creditReservation.reserve({
        userId: input.userId,
        tenantId: input.tenantId,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        metadata: { matterId: input.matterId, query: input.query },
      });
      reservationId = reservation.id;
    } else {
      await this.aiCreditLedger.assertAndDebit({
        userId: input.userId,
        tenantId: input.tenantId,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        metadata: { matterId: input.matterId, query: input.query },
      });
    }

    const estimatedInputTokens = estimateTokens(prompt);
    const estimatedOutputTokens = route.maxOutputTokens;
    const estimatedCost = estimateCostUsd(estimatedInputTokens, estimatedOutputTokens, 0.003, 0.012);

    const budgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
      input.tenantId,
      input.userId,
      estimatedCost,
    );
    if (!budgetCheck.allowed) {
      throw new ForbiddenException(budgetCheck.reason ?? 'AI budget check failed');
    }

    if (input.tenantId) {
      const monthlySpend = await this.aiUsage.getMonthlyTenantSpend(input.tenantId);
      const costDecision = this.aiPolicy.evaluateEstimatedCostCap(
        monthlySpend,
        estimatedCost,
        this.aiPolicy.getMonthlyTenantCostCap(),
      );
      if (!costDecision.allowed) {
        throw new ForbiddenException(costDecision.reason ?? 'Tenant AI cost cap exceeded');
      }
    }

    const startedAt = Date.now();
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();

    let result: LawyerResearchResult;
    let usage: OpenAiUsage = { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens };

    if (openAiKey) {
      const generated = await this.generateResearchWithOpenAi(
        input,
        country.name,
        authorities,
        prompt,
        route,
      );
      result = generated.result;
      usage = generated.usage;
    } else {
      result = this.generateMockResearch(input, country.name, authorities);
      usage = {
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(result.outputMarkdown),
      };
    }

    const sanitizedResearch = this.complianceGuard.sanitizeOutput(
      result.outputMarkdown,
      countryPolicy,
      'lawyer',
    );
    result = {
      ...result,
      outputMarkdown: sanitizedResearch.outputMarkdown,
    };

    const verification = await this.citationVerification.verifyCitations({
      outputMarkdown: result.outputMarkdown,
      authorities,
    });
    result = {
      ...result,
      citations: verification.citations as unknown as Prisma.InputJsonValue,
    };

    const aiOutput = await this.prisma.aIOutput.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        matterId: input.matterId,
        mode: AI_MODES.LAWYER_LEGAL_RESEARCH,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        promptHash,
        outputMarkdown: result.outputMarkdown,
        citations: result.citations,
        requiresLawyerReview: false,
      },
    });

    const citationRows = authorities
      .filter((authority) =>
        (result.citations as Array<{ authorityId?: string }>).some(
          (citation) => citation.authorityId === authority.id,
        ),
      )
      .map((authority) => ({
        userId: input.userId,
        tenantId: input.tenantId,
        aiOutputId: aiOutput.id,
        authorityId: authority.id,
        quotedText: authority.summary ?? authority.title,
        confidence: 0.75,
      }));

    if (citationRows.length > 0) {
      await this.prisma.aICitation.createMany({ data: citationRows });
    } else if (authorities.length > 0) {
      await this.prisma.aICitation.createMany({
        data: authorities.slice(0, 5).map((authority) => ({
          userId: input.userId,
          tenantId: input.tenantId,
          aiOutputId: aiOutput.id,
          authorityId: authority.id,
          quotedText: authority.summary ?? authority.title,
          confidence: 0.65,
        })),
      });
    }

    const costUsd = openAiKey
      ? await this.aiCostService.computeActualCostUsd({
          provider: result.provider,
          modelName: result.modelName,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        })
      : 0;

    const chargedCredits = getCreditCost(AI_TASK_TYPES.LEGAL_RESEARCH);
    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      chargedCredits,
      country.code,
    );
    const { platformMarginUsd } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: costUsd,
    });

    if (reservationId) {
      await this.creditReservation.release(reservationId);
    }

    await this.aiUsage.logUsage({
      userId: input.userId,
      tenantId: input.tenantId,
      matterId: input.matterId,
      taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
      mode: AI_MODES.LAWYER_LEGAL_RESEARCH,
      modelProvider: result.provider,
      modelName: result.modelName,
      modelTier: route.tier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      retrievalCount: authorities.length,
      costUsd,
      estimatedCostUsd: estimatedCost,
      chargedCredits,
      creditValueUsd,
      platformMarginUsd,
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
    });

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async runMatterSummary(input: MatterSummaryInput): Promise<MatterSummaryResult> {
    const prompt = [
      `Summarize this legal matter for a lawyer dashboard.`,
      input.matterTitle ? `Matter: ${input.matterTitle}` : 'Matter: Unspecified',
      input.matterStatus ? `Status: ${input.matterStatus}` : '',
      input.practiceArea ? `Practice area: ${input.practiceArea}` : '',
      input.clientName ? `Client: ${input.clientName}` : '',
      input.openTasks?.length
        ? `Open tasks:\n${input.openTasks.map((task) => `- ${task.title}${task.status ? ` (${task.status})` : ''}`).join('\n')}`
        : 'Open tasks: none listed',
      'Return concise markdown with sections: Snapshot, Risks, Recommended next steps.',
    ]
      .filter(Boolean)
      .join('\n');

    const promptHash = hashPrompt(prompt);
    const playbookCacheKey = this.cacheService.buildKey('ai:playbook', [
      input.tenantId,
      input.matterId ?? 'none',
      promptHash,
    ]);
    const cached = await this.cacheService.get<MatterSummaryResult>(playbookCacheKey);
    if (cached) {
      return cached;
    }

    const estimatedInputTokens = estimateTokens(prompt);
    const estimatedOutputTokens = 900;
    const estimatedCost = estimateCostUsd(estimatedInputTokens, estimatedOutputTokens);

    if (input.tenantId) {
      const monthlySpend = await this.aiUsage.getMonthlyTenantSpend(input.tenantId);
      const capDecision = this.aiPolicy.evaluateTenantCostCap(monthlySpend);
      if (!capDecision.allowed) {
        throw new ForbiddenException(capDecision.reason ?? 'Tenant AI cost cap exceeded');
      }
    }

    const budgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
      input.tenantId,
      input.userId,
      estimatedCost,
    );
    if (!budgetCheck.allowed) {
      throw new ForbiddenException(budgetCheck.reason ?? 'AI budget check failed');
    }

    if (input.tenantId) {
      const monthlySpend = await this.aiUsage.getMonthlyTenantSpend(input.tenantId);
      const costDecision = this.aiPolicy.evaluateEstimatedCostCap(
        monthlySpend,
        estimatedCost,
        this.aiPolicy.getMonthlyTenantCostCap(),
      );
      if (!costDecision.allowed) {
        throw new ForbiddenException(costDecision.reason ?? 'Tenant AI cost cap exceeded');
      }
    }

    await this.aiCreditLedger.assertAndDebit({
      userId: input.userId,
      tenantId: input.tenantId,
      taskType: 'MATTER_SUMMARY',
      metadata: { matterId: input.matterId },
    });

    const startedAt = Date.now();
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    let result: MatterSummaryResult;
    let usage: OpenAiUsage = { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens };

    if (!openAiKey) {
      result = {
        outputMarkdown: [
          `# Matter summary`,
          '',
          `## Snapshot`,
          `- Matter: ${input.matterTitle ?? 'Unspecified'}`,
          `- Status: ${input.matterStatus ?? 'Unknown'}`,
          input.clientName ? `- Client: ${input.clientName}` : '',
          '',
          '## Risks',
          '- Confirm jurisdiction deadlines and outstanding dependencies.',
          '',
          '## Recommended next steps',
          ...(input.openTasks?.length
            ? input.openTasks.slice(0, 5).map((task, idx) => `${idx + 1}. Resolve: ${task.title}`)
            : ['1. Capture missing task details and assign ownership.']),
        ]
          .filter(Boolean)
          .join('\n'),
        provider: 'mock',
        modelName: 'mock-matter-summary-v1',
      };
      usage.outputTokens = estimateTokens(result.outputMarkdown);
    } else {
      const modelName = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          store: false,
          messages: [
            {
              role: 'system',
              content:
                'You summarize legal matter context for lawyers. Be concise and action-oriented.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI matter summary request failed: ${errorText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      result = {
        outputMarkdown:
          payload.choices?.[0]?.message?.content ?? 'Unable to summarize matter at this time.',
        provider: 'openai',
        modelName,
      };
      usage = {
        inputTokens: payload.usage?.prompt_tokens ?? estimatedInputTokens,
        outputTokens: payload.usage?.completion_tokens ?? estimateTokens(result.outputMarkdown),
      };
    }

    await this.aiUsage.logUsage({
      userId: input.userId,
      tenantId: input.tenantId,
      matterId: input.matterId,
      taskType: 'MATTER_SUMMARY',
      mode: AI_MODES.LAWYER_COPILOT,
      modelProvider: result.provider,
      modelName: result.modelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: openAiKey
        ? estimateCostUsd(usage.inputTokens, usage.outputTokens)
        : 0,
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
    });

    await this.cacheService.set(playbookCacheKey, result);
    return result;
  }

  async runDocumentDraft(input: DocumentDraftInput): Promise<DocumentDraftResult> {
    const tenant = input.tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: input.tenantId },
          select: { primaryCountry: true },
        })
      : null;
    const countryPolicy = await this.complianceGuard.assertDocumentGenerationAllowed(
      tenant?.primaryCountry ?? 'US',
    );

    const docType = input.documentType ?? 'memo';
    const prompt = [
      `Draft a ${docType} for legal review.`,
      input.matterTitle ? `Matter: ${input.matterTitle}` : 'Matter: Unspecified',
      input.instructions ? `Instructions: ${input.instructions}` : '',
      'Respond in markdown with: Title, Draft body, and Review checklist.',
    ]
      .filter(Boolean)
      .join('\n');

    const promptHash = hashPrompt(prompt);
    const cacheKey = this.cacheService.buildKey('ai:playbook', [
      input.tenantId,
      input.matterId ?? 'none',
      `draft:${docType}:${promptHash}`,
    ]);
    const cached = await this.cacheService.get<DocumentDraftResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const estimatedInputTokens = estimateTokens(prompt);
    const estimatedOutputTokens = 1600;
    const estimatedCost = estimateCostUsd(estimatedInputTokens, estimatedOutputTokens, 0.003, 0.012);

    if (input.tenantId) {
      const monthlySpend = await this.aiUsage.getMonthlyTenantSpend(input.tenantId);
      const capDecision = this.aiPolicy.evaluateTenantCostCap(monthlySpend);
      if (!capDecision.allowed) {
        throw new ForbiddenException(capDecision.reason ?? 'Tenant AI cost cap exceeded');
      }
    }

    const budgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
      input.tenantId,
      input.userId,
      estimatedCost,
    );
    if (!budgetCheck.allowed) {
      throw new ForbiddenException(budgetCheck.reason ?? 'AI budget check failed');
    }

    if (input.tenantId) {
      const monthlySpend = await this.aiUsage.getMonthlyTenantSpend(input.tenantId);
      const costDecision = this.aiPolicy.evaluateEstimatedCostCap(
        monthlySpend,
        estimatedCost,
        this.aiPolicy.getMonthlyTenantCostCap(),
      );
      if (!costDecision.allowed) {
        throw new ForbiddenException(costDecision.reason ?? 'Tenant AI cost cap exceeded');
      }
    }

    await this.aiCreditLedger.assertAndDebit({
      userId: input.userId,
      tenantId: input.tenantId,
      taskType: 'DOCUMENT_DRAFT',
      metadata: { matterId: input.matterId, documentType: input.documentType },
    });

    const startedAt = Date.now();
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    let result: DocumentDraftResult;
    let usage: OpenAiUsage = { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens };

    if (!openAiKey) {
      result = {
        outputMarkdown: [
          `# Draft ${docType}`,
          '',
          input.matterTitle ? `Re: ${input.matterTitle}` : 'Re: (matter not specified)',
          '',
          input.instructions ?? 'No instructions provided.',
          '',
          '## Review checklist',
          '- Verify facts and dates.',
          '- Confirm cited authorities before sharing.',
          '- Final lawyer approval required.',
        ].join('\n'),
        provider: 'mock',
        modelName: 'mock-document-draft-v1',
      };
      usage.outputTokens = estimateTokens(result.outputMarkdown);
    } else {
      const modelName = this.configService.get<string>('AI_REASONING_MODEL', 'gpt-4.1');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          store: false,
          messages: [
            {
              role: 'system',
              content:
                'You draft legal documents for licensed attorneys. Include clear structure and placeholders where facts are missing.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI draft request failed: ${errorText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      result = {
        outputMarkdown:
          payload.choices?.[0]?.message?.content ?? 'Unable to draft document at this time.',
        provider: 'openai',
        modelName,
      };
      usage = {
        inputTokens: payload.usage?.prompt_tokens ?? estimatedInputTokens,
        outputTokens: payload.usage?.completion_tokens ?? estimateTokens(result.outputMarkdown),
      };
    }

    const sanitizedDraft = this.complianceGuard.sanitizeOutput(
      result.outputMarkdown,
      countryPolicy,
      'document_generation',
    );
    result = {
      ...result,
      outputMarkdown: sanitizedDraft.outputMarkdown,
    };

    await this.aiUsage.logUsage({
      userId: input.userId,
      tenantId: input.tenantId,
      matterId: input.matterId,
      taskType: 'DOCUMENT_DRAFT',
      mode: AI_MODES.LAWYER_COPILOT,
      modelProvider: result.provider,
      modelName: result.modelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: openAiKey
        ? estimateCostUsd(usage.inputTokens, usage.outputTokens, 0.003, 0.012)
        : 0,
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
    });

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async runDocumentExplain(input: DocumentExplainInput): Promise<MatterSummaryResult> {
    return this.runTenantAgentTask({
      ...input,
      taskType: 'DOCUMENT_EXPLAINER',
      cacheNamespace: 'ai:explainer',
      cacheParts: [input.documentId, hashPrompt(input.documentText)],
      systemPrompt:
        'Explain legal documents in plain language for licensed attorneys. Highlight risks and key clauses.',
      userPrompt: [
        `Explain this document for matter review.`,
        input.documentText ? `Document text:\n${input.documentText}` : 'No extracted text available.',
      ].join('\n'),
    });
  }

  async runOpponentAnalysis(input: OpponentAnalysisInput): Promise<MatterSummaryResult> {
    return this.runTenantAgentTask({
      ...input,
      taskType: 'OPPONENT_ANALYZER',
      cacheNamespace: 'ai:research',
      cacheParts: [hashPrompt(input.filingText)],
      systemPrompt:
        'Analyze opposing filings and propose counterarguments for licensed attorneys.',
      userPrompt: `Analyze this opposing filing and suggest counterarguments:\n${input.filingText}`,
      reasoningModel: true,
    });
  }

  /** Plan-quota deep analysis for firm intake workspace (no credit debit). */
  async runIntakeDeepAnalysis(input: {
    userId: string;
    tenantId: string;
    taskType: string;
    systemPrompt: string;
    userPrompt: string;
    reasoningModel?: boolean;
    skipDebit?: boolean;
  }): Promise<MatterSummaryResult> {
    return this.runTenantAgentTask({
      userId: input.userId,
      tenantId: input.tenantId,
      taskType: input.taskType,
      cacheNamespace: 'ai:research',
      cacheParts: [hashPrompt(input.userPrompt)],
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      reasoningModel: input.reasoningModel,
      skipDebit: input.skipDebit ?? true,
    });
  }

  async runEvidenceGapAnalysis(input: EvidenceGapInput): Promise<MatterSummaryResult> {
    return this.runTenantAgentTask({
      ...input,
      taskType: 'EVIDENCE_GAP',
      cacheNamespace: 'ai:playbook',
      cacheParts: [hashPrompt(`${input.matterTitle ?? ''}:${input.factsSummary}`)],
      systemPrompt:
        'Identify missing evidence and discovery priorities for litigation matters.',
      userPrompt: [
        input.matterTitle ? `Matter: ${input.matterTitle}` : '',
        `Facts:\n${input.factsSummary || 'No facts summary provided.'}`,
        'Return markdown with sections: Missing evidence, Discovery priorities, Next actions.',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  async runBillingRecovery(input: AgentTaskInput): Promise<MatterSummaryResult> {
    const matter = input.matterId
      ? await this.prisma.matter.findFirst({
          where: { id: input.matterId, tenantId: input.tenantId },
          include: {
            tasks: { take: 5, orderBy: { createdAt: 'desc' } },
          },
        })
      : null;

    const timeEntries = input.matterId
      ? await this.prisma.timeEntry.findMany({
          where: { matterId: input.matterId, tenantId: input.tenantId },
          orderBy: { date: 'desc' },
          take: 20,
        })
      : [];

    return this.runTenantAgentTask({
      ...input,
      taskType: 'BILLING_RECOVERY',
      cacheNamespace: 'ai:playbook',
      cacheParts: [input.matterId ?? 'none', String(timeEntries.length)],
      systemPrompt:
        'Surface unbilled time, draft invoice opportunities, and collection follow-ups for law firms.',
      userPrompt: [
        matter ? `Matter: ${matter.title}` : 'Matter context unavailable.',
        timeEntries.length
          ? `Recent time entries:\n${timeEntries
              .map(
                (entry) =>
                  `- ${entry.narrative ?? 'Work'} (${(entry.minutes / 60).toFixed(2)}h)`,
              )
              .join('\n')}`
          : 'No time entries found.',
        matter?.tasks?.length
          ? `Open tasks:\n${matter.tasks.map((task) => `- ${task.title}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  async runDeadlineExtraction(input: DeadlineExtractionInput): Promise<MatterSummaryResult> {
    const tasks = input.matterId
      ? await this.prisma.task.findMany({
          where: { matterId: input.matterId, tenantId: input.tenantId },
          orderBy: { dueDate: 'asc' },
          take: 20,
        })
      : [];

    return this.runTenantAgentTask({
      ...input,
      taskType: 'DEADLINE_AGENT',
      cacheNamespace: 'ai:playbook',
      cacheParts: [input.matterId ?? 'none', String(tasks.length)],
      systemPrompt:
        'Extract procedural deadlines and escalation priorities for legal matters.',
      userPrompt: [
        input.matterTitle ? `Matter: ${input.matterTitle}` : '',
        tasks.length
          ? `Tasks and due dates:\n${tasks
              .map(
                (task) =>
                  `- ${task.title}${task.dueDate ? ` due ${task.dueDate.toISOString().slice(0, 10)}` : ''}`,
              )
              .join('\n')}`
          : 'No scheduled tasks found.',
        'Return markdown with sections: Critical deadlines, At-risk items, Recommended alerts.',
      ]
        .filter(Boolean)
        .join('\n'),
      skipDebit: true,
    });
  }

  async runConsumerFullReportSections(
    input: ConsumerFullReportInput,
  ): Promise<Record<string, string>> {
    const countryPolicy = await this.complianceGuard.assertConsumerGuidanceAllowed(
      input.countryCode,
    );
    const country = getCountryConfig(input.countryCode);
    const authorities = await this.hybridSearch.search(
      `${input.issueType} ${input.title}`,
      {
        countryCode: country.code,
        jurisdiction: input.jurisdiction,
        limit: 8,
      },
    );
    const authorityContext = authorities
      .map(
        (authority) =>
          `- ${authority.title}${authority.citation ? ` (${authority.citation})` : ''}: ${authority.summary ?? authority.sourceName}`,
      )
      .join('\n');

    const sectionBodies: Record<string, string> = {};

    for (const sectionTitle of input.sections) {
      if (sectionTitle === 'Disclaimer') {
        sectionBodies[sectionTitle] = CONSUMER_DISCLAIMER;
        continue;
      }

      const prompt = [
        `Generate the "${sectionTitle}" section of a consumer legal report.`,
        `Country: ${country.name}`,
        input.jurisdiction ? `Jurisdiction: ${input.jurisdiction}` : '',
        `Issue type: ${input.issueType}`,
        `Case title: ${input.title}`,
        input.facts ? `Facts: ${input.facts}` : '',
        input.desiredOutcome ? `Desired outcome: ${input.desiredOutcome}` : '',
        input.documentSummaries?.length
          ? `Documents:\n${input.documentSummaries.join('\n')}`
          : '',
        authorityContext ? `Retrieved authorities:\n${authorityContext}` : '',
        'Write 2-4 paragraphs in markdown without repeating the section title.',
      ]
        .filter(Boolean)
        .join('\n');

      sectionBodies[sectionTitle] = await this.generateSectionMarkdown(prompt);
      const sanitized = this.complianceGuard.sanitizeOutput(
        sectionBodies[sectionTitle],
        countryPolicy,
        'consumer',
      );
      sectionBodies[sectionTitle] = sanitized.outputMarkdown;
    }

    return sectionBodies;
  }

  private async runTenantAgentTask(input: {
    userId: string;
    tenantId: string;
    matterId?: string;
    taskType: string;
    cacheNamespace: 'ai:explainer' | 'ai:playbook' | 'ai:research';
    cacheParts: string[];
    systemPrompt: string;
    userPrompt: string;
    reasoningModel?: boolean;
    skipDebit?: boolean;
  }): Promise<MatterSummaryResult> {
    const route = this.modelRouter.resolveRoute(input.taskType);
    const cacheKey = this.cacheService.buildKey(input.cacheNamespace, [
      input.tenantId,
      input.matterId ?? 'none',
      ...input.cacheParts,
    ]);
    const cached = await this.cacheService.get<MatterSummaryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const estimatedInputTokens = estimateTokens(input.userPrompt);
    const estimatedOutputTokens = route.maxOutputTokens;
    const modelCost = await this.aiCostService.getModelCost(route.provider, route.modelName);
    const estimatedCost = estimateCostUsd(
      estimatedInputTokens,
      estimatedOutputTokens,
      modelCost.inputPer1M / 1_000_000,
      modelCost.outputPer1M / 1_000_000,
    );

    const budgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
      input.tenantId,
      input.userId,
      estimatedCost,
    );
    if (!budgetCheck.allowed) {
      throw new ForbiddenException(budgetCheck.reason ?? 'AI budget check failed');
    }

    let reservationId: string | undefined;
    if (!input.skipDebit) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { primaryCountry: true },
      });

      await this.assertMarginAllowed({
        taskType: input.taskType,
        route,
        countryCode: tenant?.primaryCountry ?? 'US',
        estimatedInputTokens,
        estimatedOutputTokens,
      });

      if (this.creditReservation.isEnabled()) {
        const reservation = await this.creditReservation.reserve({
          userId: input.userId,
          tenantId: input.tenantId,
          taskType: input.taskType,
          metadata: { matterId: input.matterId },
        });
        reservationId = reservation.id;
      } else {
        await this.aiCreditLedger.assertAndDebit({
          userId: input.userId,
          tenantId: input.tenantId,
          taskType: input.taskType,
          metadata: { matterId: input.matterId },
        });
      }
    }

    const startedAt = Date.now();
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    let result: MatterSummaryResult;
    let usage: OpenAiUsage = {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
    };

    if (!openAiKey) {
      result = {
        outputMarkdown: `# ${input.taskType}\n\n${input.userPrompt}`,
        provider: 'mock',
        modelName: `mock-${input.taskType.toLowerCase()}-v1`,
      };
    } else {
      const modelName = route.modelName;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          store: false,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI ${input.taskType} request failed: ${errorText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      result = {
        outputMarkdown:
          payload.choices?.[0]?.message?.content ??
          `Unable to complete ${input.taskType} at this time.`,
        provider: 'openai',
        modelName,
      };
      usage = {
        inputTokens: payload.usage?.prompt_tokens ?? usage.inputTokens,
        outputTokens: payload.usage?.completion_tokens ?? estimateTokens(result.outputMarkdown),
      };
    }

    const costUsd = openAiKey
      ? await this.aiCostService.computeActualCostUsd({
          provider: result.provider,
          modelName: result.modelName,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        })
      : 0;

    const chargedCredits = input.skipDebit ? 0 : getCreditCost(input.taskType);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { primaryCountry: true },
    });
    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      chargedCredits,
      tenant?.primaryCountry ?? 'US',
    );
    const { platformMarginUsd } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: costUsd,
    });

    if (reservationId) {
      await this.creditReservation.release(reservationId);
    }

    await this.aiUsage.logUsage({
      userId: input.userId,
      tenantId: input.tenantId,
      matterId: input.matterId,
      taskType: input.taskType,
      mode: AI_MODES.LAWYER_COPILOT,
      modelProvider: result.provider,
      modelName: result.modelName,
      modelTier: route.tier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd,
      estimatedCostUsd: estimatedCost,
      chargedCredits,
      creditValueUsd,
      platformMarginUsd,
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
    });

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  private async generateSectionMarkdown(prompt: string): Promise<string> {
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    if (!openAiKey) {
      return `${prompt.slice(0, 400)}...`;
    }

    const modelName = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        store: false,
        messages: [
          {
            role: 'system',
            content:
              'You write educational consumer legal report sections. Do not provide legal advice.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return 'Section content unavailable at this time.';
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return payload.choices?.[0]?.message?.content ?? 'Section content unavailable.';
  }

  private formatLegalLocation(countryCode: string, jurisdiction?: string): string {
    const country = getCountryConfig(countryCode);
    if (jurisdiction?.trim()) {
      return `${jurisdiction.trim()}, ${country.name}`;
    }
    return country.name;
  }

  private buildFirmIntakePreviewPrompt(
    input: ConsumerPreviewInput,
    authorities: Array<{
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }> = [],
  ): string {
    const authorityContext = authorities
      .map(
        (authority) =>
          `- ${authority.title}${authority.citation ? ` (${authority.citation})` : ''}: ${authority.summary ?? authority.sourceName}`,
      )
      .join('\n');

    const legalLocation = this.formatLegalLocation(input.countryCode, input.jurisdiction);

    return [
      `You are assisting a licensed attorney conducting client matter intake for ${legalLocation}.`,
      `Apply the laws and procedures of ${legalLocation} only.`,
      input.clientName ? `Client: ${input.clientName}` : '',
      input.clientReference ? `Client reference: ${input.clientReference}` : '',
      input.internalNotes ? `Internal notes: ${input.internalNotes}` : '',
      `Issue type: ${input.issueType}`,
      `Matter title: ${input.title}`,
      input.jurisdiction ? `Jurisdiction: ${input.jurisdiction}` : '',
      input.parties ? `Parties: ${input.parties}` : '',
      input.facts ? `Facts: ${input.facts}` : '',
      input.desiredOutcome ? `Client desired outcome: ${input.desiredOutcome}` : '',
      authorityContext
        ? `\nRelevant legal authorities:\n${authorityContext}`
        : '\nNo specific authorities retrieved — note gaps explicitly.',
      '',
      'Provide counsel-oriented analysis (not consumer self-help). Include:',
      '1. Applicable law overview',
      '2. Strengths for our client',
      '3. Risks and evidence gaps',
      '4. Missing evidence to request',
      '5. Recommended next steps for counsel',
      '',
      'Write the main analysis in markdown. Then append a JSON block:',
      '```json',
      '{"situation":"...","legalIssues":["..."],"strengths":["..."],"risksAndGaps":["..."],"recommendedNextSteps":["..."],"sourcesCited":["..."]}',
      '```',
      'Do not tell the lawyer to consult a lawyer — they are the lawyer.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private parseFirmIntakeStructured(content: string): FirmIntakeStructuredOutput | undefined {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as Partial<FirmIntakeStructuredOutput>;
        return {
          situation: parsed.situation ?? '',
          legalIssues: parsed.legalIssues ?? [],
          strengths: parsed.strengths ?? [],
          risksAndGaps: parsed.risksAndGaps ?? [],
          recommendedNextSteps: parsed.recommendedNextSteps ?? [],
          sourcesCited: parsed.sourcesCited ?? [],
        };
      } catch {
        // fall through to markdown parsing
      }
    }

    const section = (header: string) => {
      const re = new RegExp(`##\\s*${header}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
      const match = content.match(re);
      return match?.[0]?.replace(new RegExp(`^##\\s*${header}\\s*`, 'i'), '').trim() ?? '';
    };

    const bullets = (text: string) =>
      text
        .split('\n')
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);

    const situation = section('Situation|Summary|Applicable law overview');
    if (!situation) return undefined;

    return {
      situation,
      legalIssues: bullets(section('Legal issues|Legal Issues')),
      strengths: bullets(section('Strengths|Strengths for our client')),
      risksAndGaps: bullets(section('Risks|Risks & gaps|Risks and gaps')),
      recommendedNextSteps: bullets(section('Recommended next steps|Next steps')),
      sourcesCited: bullets(section('Sources|Sources cited')),
    };
  }

  private stripStructuredJsonBlock(content: string): string {
    return content.replace(/```json[\s\S]*?```/gi, '').trim();
  }

  private buildPreviewPrompt(
    input: ConsumerPreviewInput,
    authorities: Array<{
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }> = [],
  ): string {
    const authorityContext = authorities
      .map(
        (authority) =>
          `- ${authority.title}${authority.citation ? ` (${authority.citation})` : ''}: ${authority.summary ?? authority.sourceName}`,
      )
      .join('\n');

    const legalLocation = this.formatLegalLocation(input.countryCode, input.jurisdiction);

    return [
      `Analyze this consumer legal issue in ${legalLocation}. Apply the laws and procedures of ${legalLocation} only — do not assume a different country or state.`,
      `Issue type: ${input.issueType}`,
      `Title: ${input.title}`,
      input.jurisdiction ? `Jurisdiction: ${input.jurisdiction}` : '',
      input.facts ? `Facts: ${input.facts}` : '',
      input.desiredOutcome ? `Desired outcome: ${input.desiredOutcome}` : '',
      authorityContext
        ? `\nRelevant legal authorities:\n${authorityContext}`
        : '\nNo specific authorities retrieved — provide general educational guidance and note limitations.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildResearchPrompt(
    input: LawyerResearchInput,
    countryName: string,
    authorities: Array<{
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }>,
    firmMemoryHits: Array<{ title?: string; content: string; sourceType: string }> = [],
  ): string {
    const authorityContext = authorities
      .map(
        (authority) =>
          `- ${authority.title}${authority.citation ? ` (${authority.citation})` : ''}: ${authority.summary ?? authority.sourceName}`,
      )
      .join('\n');

    const firmContext = firmMemoryHits
      .map((hit) => `- [${hit.sourceType}] ${hit.title ?? 'Firm artifact'}: ${hit.content.slice(0, 500)}`)
      .join('\n');

    return [
      `Legal research query for ${countryName}.`,
      input.jurisdiction ? `Jurisdiction: ${input.jurisdiction}` : '',
      input.practiceArea ? `Practice area: ${input.practiceArea}` : '',
      `Query: ${input.query}`,
      authorityContext
        ? `\nRetrieved authorities:\n${authorityContext}`
        : '\nNo authorities retrieved — note gaps explicitly.',
      firmContext ? `\nFirm memory (tenant-private):\n${firmContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async generateResearchWithOpenAi(
    input: LawyerResearchInput,
    countryName: string,
    authorities: Array<{
      id: string;
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }>,
    prompt: string,
    route: ResolvedModelRoute,
  ): Promise<{ result: LawyerResearchResult; usage: OpenAiUsage }> {
    const modelName = route.modelName;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        store: false,
        messages: [
          {
            role: 'system',
            content:
              'You are a legal research assistant for licensed attorneys. Cite only provided authorities.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI research request failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content =
      payload.choices?.[0]?.message?.content ??
      'Unable to generate research memo at this time.';

    const citations = authorities.map((authority) => ({
      authorityId: authority.id,
      sourceName: authority.sourceName,
      citation: authority.citation ?? authority.title,
      confidence: 0.75,
    }));

    return {
      result: {
        outputMarkdown: content,
        citations,
        mode: AI_MODES.LAWYER_LEGAL_RESEARCH,
        provider: 'openai',
        modelName,
        countryCode: input.countryCode.toUpperCase(),
        jurisdiction: input.jurisdiction,
      },
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(prompt),
        outputTokens: payload.usage?.completion_tokens ?? estimateTokens(content),
      },
    };
  }

  private generateMockResearch(
    input: LawyerResearchInput,
    countryName: string,
    authorities: Array<{
      id: string;
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }>,
  ): LawyerResearchResult {
    const citations =
      authorities.length > 0
        ? authorities.map((authority) => ({
            authorityId: authority.id,
            sourceName: authority.sourceName,
            citation: authority.citation ?? authority.title,
            confidence: 0.65,
          }))
        : [
            {
              sourceName: 'Mock Legal Knowledge Base',
              citation: `${countryName} practice guidance (demo)`,
              confidence: 0.5,
            },
          ];

    const authoritySection =
      authorities.length > 0
        ? authorities
            .map(
              (authority, index) =>
                `${index + 1}. **${authority.title}**${authority.citation ? ` — ${authority.citation}` : ''}\n   ${authority.summary ?? 'Summary unavailable in seed data.'}`,
            )
            .join('\n')
        : '_No seeded authorities found for this jurisdiction — add records to LegalAuthority or configure live retrieval._';

    const body = [
      `# Legal Research Memo`,
      '',
      `**Query:** ${input.query}`,
      `**Country:** ${countryName}`,
      input.jurisdiction ? `**Jurisdiction:** ${input.jurisdiction}` : '',
      input.practiceArea ? `**Practice area:** ${input.practiceArea}` : '',
      input.matterId ? `**Matter ID:** ${input.matterId}` : '',
      '',
      '## Executive summary',
      `This mock research memo outlines relevant considerations for "${input.query}" under ${countryName} law. Configure OPENAI_API_KEY for live analysis with citation guardrails.`,
      '',
      '## Applicable authorities',
      authoritySection,
      '',
      '## Analysis',
      '- Identify controlling statutes, regulations, and precedent applicable to the query.',
      '- Cross-check procedural requirements and limitation periods.',
      '- Flag factual gaps that may affect conclusions.',
      '',
      '## Recommended next steps',
      '1. Verify citations against official sources.',
      '2. Expand search to adjacent jurisdictions if conflicts exist.',
      '3. Document research trail in the matter file.',
      '',
      '_Mock preview — LAWYER_LEGAL_RESEARCH mode_',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      outputMarkdown: body,
      citations,
      mode: AI_MODES.LAWYER_LEGAL_RESEARCH,
      provider: 'mock',
      modelName: 'mock-legal-research-v1',
      countryCode: input.countryCode.toUpperCase(),
      jurisdiction: input.jurisdiction,
    };
  }

  private async generateWithOpenAi(
    input: ConsumerPreviewInput,
    countryName: string,
    disclaimer: string,
    prompt: string,
    authorities: Array<{
      id: string;
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }> = [],
    route: ResolvedModelRoute,
    isFirmIntake = false,
  ): Promise<{ result: AiPreviewResult; usage: OpenAiUsage }> {
    const modelName = route.modelName;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        store: false,
        messages: [
          {
            role: 'system',
            content: isFirmIntake
              ? 'You are a legal research assistant for licensed attorneys conducting client intake. Provide actionable counsel-oriented analysis. Cite provided authorities when relevant.'
              : 'You are a legal information assistant. Provide educational previews only, not legal advice. When authorities are provided, reference them in your analysis.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const rawContent =
      payload.choices?.[0]?.message?.content ??
      'Unable to generate preview at this time.';

    const structuredOutput = isFirmIntake
      ? this.parseFirmIntakeStructured(rawContent)
      : undefined;
    const content = isFirmIntake
      ? this.stripStructuredJsonBlock(rawContent)
      : rawContent;

    const riskLevel = this.estimateRiskLevel(input.issueType, input.facts);
    const outputMarkdown = this.appendDisclaimer(content, disclaimer);

    return {
      result: {
        outputMarkdown,
        citations:
          authorities.length > 0
            ? authorities.map((authority) => ({
                authorityId: authority.id,
                sourceName: authority.sourceName,
                citation: authority.citation ?? authority.title,
                confidence: 0.7,
              }))
            : [],
        riskLevel,
        riskScore: this.riskScoreFromLevel(riskLevel),
        requiresLawyerReview: riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
        disclaimer,
        mode: isFirmIntake ? AI_MODES.FIRM_INTAKE_PREVIEW : AI_MODES.CONSUMER_FREE_PREVIEW,
        provider: 'openai',
        modelName,
        structuredOutput,
      },
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(prompt),
        outputTokens:
          payload.usage?.completion_tokens ?? estimateTokens(outputMarkdown),
      },
    };
  }

  private generateMockPreview(
    input: ConsumerPreviewInput,
    countryName: string,
    disclaimer: string,
    authorities: Array<{
      id: string;
      title: string;
      citation: string | null;
      sourceName: string;
      summary: string | null;
    }> = [],
    isFirmIntake = false,
  ): AiPreviewResult {
    const riskLevel = this.estimateRiskLevel(input.issueType, input.facts);
    const requiresLawyerReview = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

    const body = isFirmIntake
      ? [
          `# Client Matter Intake — ${input.title}`,
          '',
          input.clientName ? `**Client:** ${input.clientName}` : '',
          `**Location:** ${countryName}${input.jurisdiction ? ` — ${input.jurisdiction}` : ''}`,
          `**Issue type:** ${input.issueType}`,
          '',
          '## Applicable law overview',
          `Initial review suggests ${input.issueType.toLowerCase()} principles in ${countryName} may apply.`,
          input.facts ? `\n**Facts:** ${input.facts}` : '',
          '',
          '## Strengths for our client',
          '- Client has documented the timeline and key facts.',
          '- Early intake allows proactive evidence gathering.',
          '',
          '## Risks & gaps',
          '- Confirm procedural deadlines and notice requirements.',
          '- Request supporting documents before advising on strategy.',
          '',
          '## Recommended next steps',
          '1. Request leases, notices, and correspondence from client.',
          '2. Confirm jurisdiction-specific procedural requirements.',
          '3. Schedule follow-up after document review.',
          '',
          `**Risk level:** ${riskLevel} (mock preview)`,
        ]
          .filter(Boolean)
          .join('\n')
      : [
      `# Issue Checker Preview — ${input.title}`,
      '',
      `**Country:** ${countryName}`,
      input.jurisdiction ? `**Jurisdiction:** ${input.jurisdiction}` : '',
      `**Issue type:** ${input.issueType}`,
      '',
      '## Summary',
      `Based on the information provided, this appears to be a ${input.issueType.toLowerCase()} matter that may benefit from further review.`,
      input.facts ? `\n**Facts reviewed:** ${input.facts}` : '',
      input.desiredOutcome
        ? `\n**Stated goal:** ${input.desiredOutcome}`
        : '',
      '',
      '## Potential risks',
      `- Procedural deadlines may apply in ${countryName}.`,
      '- Missing documentation could weaken your position.',
      requiresLawyerReview
        ? '- Complexity suggests consulting a licensed attorney soon.'
        : '- Initial review suggests manageable next steps with proper documentation.',
      '',
      '## Recommended next steps',
      '1. Gather relevant documents and correspondence.',
      '2. Note key dates, parties, and amounts involved.',
      '3. Consider requesting a lawyer review if deadlines are near.',
      '',
      '## Risk level',
      `**${riskLevel}** (mock preview — configure OPENAI_API_KEY for live analysis)`,
    ]
      .filter(Boolean)
      .join('\n');

    const structuredOutput = isFirmIntake
      ? {
          situation: `${input.issueType} matter for ${input.clientName ?? 'client'} in ${countryName}.`,
          legalIssues: [input.issueType],
          strengths: ['Facts captured at intake', 'Early counsel review possible'],
          risksAndGaps: ['Deadlines unverified', 'Documents not yet uploaded'],
          recommendedNextSteps: [
            'Gather supporting documents',
            'Verify jurisdiction-specific deadlines',
            'Schedule client follow-up',
          ],
          sourcesCited: authorities.map(
            (a) => a.citation ?? a.title,
          ),
        }
      : undefined;

    return {
      outputMarkdown: this.appendDisclaimer(body, disclaimer),
      citations:
        authorities.length > 0
          ? authorities.map((authority) => ({
              authorityId: authority.id,
              sourceName: authority.sourceName,
              citation: authority.citation ?? authority.title,
              confidence: 0.65,
            }))
          : [
              {
                sourceName: 'Mock Legal Knowledge Base',
                citation: `${countryName} consumer guidance (demo)`,
                confidence: 0.55,
              },
            ],
      riskLevel,
      riskScore: this.riskScoreFromLevel(riskLevel),
      requiresLawyerReview,
      disclaimer,
      mode: isFirmIntake ? AI_MODES.FIRM_INTAKE_PREVIEW : AI_MODES.CONSUMER_FREE_PREVIEW,
      provider: 'mock',
      modelName: 'mock-issue-checker-v1',
      structuredOutput,
    };
  }

  private appendDisclaimer(content: string, disclaimer: string): string {
    if (!disclaimer) {
      return content;
    }

    return `${content}\n\n---\n\n> **Disclaimer:** ${disclaimer}`;
  }

  private estimateRiskLevel(issueType: string, facts?: string): string {
    const normalized = `${issueType} ${facts ?? ''}`.toLowerCase();

    if (
      normalized.includes('criminal') ||
      normalized.includes('eviction') ||
      normalized.includes('deadline')
    ) {
      return 'HIGH';
    }

    if (
      normalized.includes('contract') ||
      normalized.includes('employment') ||
      normalized.includes('dispute')
    ) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  async classifyIssueChecker(input: {
    countryCode: string;
    facts: string;
    mode?: string;
  }): Promise<IssueClassificationResult> {
    await this.complianceGuard.assertConsumerGuidanceAllowed(input.countryCode);

    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    if (openAiKey) {
      try {
        return await this.classifyWithOpenAi(input.facts);
      } catch {
        // fall back to heuristics
      }
    }

    return this.classifyFromKeywords(input.facts);
  }

  async runIssueCheckerTeaser(
    input: IssueCheckerTeaserInput,
  ): Promise<IssueCheckerTeaserResult> {
    await this.complianceGuard.assertConsumerGuidanceAllowed(input.countryCode);

    const country = getCountryConfig(input.countryCode);
    const combinedFacts = this.buildTeaserFacts(input);
    const previewInput: ConsumerPreviewInput = {
      userId: 'anonymous',
      consumerCaseId: 'teaser',
      countryCode: input.countryCode,
      jurisdiction: input.jurisdiction,
      issueType: input.issueType,
      title: input.title,
      facts: combinedFacts,
      desiredOutcome: input.desiredOutcome,
    };

    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    let fullMarkdown: string;
    let requiresLawyer: boolean;
    let provider: string;

    if (openAiKey) {
      try {
        const route = this.modelRouter.resolveRoute(AI_TASK_TYPES.ISSUE_CHECKER);
        const prompt = this.buildPreviewPrompt(previewInput, []);
        const generated = await this.generateWithOpenAi(
          previewInput,
          country.name,
          CONSUMER_DISCLAIMER,
          prompt,
          [],
          route,
        );
        fullMarkdown = generated.result.outputMarkdown;
        requiresLawyer = generated.result.requiresLawyerReview;
        provider = generated.result.provider;
      } catch {
        const mock = this.generateMockPreview(
          previewInput,
          country.name,
          CONSUMER_DISCLAIMER,
          [],
        );
        fullMarkdown = mock.outputMarkdown;
        requiresLawyer = mock.requiresLawyerReview;
        provider = mock.provider;
      }
    } else {
      const mock = this.generateMockPreview(
        previewInput,
        country.name,
        CONSUMER_DISCLAIMER,
        [],
      );
      fullMarkdown = mock.outputMarkdown;
      requiresLawyer = mock.requiresLawyerReview;
      provider = mock.provider;
    }

    const teaserMarkdown = this.truncateToWords(fullMarkdown, 200);
    const keyBullets = this.extractKeyBullets(fullMarkdown);

    return {
      detectedIssueType: input.issueType,
      suggestedTitle: input.title,
      teaserMarkdown,
      keyBullets,
      requiresLawyer,
      disclaimer: CONSUMER_DISCLAIMER,
      mode: 'TEASER',
      provider,
    };
  }

  private buildTeaserFacts(input: IssueCheckerTeaserInput): string {
    return [
      input.facts,
      input.parties ? `Parties involved: ${input.parties}` : '',
      input.urgencyLevel ? `Urgency: ${input.urgencyLevel}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private classifyFromKeywords(facts: string): IssueClassificationResult {
    const normalized = facts.toLowerCase();
    const rules: Array<{ type: string; keywords: string[]; urgency?: string }> = [
      { type: 'Employment & Workplace', keywords: ['employ', 'salary', 'workplace', 'hr', 'fired', 'termination', 'boss'] },
      { type: 'Landlord & Tenant', keywords: ['landlord', 'tenant', 'rent', 'lease', 'eviction', 'deposit'] },
      { type: 'Family & Divorce', keywords: ['divorce', 'custody', 'spouse', 'marriage', 'child support', 'separation'] },
      { type: 'Consumer Rights', keywords: ['refund', 'warranty', 'faulty', 'consumer', 'retailer', 'product defect'] },
      { type: 'Contract Dispute', keywords: ['contract', 'breach', 'invoice', 'client won\'t pay', 'agreement'] },
      { type: 'Debt & Collections', keywords: ['debt', 'collection', 'creditor', 'loan', 'harassment'] },
      { type: 'Criminal Matter', keywords: ['criminal', 'police', 'arrest', 'charge', 'court summons', 'prosecution'] },
      { type: 'Immigration', keywords: ['visa', 'immigration', 'deportation', 'asylum', 'work permit', 'green card'] },
    ];

    let bestType = 'Other';
    let bestScore = 0;
    for (const rule of rules) {
      const score = rule.keywords.filter((keyword) => normalized.includes(keyword)).length;
      if (score > bestScore) {
        bestScore = score;
        bestType = rule.type;
      }
    }

    const urgencyLevel = this.inferUrgencyFromText(normalized);
    const suggestedTitle = this.generateSuggestedTitle(facts, bestType);

    return {
      issueType: bestType,
      suggestedTitle,
      urgencyLevel,
      confidence: bestScore > 0 ? Math.min(0.95, 0.55 + bestScore * 0.15) : 0.45,
    };
  }

  private async classifyWithOpenAi(facts: string): Promise<IssueClassificationResult> {
    const issueTypes = [
      'Employment & Workplace',
      'Landlord & Tenant',
      'Family & Divorce',
      'Consumer Rights',
      'Contract Dispute',
      'Debt & Collections',
      'Criminal Matter',
      'Immigration',
      'Other',
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.configService.get<string>('AI_CHEAP_MODEL', 'gpt-4.1-mini'),
        store: false,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Classify the legal situation. Respond with JSON: {"issueType":"...","suggestedTitle":"...","urgencyLevel":"LOW|MEDIUM|HIGH|URGENT","confidence":0.0-1.0}. issueType must be one of the allowed values.',
          },
          {
            role: 'user',
            content: `Allowed issue types: ${issueTypes.join(', ')}\n\nSituation:\n${facts}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI classify failed: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as {
      issueType?: string;
      suggestedTitle?: string;
      urgencyLevel?: string;
      confidence?: number;
    };

    const issueType = issueTypes.includes(parsed.issueType ?? '')
      ? parsed.issueType!
      : 'Other';

    return {
      issueType,
      suggestedTitle:
        parsed.suggestedTitle?.trim() ||
        this.generateSuggestedTitle(facts, issueType),
      urgencyLevel: this.normalizeUrgency(parsed.urgencyLevel ?? 'MEDIUM'),
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.75)),
    };
  }

  private generateSuggestedTitle(facts: string, issueType: string): string {
    const firstSentence = facts.split(/[.!?\n]/)[0]?.trim() ?? facts.trim();
    const trimmed = firstSentence.slice(0, 80);
    if (trimmed.length >= 10) {
      return trimmed;
    }
    return `${issueType} matter`;
  }

  private inferUrgencyFromText(text: string): string {
    if (
      text.includes('urgent') ||
      text.includes('deadline') ||
      text.includes('tomorrow') ||
      text.includes('court date')
    ) {
      return 'URGENT';
    }
    if (
      text.includes('soon') ||
      text.includes('eviction') ||
      text.includes('criminal')
    ) {
      return 'HIGH';
    }
    if (text.includes('eventually') || text.includes('no rush')) {
      return 'LOW';
    }
    return 'MEDIUM';
  }

  private normalizeUrgency(value: string): string {
    const upper = value.toUpperCase();
    if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(upper)) {
      return upper;
    }
    return 'MEDIUM';
  }

  private truncateToWords(text: string, maxWords: number): string {
    const stripped = text.replace(/\n---\n[\s\S]*$/, '').trim();
    const words = stripped.split(/\s+/);
    if (words.length <= maxWords) {
      return stripped;
    }
    return `${words.slice(0, maxWords).join(' ')}…`;
  }

  private extractKeyBullets(markdown: string): string[] {
    const bullets: string[] = [];
    for (const line of markdown.split('\n')) {
      const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/);
      if (match?.[1]) {
        bullets.push(match[1].trim());
      }
      if (bullets.length >= 4) {
        break;
      }
    }

    if (bullets.length >= 2) {
      return bullets.slice(0, 4);
    }

    return [
      'We reviewed the facts you shared and identified relevant legal themes.',
      'Deadlines and documentation gaps are common risk factors in cases like this.',
      'Create a free account to unlock the full analysis and save your case.',
    ];
  }

  private riskScoreFromLevel(level: string): number {
    switch (level) {
      case 'CRITICAL':
        return 0.95;
      case 'HIGH':
        return 0.8;
      case 'MEDIUM':
        return 0.55;
      default:
        return 0.3;
    }
  }

  private async assertMarginAllowed(params: {
    taskType: string;
    route: ResolvedModelRoute;
    countryCode: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    isFreePreview?: boolean;
  }) {
    const modelCost = await this.aiCostService.getModelCost(
      params.route.provider,
      params.route.modelName,
    );
    const estimatedCostUsd = estimateCostUsd(
      params.estimatedInputTokens,
      params.estimatedOutputTokens,
      modelCost.inputPer1M / 1_000_000,
      modelCost.outputPer1M / 1_000_000,
    );
    const chargedCredits = getCreditCost(params.taskType);
    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      chargedCredits,
      params.countryCode,
    );
    const { grossMarginPercent } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: estimatedCostUsd,
    });

    if (
      this.aiCostService.shouldBlockNegativeMargin({
        taskType: params.taskType,
        grossMarginPercent,
        isFreePreview: params.isFreePreview,
      })
    ) {
      throw new ForbiddenException(
        `Task ${params.taskType} blocked: estimated margin ${grossMarginPercent}% below policy threshold`,
      );
    }
  }
}
