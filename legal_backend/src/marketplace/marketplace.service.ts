import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { generateUniqueClientCode } from '@/clients/client-code.util';
import { PaymentsService } from '@/payments/payments.service';
import {
  CreateLawyerProfileDto,
  CreateLeadDto,
  CreateReviewRequestDto,
} from './dto/create-lawyer-profile.dto';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { DeliverReviewDto } from './dto/deliver-review.dto';
import { CreatePublicBookingDto } from './dto/public-booking.dto';
import { defaultMatterTypeForPracticeArea, ISSUE_TYPE_MATTER_TYPE_OVERRIDE } from '@/config/matter-types';
import { ISSUE_TYPE_TO_PRACTICE_AREA, type IssueCheckerType, getIntakeIntent } from '@/consumers/issue-checker.constants';
import { buildMatterTitleFromLead } from './lead-display.util';
import { IntakeAnalysisService } from './intake-analysis.service';
import { LeadDocumentsService } from './lead-documents.service';
import { FullLoopAutomationService } from './full-loop-automation.service';
import { PlaybooksService } from '@/playbooks/playbooks.service';
import { ConflictsService } from '@/conflicts/conflicts.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { MatterAutonomyService } from '@/matter-autonomy/matter-autonomy.service';
import { CourtDeadlinesService } from '@/court-deadlines/court-deadlines.service';
import {
  partiesFromIntakeBrief,
  readIntakeCaseBrief,
} from '@/consumers/intake-case-brief';
import {
  conflictStatusFromCheck,
  shouldBlockConvertOnConflict,
} from './convert-conflict-gate';
import {
  CreateLeadDocumentDto,
  RunLeadAnalysisDto,
  UpdateLeadContextDto,
} from './dto/run-lead-analysis.dto';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';

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
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly intakeAnalysis: IntakeAnalysisService,
    private readonly leadDocuments: LeadDocumentsService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly fullLoopAutomation: FullLoopAutomationService,
    private readonly playbooksService: PlaybooksService,
    private readonly conflictsService: ConflictsService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    @Optional()
    private readonly matterAutonomy: MatterAutonomyService | null = null,
    @Optional()
    private readonly courtDeadlines: CourtDeadlinesService | null = null,
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
        ...(dto.specialtyLevel !== undefined && { specialtyLevel: dto.specialtyLevel }),
        ...(dto.jurisdictionLicenses !== undefined && {
          jurisdictionLicenses: dto.jurisdictionLicenses,
        }),
        ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
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
        ...(dto.specialtyLevel !== undefined && { specialtyLevel: dto.specialtyLevel }),
        ...(dto.jurisdictionLicenses !== undefined && { jurisdictionLicenses: dto.jurisdictionLicenses }),
        ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
    });
  }

  async getLawyerProfileByUserId(userId: string) {
    return this.prisma.lawyerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, email: true, countryCode: true },
        },
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
      return tierFiltered.map((profile) => this.enrichLawyerProfile(profile));
    }

    return tierFiltered
      .filter((profile) => {
        const areas = profile.practiceAreas as string[];
        return areas.some((area) =>
          area.toLowerCase().includes(issueType.toLowerCase()),
        );
      })
      .map((profile) => this.enrichLawyerProfile(profile));
  }

  async getLawyerBySlug(slug: string) {
    const profiles = await this.prisma.lawyerProfile.findMany({
      where: { acceptsLeads: true, verified: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 200,
    });

    const profile = profiles.find(
      (row) => this.buildLawyerSlug(row.user.name ?? 'lawyer', row.id) === slug,
    );

    if (!profile) {
      throw new NotFoundException('Lawyer not found');
    }

    return this.enrichLawyerProfile(profile);
  }

  async createPublicBooking(dto: CreatePublicBookingDto) {
    const slotDate = new Date(dto.slot);
    if (Number.isNaN(slotDate.getTime())) {
      throw new BadRequestException('slot must be a valid ISO datetime');
    }

    const profile = await this.resolveLawyerProfile(dto.lawyerId);
    if (!profile.acceptsLeads) {
      throw new BadRequestException('This lawyer is not accepting bookings');
    }

    const summary = [
      `Public booking � ${dto.issueType}`,
      `Slot: ${slotDate.toISOString()}`,
      `Client: ${dto.clientName} <${dto.clientEmail}>`,
      dto.clientPhone ? `Phone: ${dto.clientPhone}` : null,
      dto.description ? `Notes: ${dto.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const lead = await this.prisma.lawyerLead.create({
      data: {
        lawyerProfileId: profile.id,
        tenantId: profile.tenantId ?? undefined,
        issueType: dto.issueType,
        countryCode: dto.countryCode.toUpperCase(),
        jurisdiction: dto.jurisdiction,
        summary,
        status: 'NEW',
        intakeStage: 'CONSULT',
        urgency: 'MEDIUM',
      },
    });

    return {
      lead,
      lawyer: this.enrichLawyerProfile(profile),
      slot: slotDate.toISOString(),
    };
  }

  private async resolveLawyerProfile(lawyerId: string) {
    const byProfileId = await this.prisma.lawyerProfile.findUnique({
      where: { id: lawyerId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (byProfileId) {
      return byProfileId;
    }

    const byUserId = await this.prisma.lawyerProfile.findUnique({
      where: { userId: lawyerId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (byUserId) {
      return byUserId;
    }

    throw new NotFoundException('Lawyer not found');
  }

  buildLawyerSlug(name: string, profileId: string): string {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'lawyer';
    return `${base}-${profileId.slice(-6)}`;
  }

  private enrichLawyerProfile(
    profile: {
      id: string;
      userId: string;
      countryCode: string;
      practiceAreas: unknown;
      jurisdictions: unknown;
      languages: unknown;
      currency: string;
      consultationFee: Prisma.Decimal | null;
      acceptsLeads: boolean;
      verified: boolean;
      verificationStatus: string;
      user: { id: string; name: string | null; email: string };
    },
  ) {
    return {
      ...profile,
      slug: this.buildLawyerSlug(profile.user.name ?? 'lawyer', profile.id),
      verificationTier: this.normalizeVerificationTier(profile.verificationStatus),
      consultationFee: profile.consultationFee
        ? Number(profile.consultationFee.toString())
        : null,
    };
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
      checkoutUrl: intent.checkoutUrl,
      clientSecret: intent.clientSecret,
      provider: intent.provider,
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
        summary: `${REVIEW_REQUEST_META_PREFIX}${request.id}\nLawyer review � ${request.issueType}`,
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
          title: `Lawyer review � ${request.issueType}`,
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

    // Firm-intake leads (created by the accepting lawyer) stay in the pipeline until
    // the lawyer explicitly converts with a chosen client � do not auto-create a matter.
    const skipAutoConvert = Boolean(
      lead.userId && lead.userId === lawyerUserId && updatedLead.tenantId,
    );

    const fullLoop = skipAutoConvert
      ? { skipped: true, reason: 'firm_intake' }
      : await this.fullLoopAutomation.onLeadAccepted(
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

  async convertToMatter(
    lawyerUserId: string,
    leadId: string,
    providedClientId?: string,
    options?: { overrideConflict?: boolean },
  ) {
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

    const lead = await this.prisma.lawyerLead.findUnique({
      where: { id: leadId },
      include: {
        analysisRuns: { orderBy: { createdAt: 'desc' } },
        leadDocuments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.tenantId && lead.tenantId !== tenantId) {
      throw new ForbiddenException('Lead not accessible for this firm');
    }

    if (lead.convertedMatterId) {
      const existing = await this.prisma.matter.findUnique({ where: { id: lead.convertedMatterId } });
      return { matter: existing, playbookApplied: null };
    }

    // Allow conversion from NEW/OPEN without a separate accept step
    if (!['ACCEPTED', 'NEW', 'OPEN'].includes(lead.status)) {
      throw new ForbiddenException('Lead must be accepted before conversion');
    }

    // ?? Pull consumer case context ???????????????????????????????????
    type ConsumerCaseCtx = {
      id: string; userId: string; title: string; facts: string | null; desiredOutcome: string | null;
      issueType: string; user: { name: string | null; email: string };
      documents: Array<{ id: string; fileName: string; fileUrl: string; mimeType: string | null; extractedText: string | null }>;
    } | null;

    const fetchedCase = lead.consumerCaseId
      ? await this.prisma.consumerCase.findUnique({
          where: { id: lead.consumerCaseId },
          include: {
            user: { select: { name: true, email: true } },
            documents: {
              select: { id: true, fileName: true, fileUrl: true, mimeType: true, extractedText: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : null;
    const consumerCase = fetchedCase as unknown as ConsumerCaseCtx;

    // ?? Resolve / create client ??????????????????????????????????????
    let clientId: string | undefined = providedClientId;
    let resolvedClientName = 'New Client';

    if (providedClientId) {
      const existingClient = await this.prisma.client.findFirst({
        where: { id: providedClientId, tenantId },
      });
      if (!existingClient) {
        throw new ForbiddenException('Client not found or not accessible');
      }
      resolvedClientName = existingClient.name;
    } else {
      // Try to resolve client from lead.clientName first (set during intake),
      // then fall back to consumer case user name.
      const intakeClientName = (lead as any).clientName as string | null | undefined;
      const fallbackName = consumerCase
        ? (consumerCase.user.name?.trim() || consumerCase.user.email.split('@')[0])
        : null;
      const clientName = intakeClientName?.trim() || fallbackName || 'New Client';

      // Search for an existing client with the same name in this tenant (case-insensitive).
      const existingByName = clientName !== 'New Client'
        ? await this.prisma.client.findFirst({
            where: {
              tenantId,
              name: { equals: clientName, mode: 'insensitive' },
            },
          })
        : null;

      if (existingByName) {
        clientId = existingByName.id;
        resolvedClientName = existingByName.name;
      } else if (consumerCase || clientName !== 'New Client') {
        resolvedClientName = clientName;
        const clientCode = await generateUniqueClientCode(this.prisma, tenantId, clientName);
        const client = await this.prisma.client.create({
          data: {
            tenantId,
            clientCode,
            name: clientName,
            email: (lead as any).clientEmail ?? consumerCase?.user.email ?? undefined,
            phone: (lead as any).clientPhone ?? undefined,
            type: (lead as any).clientType ?? 'INDIVIDUAL',
            countryCode: lead.countryCode,
          },
        });
        clientId = client.id;
      }
    }

    const intakeBrief = readIntakeCaseBrief(lead.planningAnswers);
    const conflictParties = partiesFromIntakeBrief(intakeBrief, [
      {
        name: (lead as { clientName?: string | null }).clientName,
        email: (lead as { clientEmail?: string | null }).clientEmail,
      },
      {
        name: consumerCase?.user.name ?? undefined,
        email: consumerCase?.user.email,
      },
    ]);
    let conflictCheck: Awaited<ReturnType<ConflictsService['quickCheck']>> | null = null;
    if (conflictParties.length > 0) {
      try {
        conflictCheck = await this.conflictsService.quickCheck(
          tenantId,
          conflictParties,
          clientId,
        );
      } catch {
        conflictCheck = null;
      }
    }
    if (shouldBlockConvertOnConflict(conflictCheck, options?.overrideConflict === true)) {
      return {
        matter: null,
        playbookApplied: null,
        conflictStatus: 'REVIEW_REQUIRED' as const,
        conflicts: conflictCheck,
      };
    }

    // ?? Build rich matter title ??????????????????????????????????????
    const matterTitle = buildMatterTitleFromLead({
      issueType: consumerCase?.issueType ?? lead.issueType,
      consumerCaseTitle: consumerCase?.title,
      clientName: resolvedClientName,
    });

    // ?? Build facts summary ??????????????????????????????????????????
    const factsParts: string[] = [];
    if (lead.summary) factsParts.push(lead.summary);
    if (consumerCase?.facts && consumerCase.facts !== lead.summary) {
      factsParts.push(`\n\n**Client-stated facts:**\n${consumerCase.facts}`);
    }
    if (lead.lawyerContextMarkdown) {
      factsParts.push(`\n\n**Lawyer notes:**\n${lead.lawyerContextMarkdown}`);
    }
    const factsSummary = factsParts.join('\n').trim() || undefined;

    const practiceAreaSlug = ISSUE_TYPE_TO_PRACTICE_AREA[lead.issueType as IssueCheckerType];
    const matterType =
      ISSUE_TYPE_MATTER_TYPE_OVERRIDE[lead.issueType] ??
      defaultMatterTypeForPracticeArea(practiceAreaSlug ?? lead.issueType);

    // ?? Resolve planningAnswers from lead or consumer case ???????????
    const leadPlanningAnswers = lead.planningAnswers as Record<string, string> | null;
    const casePlanningAnswers = (fetchedCase as any)?.planningAnswers as Record<string, string> | null;
    const resolvedPlanningAnswers = { ...(casePlanningAnswers ?? {}), ...(leadPlanningAnswers ?? {}) };

    // ?? Copy drafting workspace from latest PREVIEW analysis run ?????
    const previewRun = (lead.analysisRuns ?? []).find(
      (run) => run.runType === 'PREVIEW' && run.structuredOutput,
    );
    const draftWorkspace = previewRun?.structuredOutput as Prisma.InputJsonValue | undefined;
    if (
      draftWorkspace &&
      typeof draftWorkspace === 'object' &&
      !Array.isArray(draftWorkspace) &&
      (draftWorkspace as Record<string, unknown>).documentType &&
      !resolvedPlanningAnswers.documentType
    ) {
      resolvedPlanningAnswers.documentType = String(
        (draftWorkspace as Record<string, unknown>).documentType,
      );
    }

    // ?? Create the matter ????????????????????????????????????????????
    const matter = await this.prisma.matter.create({
      data: {
        tenantId,
        clientId,
        title: matterTitle,
        countryCode: lead.countryCode,
        jurisdiction: lead.jurisdiction ?? undefined,
        practiceArea: lead.issueType,
        matterType,
        status: 'OPEN',
        stage: 'Intake',
        factsSummary,
        desiredOutcome: consumerCase?.desiredOutcome ?? undefined,
        sourceLeadId: leadId,
        consumerCaseId: lead.consumerCaseId ?? undefined,
        planningAnswers:
          Object.keys(resolvedPlanningAnswers).length > 0
            ? (resolvedPlanningAnswers as Prisma.InputJsonValue)
            : undefined,
        draftWorkspace,
      },
    });

    // ?? Seed MatterFacts from consumer case ??????????????????????????
    const factsToCreate: Array<{ tenantId: string; matterId: string; factText: string; sourceType: string; sourceId?: string; confidence: number }> = [];

    if (consumerCase?.facts) {
      // Split into sentences as individual facts
      const sentences = consumerCase.facts
        .split(/[.!?\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);
      for (const sentence of sentences.slice(0, 10)) {
        factsToCreate.push({
          tenantId,
          matterId: matter.id,
          factText: sentence,
          sourceType: 'INTAKE',
          confidence: 0.8,
        });
      }
    }

    if (consumerCase?.desiredOutcome) {
      factsToCreate.push({
        tenantId,
        matterId: matter.id,
        factText: `Desired outcome: ${consumerCase.desiredOutcome}`,
        sourceType: 'INTAKE',
        confidence: 0.9,
      });
    }

    if (factsToCreate.length > 0) {
      await this.prisma.matterFact.createMany({ data: factsToCreate });
    }

    // ?? Copy consumer documents onto the matter ??????????????????????
    if (consumerCase?.documents?.length) {
      const docData = consumerCase.documents.map((doc) => ({
        tenantId,
        matterId: matter.id,
        clientId,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType ?? undefined,
        extractedText: doc.extractedText ?? undefined,
        sourceConsumerDocId: doc.id,
        visibility: 'PRIVATE' as const,
        version: 1,
      }));
      await this.prisma.document.createMany({ data: docData });
    }

    // ?? Copy lead documents onto the matter ?????????????????????????
    if (lead.leadDocuments?.length) {
      const leadDocData = (lead.leadDocuments as Array<{ fileName: string; fileUrl: string; mimeType: string | null; extractedText: string | null }>).map((doc) => ({
        tenantId,
        matterId: matter.id,
        clientId,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType ?? undefined,
        extractedText: doc.extractedText ?? undefined,
        visibility: 'PRIVATE' as const,
        version: 1,
      }));
      await this.prisma.document.createMany({ data: leadDocData });
    }

    // ?? Run practice-area playbook ???????????????????????????????????
    const playbookResult = await this.playbooksService.executePlaybook(
      tenantId,
      matter.id,
      matterType,
      lead.countryCode,
    );

    // Update stage based on playbook result
    if (playbookResult.playbookName) {
      await this.prisma.matter.update({
        where: { id: matter.id },
        data: { stage: 'Intake' },
      });
    }

    // ?? Fire matter.created automation ??????????????????????????????
    try {
      await this.automationEngine.dispatch(tenantId, 'matter.created', {
        matterId: matter.id,
        tenantId,
        practiceArea: lead.issueType,
        matterType,
      });
    } catch {
      // Non-blocking
    }

    this.matterAutonomy?.triggerOnCreate(matter.id, tenantId, lawyerUserId);

    let limitation: Awaited<ReturnType<CourtDeadlinesService['calculateLimitationPeriod']>> | null =
      null;
    if (this.courtDeadlines) {
      try {
        limitation = await this.courtDeadlines.calculateLimitationPeriod(tenantId, matter.id);
      } catch {
        limitation = null;
      }
    }

    // Mark lead as converted
    await this.prisma.lawyerLead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        intakeStage: 'CONVERTED',
        convertedMatterId: matter.id,
        tenantId,
      },
    });

    const intakeIntent = getIntakeIntent(lead.issueType, fetchedCase?.facts ?? undefined);

    return {
      matter,
      playbookApplied: playbookResult.playbookName
        ? { name: playbookResult.playbookName, tasksCreated: playbookResult.taskCount }
        : null,
      intakeIntent,
      openDocumentsTab: intakeIntent === 'TRANSACTIONAL_DRAFT',
      conflictStatus: conflictStatusFromCheck(conflictCheck),
      conflicts: conflictCheck,
      limitation,
    };
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

      return this.prisma.lawyerLead
        .findMany({
          where: {
            tenantId,
            ...(profile?.countryCode
              ? { countryCode: profile.countryCode }
              : {}),
            status: { in: ['NEW', 'OPEN', 'ACCEPTED', 'CONVERTED', 'REJECTED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        .then(async (leads) => {
          const caseIds = leads
            .map((lead) => lead.consumerCaseId)
            .filter((id): id is string => Boolean(id));
          const consumerCases = caseIds.length
            ? await this.prisma.consumerCase.findMany({
                where: { id: { in: caseIds } },
                select: {
                  id: true,
                  matterProfile: true,
                  urgencyLevel: true,
                  riskScore: true,
                },
              })
            : [];
          const caseById = new Map(consumerCases.map((row) => [row.id, row]));

          return leads
            .map((lead) => ({
              ...lead,
              miLeadScore: this.computeLeadScoreFromConsumerCase(
                lead.consumerCaseId ? caseById.get(lead.consumerCaseId) : null,
              ),
            }))
            .sort((a, b) => (b.miLeadScore ?? 0) - (a.miLeadScore ?? 0));
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

    const leadDocuments = await this.leadDocuments.listDocuments(userId, leadId);

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

    const intakeIntent = getIntakeIntent(lead.issueType, consumerCase?.facts ?? undefined);
    const intakeCaseBrief = readIntakeCaseBrief(lead.planningAnswers);

    // Expose clientName/clientId at top level for easy dialog pre-fill
    const clientName = (lead as any).clientName as string | null ?? null;
    const clientId = (lead as any).clientId as string | null ?? null;

    return {
      lead,
      consumerCase,
      previewReport,
      documents,
      leadDocuments,
      analysisRuns,
      quotaStatus,
      convertedMatter,
      intakeIntent,
      intakeCaseBrief,
      recommendedNextTool: intakeCaseBrief?.recommendedNextTool,
      clientName,
      clientId,
      miLeadScore: this.computeLeadScoreFromConsumerCase(consumerCase),
    };
  }

  getAnalysisRuns(userId: string, leadId: string) {
    return this.intakeAnalysis.getAnalysisRuns(userId, leadId);
  }

  updateLeadContext(userId: string, leadId: string, lawyerContextMarkdown?: string) {
    return this.intakeAnalysis.updateLeadContext(userId, leadId, lawyerContextMarkdown);
  }

  runSimilarCases(userId: string, leadId: string, dto?: RunLeadAnalysisDto, locale?: string) {
    return this.intakeAnalysis.runSimilarCases(userId, leadId, dto, locale);
  }

  runOpponentAngles(userId: string, leadId: string, dto?: RunLeadAnalysisDto, locale?: string) {
    return this.intakeAnalysis.runOpponentAngles(userId, leadId, dto, locale);
  }

  runStrategyMemo(userId: string, leadId: string, dto?: RunLeadAnalysisDto, locale?: string) {
    return this.intakeAnalysis.runStrategyMemo(userId, leadId, dto, locale);
  }

  listLeadDocuments(userId: string, leadId: string) {
    return this.leadDocuments.listDocuments(userId, leadId);
  }

  createLeadDocumentUploadUrl(userId: string, leadId: string, fileName: string) {
    return this.leadDocuments.createUploadUrl(userId, leadId, fileName);
  }

  createLeadDocument(userId: string, leadId: string, dto: CreateLeadDocumentDto) {
    return this.leadDocuments.createDocument(userId, leadId, dto);
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

  private computeLeadScoreFromConsumerCase(
    consumerCase?: {
      matterProfile: unknown;
      urgencyLevel?: string;
      riskScore?: number | null;
    } | null,
  ): number {
    if (!consumerCase) return 0.5;

    let score = consumerCase.riskScore != null ? Number(consumerCase.riskScore) : 0.5;
    const profile = consumerCase.matterProfile as MatterProfile | undefined;

    if (profile?.confidence != null) {
      score = Math.min(1, score * 0.65 + profile.confidence * 0.35);
      if (profile.confidence >= 0.85) score = Math.min(1, score + 0.1);
      if (profile.nature === 'dispute') score = Math.min(1, score + 0.05);
    }

    if (consumerCase.urgencyLevel === 'HIGH') {
      score = Math.min(1, score + 0.12);
    }

    return Math.round(score * 100) / 100;
  }
}
