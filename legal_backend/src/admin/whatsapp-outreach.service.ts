import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { QUEUE_NAMES } from '@/jobs/jobs.constants';

export interface CreateCampaignDto {
  name: string;
  templateName: string;
  templateParams?: Record<string, unknown>;
  /** PROSPECT (default) or USER (opted-in app users) */
  audienceType?: 'PROSPECT' | 'USER';
  /** When true, send only to isTest prospects; ignores bulk filters */
  testOnly?: boolean;
  /** Subset of test prospects; if empty, all isTest=true with a phone/whatsapp */
  testProspectIds?: string[];
  /** Filter by country (ISO code or display name stored on prospect) */
  country?: string;
  /** Filter prospects by whatsappConfidence (e.g. "verified", "high") */
  whatsappConfidence?: string;
  /** Filter by one or more cities (OR match) */
  cities?: string[];
  /** @deprecated use cities[] */
  city?: string;
  /** Filter by source */
  source?: string;
  /** Only include prospects with this outreachStatus (defaults to NEW) */
  outreachStatus?: string;
  /** Filter app users by userType (CONSUMER, LAWYER, etc.) */
  userType?: string;
  /** When true, only include app users with an ACTIVE subscription */
  subscriptionActiveOnly?: boolean;
  /** Filter app users by countryCode */
  userCountryCode?: string;
  /** Maximum number of prospects to include (0 = unlimited) */
  limit?: number;
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  bodyText: string;
  components: unknown[];
}

export interface WhatsappTemplateListResult {
  templates: MetaTemplate[];
  diagnostics?: {
    reason: 'not_configured' | 'meta_api_error' | 'no_approved_templates' | 'all_filtered';
    message: string;
    metaStatus?: number;
    totalFromMeta?: number;
  };
}

@Injectable()
export class WhatsappOutreachService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappOutreachService.name);
  private readonly sendQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.sendQueue = new Queue(QUEUE_NAMES.WHATSAPP_SEND, {
      connection: { url: redisUrl, maxRetriesPerRequest: null },
    });
  }

  async onModuleDestroy() {
    await this.sendQueue.close();
  }

  private takeLimit(limit?: number) {
    return limit && limit > 0 ? limit : undefined;
  }

  private async resolveProspectRecipients(dto: CreateCampaignDto) {
    if (dto.testOnly) {
      if (dto.testProspectIds?.length) {
        return this.prisma.lawyerProspect.findMany({
          where: {
            isTest: true,
            id: { in: dto.testProspectIds },
            OR: [{ whatsapp: { not: null } }, { phone: { not: null } }],
          },
          select: { id: true, whatsapp: true, phone: true, firstName: true, fullName: true, city: true },
          take: this.takeLimit(dto.limit),
        });
      }
      return this.prisma.lawyerProspect.findMany({
        where: {
          isTest: true,
          OR: [{ whatsapp: { not: null } }, { phone: { not: null } }],
        },
        select: { id: true, whatsapp: true, phone: true, firstName: true, fullName: true, city: true },
        take: this.takeLimit(dto.limit),
      });
    }

    return this.prisma.lawyerProspect.findMany({
      where: {
        isTest: false,
        outreachStatus: dto.outreachStatus ?? 'NEW',
        OR: [{ whatsapp: { not: null } }, { phone: { not: null } }],
        ...(dto.country ? { country: { contains: dto.country, mode: 'insensitive' as const } } : {}),
        ...(dto.whatsappConfidence ? { whatsappConfidence: dto.whatsappConfidence } : {}),
        ...(dto.cities?.length
          ? { city: { in: dto.cities } }
          : dto.city
            ? { city: { contains: dto.city, mode: 'insensitive' as const } }
            : {}),
        ...(dto.source ? { source: dto.source } : {}),
      },
      select: { id: true, whatsapp: true, phone: true, firstName: true, fullName: true, city: true },
      take: this.takeLimit(dto.limit),
    });
  }

  private async resolveUserRecipients(dto: CreateCampaignDto) {
    let allowedUserIds: string[] | undefined;

    if (dto.subscriptionActiveOnly) {
      const [userSubs, tenantSubs] = await Promise.all([
        this.prisma.subscription.findMany({
          where: { status: 'ACTIVE', userId: { not: null } },
          select: { userId: true },
        }),
        this.prisma.subscription.findMany({
          where: { status: 'ACTIVE', tenantId: { not: null } },
          select: { tenantId: true },
        }),
      ]);

      const directUserIds = userSubs.map((s) => s.userId!).filter(Boolean);
      const tenantIds = [...new Set(tenantSubs.map((s) => s.tenantId!).filter(Boolean))];

      const tenantMemberIds =
        tenantIds.length > 0
          ? (
              await this.prisma.tenantUser.findMany({
                where: { tenantId: { in: tenantIds } },
                select: { userId: true },
              })
            ).map((m) => m.userId)
          : [];

      allowedUserIds = [...new Set([...directUserIds, ...tenantMemberIds])];
      if (allowedUserIds.length === 0) return [];
    }

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        whatsappMarketingOptIn: true,
        whatsappOptOutAt: null,
        phone: { not: null },
        ...(dto.userType ? { userType: dto.userType } : {}),
        ...(dto.userCountryCode ? { countryCode: dto.userCountryCode } : {}),
        ...(allowedUserIds ? { id: { in: allowedUserIds } } : {}),
      },
      select: {
        id: true,
        phone: true,
        name: true,
        countryCode: true,
        jurisdiction: true,
      },
      take: this.takeLimit(dto.limit),
    });
  }

  async createCampaign(dto: CreateCampaignDto) {
    const audienceType = dto.testOnly ? 'PROSPECT' : (dto.audienceType ?? 'PROSPECT');

    if (dto.testOnly && dto.audienceType === 'USER') {
      throw new BadRequestException('testOnly cannot be combined with USER audience');
    }

    if (dto.testOnly && dto.testProspectIds?.length === 0) {
      throw new BadRequestException('Select at least one test user');
    }

    if (audienceType === 'USER') {
      const users = await this.resolveUserRecipients(dto);
      if (users.length === 0) {
        throw new BadRequestException('No eligible app users found for this campaign');
      }

      this.logger.log(`Creating USER campaign '${dto.name}' for ${users.length} users`);

      const campaign = await this.prisma.whatsappCampaign.create({
        data: {
          name: dto.name,
          templateName: dto.templateName,
          templateParams: (dto.templateParams ?? {}) as object,
          audienceType: 'USER',
          status: 'RUNNING',
          totalQueued: users.length,
          messages: {
            create: users.map((u) => ({
              userId: u.id,
              to: u.phone!,
              status: 'QUEUED',
            })),
          },
        },
        include: { messages: true },
      });

      const jobs = campaign.messages.map((msg) => {
        const user = users.find((u) => u.id === msg.userId)!;
        const firstName = user.name?.trim().split(/\s+/)[0] ?? 'there';
        const city = user.jurisdiction ?? user.countryCode ?? 'India';
        return {
          name: 'send-whatsapp',
          data: {
            messageId: msg.id,
            campaignId: campaign.id,
            to: msg.to,
            templateName: dto.templateName,
            firstName,
            city,
            isPhoneFallback: false,
          },
          opts: {
            attempts: 3,
            backoff: { type: 'exponential' as const, delay: 5000 },
            removeOnComplete: 200,
            removeOnFail: 500,
          },
        };
      });

      await this.sendQueue.addBulk(jobs);

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalQueued: campaign.totalQueued,
      };
    }

    const prospects = await this.resolveProspectRecipients(dto);
    if (prospects.length === 0) {
      throw new BadRequestException(
        dto.testOnly ? 'No test prospects found with a phone or WhatsApp number' : 'No prospects match these filters',
      );
    }

    this.logger.log(`Creating campaign '${dto.name}' for ${prospects.length} prospects`);

    const campaign = await this.prisma.whatsappCampaign.create({
      data: {
        name: dto.name,
        templateName: dto.templateName,
        templateParams: (dto.templateParams ?? {}) as object,
        audienceType: 'PROSPECT',
        status: 'RUNNING',
        totalQueued: prospects.length,
        messages: {
          create: prospects.map((p) => ({
            prospectId: p.id,
            to: (p.whatsapp ?? p.phone)!,
            status: 'QUEUED',
          })),
        },
      },
      include: { messages: true },
    });

    // Enqueue BullMQ jobs for each message
    const jobs = campaign.messages.map((msg) => {
      const prospect = prospects.find((p) => p.id === msg.prospectId)!;
      return {
        name: 'send-whatsapp',
        data: {
          messageId: msg.id,
          campaignId: campaign.id,
          to: msg.to,
          templateName: dto.templateName,
          firstName: prospect.firstName ?? prospect.fullName.split(' ')[0],
          city: prospect.city ?? '',
          // Flag so the worker knows the number came from phone field (not confirmed WhatsApp)
          isPhoneFallback: !prospect.whatsapp,
        },
        opts: {
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 5000 },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      };
    });

    await this.sendQueue.addBulk(jobs);

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalQueued: campaign.totalQueued,
    };
  }

  async pauseCampaign(id: string) {
    const campaign = await this.prisma.whatsappCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.whatsappCampaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async resumeCampaign(id: string) {
    const campaign = await this.prisma.whatsappCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.whatsappCampaign.update({
      where: { id },
      data: { status: 'RUNNING' },
    });
  }

  async deleteCampaign(id: string) {
    const campaign = await this.prisma.whatsappCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Drop pending queue jobs so workers don't retry against a deleted campaign.
    try {
      const jobStates = ['waiting', 'delayed', 'paused', 'active'] as const;
      for (const state of jobStates) {
        const jobs = await this.sendQueue.getJobs([state]);
        await Promise.all(
          jobs.filter((job) => job.data?.campaignId === id).map((job) => job.remove()),
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to drain queue jobs for campaign ${id}: ${err}`);
    }

    await this.prisma.whatsappCampaign.delete({ where: { id } });
    this.logger.log(`Deleted WhatsApp campaign '${campaign.name}' (${id})`);
    return { deleted: true, id };
  }

  async getCampaignStats(id: string) {
    const campaign = await this.prisma.whatsappCampaign.findUnique({
      where: { id },
      include: {
        _count: { select: { messages: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const statusCounts = await this.prisma.whatsappMessage.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true,
    });

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = row._count;
    }

    return {
      id: campaign.id,
      name: campaign.name,
      templateName: campaign.templateName,
      status: campaign.status,
      totalQueued: campaign.totalQueued,
      totalSent: campaign.totalSent,
      totalDelivered: campaign.totalDelivered,
      totalRead: campaign.totalRead,
      totalFailed: campaign.totalFailed,
      createdAt: campaign.createdAt,
      statusBreakdown: counts,
    };
  }

  async listCampaigns() {
    const campaigns = await this.prisma.whatsappCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      campaigns.map(async (campaign) => {
        if (campaign.totalFailed === 0) {
          return { ...campaign, lastFailedError: null as string | null };
        }
        const failed = await this.prisma.whatsappMessage.findFirst({
          where: { campaignId: campaign.id, status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
          select: { errorCode: true },
        });
        return { ...campaign, lastFailedError: failed?.errorCode ?? null };
      }),
    );
  }

  /** Config presence check for admin diagnostics (no secrets returned). */
  getConfigDiagnostics() {
    const wabaId = this.config.get<string>('WHATSAPP_WABA_ID');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const apiToken = this.config.get<string>('WHATSAPP_API_TOKEN');
    const webhookToken = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    const missing = [
      !wabaId && 'WHATSAPP_WABA_ID',
      !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
      !apiToken && 'WHATSAPP_API_TOKEN',
      !webhookToken && 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    ].filter(Boolean) as string[];

    return {
      apiConfigured: missing.length === 0,
      vars: {
        WHATSAPP_WABA_ID: Boolean(wabaId),
        WHATSAPP_PHONE_NUMBER_ID: Boolean(phoneNumberId),
        WHATSAPP_API_TOKEN: Boolean(apiToken),
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: Boolean(webhookToken),
      },
      phoneNumberId,
      missing,
      hints: [
        'API and worker must use the same WHATSAPP_* values (Umbrella WABA, not DV Tech Ventures).',
        'Sender phone must show Connected in Meta — complete verification if required.',
        'Worker loads .env via dotenv; restart API + worker after env changes.',
      ],
    };
  }

  async getCampaignDetail(id: string) {
    const campaign = await this.prisma.whatsappCampaign.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 500,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  /** Called by the send worker on success to increment totalSent */
  async markSent(messageId: string, waMessageId: string) {
    const msg = await this.prisma.whatsappMessage.update({
      where: { id: messageId },
      data: { status: 'SENT', waMessageId, sentAt: new Date() },
    });
    await this.prisma.whatsappCampaign.update({
      where: { id: msg.campaignId },
      data: { totalSent: { increment: 1 } },
    });
  }

  /** Called by the send worker on permanent failure */
  async markFailed(messageId: string, errorCode?: string) {
    const msg = await this.prisma.whatsappMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', errorCode },
    });
    await this.prisma.whatsappCampaign.update({
      where: { id: msg.campaignId },
      data: { totalFailed: { increment: 1 } },
    });
  }

  /** Fetch approved message templates from the Meta Graph API */
  async getTemplates(): Promise<WhatsappTemplateListResult> {
    const wabaId = this.config.get<string>('WHATSAPP_WABA_ID');
    const apiToken = this.config.get<string>('WHATSAPP_API_TOKEN');

    if (!wabaId || !apiToken) {
      const missing = [!wabaId && 'WHATSAPP_WABA_ID', !apiToken && 'WHATSAPP_API_TOKEN']
        .filter(Boolean)
        .join(' and ');
      this.logger.warn(`${missing} not configured — returning empty template list`);
      return {
        templates: [],
        diagnostics: {
          reason: 'not_configured',
          message: `WhatsApp not configured on server: ${missing} is missing. Set the variable(s) and restart the backend.`,
        },
      };
    }

    const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates?fields=id,name,status,language,components&limit=50`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const rawErr = await res.text();
      this.logger.error(`Meta templates API error ${res.status}: ${rawErr}`);

      // Try to parse Graph API error structure for a human-readable message.
      let metaMessage = rawErr;
      let errorSubcode: number | undefined;
      try {
        const parsed = JSON.parse(rawErr) as {
          error?: { message?: string; type?: string; code?: number; error_subcode?: number };
        };
        if (parsed?.error?.message) {
          metaMessage = parsed.error.message;
        }
        errorSubcode = parsed?.error?.error_subcode;
      } catch {
        // rawErr was not JSON; use as-is
      }

      const permissionHint =
        errorSubcode === 33 ||
        metaMessage.includes('missing permissions') ||
        metaMessage.includes('does not exist')
          ? ' Your WHATSAPP_API_TOKEN likely expired, belongs to a different Meta app, or lacks whatsapp_business_management scope. Regenerate a System User token in Meta Business Suite → WhatsApp → API Setup, then update WHATSAPP_API_TOKEN on the server.'
          : '';

      return {
        templates: [],
        diagnostics: {
          reason: 'meta_api_error',
          message: `Meta API error (${res.status}): ${metaMessage}${permissionHint}`,
          metaStatus: res.status,
        },
      };
    }

    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        language: string;
        components?: Array<{ type: string; text?: string; buttons?: unknown[] }>;
      }>;
    };

    const allTemplates = json.data ?? [];

    // Meta Graph API v16+ returns status "APPROVED" for older templates and
    // "ACTIVE" for templates approved under the newer quality-rating system.
    // Both statuses mean the template is ready to send.
    const USABLE_STATUSES = new Set(['APPROVED', 'ACTIVE']);
    const approved = allTemplates.filter((t) => USABLE_STATUSES.has(t.status));

    if (allTemplates.length > 0 && approved.length === 0) {
      this.logger.warn(
        `Meta returned ${allTemplates.length} template(s) but none have APPROVED or ACTIVE status`,
      );
      return {
        templates: [],
        diagnostics: {
          reason: 'all_filtered',
          message: `Meta returned ${allTemplates.length} template(s) but none are APPROVED or ACTIVE. Check their status in Meta Business Suite.`,
          totalFromMeta: allTemplates.length,
        },
      };
    }

    if (approved.length === 0) {
      return {
        templates: [],
        diagnostics: {
          reason: 'no_approved_templates',
          message: 'No message templates found in this WhatsApp Business Account. Create and get approval on Meta first.',
        },
      };
    }

    return {
      templates: approved.map((t) => {
        const bodyComp = t.components?.find((c) => c.type === 'BODY');
        return {
          id: t.id,
          name: t.name,
          status: t.status,
          language: t.language,
          bodyText: bodyComp?.text ?? '',
          components: t.components ?? [],
        };
      }),
    };
  }
}
