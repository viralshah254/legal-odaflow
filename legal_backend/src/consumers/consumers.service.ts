import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditPack, listCreditPacks } from '@/ai-credits/credit-packs';
import {
  AiGatewayService,
  type StoredIssueCheckerSession,
} from '@/ai/ai-gateway.service';
import { getCountryConfig } from '@/config/countries';
import { getDefaultConsumerFreePlan } from '@/config/pricing.config';
import { RequestUser } from '@/common/types/request-user.interface';
import { PaymentsService } from '@/payments/payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreditTopupCheckoutDto } from './dto/credit-topup.dto';
import { CreateConsumerCaseDto } from './dto/create-case.dto';
import { IssueCheckerClassifyDto } from './dto/issue-checker-classify.dto';
import { IssueCheckerPreviewDto } from './dto/issue-checker-preview.dto';
import { IssueCheckerTeaserDto } from './dto/issue-checker-teaser.dto';
import { FullLoopAutomationService } from '@/marketplace/full-loop-automation.service';
import { UpdateConsumerCaseDto } from './dto/update-case.dto';

const COMPLETED_CASE_STATUSES = new Set([
  'COMPLETED',
  'REVIEW_COMPLETED',
  'CLOSED',
]);

const TEASER_SESSION_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class ConsumersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly fullLoopAutomation: FullLoopAutomationService,
  ) {}

  async createCase(userId: string, dto: CreateConsumerCaseDto) {
    return this.prisma.consumerCase.create({
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

  async classifyIssueChecker(dto: IssueCheckerClassifyDto) {
    return this.aiGateway.classifyIssueChecker({
      countryCode: dto.countryCode.toUpperCase(),
      facts: dto.facts,
      mode: dto.mode,
    });
  }

  async teaserIssueChecker(dto: IssueCheckerTeaserDto) {
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
    });

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
    };
  }

  async previewIssueChecker(user: RequestUser, dto: IssueCheckerPreviewDto) {
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
        },
      });
      consumerCaseId = createdCase.id;
    }

    const aiResult = await this.aiGateway.runConsumerFreePreview({
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
      clientName: payload.clientName,
      clientReference: payload.clientReference,
      internalNotes: payload.internalNotes,
      parties: payload.parties,
    });

    const balanceAfter = await this.creditLedger.getBalance({
      userId: user.id,
      tenantId,
    });

    const report = await this.prisma.consumerLegalReport.create({
      data: {
        userId: user.id,
        consumerCaseId,
        countryCode: payload.countryCode.toUpperCase(),
        reportType: 'ISSUE_CHECKER_PREVIEW',
        title: `Preview: ${payload.title}`,
        contentMarkdown: aiResult.outputMarkdown,
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
      packs: listCreditPacks(profile.countryCode),
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

    const pack = getCreditPack(dto.countryCode, dto.packId);
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

    const { payment, intent } = await this.paymentsService.createPayment(userId, undefined, {
      amount: pack.amount,
      currency: pack.currency,
      countryCode: pack.countryCode,
      purpose: 'AI_CREDIT_TOPUP',
      metadata: {
        packId: pack.packId,
        credits: String(pack.credits),
        userId,
      },
    });

    const checkoutUrl =
      intent.checkoutUrl ??
      `${appUrl}/consumer/subscription?topup=${payment.id}&status=pending`;

    return {
      paymentId: payment.id,
      packId: pack.packId,
      credits: pack.credits,
      amount: pack.amount,
      currency: pack.currency,
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
    const freePlan = getDefaultConsumerFreePlan(resolvedCountry.code);

    return this.prisma.consumerProfile.create({
      data: {
        userId,
        countryCode: resolvedCountry.code,
        subscriptionStatus: 'FREE',
        aiCreditsRemaining: freePlan.aiCredits,
      },
    });
  }

  private async ensureCaseOwnership(userId: string, caseId: string) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: caseId, userId },
      select: { id: true },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }
  }
}
