import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { CONSUMER_DISCLAIMER } from '@/ai/constants';
import { getCountryConfig } from '@/config/countries';
import { PrismaService } from '@/prisma/prisma.service';
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
  ) {}

  async generateFullReport(userId: string, caseId: string) {
    const consumerCase = await this.prisma.consumerCase.findFirst({
      where: { id: caseId, userId },
      include: {
        documents: true,
        reports: { where: { isPreview: false }, take: 1 },
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

    const preview = await this.aiGateway.runConsumerFreePreview({
      userId,
      consumerCaseId: caseId,
      countryCode: consumerCase.countryCode,
      jurisdiction: consumerCase.jurisdiction ?? undefined,
      issueType: consumerCase.issueType,
      title: consumerCase.title,
      facts: consumerCase.facts ?? undefined,
      desiredOutcome: consumerCase.desiredOutcome ?? undefined,
      creditTaskType: 'CONSUMER_FULL_REPORT',
    });

    const country = getCountryConfig(consumerCase.countryCode);
    const documentSummaries = consumerCase.documents.map(
      (doc) =>
        `- ${doc.fileName}${doc.extractedText ? `: ${doc.extractedText.slice(0, 500)}` : ''}`,
    );

    const sectionBodies = await this.aiGateway.runConsumerFullReportSections({
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
    });

    const sections = CONSUMER_FULL_REPORT_SECTIONS.map((title, index) => {
      const body =
        title === 'Legal Analysis'
          ? preview.outputMarkdown
          : sectionBodies[title] ?? this.buildSectionBody(title, consumerCase, preview.outputMarkdown, country.name);
      return {
        index: index + 1,
        title,
        body,
      };
    });

    const contentMarkdown = sections
      .map((section) => `## ${section.index}. ${section.title}\n\n${section.body}`)
      .join('\n\n');

    const report = await this.prisma.consumerLegalReport.create({
      data: {
        userId,
        consumerCaseId: caseId,
        countryCode: consumerCase.countryCode,
        reportType: 'FULL_LEGAL_REPORT',
        title: `Full Report: ${consumerCase.title}`,
        contentMarkdown,
        citations: preview.citations,
        riskLevel: preview.riskLevel,
        requiresLawyer: preview.requiresLawyerReview,
        isPreview: false,
        lawyerReviewStatus: preview.requiresLawyerReview ? 'PENDING_VERIFICATION' : 'NOT_REQUESTED',
      },
    });

    await this.prisma.consumerCase.update({
      where: { id: caseId },
      data: {
        status: 'REPORT_READY',
        riskScore: preview.riskScore,
      },
    });

    return {
      report,
      sections,
      sectionCount: sections.length,
      disclaimer: preview.disclaimer || CONSUMER_DISCLAIMER,
      provider: preview.provider,
      modelName: preview.modelName,
    };
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

  private buildSectionBody(
    title: string,
    consumerCase: {
      title: string;
      issueType: string;
      facts: string | null;
      desiredOutcome: string | null;
      jurisdiction: string | null;
    },
    previewMarkdown: string,
    countryName: string,
  ): string {
    switch (title) {
      case 'Executive Summary':
        return `This report analyzes "${consumerCase.title}" as a ${consumerCase.issueType.toLowerCase()} matter in ${countryName}. It is an AI-generated educational overview and not legal advice.`;
      case 'Issue Overview':
        return `Issue type: ${consumerCase.issueType}. Jurisdiction: ${consumerCase.jurisdiction ?? 'Not specified'}.`;
      case 'Parties Involved':
        return 'Identify all parties, agents, employers, landlords, creditors, or institutions referenced in your documents and correspondence.';
      case 'Facts Summary':
        return consumerCase.facts ?? 'No detailed facts were provided. Upload documents or add a narrative to strengthen this section.';
      case 'Applicable Law':
        return `Applicable rules depend on ${countryName} law and local procedural requirements for ${consumerCase.issueType.toLowerCase()} matters.`;
      case 'Legal Analysis':
        return previewMarkdown;
      case 'Disclaimer':
        return CONSUMER_DISCLAIMER;
      default:
        return 'Section content unavailable.';
    }
  }
}
