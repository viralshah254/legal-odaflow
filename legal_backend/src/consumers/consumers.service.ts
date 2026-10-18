import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { CreditPacksService } from '@/ai-credits/credit-packs.service';
import { computeCreditsFromPayment, DEFAULT_CREDIT_USD_VALUE } from '@/ai-credits/credit-pricing.util';
import {
  AiGatewayService,
  type StoredIssueCheckerSession,
  type StoredLegalResearchSession,
} from '@/ai/ai-gateway.service';
import { getIntakeIntent } from './issue-checker.constants';
import { mergeIntakeCaseBrief } from './intake-case-brief';
import { IntakeIntelligenceService } from './intake-intelligence.service';
import { getCountryConfig } from '@/config/countries';
import { resolveConsumerSignupCredits } from '@/config/pricing.config';
import { RequestUser } from '@/common/types/request-user.interface';
import { PaymentsService } from '@/payments/payments.service';
import { StripeService, toStripeMinorUnits } from '@/payments/stripe.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreditTopupCheckoutDto } from './dto/credit-topup.dto';
import { resolveAppUrl } from '@/common/app-url';
import { CreateConsumerCaseDto } from './dto/create-case.dto';
import { IssueCheckerClassifyDto } from './dto/issue-checker-classify.dto';
import { IssueCheckerPreviewDto } from './dto/issue-checker-preview.dto';
import { IssueCheckerTeaserDto } from './dto/issue-checker-teaser.dto';
import { LegalResearchTeaserDto } from './dto/legal-research-teaser.dto';
import { FullLoopAutomationService } from '@/marketplace/full-loop-automation.service';
import { DocumentsService } from '@/documents/documents.service';
import { formatPreviewReportMarkdown } from '@/consumer-reports/format-preview-report.util';
import { UpdateConsumerCaseDto } from './dto/update-case.dto';
import { JobsService } from '@/jobs/jobs.service';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import { MiAuditLogService } from '@/ai/matter-intelligence/mi-audit-log.service';
import { isMiEnabled } from '@/ai/matter-intelligence/mi-feature-flags';
import type { MatterIntelligencePipelineResult } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';

const COMPLETED_CASE_STATUSES = new Set([
  'COMPLETED',
  'REVIEW_COMPLETED',
  'CLOSED',
]);

const TEASER_SESSION_TTL_SECONDS = 60 * 60 * 24;

/**
 * Heuristic extraction of a client name from intake facts text.
 * Matches common patterns: "a client John Smith", "my client Rushab Shah",
 * "help a client named X", "help X to fix", "for X who is".
 * Returns null if no confident match.
 */
function extractClientNameFromFacts(facts: string): string | null {
  const patterns = [
    // "a/my client [Name]" or "client named [Name]"
    /\b(?:a|my)\s+client\s+(?:named?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/,
    // "help [Name] to/with/fix/in"
    /\bhelp\s+(?:a\s+client\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:to|with|fix|in|regarding|who)\b/i,
    // "for [Name] who" or "for [Name],"
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:who|,)/,
    // "client is [Name]" or "client: [Name]"
    /\bclient\s+(?:is\s*:?\s*|:\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = facts.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      // Sanity: at least 2+ chars, not a stop word
      const stopWords = new Set(['me', 'you', 'us', 'him', 'her', 'them', 'this', 'that', 'the']);
      if (name.length >= 3 && !stopWords.has(name.toLowerCase())) {
        return name;
      }
    }
  }
  return null;
}

@Injectable()
export class ConsumersService {
  private readonly logger = new Logger(ConsumersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly fullLoopAutomation: FullLoopAutomationService,
    private readonly documentsService: DocumentsService,
    private readonly creditPacks: CreditPacksService,
    private readonly jobsService: JobsService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly matterMemory: MatterMemoryService,
    private readonly miAuditLog: MiAuditLogService,
    private readonly intakeIntelligence: IntakeIntelligenceService,
  ) {}

  async createCase(userId: string, dto: CreateConsumerCaseDto) {
    const consumerCase = await this.prisma.consumerCase.create({
      data: {
        userId,
        countryCode: dto.countryCode.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        issueType: dto.issueType,
        title: dto.title,
        facts: dto.facts,
        desiredOutcome: dto.desiredOutcome,
        urgencyLevel: dto.urgencyLevel ?? 'LOW',
        status: 'DRAFT',
      },
    });

    if (dto.facts?.trim()) {
      void this.runConsumerMiPipeline(
        consumerCase.id,
        dto.facts,
        dto.countryCode.toUpperCase(),
        dto.jurisdiction,
        { userId, consumer: 'consumers.createCase' },
      ).catch((err) => {
      this.logger.warn(
        `MI pipeline failed for consumer case ${consumerCase.id}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      });
    }

    return consumerCase;
  }

  async listCases(userId: string) {
    return this.prisma.consumerCase.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        reports: {
          where: { isPreview: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getCase(userId: string, caseId: string) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: caseId, userId },
      include: {
        documents: true,
        reports: { orderBy: { createdAt: 'desc' } },
        reviewRequests: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    return consumerCase;
  }

  async updateCase(userId: string, caseId: string, dto: UpdateConsumerCaseDto) {
    await this.ensureCaseOwnership(userId, caseId);

    const updated = await this.prisma.consumerCase.update({
      where: { id: caseId },
      data: dto,
    });

    if (dto.status && COMPLETED_CASE_STATUSES.has(dto.status)) {
      void this.fullLoopAutomation.onConsumerCaseCompleted(caseId);
    }

    return updated;
  }

  async deleteCase(userId: string, caseId: string) {
    await this.ensureCaseOwnership(userId, caseId);

    await this.prisma.consumerCase.delete({ where: { id: caseId } });
    return { success: true };
  }

  async classifyIssueChecker(dto: IssueCheckerClassifyDto, locale?: string) {
    const result = await this.aiGateway.classifyIssueChecker({
      countryCode: dto.countryCode.toUpperCase(),
      facts: dto.facts,
      mode: dto.mode,
      locale,
    });

    const suggestedClientName = extractClientNameFromFacts(dto.facts);
    const intelligence = await this.intakeIntelligence.analyze({
      facts: dto.facts,
      countryCode: dto.countryCode.toUpperCase(),
      issueType: result.issueType,
      mode: dto.mode,
    });

    const miResult = isMiEnabled('intake')
      ? await this.matterPipeline.run({
          facts: dto.facts,
          countryCode: dto.countryCode.toUpperCase(),
          skipRetrieval: true,
          consumer: 'intake',
        })
      : null;

    return {
      ...result,
      suggestedClientName: suggestedClientName ?? null,
      intakeIntelligence: {
        intent: intelligence.intent,
        jurisdictionHints: intelligence.jurisdictionHints,
        missingSlots: intelligence.missingSlots,
        toolPlan: intelligence.toolPlan,
        recommendedNextTool: intelligence.recommendedNextTool,
      },
      recommendedNextTool: intelligence.recommendedNextTool,
      ...(miResult
        ? {
            matterProfile: miResult.profile,
            matterGraph: miResult.graph,
            taskGraph: miResult.taskGraph,
            recommendationMode: miResult.recommendationMode,
            clarifyingQuestions: miResult.clarifyingQuestions,
          }
        : {}),
    };
  }

  async getPlanQuestions(
    dto: {
      countryCode: string;
      facts: string;
      issueType?: string;
      mode?: string;
      parties?: string;
      locale?: string;
    },
    locale?: string,
  ) {
    const result = await this.aiGateway.runPlanQuestions({
      countryCode: dto.countryCode.toUpperCase(),
      facts: dto.facts,
      issueType: dto.issueType,
      mode: dto.mode,
      parties: dto.parties,
      locale: locale ?? dto.locale,
    });
    return {
      extractedFields: result.extractedFields,
      questions: result.questions,
    };
  }

  async getOutcomeOptions(
    dto: { facts: string; countryCode: string; practiceArea?: string },
    locale?: string,
  ) {
    const options = await this.aiGateway.runOutcomeOptions({
      facts: dto.facts,
      countryCode: dto.countryCode.toUpperCase(),
      practiceArea: dto.practiceArea,
      locale,
    });
    return { options };
  }

  async teaserIssueChecker(dto: IssueCheckerTeaserDto, locale?: string) {
    const anonymousSessionId = randomUUID();
    const combinedFacts = this.buildCombinedFacts(dto);

    const teaser = await this.aiGateway.runIssueCheckerTeaser({
      countryCode: dto.countryCode.toUpperCase(),
      jurisdiction: dto.jurisdiction,
      issueType: dto.issueType,
      title: dto.title,
      facts: combinedFacts,
      desiredOutcome: dto.desiredOutcome,
      parties: dto.parties,
      urgencyLevel: dto.urgencyLevel,
      locale,
      planningAnswers: dto.planningAnswers,
    });

    const miResult = isMiEnabled('intake')
      ? await this.matterPipeline.run({
          facts: combinedFacts,
          countryCode: dto.countryCode.toUpperCase(),
          jurisdiction: dto.jurisdiction,
          skipRetrieval: true,
          consumer: 'intake',
        })
      : null;

    const session: StoredIssueCheckerSession = {
      countryCode: dto.countryCode.toUpperCase(),
      jurisdiction: dto.jurisdiction,
      issueType: dto.issueType,
      title: dto.title,
      facts: combinedFacts,
      desiredOutcome: dto.desiredOutcome,
      parties: dto.parties,
      urgencyLevel: dto.urgencyLevel,
      mode: dto.mode,
      clientName: dto.clientName,
      clientReference: dto.clientReference,
      internalNotes: dto.internalNotes,
      planningAnswers: dto.planningAnswers,
      createdAt: new Date().toISOString(),
    };

    await this.cacheService.set(
      this.sessionCacheKey(anonymousSessionId),
      session,
      TEASER_SESSION_TTL_SECONDS,
    );

    return {
      anonymousSessionId,
      ...teaser,
      ...(miResult
        ? {
            matterProfile: miResult.profile,
            taskGraph: miResult.taskGraph,
            recommendedActions: miResult.taskGraph?.recommendedActions,
            issues: miResult.profile.issues,
            nextBestAction: miResult.taskGraph?.nextBestAction,
          }
        : {}),
    };
  }

  async teaserLegalResearch(dto: LegalResearchTeaserDto, locale?: string) {
    const anonymousSessionId = randomUUID();
    const countryCode = dto.countryCode.toUpperCase();

    const teaser = await this.aiGateway.runLegalResearchTeaser({
      query: dto.query.trim(),
      countryCode,
      locale,
    });

    const session: StoredLegalResearchSession = {
      query: dto.query.trim(),
      countryCode,
      createdAt: new Date().toISOString(),
    };

    await this.cacheService.set(
      this.researchSessionCacheKey(anonymousSessionId),
      session,
      TEASER_SESSION_TTL_SECONDS,
    );

    return {
      anonymousSessionId,
      ...teaser,
    };
  }

  async previewIssueChecker(user: RequestUser, dto: IssueCheckerPreviewDto, locale?: string) {
    let payload = dto;

    if (dto.anonymousSessionId) {
      const cached = await this.cacheService.get<StoredIssueCheckerSession>(
        this.sessionCacheKey(dto.anonymousSessionId),
      );
      if (cached) {
        payload = {
          ...dto,
          countryCode: dto.countryCode ?? cached.countryCode,
          jurisdiction: dto.jurisdiction ?? cached.jurisdiction,
          issueType: dto.issueType || cached.issueType,
          title: dto.title || cached.title,
          facts: dto.facts || cached.facts,
          desiredOutcome: dto.desiredOutcome ?? cached.desiredOutcome,
          parties: dto.parties ?? cached.parties,
          urgencyLevel: dto.urgencyLevel ?? cached.urgencyLevel,
          mode: dto.mode ?? cached.mode,
          clientName: dto.clientName ?? cached.clientName,
          clientReference: dto.clientReference ?? cached.clientReference,
          internalNotes: dto.internalNotes ?? cached.internalNotes,
          planningAnswers: dto.planningAnswers ?? cached.planningAnswers,
        };
      }
    }

    await this.ensureConsumerProfile(user.id, payload.countryCode);

    const tenantId =
      user.userType === 'LAWYER' && user.tenantId ? user.tenantId : undefined;
    const balance = await this.creditLedger.getBalance({
      userId: user.id,
      tenantId,
    });
    if (balance <= 0) {
      throw new ForbiddenException(
        tenantId
          ? 'No AI credits remaining on your firm wallet. Please top up to continue.'
          : 'No AI credits remaining. Please top up to continue.',
      );
    }

    const combinedFacts = payload.facts ?? this.buildCombinedFacts(payload);
    let consumerCaseId = payload.consumerCaseId;

    if (consumerCaseId) {
      await this.ensureCaseOwnership(user.id, consumerCaseId);
    } else {
      const createdCase = await this.prisma.consumerCase.create({
        data: {
          userId: user.id,
          countryCode: payload.countryCode.toUpperCase(),
          jurisdiction: payload.jurisdiction,
          issueType: payload.issueType,
          title: payload.title,
          facts: combinedFacts,
          desiredOutcome: payload.desiredOutcome,
          urgencyLevel: payload.urgencyLevel ?? 'MEDIUM',
          status: 'DRAFT',
          planningAnswers: payload.planningAnswers as Prisma.InputJsonValue ?? undefined,
        },
      });
      consumerCaseId = createdCase.id;
    }

    await this.runConsumerMiPipeline(
      consumerCaseId,
      combinedFacts,
      payload.countryCode.toUpperCase(),
      payload.jurisdiction,
      { userId: user.id, consumer: 'consumers.previewIssueChecker' },
    );

    const miSnapshot = await this.matterMemory.load('consumerCase', consumerCaseId);

    const { context: documentContext, documentCount } =
      await this.documentsService.loadDocumentContextForPreview(
        user.id,
        consumerCaseId,
      );

    const intelligence = await this.intakeIntelligence.analyze({
      facts: combinedFacts,
      countryCode: payload.countryCode.toUpperCase(),
      issueType: payload.issueType,
      mode: payload.mode,
      jurisdiction: payload.jurisdiction,
    });
    const intakeIntent =
      intelligence.intent ||
      getIntakeIntent(payload.issueType, payload.facts ?? combinedFacts);

    let aiResult;
    try {
      aiResult = await this.aiGateway.runConsumerFreePreview({
        userId: user.id,
        tenantId,
        consumerCaseId,
        countryCode: payload.countryCode.toUpperCase(),
        jurisdiction: payload.jurisdiction,
        issueType: payload.issueType,
        title: payload.title,
        facts: combinedFacts,
        desiredOutcome: payload.desiredOutcome,
        intakeMode: payload.mode as 'SELF' | 'FIRM_INTAKE' | undefined,
        intakeIntent,
        toolPlan: intelligence.toolPlan,
        recommendedNextTool: intelligence.recommendedNextTool,
        clientName: payload.clientName,
        clientReference: payload.clientReference,
        internalNotes: payload.internalNotes,
        parties: payload.parties,
        documentContext: documentContext || undefined,
        locale,
        planningAnswers: payload.planningAnswers as Record<string, string | string[]> | undefined,
      });
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'AI preview generation failed';
      throw new ServiceUnavailableException(message);
    }

    const balanceAfter = await this.creditLedger.getBalance({
      userId: user.id,
      tenantId,
    });

    const contentMarkdown = formatPreviewReportMarkdown({
      outputMarkdown: aiResult.outputMarkdown,
      structuredOutput: aiResult.structuredOutput,
      issueType: payload.issueType,
      title: payload.title,
      countryCode: payload.countryCode.toUpperCase(),
      jurisdiction: payload.jurisdiction,
      facts: combinedFacts,
      disclaimer: aiResult.disclaimer,
    });

    const report = await this.prisma.consumerLegalReport.create({
      data: {
        userId: user.id,
        consumerCaseId,
        countryCode: payload.countryCode.toUpperCase(),
        reportType: 'ISSUE_CHECKER_PREVIEW',
        title: `Preview: ${payload.title}`,
        contentMarkdown,
        citations: aiResult.citations,
        riskLevel: aiResult.riskLevel,
        requiresLawyer: aiResult.requiresLawyerReview,
        isPreview: true,
      },
    });

    if (aiResult.riskScore !== undefined) {
      await this.prisma.consumerCase.update({
        where: { id: consumerCaseId },
        data: { riskScore: aiResult.riskScore },
      });
    }

    let leadId: string | undefined;

    if (payload.mode === 'FIRM_INTAKE' && user.tenantId) {
      const planningAnswers = mergeIntakeCaseBrief(
        (payload.planningAnswers as Record<string, unknown> | undefined) ?? {},
        {
          suggestedOutcomes: payload.suggestedOutcomes,
          parties: payload.parties,
          toolPlan: intelligence.toolPlan,
          missingSlots: intelligence.missingSlots,
          recommendedNextTool: intelligence.recommendedNextTool,
        },
      );
      const lead = await this.prisma.lawyerLead.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          consumerCaseId,
          issueType: payload.issueType,
          countryCode: payload.countryCode.toUpperCase(),
          jurisdiction: payload.jurisdiction,
          urgency: payload.urgencyLevel ?? 'MEDIUM',
          summary: [
            payload.clientName ? `Client: ${payload.clientName}` : null,
            payload.clientReference ? `Ref: ${payload.clientReference}` : null,
            payload.title,
            payload.internalNotes,
          ]
            .filter(Boolean)
            .join(' — '),
          status: 'NEW',
          planningAnswers: planningAnswers as Prisma.InputJsonValue,
          clientName: payload.clientName ?? null,
          clientEmail: (payload as any).clientEmail ?? null,
          clientPhone: (payload as any).clientPhone ?? null,
          clientType: (payload as any).clientType ?? null,
        },
      });

      leadId = lead.id;

      await this.prisma.caseAnalysisRun.create({
        data: {
          tenantId: user.tenantId,
          consumerCaseId,
          lawyerLeadId: lead.id,
          runType: 'PREVIEW',
          trigger: 'manual',
          structuredOutput: (aiResult.structuredOutput ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          contentMarkdown: aiResult.outputMarkdown,
          citations: aiResult.citations,
          createdByUserId: user.id,
        },
      });

      this.realtimePublisher.publishToTenant(user.tenantId, REALTIME_EVENTS.LEAD_CREATED, {
        entityId: lead.id,
        action: 'created',
      });

      // For transactional-draft intakes, enqueue background document generation
      if (intakeIntent === 'TRANSACTIONAL_DRAFT') {
        const documentType = (aiResult.structuredOutput as { documentType?: string } | undefined)?.documentType ?? 'contract';
        this.jobsService.enqueueLeadDraftGenerate({
          leadId: lead.id,
          tenantId: user.tenantId,
          userId: user.id,
          documentType,
          planningAnswers: payload.planningAnswers as Record<string, unknown> | undefined,
          countryCode: payload.countryCode.toUpperCase(),
          jurisdiction: payload.jurisdiction,
        }).catch(() => {
          // Background job failure is non-fatal — the lawyer can still draft manually from the matter
        });
      }
    }

    if (dto.anonymousSessionId) {
      await this.cacheService.del(this.sessionCacheKey(dto.anonymousSessionId));
    }

    return {
      caseId: consumerCaseId,
      leadId,
      report,
      disclaimer: aiResult.disclaimer,
      creditsRemaining: balanceAfter,
      mode: aiResult.mode,
      provider: aiResult.provider,
      intakeMode: payload.mode ?? 'SELF',
      documentsIncluded: documentCount,
      winProbability: aiResult.winProbability ?? null,
      riskLevel: aiResult.riskLevel,
      intakeIntent,
      toolPlan: intelligence.toolPlan,
      recommendedNextTool:
        aiResult.recommendedNextTool ?? intelligence.recommendedNextTool,
      intakeIntelligence: {
        intent: intelligence.intent,
        jurisdictionHints: intelligence.jurisdictionHints,
        missingSlots: intelligence.missingSlots,
        toolPlan: intelligence.toolPlan,
        recommendedNextTool: intelligence.recommendedNextTool,
      },
      matterProfile: miSnapshot?.profile,
      matterGraph: miSnapshot?.graph,
      taskGraph: miSnapshot?.taskGraph,
      recommendedActions: miSnapshot?.taskGraph?.recommendedActions,
      issues: miSnapshot?.profile?.issues,
      nextBestAction: miSnapshot?.taskGraph?.nextBestAction,
    };
  }

  async getCredits(userId: string) {
    const profile = await this.ensureConsumerProfile(userId, 'US');

    const balance = await this.creditLedger.getBalance({ userId });
    const ledger = await this.prisma.aICreditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      balance,
      profileBalance: profile.aiCreditsRemaining,
      countryCode: profile.countryCode,
      packs: await this.creditPacks.listCreditPacks(
        profile.countryCode,
        'CONSUMER_PLUS',
      ),
      ledger: ledger.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        taskType: entry.taskType,
        credits: entry.credits,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async createCreditTopupCheckout(userId: string, dto: CreditTopupCheckoutDto) {
    const profile = await this.ensureConsumerProfile(userId, dto.countryCode);
    const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));
    const countryConfig = getCountryConfig(dto.countryCode);
    const currency = countryConfig.currency;

    let amount: number;
    let packId: string;
    let credits: number;
    let productName: string;

    const CURRENCY_MULTIPLIERS: Record<string, number> = {
      USD: 1, GBP: 0.79, INR: 83, KES: 129,
    };

    if (dto.customAmountUsd && dto.customAmountUsd >= 5) {
      // Custom amount: convert USD to local currency and compute credits
      const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 1;
      amount = Number((dto.customAmountUsd * multiplier).toFixed(2));
      packId = 'custom';
      const creditUsdValue = Number(process.env.AI_CREDIT_USD_VALUE ?? DEFAULT_CREDIT_USD_VALUE);
      credits = computeCreditsFromPayment(dto.customAmountUsd, creditUsdValue, 40);
      productName = `${credits} AI Credits (custom top-up)`;
    } else if (dto.packId) {
      const pack = await this.creditPacks.getCreditPack(
        dto.countryCode,
        dto.packId,
        'CONSUMER_PLUS',
      );
      amount = pack.amount;
      packId = pack.packId;
      credits = pack.credits;
      productName = pack.label ?? `${pack.credits} AI Credits`;
    } else {
      throw new Error('Either packId or customAmountUsd (min $5) must be provided');
    }

    void profile; // profile used for side-effect (ensure exists)

    const { payment, intent } = await this.paymentsService.createPayment(userId, undefined, {
      amount,
      currency,
      countryCode: dto.countryCode,
      purpose: 'AI_CREDIT_TOPUP',
      metadata: {
        packId,
        credits: String(credits),
        userId,
      },
    });

    // Stripe Hosted Checkout — UPI, Google Pay, cards (see Dashboard payment methods).
    let checkoutUrl = intent.checkoutUrl ?? null;

    // M-Pesa (and other providers) may return no hosted checkout URL — fall back to Stripe.
    if (!checkoutUrl) {
      try {
        const session = await this.stripeService.createDynamicCheckoutSession({
          amountMinorUnits: toStripeMinorUnits(amount, currency),
          currency,
          productName,
          productDescription: `${credits} AI credits added to your Umbrella account`,
          mode: 'payment',
          successUrl: `${appUrl}/consumer/subscription?topup=${payment.id}&status=success`,
          cancelUrl: `${appUrl}/consumer/subscription`,
          metadata: {
            paymentId: payment.id,
            packId,
            credits: String(credits),
            userId,
            purpose: 'AI_CREDIT_TOPUP',
          },
        });
        if (session.url) {
          checkoutUrl = session.url;
        }
      } catch (err) {
        if (err instanceof ServiceUnavailableException || err instanceof BadRequestException) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Credit topup Stripe fallback failed for ${dto.countryCode}: ${msg}`);
        throw new ServiceUnavailableException(`Payment session could not be started: ${msg}`);
      }
    }

    if (!checkoutUrl) {
      throw new ServiceUnavailableException('Payment provider returned no checkout URL. Please try again or contact support.');
    }

    return {
      paymentId: payment.id,
      packId,
      credits,
      amount,
      currency,
      checkoutUrl,
      clientSecret: intent.clientSecret,
      provider: intent.provider,
      status: intent.status,
    };
  }

  async listCaseDrafts(userId: string, caseId: string) {
    await this.ensureCaseOwnership(userId, caseId);

    const reports = await this.prisma.consumerLegalReport.findMany({
      where: { consumerCaseId: caseId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return reports.map((report) => ({
      id: report.id,
      consumerCaseId: report.consumerCaseId,
      title: report.title,
      content: report.contentMarkdown,
      status: report.isPreview ? 'PREVIEW' : 'FINAL',
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.createdAt.toISOString(),
    }));
  }

  async listCaseMessages(userId: string, caseId: string) {
    await this.ensureCaseOwnership(userId, caseId);

    const reviewRequests = await this.prisma.lawyerReviewRequest.findMany({
      where: { consumerCaseId: caseId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return reviewRequests.map((request) => ({
      id: request.id,
      consumerCaseId: request.consumerCaseId,
      direction: 'OUTBOUND' as const,
      subject: `Lawyer review (${request.status})`,
      body: `Review request for ${request.issueType}. Status: ${request.status}.`,
      createdAt: request.createdAt.toISOString(),
    }));
  }

  async listCasePayments(userId: string, caseId: string) {
    await this.ensureCaseOwnership(userId, caseId);

    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return payments
      .filter((payment) => {
        const metadata = payment.metadata as { consumerCaseId?: string } | null;
        return metadata?.consumerCaseId === caseId;
      })
      .map((payment) => ({
        id: payment.id,
        consumerCaseId: caseId,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        description: payment.purpose,
        createdAt: payment.createdAt.toISOString(),
      }));
  }

  private async runConsumerMiPipeline(
    consumerCaseId: string,
    facts: string,
    countryCode: string,
    jurisdiction?: string,
    audit?: { userId?: string; consumer: string },
  ): Promise<MatterIntelligencePipelineResult> {
    const existing = await this.matterMemory.load('consumerCase', consumerCaseId);
    if (existing?.profile && !this.matterMemory.shouldReclassify(facts, existing.profile)) {
      return {
        profile: existing.profile,
        graph: existing.graph,
        taskGraph: existing.taskGraph,
        clarifyingQuestions: [],
        shouldProceed: true,
        recommendationMode: 'matched',
      };
    }

    const miResult = await this.matterPipeline.run({
      facts,
      countryCode,
      jurisdiction,
      skipRetrieval: true,
    });

    await this.matterMemory.persist(
      'consumerCase',
      consumerCaseId,
      {
        profile: miResult.profile,
        graph: miResult.graph,
        taskGraph: miResult.taskGraph,
      },
      facts,
    );

    if (audit) {
      void this.miAuditLog
        .recordFromFacts(audit.consumer, facts, miResult.profile, {
          userId: audit.userId,
          entityType: 'consumer_case',
          entityId: consumerCaseId,
        })
        .catch(() => undefined);
    }

    return miResult;
  }

  private buildCombinedFacts(input: {
    facts?: string;
    parties?: string;
    urgencyLevel?: string;
    internalNotes?: string;
    clientName?: string;
  }): string {
    return [
      input.facts,
      input.parties ? `Parties involved: ${input.parties}` : '',
      input.urgencyLevel ? `Urgency: ${input.urgencyLevel}` : '',
      input.clientName ? `Client: ${input.clientName}` : '',
      input.internalNotes ? `Internal notes: ${input.internalNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private sessionCacheKey(sessionId: string): string {
    return this.cacheService.buildKey('issue-checker:session', [sessionId]);
  }

  private researchSessionCacheKey(sessionId: string): string {
    return this.cacheService.buildKey('legal-research:session', [sessionId]);
  }

  private async ensureConsumerProfile(userId: string, countryCode: string) {
    const existing = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true },
    });

    const resolvedCountry = getCountryConfig(
      countryCode || user?.countryCode || 'US',
    );

    await this.prisma.consumerProfile.create({
      data: {
        userId,
        countryCode: resolvedCountry.code,
        subscriptionStatus: 'FREE',
        aiCreditsRemaining: 0,
      },
    });

    const signupCredits = resolveConsumerSignupCredits(
      this.configService.get<string>('CONSUMER_SIGNUP_CREDITS'),
    );
    try {
      await this.creditLedger.credit({
        userId,
        taskType: 'signup_bonus',
        credits: signupCredits,
        metadata: { source: 'consumer_signup' },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to grant consumer signup credits for user ${userId}: ${String(err)}`,
      );
    }

    return this.prisma.consumerProfile.findUniqueOrThrow({
      where: { userId },
    });
  }

  private async ensureCaseOwnership(userId: string, caseId: string) {
    const consumerCase = await this.prisma.consumerCase.findUnique({
      where: { id: caseId },
      select: { id: true, userId: true },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    if (consumerCase.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
