import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IngestLegalAuthorityInput,
  LegalSourceService,
} from '@/legal-sources/legal-source.service';
import { PrismaService } from '@/prisma/prisma.service';
import { PresenceService } from '@/realtime/presence.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legalSourceService: LegalSourceService,
    private readonly presenceService: PresenceService,
  ) {}

  async getDashboardStats() {
    return this.getStats();
  }

  async getStats() {
    const [
      userCount,
      tenantCount,
      matterCount,
      consumerCaseCount,
      invoiceCount,
      paymentCount,
      aiUsageCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.matter.count(),
      this.prisma.consumerCase.count(),
      this.prisma.invoice.count(),
      this.prisma.payment.count(),
      this.prisma.aIUsageLog.count(),
    ]);

    const recentAuditLogs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      totals: {
        users: userCount,
        tenants: tenantCount,
        matters: matterCount,
        consumerCases: consumerCaseCount,
        invoices: invoiceCount,
        payments: paymentCount,
        aiUsageLogs: aiUsageCount,
      },
      recentAuditLogs,
      generatedAt: new Date().toISOString(),
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        userType: true,
        countryCode: true,
        jurisdiction: true,
        isActive: true,
        firebaseUid: true,
        passwordHash: true,
        invitationStatus: true,
        invitedAt: true,
        invitationAcceptedAt: true,
        firstLoginAt: true,
        createdAt: true,
        consumerProfile: {
          select: {
            countryCode: true,
            stateOrCounty: true,
            subscriptionStatus: true,
            preferredLanguage: true,
            aiCreditsRemaining: true,
          },
        },
        lawyerProfile: {
          select: {
            countryCode: true,
            verified: true,
            verificationStatus: true,
            barNumber: true,
            practiceAreas: true,
            acceptsLeads: true,
          },
        },
        tenantUsers: {
          select: {
            role: true,
            status: true,
            tenant: {
              select: {
                id: true,
                name: true,
                primaryCountry: true,
                billingPlan: true,
                aiCreditsRemaining: true,
                subscriptions: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    planId: true,
                    status: true,
                    currentPeriodStart: true,
                    currentPeriodEnd: true,
                    cancelAtPeriodEnd: true,
                    currency: true,
                  },
                },
              },
            },
          },
        },
        referralReceived: {
          select: {
            referralCode: true,
            status: true,
            referrer: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      countryCode: user.countryCode,
      jurisdiction: user.jurisdiction,
      isActive: user.isActive,
      authMethod: user.firebaseUid
        ? user.passwordHash
          ? 'firebase_and_password'
          : 'firebase'
        : user.passwordHash
          ? 'email_password'
          : user.invitationStatus
            ? 'invitation'
            : 'unknown',
      invitationStatus: user.invitationStatus,
      invitedAt: user.invitedAt,
      invitationAcceptedAt: user.invitationAcceptedAt,
      firstLoginAt: user.firstLoginAt,
      createdAt: user.createdAt,
      consumerProfile: user.consumerProfile,
      lawyerProfile: user.lawyerProfile
        ? {
            ...user.lawyerProfile,
            practiceAreas: Array.isArray(user.lawyerProfile.practiceAreas)
              ? (user.lawyerProfile.practiceAreas as string[])
              : [],
          }
        : null,
      tenantUsers: user.tenantUsers.map((tu) => {
        const sub = tu.tenant.subscriptions[0] ?? null;
        let billingCycle: 'monthly' | 'annual' | null = null;
        if (sub?.currentPeriodStart && sub?.currentPeriodEnd) {
          const days =
            (sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
            (1000 * 60 * 60 * 24);
          billingCycle = days > 300 ? 'annual' : 'monthly';
        }
        return {
          tenantId: tu.tenant.id,
          role: tu.role,
          status: tu.status,
          tenant: {
            id: tu.tenant.id,
            name: tu.tenant.name,
            primaryCountry: tu.tenant.primaryCountry,
            billingPlan: tu.tenant.billingPlan,
            aiCreditsRemaining: tu.tenant.aiCreditsRemaining,
            subscription: sub
              ? {
                  planId: sub.planId,
                  status: sub.status,
                  currentPeriodEnd: sub.currentPeriodEnd,
                  cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                  billingCycle,
                  currency: sub.currency,
                }
              : null,
          },
        };
      }),
      referral: user.referralReceived
        ? {
            code: user.referralReceived.referralCode,
            status: user.referralReceived.status,
            referrerEmail: user.referralReceived.referrer.email,
            referrerName: user.referralReceived.referrer.name,
          }
        : null,
    }));
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        primaryCountry: true,
        defaultCurrency: true,
        billingPlan: true,
        isActive: true,
        createdAt: true,
        aiCreditsRemaining: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            planId: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            currency: true,
          },
        },
        _count: {
          select: {
            tenantUsers: true,
            matters: true,
            clients: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const pricings = await this.prisma.countryPricing.findMany({ where: { isActive: true } });
    const pricingByKey = new Map(pricings.map((p) => [`${p.countryCode}:${p.planId}`, p.aiCredits]));

    return tenants.map((t) => {
      const sub = t.subscriptions[0] ?? null;
      let billingCycle: 'monthly' | 'annual' | null = null;
      let planCreditsTotal: number | null = null;
      let percentUsed: number | null = null;

      if (sub?.currentPeriodStart && sub?.currentPeriodEnd) {
        const days =
          (sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
          (1000 * 60 * 60 * 24);
        billingCycle = days > 300 ? 'annual' : 'monthly';
      }

      if (sub?.planId) {
        const key = `${t.primaryCountry}:${sub.planId}`;
        planCreditsTotal = pricingByKey.get(key) ?? null;
        if (planCreditsTotal && planCreditsTotal > 0) {
          percentUsed = Math.min(
            100,
            Math.round(((planCreditsTotal - t.aiCreditsRemaining) / planCreditsTotal) * 100),
          );
        }
      }

      return {
        id: t.id,
        name: t.name,
        type: t.type,
        primaryCountry: t.primaryCountry,
        defaultCurrency: t.defaultCurrency,
        billingPlan: t.billingPlan,
        isActive: t.isActive,
        createdAt: t.createdAt,
        aiCreditsRemaining: t.aiCreditsRemaining,
        subscription: sub
          ? {
              planId: sub.planId,
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
              billingCycle,
              planCreditsTotal,
              percentUsed,
              currency: sub.currency,
            }
          : null,
        _count: t._count,
      };
    });
  }

  async listSubscriptions() {
    const subs = await this.prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            primaryCountry: true,
            billingPlan: true,
            aiCreditsRemaining: true,
          },
        },
      },
    });

    // Batch-load consumer users for userId-based subscriptions
    const consumerUserIds = subs
      .filter((s) => s.userId && !s.tenantId)
      .map((s) => s.userId as string);

    const consumerUsers =
      consumerUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: consumerUserIds } },
            select: {
              id: true,
              name: true,
              email: true,
              consumerProfile: { select: { aiCreditsRemaining: true, subscriptionStatus: true } },
            },
          })
        : [];

    const userMap = new Map(consumerUsers.map((u) => [u.id, u]));

    const pricings = await this.prisma.countryPricing.findMany({ where: { isActive: true } });
    const pricingByKey = new Map(pricings.map((p) => [`${p.countryCode}:${p.planId}`, p.aiCredits]));

    return subs.map((sub) => {
      const isFirm = !!sub.tenantId;
      const user = sub.userId ? userMap.get(sub.userId) : null;

      const entityType = isFirm ? 'firm' : 'consumer';
      const entityName = isFirm
        ? (sub.tenant?.name ?? 'Unknown Firm')
        : (user?.name ?? user?.email ?? 'Unknown');
      const entityId = sub.tenantId ?? sub.userId ?? null;
      const userEmail = isFirm ? null : (user?.email ?? null);

      const creditsRemaining = isFirm
        ? (sub.tenant?.aiCreditsRemaining ?? 0)
        : (user?.consumerProfile?.aiCreditsRemaining ?? 0);

      const planKey = `${sub.countryCode}:${sub.planId}`;
      const planCreditsTotal = pricingByKey.get(planKey) ?? null;
      const percentUsed =
        planCreditsTotal && planCreditsTotal > 0
          ? Math.min(
              100,
              Math.round(((planCreditsTotal - creditsRemaining) / planCreditsTotal) * 100),
            )
          : null;

      let billingCycle: 'monthly' | 'annual' | null = null;
      if (sub.currentPeriodStart && sub.currentPeriodEnd) {
        const days =
          (sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) /
          (1000 * 60 * 60 * 24);
        billingCycle = days > 300 ? 'annual' : 'monthly';
      }

      return {
        id: sub.id,
        entityType,
        entityName,
        entityId,
        userEmail,
        planId: sub.planId,
        billingPlan: isFirm ? (sub.tenant?.billingPlan ?? null) : null,
        status: sub.status,
        billingCycle,
        creditsRemaining,
        planCreditsTotal,
        percentUsed,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        countryCode: sub.countryCode,
        currency: sub.currency,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
    });
  }

  async listAiCosts(limit = 100) {
    return this.prisma.aIUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        taskType: true,
        mode: true,
        modelName: true,
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
        status: true,
        createdAt: true,
        tenantId: true,
        userId: true,
      },
    });
  }

  async listAiLogs(limit = 50) {
    return this.listAiCosts(limit);
  }

  async listAuditLogs(query: {
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'action' | 'entityType';
    sortDir?: 'asc' | 'desc';
  } = {}) {
    const limit = Math.min(query.limit ?? 100, 200);
    const offset = query.offset ?? 0;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const where = {
      userId: query.userId || undefined,
      action: query.action
        ? { contains: query.action, mode: 'insensitive' as const }
        : undefined,
      entityType: query.entityType || undefined,
      entityId: query.entityId || undefined,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        take: limit,
        skip: offset,
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async listTrainingDatasets() {
    const datasets = await this.prisma.trainingDataset.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return datasets.map((d) => ({
      id: d.id,
      name: d.name,
      datasetType: d.datasetType,
      countryCode: d.countryCode,
      status: d.status,
      itemCount: d._count.items,
      createdAt: d.createdAt,
    }));
  }

  async listLegalSources() {
    return this.prisma.legalSource.findMany({
      orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
    });
  }

  ingestLegalAuthority(input: IngestLegalAuthorityInput) {
    return this.legalSourceService.ingestAuthority(input);
  }

  async getUnitEconomicsSummary() {
    const snapshots = await this.prisma.unitEconomicsSnapshot.findMany({
      orderBy: { periodStart: 'desc' },
      take: 20,
    });
    const totalCost = await this.prisma.aIUsageLog.aggregate({
      _sum: { costUsd: true },
      _count: true,
    });
    return {
      snapshots,
      aiUsageTotal: totalCost._count,
      aiCostTotalUsd: Number(totalCost._sum.costUsd ?? 0),
      targetNetMargin: 0.4,
    };
  }

  // ── Referrals admin ────────────────────────────────────────────────────────

  async listReferrals(query: {
    status?: string;
    referrerUserId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;

    const where = {
      status: query.status || undefined,
      referrerUserId: query.referrerUserId || undefined,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          referrerUserId: true,
          refereeUserId: true,
          referralCode: true,
          status: true,
          rejectionReason: true,
          refereeDeviceFingerprintHash: true,
          subscriptionId: true,
          subscribedAt: true,
          rewardedAt: true,
          referrerRewardCredits: true,
          refereeDiscountApplied: true,
          createdAt: true,
          referrer: { select: { email: true, name: true, userType: true } },
          referee: { select: { email: true, name: true } },
        },
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        ...r,
        refereeDeviceFingerprintHash: r.refereeDeviceFingerprintHash
          ? `${r.refereeDeviceFingerprintHash.slice(0, 12)}…`
          : null,
      })),
      total,
      limit,
      offset,
    };
  }

  async getReferralStats() {
    const [totalPending, totalSubscribed, totalRewarded, totalRejected] =
      await Promise.all([
        this.prisma.referral.count({ where: { status: 'PENDING' } }),
        this.prisma.referral.count({ where: { status: 'SUBSCRIBED' } }),
        this.prisma.referral.count({ where: { status: 'REWARDED' } }),
        this.prisma.referral.count({ where: { status: 'REJECTED' } }),
      ]);

    const rewardAgg = await this.prisma.referral.aggregate({
      where: { status: 'REWARDED' },
      _sum: { referrerRewardCredits: true },
    });

    // Top 10 referrers by rewards
    const topReferrers = await this.prisma.referral.groupBy({
      by: ['referrerUserId'],
      where: { status: 'REWARDED' },
      _count: { id: true },
      _sum: { referrerRewardCredits: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const referrerIds = topReferrers.map((r) => r.referrerUserId);
    const referrerUsers = await this.prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = Object.fromEntries(referrerUsers.map((u) => [u.id, u]));

    return {
      totals: {
        pending: totalPending,
        subscribed: totalSubscribed,
        rewarded: totalRewarded,
        rejected: totalRejected,
        totalCreditsAwarded: rewardAgg._sum.referrerRewardCredits ?? 0,
      },
      topReferrers: topReferrers.map((r) => ({
        userId: r.referrerUserId,
        email: userMap[r.referrerUserId]?.email ?? '',
        name: userMap[r.referrerUserId]?.name ?? null,
        rewardedReferrals: r._count.id,
        totalCredits: r._sum.referrerRewardCredits ?? 0,
      })),
    };
  }

  async getAiProfitability() {
    const rows = await this.prisma.aIUsageLog.groupBy({
      by: ['taskType'],
      _count: { id: true },
      _sum: {
        chargedCredits: true,
        creditValueUsd: true,
        costUsd: true,
        platformMarginUsd: true,
      },
      orderBy: { _count: { id: 'desc' } },
      take: 100,
    });
    return rows.map((r) => {
      const revenue = Number(r._sum.creditValueUsd ?? 0);
      const cost = Number(r._sum.costUsd ?? 0);
      const margin = Number(r._sum.platformMarginUsd ?? 0);
      return {
        taskType: r.taskType,
        countryCode: null,
        userSegment: null,
        totalCreditsCharged: r._sum.chargedCredits ?? 0,
        totalCreditValueUsd: revenue,
        totalActualCostUsd: cost,
        platformMarginUsd: margin,
        grossMarginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
        requestCount: r._count.id,
      };
    });
  }

  async listCreditRates() {
    return this.prisma.aICreditRate.findMany({
      orderBy: [{ taskType: 'asc' }, { userSegment: 'asc' }],
    });
  }

  async updateCreditRate(id: string, data: { baseCredits?: number; markupMultiplier?: number; enabled?: boolean }) {
    return this.prisma.aICreditRate.update({
      where: { id },
      data: {
        baseCredits: data.baseCredits !== undefined ? Number(data.baseCredits) : undefined,
        markupMultiplier: data.markupMultiplier !== undefined ? data.markupMultiplier : undefined,
        enabled: data.enabled !== undefined ? data.enabled : undefined,
      },
    });
  }

  async listAiModelCosts() {
    return this.prisma.aIModelCostConfig.findMany({
      orderBy: [{ provider: 'asc' }, { modelName: 'asc' }],
    });
  }

  async updateAiModelCost(id: string, data: { inputCostPer1M?: number; outputCostPer1M?: number; isActive?: boolean }) {
    return this.prisma.aIModelCostConfig.update({
      where: { id },
      data: {
        inputCostPer1M: data.inputCostPer1M !== undefined ? data.inputCostPer1M : undefined,
        outputCostPer1M: data.outputCostPer1M !== undefined ? data.outputCostPer1M : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });
  }

  async getAiCostsByEntity(params: { from?: string; to?: string; limit?: number } = {}) {
    const limit = Math.min(params.limit ?? 50, 200);
    const createdAt = params.from || params.to
      ? {
          gte: params.from ? new Date(params.from) : undefined,
          lte: params.to ? new Date(params.to) : undefined,
        }
      : undefined;

    // Tenant costs
    const tenantRows = await this.prisma.aIUsageLog.groupBy({
      by: ['tenantId'],
      where: { tenantId: { not: null }, createdAt },
      _sum: { costUsd: true, chargedCredits: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: limit,
    });

    const tenantIds = tenantRows.map((r) => r.tenantId!).filter(Boolean);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    // Top task per tenant
    const tenantTopTask = await Promise.all(
      tenantRows.map(async (r) => {
        const top = await this.prisma.aIUsageLog.groupBy({
          by: ['taskType'],
          where: { tenantId: r.tenantId!, createdAt },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 1,
        });
        return { tenantId: r.tenantId!, topTask: top[0]?.taskType ?? null };
      }),
    );
    const topTaskByTenant = new Map(tenantTopTask.map((t) => [t.tenantId, t.topTask]));

    const tenantResult = tenantRows.map((r) => ({
      entityId: r.tenantId!,
      entityName: tenantMap.get(r.tenantId!) ?? r.tenantId!,
      entityType: 'tenant' as const,
      totalCostUsd: Number(r._sum.costUsd ?? 0),
      totalCreditsCharged: r._sum.chargedCredits ?? 0,
      totalRequests: r._count.id,
      topTaskType: topTaskByTenant.get(r.tenantId!) ?? null,
      breakdown: [],
    }));

    // Consumer (userId, no tenantId) costs
    const consumerRows = await this.prisma.aIUsageLog.groupBy({
      by: ['userId'],
      where: { tenantId: null, userId: { not: null }, createdAt },
      _sum: { costUsd: true, chargedCredits: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 20,
    });

    const userIds = consumerRows.map((r) => r.userId!).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]));

    const consumerResult = consumerRows.map((r) => ({
      entityId: r.userId!,
      entityName: userMap.get(r.userId!) ?? r.userId!,
      entityType: 'consumer' as const,
      totalCostUsd: Number(r._sum.costUsd ?? 0),
      totalCreditsCharged: r._sum.chargedCredits ?? 0,
      totalRequests: r._count.id,
      topTaskType: null,
      breakdown: [],
    }));

    return [...tenantResult, ...consumerResult].sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }

  async getEntityCostBreakdown(entityId: string, entityType: 'tenant' | 'consumer') {
    const where =
      entityType === 'tenant'
        ? { tenantId: entityId }
        : { userId: entityId, tenantId: null };

    const taskRows = await this.prisma.aIUsageLog.groupBy({
      by: ['taskType'],
      where,
      _sum: { costUsd: true, chargedCredits: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    const modelRows = await this.prisma.aIUsageLog.groupBy({
      by: ['taskType', 'modelName'],
      where,
      _sum: { costUsd: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    const modelsByTask = new Map<string, { modelName: string | null; costUsd: number; requests: number }[]>();
    for (const r of modelRows) {
      const list = modelsByTask.get(r.taskType) ?? [];
      list.push({ modelName: r.modelName, costUsd: Number(r._sum.costUsd ?? 0), requests: r._count.id });
      modelsByTask.set(r.taskType, list);
    }

    return taskRows.map((r) => ({
      taskType: r.taskType,
      requests: r._count.id,
      totalCostUsd: Number(r._sum.costUsd ?? 0),
      creditsCharged: Number(r._sum.chargedCredits ?? 0),
      totalTokens: Number(r._sum.inputTokens ?? 0) + Number(r._sum.outputTokens ?? 0),
      models: modelsByTask.get(r.taskType) ?? [],
    }));
  }

  async createTrainingDataset(data: { name: string; datasetType: string; countryCode?: string; description?: string }) {
    const dataset = await this.prisma.trainingDataset.create({
      data: {
        name: data.name,
        datasetType: data.datasetType,
        countryCode: data.countryCode ?? null,
        sourcePolicy: data.description ?? null,
        status: 'DRAFT',
      },
      include: { _count: { select: { items: true } } },
    });
    return {
      id: dataset.id,
      name: dataset.name,
      datasetType: dataset.datasetType,
      countryCode: dataset.countryCode,
      status: dataset.status,
      description: dataset.sourcePolicy,
      itemCount: dataset._count.items,
      createdAt: dataset.createdAt,
    };
  }

  async updateTrainingDatasetStatus(id: string, status: string) {
    const dataset = await this.prisma.trainingDataset.update({
      where: { id },
      data: { status },
      include: { _count: { select: { items: true } } },
    });
    return {
      id: dataset.id,
      name: dataset.name,
      datasetType: dataset.datasetType,
      countryCode: dataset.countryCode,
      status: dataset.status,
      description: dataset.sourcePolicy,
      itemCount: dataset._count.items,
      createdAt: dataset.createdAt,
    };
  }

  async listTrainingDatasetItems(datasetId: string) {
    const items = await this.prisma.trainingDatasetItem.findMany({
      where: { datasetId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return items.map((item) => ({
      id: item.id,
      datasetId: item.datasetId,
      inputText: item.inputText,
      outputText: item.expectedOutput ?? null,
      approvalStatus: item.revoked ? 'REVOKED' : item.approved ? 'APPROVED' : 'PENDING',
      createdAt: item.createdAt,
    }));
  }

  async updateTrainingDatasetItem(datasetId: string, itemId: string, approvalStatus: 'APPROVED' | 'REVOKED') {
    const item = await this.prisma.trainingDatasetItem.update({
      where: { id: itemId, datasetId },
      data: {
        approved: approvalStatus === 'APPROVED',
        revoked: approvalStatus === 'REVOKED',
      },
    });
    return {
      id: item.id,
      datasetId: item.datasetId,
      inputText: item.inputText,
      outputText: item.expectedOutput ?? null,
      approvalStatus: item.revoked ? 'REVOKED' : item.approved ? 'APPROVED' : 'PENDING',
      createdAt: item.createdAt,
    };
  }

  // ── Credit management ────────────────────────────────────────────────────

  /**
   * Wipe the AICreditLedger for a tenant and reset its balance to `credits`.
   * Activates the subscription billing cycle starting from today if a
   * subscription record exists.
   */
  async resetTenantCredits(
    tenantId: string,
    credits: number,
    adminUserId: string,
  ): Promise<{ tenantId: string; credits: number; cycleStart: string; cycleEnd: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const cycleStart = new Date();
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + 30);

    await this.prisma.aICreditLedger.deleteMany({ where: { tenantId } });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { aiCreditsRemaining: 0 },
    });

    await this.prisma.aICreditLedger.create({
      data: {
        tenantId,
        eventType: 'CREDIT',
        taskType: 'admin_credit_reset',
        credits,
        metadata: {
          reason: 'manual_monthly_refresh',
          billingPlan: tenant.billingPlan,
          resetBy: adminUserId,
          resetAt: cycleStart.toISOString(),
          cycleStart: cycleStart.toISOString(),
          cycleEnd: cycleEnd.toISOString(),
        },
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { aiCreditsRemaining: credits },
    });

    const pendingSub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingSub) {
      await this.prisma.subscription.update({
        where: { id: pendingSub.id },
        data: { status: 'ACTIVE', currentPeriodStart: cycleStart, currentPeriodEnd: cycleEnd },
      });
    }

    return {
      tenantId,
      credits,
      cycleStart: cycleStart.toISOString(),
      cycleEnd: cycleEnd.toISOString(),
    };
  }

  /**
   * Wipe the AICreditLedger for a consumer and reset their profile balance.
   */
  async resetConsumerCredits(
    userId: string,
    credits: number,
    adminUserId: string,
  ): Promise<{ userId: string; credits: number }> {
    const profile = await this.prisma.consumerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new Error(`Consumer profile not found for userId: ${userId}`);
    }

    await this.prisma.aICreditLedger.deleteMany({ where: { userId } });
    await this.prisma.consumerProfile.update({
      where: { userId },
      data: { aiCreditsRemaining: 0 },
    });

    await this.prisma.aICreditLedger.create({
      data: {
        userId,
        eventType: 'CREDIT',
        taskType: 'admin_credit_reset',
        credits,
        metadata: {
          reason: 'manual_monthly_refresh',
          subscriptionStatus: profile.subscriptionStatus,
          resetBy: adminUserId,
          resetAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.consumerProfile.update({
      where: { userId },
      data: { aiCreditsRemaining: credits },
    });

    return { userId, credits };
  }

  async listMarketplaceLawyerProfiles(filters?: {
    verified?: boolean;
    countryCode?: string;
    q?: string;
  }) {
    const q = filters?.q?.trim();
    const profiles = await this.prisma.lawyerProfile.findMany({
      where: {
        verified: filters?.verified,
        countryCode: filters?.countryCode?.toUpperCase(),
        ...(q
          ? {
              OR: [
                { user: { email: { contains: q, mode: 'insensitive' } } },
                { user: { name: { contains: q, mode: 'insensitive' } } },
                { barNumber: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ verified: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    });

    const tenantIds = [
      ...new Set(profiles.map((p) => p.tenantId).filter(Boolean)),
    ] as string[];
    const tenants = tenantIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true, primaryCountry: true },
        })
      : [];
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    return profiles.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      tenantId: profile.tenantId,
      countryCode: profile.countryCode,
      barNumber: profile.barNumber,
      verified: profile.verified,
      verificationStatus: profile.verificationStatus,
      acceptsLeads: profile.acceptsLeads,
      practiceAreas: profile.practiceAreas,
      jurisdictions: profile.jurisdictions,
      languages: profile.languages,
      consultationFee: profile.consultationFee
        ? Number(profile.consultationFee.toString())
        : null,
      currency: profile.currency,
      bio: profile.bio,
      yearsExperience: profile.yearsExperience,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      user: profile.user,
      tenant: profile.tenantId ? tenantMap.get(profile.tenantId) ?? null : null,
    }));
  }

  async updateMarketplaceLawyerVerification(
    profileId: string,
    data: { verified: boolean; verificationStatus?: string; acceptsLeads?: boolean },
  ) {
    const profile = await this.prisma.lawyerProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      throw new NotFoundException(`Lawyer profile not found: ${profileId}`);
    }

    const verificationStatus =
      data.verificationStatus ??
      (data.verified ? 'VERIFIED' : 'PENDING');

    return this.prisma.lawyerProfile.update({
      where: { id: profileId },
      data: {
        verified: data.verified,
        verificationStatus,
        ...(data.acceptsLeads !== undefined ? { acceptsLeads: data.acceptsLeads } : {}),
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  async listAllReviewRequests(filters?: { status?: string; countryCode?: string }) {
    const rows = await this.prisma.lawyerReviewRequest.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.countryCode ? { countryCode: filters.countryCode.toUpperCase() } : {}),
      },
      include: {
        consumerCase: {
          select: {
            id: true,
            title: true,
            issueType: true,
            countryCode: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Attach user emails without requiring a Prisma relation
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      ...r,
      user: userMap.get(r.userId) ?? null,
    }));
  }

  async setUserActive(userId: string, isActive: boolean, adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType === 'SUPER_ADMIN') {
      throw new BadRequestException('Super admin accounts cannot be deactivated');
    }

    if (userId === adminUserId && !isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    await this.prisma.$transaction(async (tx) => {
      if (!isActive) {
        await tx.refreshToken.deleteMany({ where: { userId } });
      }

      await tx.user.update({
        where: { id: userId },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
          entityType: 'User',
          entityId: userId,
          metadata: {
            targetEmail: user.email,
            targetUserType: user.userType,
          },
        },
      });
    });

    return { id: userId, isActive };
  }

  async masterDeleteUser(
    userId: string,
    confirmEmail: string,
    adminUserId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType === 'SUPER_ADMIN') {
      throw new BadRequestException('Super admin accounts cannot be deleted');
    }

    if (userId === adminUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    if (user.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      throw new ForbiddenException('Email confirmation does not match this user');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.referral.deleteMany({
        where: {
          OR: [{ referrerUserId: userId }, { refereeUserId: userId }],
        },
      });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.aICreditLedger.deleteMany({ where: { userId } });
      await tx.aIUsageLog.deleteMany({ where: { userId } });
      await tx.aIOutput.deleteMany({ where: { userId } });
      await tx.aICitation.deleteMany({ where: { userId } });
      await tx.payment.deleteMany({ where: { userId } });
      await tx.lawyerLead.deleteMany({ where: { userId } });
      await tx.trainingConsent.deleteMany({ where: { userId } });
      await tx.documentTrainingPermission.deleteMany({ where: { userId } });
      await tx.creditReservation.deleteMany({ where: { userId } });
      await tx.taskPatternUsage.deleteMany({ where: { userId } });
      await tx.legalTaskPattern.deleteMany({ where: { userId } });
      await tx.personalLegalVault.deleteMany({ where: { userId } });
      await tx.document.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: null },
      });

      await tx.user.delete({ where: { id: userId } });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_USER_MASTER_DELETED',
          entityType: 'User',
          entityId: userId,
          metadata: {
            deletedEmail: user.email,
            deletedUserType: user.userType,
            deletedAt: new Date().toISOString(),
          },
        },
      });
    });

    return {
      deleted: true,
      id: userId,
      email: user.email,
      deletedAt: new Date().toISOString(),
    };
  }

  async getPresenceSnapshot() {
    const snapshot = this.presenceService.getPresenceSnapshot();
    if (snapshot.users.length === 0) {
      return { ...snapshot, users: [] };
    }

    const userIds = snapshot.users.map((u) => u.userId);
    const dbUsers = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        countryCode: true,
      },
    });
    const userMap = new Map(dbUsers.map((u) => [u.id, u]));

    const users = snapshot.users.map((row) => {
      const dbUser = userMap.get(row.userId);
      return {
        userId: row.userId,
        email: dbUser?.email ?? '',
        name: dbUser?.name ?? null,
        userType: dbUser?.userType ?? row.userType ?? 'unknown',
        countryCode: dbUser?.countryCode ?? row.countryCode,
        isOnline: row.isOnline,
        connectedAt: row.connectedAt,
        sessionSeconds: row.sessionSeconds,
      };
    });

    return {
      onlineCount: snapshot.onlineCount,
      byCountry: snapshot.byCountry,
      byUserType: snapshot.byUserType,
      users,
    };
  }
}
