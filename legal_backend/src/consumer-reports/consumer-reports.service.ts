import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { CONSUMER_DISCLAIMER } from '@/ai/constants';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/security/encryption.service';
import {
  LEGAL_REPORT_SECTIONS,
  type LegalReportSectionTitle,
} from './legal-report-sections.constants';
import {
  listEmptyReportSections,
  mergeSectionIntoReportMarkdown,
  parseReportSectionsMarkdown,
} from './merge-report-section.util';
import {
  getReportSectionCreditCost,
  getReportSectionCreditCostsMap,
} from './report-section-credit-costs';
import { CONSUMER_FULL_REPORT_SECTIONS } from './report-sections';

/** SLA target for lawyer review of verified consumer reports (hours). */
export const LAWYER_REVIEW_SLA_HOURS = 48;

export type LawyerReviewSlaStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

@Injectable()
export class ConsumerReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly encryption: EncryptionService,
  ) {}

  getSectionCreditCosts() {
    return {
      costs: getReportSectionCreditCostsMap(),
      bundleCredits: getCreditCost(AI_TASK_TYPES.CONSUMER_FULL_REPORT),
    };
  }

  async generateReportSection(
    userId: string,
    caseId: string,
    sectionTitle: string,
    locale?: string,
  ) {
    const { consumerCase, report, sectionInput } =
      await this.loadCaseReportContext(userId, caseId);

    if (!LEGAL_REPORT_SECTIONS.includes(sectionTitle as LegalReportSectionTitle)) {
      throw new BadRequestException(`Invalid section: ${sectionTitle}`);
    }

    const existing = parseReportSectionsMarkdown(report.contentMarkdown);
    if (existing.get(sectionTitle)?.trim()) {
      throw new BadRequestException('Section already has content');
    }

    const creditCost = getReportSectionCreditCost(sectionTitle);
    const { body, creditsCharged } =
      await this.aiGateway.generateSingleConsumerReportSection(
        { ...sectionInput, sectionTitle, locale },
        { chargeCredits: true, creditCost },
      );

    const contentMarkdown = mergeSectionIntoReportMarkdown(
      report.contentMarkdown,
      sectionTitle,
      body,
    );

    const updated = await this.prisma.consumerLegalReport.update({
      where: { id: report.id },
      data: { contentMarkdown },
    });

    const creditsRemaining = await this.creditLedger.getBalance({ userId });

    return {
      report: updated,
      sectionTitle,
      content: body,
      creditsCharged,
      creditsRemaining,
      caseTitle: consumerCase.title,
    };
  }

  async generateFullReport(userId: string, caseId: string) {
    const { consumerCase, report, sectionInput } =
      await this.loadCaseReportContext(userId, caseId);

    const emptySections = listEmptyReportSections(report.contentMarkdown);
    if (emptySections.length === 0) {
      const creditsRemaining = await this.creditLedger.getBalance({ userId });
      return {
        report,
        sections: this.sectionsFromMarkdown(report.contentMarkdown),
        sectionCount: CONSUMER_FULL_REPORT_SECTIONS.length,
        creditsCharged: 0,
        creditsRemaining,
        disclaimer: CONSUMER_DISCLAIMER,
      };
    }

    // Check if this is the user's first ever full report — grant it for free.
    // After the first free generation the credit check runs as normal.
    const priorFullReportCount = await this.prisma.consumerLegalReport.count({
      where: {
        consumerCase: { userId },
        isPreview: false,
        id: { not: report.id },
      },
    });
    const isFreeFirstReport = priorFullReportCount === 0;

    const bundleCredits = getCreditCost(AI_TASK_TYPES.CONSUMER_FULL_REPORT);
    if (!isFreeFirstReport) {
      await this.creditLedger.assertAndDebit({
        userId,
        taskType: AI_TASK_TYPES.CONSUMER_FULL_REPORT,
        credits: bundleCredits,
        metadata: {
          consumerCaseId: caseId,
          reportId: report.id,
          mode: 'bundle',
          emptySections,
          freeFirstReport: false,
        },
      });
    }

    let contentMarkdown = report.contentMarkdown;

    for (const sectionTitle of emptySections) {
      const creditCost = getReportSectionCreditCost(sectionTitle);
      const { body } = await this.aiGateway.generateSingleConsumerReportSection(
        { ...sectionInput, sectionTitle },
        { chargeCredits: false, creditCost },
      );
      contentMarkdown = mergeSectionIntoReportMarkdown(
        contentMarkdown,
        sectionTitle,
        body,
      );
    }

    const updated = await this.prisma.consumerLegalReport.update({
      where: { id: report.id },
      data: {
        contentMarkdown,
        isPreview: false,
        title: report.isPreview
          ? `Full Report: ${consumerCase.title}`
          : report.title,
        reportType: 'FULL_LEGAL_REPORT',
      },
    });

    await this.prisma.consumerCase.update({
      where: { id: caseId },
      data: { status: 'REPORT_READY' },
    });

    const creditsRemaining = await this.creditLedger.getBalance({ userId });

    return {
      report: updated,
      sections: this.sectionsFromMarkdown(contentMarkdown),
      sectionCount: CONSUMER_FULL_REPORT_SECTIONS.length,
      creditsCharged: isFreeFirstReport ? 0 : bundleCredits,
      creditsRemaining,
      disclaimer: CONSUMER_DISCLAIMER,
      freeFirstReport: isFreeFirstReport,
    };
  }

  private async loadCaseReportContext(userId: string, caseId: string) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: caseId, userId },
      include: {
        documents: true,
        reports: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!consumerCase) {
      throw new NotFoundException('Consumer case not found');
    }

    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new ForbiddenException('Consumer profile not found');
    }

    await this.complianceGuard.assertConsumerGuidanceAllowed(consumerCase.countryCode);

    const report = consumerCase.reports[0];
    if (!report) {
      throw new NotFoundException('No report found for this case');
    }

    const documentSummaries = consumerCase.documents.map((doc) => {
      const extractedText = this.encryption.decryptStringFromStorage(
        doc.extractedText,
        `consumer-document-extracted-text:${doc.id}`,
      );
      return `- ${doc.fileName}${extractedText ? `: ${extractedText.slice(0, 500)}` : ''}`;
    });

    const sectionInput = {
      userId,
      consumerCaseId: caseId,
      countryCode: consumerCase.countryCode,
      jurisdiction: consumerCase.jurisdiction ?? undefined,
      issueType: consumerCase.issueType,
      title: consumerCase.title,
      facts: consumerCase.facts ?? undefined,
      desiredOutcome: consumerCase.desiredOutcome ?? undefined,
      documentSummaries,
      sections: [...CONSUMER_FULL_REPORT_SECTIONS],
    };

    return { consumerCase, report, sectionInput };
  }

  private sectionsFromMarkdown(contentMarkdown: string) {
    const map = parseReportSectionsMarkdown(contentMarkdown);
    return CONSUMER_FULL_REPORT_SECTIONS.map((title, index) => ({
      index: index + 1,
      title,
      body: map.get(title) ?? '',
    }));
  }

  /** Lawyer-facing queue of consumer reports awaiting verified review. */
  async listLawyerReviewQueue(tenantId: string, lawyerUserId: string) {
    const profile = await this.prisma.lawyerProfile.findUnique({
      where: { userId: lawyerUserId },
    });

    if (!profile) {
      throw new ForbiddenException('Lawyer profile required');
    }

    const reports = await this.prisma.consumerLegalReport.findMany({
      where: {
        isPreview: false,
        lawyerReviewStatus: {
          in: ['REQUESTED', 'PENDING_VERIFICATION', 'PAID', 'IN_REVIEW'],
        },
        countryCode: profile.countryCode,
      },
      include: {
        consumerCase: {
          select: {
            id: true,
            title: true,
            issueType: true,
            status: true,
            jurisdiction: true,
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return reports.map((report) => ({
      ...report,
      sla: this.computeReviewSla(report.createdAt),
    }));
  }

  computeReviewSla(createdAt: Date): {
    status: LawyerReviewSlaStatus;
    targetHours: number;
    hoursElapsed: number;
    hoursRemaining: number;
    dueAt: string;
  } {
    const targetHours = LAWYER_REVIEW_SLA_HOURS;
    const elapsedMs = Date.now() - createdAt.getTime();
    const hoursElapsed = elapsedMs / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, targetHours - hoursElapsed);

    let status: LawyerReviewSlaStatus = 'ON_TRACK';
    if (hoursElapsed >= targetHours) {
      status = 'BREACHED';
    } else if (hoursElapsed >= targetHours * 0.75) {
      status = 'AT_RISK';
    }

    const dueAt = new Date(
      createdAt.getTime() + targetHours * 60 * 60 * 1000,
    ).toISOString();

    return {
      status,
      targetHours,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      dueAt,
    };
  }

}
