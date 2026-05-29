import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '@/payments/payments.service';
import {
  CreateLawyerProfileDto,
  CreateLeadDto,
  CreateReviewRequestDto,
} from './dto/create-lawyer-profile.dto';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { DeliverReviewDto } from './dto/deliver-review.dto';
import { IntakeAnalysisService } from './intake-analysis.service';
import { FullLoopAutomationService } from './full-loop-automation.service';

const REVIEW_REQUEST_META_PREFIX = 'reviewRequestId:';

export const VERIFICATION_TIERS = ['UNVERIFIED', 'BASIC', 'VERIFIED', 'PREMIUM'] as const;
export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

const TIER_RANK: Record<VerificationTier, number> = {
  UNVERIFIED: 0,
  BASIC: 1,
  VERIFIED: 2,
  PREMIUM: 3,
};

/** PrismaService extends PrismaClient; intersection keeps IDE/delegate types in sync. */
type PrismaDb = PrismaService & PrismaClient;

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaDb,
    private readonly paymentsService: PaymentsService,
    private readonly intakeAnalysis: IntakeAnalysisService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly fullLoopAutomation: FullLoopAutomationService,
  ) {}

  async upsertLawyerProfile(userId: string, dto: CreateLawyerProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!user || user.userType !== 'LAWYER') {
      throw new ForbiddenException('Only lawyers can create lawyer profiles');
    }

    const tenantId = user.tenantUsers[0]?.tenantId;

    const verificationTier = this.resolveVerificationTier({
      barNumber: dto.barNumber,
      verified: dto.verified,
      verificationStatus: dto.verificationStatus,
    });

    return this.prisma.lawyerProfile.upsert({
      where: { userId },
      create: {
        userId,
        tenantId,
        countryCode: dto.countryCode.toUpperCase(),
        barNumber: dto.barNumber,
        practiceAreas: dto.practiceAreas,
        jurisdictions: dto.jurisdictions,
        languages: dto.languages,
        currency: dto.currency.toUpperCase(),
        consultationFee:
          dto.consultationFee !== undefined
            ? new Prisma.Decimal(dto.consultationFee)
            : undefined,
        acceptsLeads: dto.acceptsLeads ?? true,
        verified:
          dto.verified ??
          (verificationTier === 'VERIFIED' || verificationTier === 'PREMIUM'),
        verificationStatus: dto.verificationStatus ?? verificationTier,
      },
      update: {
        countryCode: dto.countryCode.toUpperCase(),
        barNumber: dto.barNumber,
        practiceAreas: dto.practiceAreas,
        jurisdictions: dto.jurisdictions,
        languages: dto.languages,
        currency: dto.currency.toUpperCase(),
        consultationFee:
          dto.consultationFee !== undefined
            ? new Prisma.Decimal(dto.consultationFee)
            : undefined,
        acceptsLeads: dto.acceptsLeads,
        verified:
          dto.verified ??
          (verificationTier === 'VERIFIED' || verificationTier === 'PREMIUM'),
        verificationStatus: dto.verificationStatus ?? verificationTier,
      },
    });
  }

  async listLawyerProfiles(
    countryCode?: string,
    issueType?: string,
    minVerificationTier?: string,
  ) {
    const minTier = this.normalizeVerificationTier(minVerificationTier);
    const profiles = await this.prisma.lawyerProfile.findMany({
      where: {
        acceptsLeads: true,
        verified: true,
        countryCode: countryCode?.toUpperCase(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const tierFiltered = profiles.filter((profile) => {
      const tier = this.normalizeVerificationTier(profile.verificationStatus);
      return TIER_RANK[tier] >= TIER_RANK[minTier];
    });

    if (!issueType) {
      return tierFiltered.map((profile) => ({
        ...profile,
        verificationTier: this.normalizeVerificationTier(profile.verificationStatus),
      }));
    }

    return tierFiltered
      .filter((profile) => {
        const areas = profile.practiceAreas as string[];
        return areas.some((area) =>
          area.toLowerCase().includes(issueType.toLowerCase()),
        );
      })
      .map((profile) => ({
        ...profile,
        verificationTier: this.normalizeVerificationTier(profile.verificationStatus),
      }));
  }

  async createReviewRequest(userId: string, dto: CreateReviewRequestDto) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: dto.consumerCaseId, userId },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    const request = await this.prisma.lawyerReviewRequest.create({
      data: {
        consumerCaseId: dto.consumerCaseId,
        consumerReportId: dto.consumerReportId,
        userId,
        countryCode: dto.countryCode.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        issueType: dto.issueType,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency.toUpperCase(),
        status: 'OPEN',
      },
    });

    await this.prisma.consumerCase.update({
      where: { id: dto.consumerCaseId },
      data: { status: 'REVIEW_REQUESTED' },
    });

    if (dto.consumerReportId) {
      await this.prisma.consumerLegalReport.update({
        where: { id: dto.consumerReportId },
        data: { lawyerReviewStatus: 'REQUESTED' },
      });
    }

    return request;
  }

  async listReviewRequests(userId: string, userType?: string) {
    if (userType === 'LAWYER') {
      const profile = await this.prisma.lawyerProfile.findUnique({
        where: { userId },
      });
      if (!profile) {
        return [];
      }

      return this.prisma.lawyerReviewRequest.findMany({
        where: {
          countryCode: profile.countryCode,
          status: { in: ['PAID', 'ASSIGNED', 'IN_REVIEW'] },
          OR: [
            { assignedLawyerId: userId },
            { assignedLawyerId: null },
          ],
        },
        include: { consumerCase: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    return this.prisma.lawyerReviewRequest.findMany({
      where: { userId },
      include: { consumerCase: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReviewRequest(userId: string, reviewRequestId: string, userType?: string) {
    const request = await this.prisma.lawyerReviewRequest.findUnique({
      where: { id: reviewRequestId },
      include: { consumerCase: true },
    });

    if (!request) {
      throw new NotFoundException('Review request not found');
    }

    if (userType !== 'LAWYER' && request.userId !== userId) {
      throw new ForbiddenException('Not your review request');
    }

    return request;
  }

  async payForReviewRequest(
    userId: string,
    reviewRequestId: string,
    phone?: string,
  ) {
    const request = await this.prisma.lawyerReviewRequest.findFirst({
      where: { id: reviewRequestId, userId },
    });

    if (!request) {
      throw new NotFoundException('Review request not found');
    }

    if (!['OPEN', 'PAYMENT_PENDING'].includes(request.status)) {
      throw new BadRequestException(
        `Review request cannot be paid from status ${request.status}`,
      );
    }

    const { payment, intent } = await this.paymentsService.createPayment(userId, undefined, {
      amount: Number(request.price),
      currency: request.currency,
      countryCode: request.countryCode,
      purpose: 'lawyer_review',
      metadata: {
        reviewRequestId: request.id,
        consumerCaseId: request.consumerCaseId,
        ...(phone ? { phone } : {}),
      },
    });

    await this.prisma.lawyerReviewRequest.update({
      where: { id: reviewRequestId },
      data: { status: 'PAYMENT_PENDING' },
    });

    return {
      reviewRequestId: request.id,
      payment,
      intent,
      status: 'PAYMENT_PENDING',
    };
  }

  async onReviewPaymentSucceeded(reviewRequestId: string, paymentId: string) {
    const request = await this.prisma.lawyerReviewRequest.findUnique({
      where: { id: reviewRequestId },
      include: { consumerCase: true },
    });

    if (!request) {
      return null;
    }

    if (['PAID', 'ASSIGNED', 'IN_REVIEW', 'COMPLETED'].includes(request.status)) {
      return { reviewRequest: request, lead: null, alreadyProcessed: true };
    }

    const profile = await this.prisma.lawyerProfile.findFirst({
      where: {
        acceptsLeads: true,
        verified: true,
        countryCode: request.countryCode,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const lead = await this.prisma.lawyerLead.create({
      data: {
        userId: request.userId,
        consumerCaseId: request.consumerCaseId,
        lawyerProfileId: profile?.id,
        tenantId: profile?.tenantId ?? undefined,
        issueType: request.issueType,
        countryCode: request.countryCode,
        jurisdiction: request.jurisdiction ?? undefined,
        summary: `${REVIEW_REQUEST_META_PREFIX}${request.id}\nLawyer review — ${request.issueType}`,
        status: 'NEW',
        reviewFeePaid: true,
      },
    });

    const reviewRequest = await this.prisma.lawyerReviewRequest.update({
      where: { id: reviewRequestId },
      data: { status: 'PAID' },
    });

    const gross = Number(request.price.toString());
    const platformFee = Math.round(gross * 0.15 * 100) / 100;
    const lawyerPayout = Math.round((gross - platformFee) * 100) / 100;
    await this.prisma.marketplaceRevenueEntry.create({
      data: {
        tenantId: profile?.tenantId,
        leadId: lead.id,
        reviewRequestId: request.id,
        grossAmount: new Prisma.Decimal(gross),
        platformFee: new Prisma.Decimal(platformFee),
        lawyerPayout: new Prisma.Decimal(lawyerPayout),
        currency: request.currency,
        providerPaymentId: paymentId,
        status: 'SETTLED',
      },
    });

    if (request.consumerReportId) {
      await this.prisma.consumerLegalReport.update({
        where: { id: request.consumerReportId },
        data: { lawyerReviewStatus: 'PAID' },
      });
    }

    return {
      reviewRequest,
      lead,
      paymentId,
      matchedLawyer: profile
        ? {
            lawyerProfileId: profile.id,
            lawyerUserId: profile.userId,
            name: profile.user.name,
            email: profile.user.email,
          }
        : null,
    };
  }

  async acceptReviewRequest(lawyerUserId: string, reviewRequestId: string) {
    const profile = await this.prisma.lawyerProfile.findUnique({
      where: { userId: lawyerUserId },
    });

    if (!profile) {
      throw new ForbiddenException('Lawyer profile required');
    }

    const request = await this.prisma.lawyerReviewRequest.findUnique({
      where: { id: reviewRequestId },
    });

    if (!request) {
      throw new NotFoundException('Review request not found');
    }

    if (!['PAID', 'OPEN'].includes(request.status)) {
      throw new ForbiddenException(
        `Review request cannot be accepted from status ${request.status}`,
      );
    }

    const lead = await this.findLeadForReviewRequest(reviewRequestId);
    if (lead && lead.status !== 'ACCEPTED') {
      await this.acceptLead(lawyerUserId, lead.id);
    }

    return this.prisma.lawyerReviewRequest.update({
      where: { id: reviewRequestId },
      data: {
        status: 'ASSIGNED',
        assignedLawyerId: lawyerUserId,
        assignedTenantId: profile.tenantId ?? undefined,
      },
    });
  }

  async startReview(lawyerUserId: string, reviewRequestId: string) {
    const request = await this.requireAssignedLawyer(reviewRequestId, lawyerUserId);

    if (request.status !== 'ASSIGNED') {
      throw new BadRequestException('Review must be assigned before starting');
    }

    return this.prisma.lawyerReviewRequest.update({
      where: { id: reviewRequestId },
      data: { status: 'IN_REVIEW' },
    });
  }

  async deliverReview(
    lawyerUserId: string,
    reviewRequestId: string,
    dto: DeliverReviewDto,
  ) {
    const request = await this.requireAssignedLawyer(reviewRequestId, lawyerUserId);

    if (!['ASSIGNED', 'IN_REVIEW'].includes(request.status)) {
      throw new BadRequestException(
        `Review cannot be delivered from status ${request.status}`,
      );
    }

    const deliveryMarkdown = dto.recommendations
      ? `${dto.lawyerOpinionMarkdown}\n\n## Recommendations\n${dto.recommendations}`
      : dto.lawyerOpinionMarkdown;

    if (request.consumerReportId) {
      await this.prisma.consumerLegalReport.update({
        where: { id: request.consumerReportId },
        data: {
          contentMarkdown: deliveryMarkdown,
          lawyerReviewStatus: 'COMPLETED',
          reviewedByLawyerId: lawyerUserId,
          requiresLawyer: false,
        },
      });
    } else {
      await this.prisma.consumerLegalReport.create({
        data: {
          userId: request.userId,
          consumerCaseId: request.consumerCaseId,
          countryCode: request.countryCode,
          reportType: 'LAWYER_REVIEW',
          title: `Lawyer review — ${request.issueType}`,
          contentMarkdown: deliveryMarkdown,
          lawyerReviewStatus: 'COMPLETED',
          reviewedByLawyerId: lawyerUserId,
          isPreview: false,
        },
      });
    }

    const lead = await this.findLeadForReviewRequest(reviewRequestId);
    if (lead) {
      await this.prisma.lawyerLead.update({
        where: { id: lead.id },
        data: { status: 'COMPLETED' },
      });
    }

    const completed = await this.prisma.lawyerReviewRequest.update({
      where: { id: reviewRequestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await this.prisma.consumerCase.update({
      where: { id: request.consumerCaseId },
      data: { status: 'REVIEW_COMPLETED' },
    });

    void this.fullLoopAutomation.onConsumerCaseCompleted(request.consumerCaseId);

    return completed;
  }

  async createLead(userId: string, dto: CreateLeadDto) {
    const profile = await this.prisma.lawyerProfile.findFirst({
      where: {
        acceptsLeads: true,
        verified: true,
        countryCode: dto.countryCode.toUpperCase(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const lead = await this.prisma.lawyerLead.create({
      data: {
        userId,
        consumerCaseId: dto.consumerCaseId,
        lawyerProfileId: profile?.id,
        tenantId: profile?.tenantId ?? undefined,
        issueType: dto.issueType,
        countryCode: dto.countryCode.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        summary: dto.description,
        status: 'NEW',
      },
    });

    return {
      lead,
      matchedLawyer: profile
        ? {
            lawyerProfileId: profile.id,
            lawyerUserId: profile.userId,
            name: profile.user.name,
            email: profile.user.email,
          }
        : null,
    };
  }

  async acceptLead(lawyerUserId: string, leadId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: lawyerUserId },
      include: {
        tenantUsers: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    const profile = await this.prisma.lawyerProfile.findUnique({
      where: { userId: lawyerUserId },
    });

    const lead = await this.prisma.lawyerLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const tenantId = user?.tenantUsers[0]?.tenantId;
    const isFirmIntakeLead = Boolean(lead.tenantId && lead.tenantId === tenantId);

    if (!profile && !isFirmIntakeLead) {
      throw new ForbiddenException('Lawyer profile required to accept leads');
    }

    if (lead.status !== 'NEW' && lead.status !== 'OPEN') {
      throw new ForbiddenException(`Lead cannot be accepted from status ${lead.status}`);
    }

    const updatedLead = await this.prisma.lawyerLead.update({
      where: { id: leadId },
      data: {
        status: 'ACCEPTED',
        intakeStage: 'SCREENING',
        lawyerProfileId: profile?.id,
        tenantId: profile?.tenantId ?? lead.tenantId ?? tenantId,
      },
    });

    if (updatedLead.tenantId) {
      this.realtimePublisher.publishToTenant(
        updatedLead.tenantId,
        REALTIME_EVENTS.LEAD_UPDATED,
        { entityId: leadId, action: 'accepted' },
      );
    }

    const reviewRequestId = this.extractReviewRequestId(lead.summary);
    if (reviewRequestId) {
      await this.prisma.lawyerReviewRequest.updateMany({
        where: { id: reviewRequestId, status: 'PAID' },
        data: {
          status: 'ASSIGNED',
          assignedLawyerId: lawyerUserId,
          assignedTenantId: profile?.tenantId ?? tenantId ?? undefined,
        },
      });
    }

    const fullLoop = await this.fullLoopAutomation.onLeadAccepted(
      leadId,
      lawyerUserId,
      updatedLead.tenantId,
    );

    return { ...updatedLead, fullLoop };
  }

  async updateIntakeStage(lawyerUserId: string, leadId: string, intakeStage: string) {
    const lead = await this.prisma.lawyerLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const allowed = ['NEW', 'SCREENING', 'CONSULT', 'ENGAGED', 'CONVERTED'];
    if (!allowed.includes(intakeStage)) {
      throw new BadRequestException(`Invalid intake stage: ${intakeStage}`);
    }

    return this.prisma.lawyerLead.update({
      where: { id: leadId },
      data: { intakeStage },
    });
  }

  async listLeadsByStage(tenantId: string, intakeStage?: string) {
    return this.prisma.lawyerLead.findMany({
      where: {
        tenantId,
        intakeStage: intakeStage || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async rejectLead(lawyerUserId: string, leadId: string, reason?: string) {
    const profile = await this.prisma.lawyerProfile.findUnique({
      where: { userId: lawyerUserId },
    });

    if (!profile) {
      throw new ForbiddenException('Lawyer profile required to reject leads');
    }

    const lead = await this.prisma.lawyerLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.prisma.lawyerLead.update({
      where: { id: leadId },
      data: {
        status: 'REJECTED',
        summary: reason ? `${lead.summary ?? ''}\nRejected: ${reason}`.trim() : lead.summary,
      },
    });
  }

  async convertToMatter(lawyerUserId: string, leadId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: lawyerUserId },
      include: {
        tenantUsers: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    const profile = await this.prisma.lawyerProfile.findUnique({
      where: { userId: lawyerUserId },
    });

    const tenantId = profile?.tenantId ?? user?.tenantUsers[0]?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Lawyer must belong to a firm tenant to convert leads');
    }

    const lead = await this.prisma.lawyerLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.tenantId && lead.tenantId !== tenantId) {
      throw new ForbiddenException('Lead not accessible for this firm');
    }

    if (lead.status !== 'ACCEPTED') {
      throw new ForbiddenException('Lead must be accepted before conversion');
    }

    if (lead.convertedMatterId) {
      return this.prisma.matter.findUnique({ where: { id: lead.convertedMatterId } });
    }

    let clientId: string | undefined;
    if (lead.consumerCaseId) {
      const consumerCase = await this.prisma.consumerCase.findUnique({
        where: { id: lead.consumerCaseId },
        include: { user: true },
      });

      if (consumerCase) {
        const clientName =
          lead.summary?.match(/Client: ([^—]+)/)?.[1]?.trim() ??
          consumerCase.user.name ??
          consumerCase.user.email;
        const client = await this.prisma.client.create({
          data: {
            tenantId,
            name: clientName,
            email: consumerCase.user.email,
            type: 'INDIVIDUAL',
            countryCode: lead.countryCode,
          },
        });
        clientId = client.id;
      }
    }

    const matter = await this.prisma.matter.create({
      data: {
        tenantId,
        clientId,
        title: lead.summary?.split(' — ').pop() ?? `${lead.issueType} — Intake Lead`,
        countryCode: lead.countryCode,
        jurisdiction: lead.jurisdiction ?? undefined,
        practiceArea: lead.issueType,
        matterType: 'LITIGATION',
        status: 'OPEN',
        factsSummary: lead.summary ?? undefined,
      },
    });

    return this.prisma.lawyerLead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        convertedMatterId: matter.id,
        tenantId,
      },
    });
  }

  async listLeads(userId: string, userType: string) {
    if (userType === 'LAWYER') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenantUsers: { where: { status: 'ACTIVE' }, take: 1 },
        },
      });

      const tenantId = user?.tenantUsers[0]?.tenantId;
      if (!tenantId) {
        return [];
      }

      const profile = await this.prisma.lawyerProfile.findUnique({
        where: { userId },
      });

      return this.prisma.lawyerLead.findMany({
        where: {
          tenantId,
          ...(profile?.countryCode
            ? { countryCode: profile.countryCode }
            : {}),
          status: { in: ['NEW', 'OPEN', 'ACCEPTED', 'CONVERTED', 'REJECTED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    return this.prisma.lawyerLead.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getLead(userId: string, _userType: string, leadId: string) {
    const lead = await this.intakeAnalysis.verifyLeadAccess(userId, leadId);

    const consumerCase = lead.consumerCaseId
      ? await this.prisma.consumerCase.findUnique({
          where: { id: lead.consumerCaseId },
        })
      : null;

    const previewReport = lead.consumerCaseId
      ? await this.prisma.consumerLegalReport.findFirst({
          where: {
            consumerCaseId: lead.consumerCaseId,
            reportType: 'ISSUE_CHECKER_PREVIEW',
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const documents = lead.consumerCaseId
      ? await this.prisma.consumerDocument.findMany({
          where: { consumerCaseId: lead.consumerCaseId },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const analysisRuns = await this.intakeAnalysis.getAnalysisRuns(userId, leadId);

    const quotaStatus = lead.tenantId
      ? await this.intakeAnalysis.getQuotaStatus(lead.tenantId)
      : null;

    let convertedMatter = null;
    if (lead.convertedMatterId) {
      convertedMatter = await this.prisma.matter.findUnique({
        where: { id: lead.convertedMatterId },
        select: { id: true, title: true, status: true },
      });
    }

    return {
      lead,
      consumerCase,
      previewReport,
      documents,
      analysisRuns,
      quotaStatus,
      convertedMatter,
    };
  }

  getAnalysisRuns(userId: string, leadId: string) {
    return this.intakeAnalysis.getAnalysisRuns(userId, leadId);
  }

  runSimilarCases(userId: string, leadId: string) {
    return this.intakeAnalysis.runSimilarCases(userId, leadId);
  }

  runOpponentAngles(userId: string, leadId: string) {
    return this.intakeAnalysis.runOpponentAngles(userId, leadId);
  }

  runStrategyMemo(userId: string, leadId: string) {
    return this.intakeAnalysis.runStrategyMemo(userId, leadId);
  }

  private async requireAssignedLawyer(reviewRequestId: string, lawyerUserId: string) {
    const request = await this.prisma.lawyerReviewRequest.findUnique({
      where: { id: reviewRequestId },
    });

    if (!request) {
      throw new NotFoundException('Review request not found');
    }

    if (request.assignedLawyerId && request.assignedLawyerId !== lawyerUserId) {
      throw new ForbiddenException('Review is assigned to another lawyer');
    }

    return request;
  }

  private extractReviewRequestId(summary: string | null | undefined): string | undefined {
    if (!summary?.startsWith(REVIEW_REQUEST_META_PREFIX)) {
      return undefined;
    }
    const line = summary.split('\n')[0];
    return line.slice(REVIEW_REQUEST_META_PREFIX.length).trim() || undefined;
  }

  private async findLeadForReviewRequest(reviewRequestId: string) {
    return this.prisma.lawyerLead.findFirst({
      where: {
        summary: { startsWith: `${REVIEW_REQUEST_META_PREFIX}${reviewRequestId}` },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private resolveVerificationTier(input: {
    barNumber?: string | null;
    verified?: boolean;
    verificationStatus?: string;
  }): VerificationTier {
    if (input.verificationStatus) {
      return this.normalizeVerificationTier(input.verificationStatus);
    }
    if (input.verified) {
      return 'VERIFIED';
    }
    if (input.barNumber?.trim()) {
      return 'BASIC';
    }
    return 'UNVERIFIED';
  }

  private normalizeVerificationTier(value?: string | null): VerificationTier {
    const normalized = (value ?? 'UNVERIFIED').toUpperCase();
    if (VERIFICATION_TIERS.includes(normalized as VerificationTier)) {
      return normalized as VerificationTier;
    }
    if (normalized === 'PENDING') {
      return 'UNVERIFIED';
    }
    if (normalized === 'APPROVED' || normalized === 'CONFIRMED') {
      return 'VERIFIED';
    }
    return 'UNVERIFIED';
  }
}
