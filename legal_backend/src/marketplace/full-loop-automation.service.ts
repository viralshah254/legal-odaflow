import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { generateUniqueClientCode } from '@/clients/client-code.util';
import { JobsService } from '@/jobs/jobs.service';
import { defaultMatterTypeForPracticeArea } from '@/config/matter-types';
import { buildMatterTitleFromLead } from './lead-display.util';
import {
  buildPortalInviteUrl,
  signPortalInviteToken,
} from '@/portal/portal-invite.util';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import type {
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
} from '@/ai/matter-intelligence/matter-intelligence.types';

interface PlaybookTaskTemplate {
  title: string;
  priority?: string;
  dueInDays?: number;
  status?: string;
  assigneeId?: string;
}

const COMPLETED_CASE_STATUSES = new Set([
  'COMPLETED',
  'REVIEW_COMPLETED',
  'CLOSED',
]);

@Injectable()
export class FullLoopAutomationService {
  private readonly logger = new Logger(FullLoopAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
    private readonly jwtService: JwtService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly matterMemory: MatterMemoryService,
  ) {}

  async onLeadAccepted(
    leadId: string,
    lawyerUserId: string,
    tenantId: string | null | undefined,
  ) {
    if (!tenantId) {
      return { skipped: true, reason: 'no_tenant' };
    }

    const lead = await this.prisma.lawyerLead.findUnique({ where: { id: leadId } });
    if (!lead || lead.convertedMatterId) {
      return { skipped: true, reason: 'already_converted' };
    }

    const matter = await this.createMatterFromLead(lead, tenantId);
    const playbookTasks = await this.applyPlaybook(tenantId, matter.id, lead, lawyerUserId);
    const portalInvite = await this.sendPortalInvite(
      tenantId,
      matter.id,
      matter.clientId,
      lawyerUserId,
    );

    await this.prisma.lawyerLead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        convertedMatterId: matter.id,
        tenantId,
      },
    });

    return {
      matterId: matter.id,
      playbookTasksCreated: playbookTasks,
      portalInvite,
    };
  }

  async onConsumerCaseCompleted(consumerCaseId: string) {
    const consumerCase = await this.prisma.consumerCase.findUnique({
      where: { id: consumerCaseId },
      include: { user: true, reports: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!consumerCase || !COMPLETED_CASE_STATUSES.has(consumerCase.status)) {
      return { skipped: true };
    }

    const existing = await this.prisma.lawyerLead.findFirst({
      where: {
        consumerCaseId,
        status: { in: ['NEW', 'OPEN', 'ACCEPTED'] },
      },
    });

    if (existing) {
      return { skipped: true, reason: 'lead_exists', leadId: existing.id };
    }

    const leadScore = this.scoreConsumerCase(consumerCase);
    const profile = await this.prisma.lawyerProfile.findFirst({
      where: {
        acceptsLeads: true,
        verified: true,
        countryCode: consumerCase.countryCode,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const lead = await this.prisma.lawyerLead.create({
      data: {
        userId: consumerCase.userId,
        consumerCaseId: consumerCase.id,
        lawyerProfileId: profile?.id,
        tenantId: profile?.tenantId ?? undefined,
        issueType: consumerCase.issueType,
        countryCode: consumerCase.countryCode,
        jurisdiction: consumerCase.jurisdiction ?? undefined,
        summary: this.buildScoredLeadSummary(consumerCase, leadScore),
        status: 'NEW',
        urgency: consumerCase.urgencyLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        reviewFeePaid: false,
      },
    });

    return { leadId: lead.id, leadScore };
  }

  async queueOutcomeRefreshOnFact(
    tenantId: string,
    matterId: string,
    userId: string,
    userRole?: string,
  ) {
    try {
      return await this.jobsService.enqueueOutcomeRefresh({
        tenantId,
        matterId,
        userId,
        userRole,
      });
    } catch (error) {
      this.logger.warn(
        `Outcome refresh enqueue failed for matter ${matterId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  private async createMatterFromLead(
    lead: {
      id: string;
      consumerCaseId: string | null;
      issueType: string;
      countryCode: string;
      jurisdiction: string | null;
      summary: string | null;
    },
    tenantId: string,
  ) {
    let clientId: string | undefined;
    let matterTitle = `${lead.issueType} intake — New Client`;
    let consumerCase:
      | {
          title: string;
          issueType: string;
          facts: string | null;
          matterProfile: unknown;
          matterGraph: unknown;
          matterTaskGraph: unknown;
          user: { name: string | null; email: string };
        }
      | null = null;

    if (lead.consumerCaseId) {
      consumerCase = await this.prisma.consumerCase.findUnique({
        where: { id: lead.consumerCaseId },
        include: { user: true },
      });

      if (consumerCase) {
        const clientName =
          consumerCase.user.name?.trim() ??
          consumerCase.user.email.split('@')[0];
        const clientCode = await generateUniqueClientCode(
          this.prisma,
          tenantId,
          clientName,
        );
        const client = await this.prisma.client.create({
          data: {
            tenantId,
            clientCode,
            name: clientName,
            email: consumerCase.user.email,
            type: 'INDIVIDUAL',
            countryCode: lead.countryCode,
          },
        });
        clientId = client.id;
        matterTitle = buildMatterTitleFromLead({
          issueType: consumerCase.issueType ?? lead.issueType,
          consumerCaseTitle: consumerCase.title,
          clientName,
        });
      }
    }

    const matterProfile = consumerCase?.matterProfile as MatterProfile | undefined;
    const practiceArea = matterProfile?.practiceArea ?? lead.issueType;

    const matter = await this.prisma.matter.create({
      data: {
        tenantId,
        clientId,
        title: matterTitle,
        countryCode: lead.countryCode,
        jurisdiction: lead.jurisdiction ?? undefined,
        practiceArea,
        matterType: defaultMatterTypeForPracticeArea(practiceArea),
        status: 'OPEN',
        factsSummary: consumerCase?.facts ?? lead.summary ?? undefined,
        matterProfile: consumerCase?.matterProfile ?? undefined,
        matterGraph: consumerCase?.matterGraph ?? undefined,
        matterTaskGraph: consumerCase?.matterTaskGraph ?? undefined,
      },
    });

    if (consumerCase?.facts && !matterProfile) {
      const miResult = await this.matterPipeline.run({
        facts: consumerCase.facts,
        countryCode: lead.countryCode,
        jurisdiction: lead.jurisdiction ?? undefined,
        skipRetrieval: true,
      });
      await this.matterMemory.persist(
        'matter',
        matter.id,
        {
          profile: miResult.profile,
          graph: miResult.graph,
          taskGraph: miResult.taskGraph,
        },
        consumerCase.facts,
      );
    } else if (matterProfile) {
      await this.matterMemory.persist(
        'matter',
        matter.id,
        {
          profile: matterProfile,
          graph: consumerCase?.matterGraph as MatterGraph | undefined,
          taskGraph: consumerCase?.matterTaskGraph as MatterTaskGraph | undefined,
        },
        consumerCase?.facts ?? undefined,
      );
    }

    return matter;
  }

  private async applyPlaybook(
    tenantId: string,
    matterId: string,
    lead: { issueType: string; countryCode: string; jurisdiction: string | null },
    createdByUserId: string,
  ): Promise<number> {
    const countryCode = lead.countryCode.toUpperCase();
    const matterType = defaultMatterTypeForPracticeArea(lead.issueType);

    const candidates = await this.prisma.matterPlaybook.findMany({
      where: {
        tenantId,
        isEnabled: true,
        OR: [
          { matterType, countryCode },
          { matterType, countryCode: null },
          { matterType: null, countryCode },
          { matterType: null, countryCode: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const playbook =
      candidates.find(
        (row) => row.matterType === matterType && row.countryCode === countryCode,
      ) ??
      candidates.find((row) => row.matterType === matterType && !row.countryCode) ??
      candidates.find((row) => !row.matterType && row.countryCode === countryCode) ??
      candidates[0];

    if (!playbook) {
      return 0;
    }

    const templates = this.parseTaskTemplates(playbook.taskTemplates);
    if (templates.length === 0) {
      return 0;
    }

    const now = new Date();
    await this.prisma.task.createMany({
      data: templates.map((template) => ({
        tenantId,
        matterId,
        title: template.title,
        priority: template.priority ?? 'MEDIUM',
        status: template.status ?? 'TODO',
        assigneeId: template.assigneeId ?? createdByUserId,
        dueDate: template.dueInDays
          ? new Date(now.getTime() + template.dueInDays * 24 * 60 * 60 * 1000)
          : undefined,
      })),
    });

    return templates.length;
  }

  private async sendPortalInvite(
    tenantId: string,
    matterId: string,
    clientId: string | null | undefined,
    sentByUserId: string,
  ) {
    if (!clientId) {
      return { sent: false, reason: 'no_client' };
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: { tenant: { select: { name: true } } },
    });

    if (!client?.email) {
      return { sent: false, reason: 'no_client_email' };
    }

    const inviteToken = signPortalInviteToken(this.jwtService, client.id, tenantId);
    const inviteUrl = buildPortalInviteUrl(this.configService, inviteToken);

    await this.prisma.portalMessage.create({
      data: {
        tenantId,
        clientId: client.id,
        matterId,
        subject: 'Welcome to your client portal',
        body: [
          `Your matter has been opened with ${client.tenant.name}.`,
          '',
          `Sign in to your client portal: ${inviteUrl}`,
          '',
          'This secure link expires in 7 days. Contact your legal team if you need a new one.',
        ].join('\n'),
        fromFirm: true,
        sentById: sentByUserId,
      },
    });

    return { sent: true, clientId: client.id, portalUrl: inviteUrl };
  }

  private scoreConsumerCase(consumerCase: {
    riskScore: number | null;
    urgencyLevel: string;
    facts: string | null;
    desiredOutcome: string | null;
    matterProfile?: unknown;
    reports: Array<{ riskLevel: string | null; requiresLawyer: boolean }>;
  }): number {
    let score = 0.5;

    if (consumerCase.riskScore != null) {
      score = Math.min(1, Math.max(0, consumerCase.riskScore));
    }

    const profile = consumerCase.matterProfile as MatterProfile | undefined;
    if (profile?.confidence != null) {
      score = Math.min(1, score * 0.7 + profile.confidence * 0.3);
      if (profile.confidence >= 0.85) {
        score = Math.min(1, score + 0.08);
      }
      if (profile.nature === 'dispute') {
        score = Math.min(1, score + 0.05);
      }
    }

    if (consumerCase.urgencyLevel === 'HIGH') {
      score = Math.min(1, score + 0.15);
    }

    const report = consumerCase.reports[0];
    if (report?.requiresLawyer) {
      score = Math.min(1, score + 0.1);
    }
    if (report?.riskLevel === 'HIGH') {
      score = Math.min(1, score + 0.1);
    }

    if (consumerCase.facts && consumerCase.facts.length > 200) {
      score = Math.min(1, score + 0.05);
    }

    return Math.round(score * 100) / 100;
  }

  private buildScoredLeadSummary(
    consumerCase: { title: string; issueType: string; desiredOutcome: string | null },
    leadScore: number,
  ): string {
    const parts = [
      `leadScore:${leadScore}`,
      `Client: ${consumerCase.title}`,
      consumerCase.desiredOutcome
        ? `Desired outcome: ${consumerCase.desiredOutcome}`
        : null,
      `${consumerCase.issueType} — Completed consumer case`,
    ].filter(Boolean);

    return parts.join('\n');
  }

  private parseTaskTemplates(raw: unknown): PlaybookTaskTemplate[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((item): item is PlaybookTaskTemplate => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const title = (item as { title?: unknown }).title;
      return typeof title === 'string' && title.trim().length > 0;
    });
  }
}
