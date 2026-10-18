import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveModelProvider } from '@/ai/model-costs.config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AdminAiDateFilters,
  buildDateRange,
  parseLedgerMetadata,
  parseRunTelemetry,
} from './admin-ai-observability.util';

/** Most rows one run-quality query will read before it reports truncation. */
const RUN_QUALITY_ROW_CAP = 5000;

@Injectable()
export class AdminAiObservabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listCreditLedger(query: AdminAiDateFilters = {}) {
    const limit = Math.min(query.limit ?? 100, 500);
    const offset = query.offset ?? 0;
    const createdAt = buildDateRange(query);

    const where: Prisma.AICreditLedgerWhereInput = {
      eventType: 'DEBIT',
      tenantId: query.tenantId || undefined,
      userId: query.userId || undefined,
      taskType: query.taskType || undefined,
      createdAt,
    };

    const [items, total] = await Promise.all([
      this.prisma.aICreditLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, email: true, name: true } },
          tenant: { select: { id: true, name: true } },
        },
      }),
      this.prisma.aICreditLedger.count({ where }),
    ]);

    const mapped = items
      .map((row) => {
        const meta = parseLedgerMetadata(row.metadata);
        if (query.modelName && meta.modelName !== query.modelName) {
          return null;
        }
        return {
          id: row.id,
          taskType: row.taskType,
          credits: row.credits,
          costUsd: row.costUsd != null ? Number(row.costUsd) : meta.providerCostUsd ?? null,
          modelName: meta.modelName ?? null,
          inputTokens: meta.inputTokens ?? null,
          outputTokens: meta.outputTokens ?? null,
          providerCostUsd: meta.providerCostUsd ?? null,
          chargeMode: meta.chargeMode ?? null,
          userId: row.userId,
          tenantId: row.tenantId,
          userName: row.user?.name ?? row.user?.email ?? null,
          tenantName: row.tenant?.name ?? null,
          entityName: row.tenant?.name ?? row.user?.name ?? row.user?.email ?? null,
          entityType: row.tenantId ? ('tenant' as const) : row.userId ? ('consumer' as const) : null,
          createdAt: row.createdAt,
        };
      })
      .filter(Boolean);

    return {
      items: mapped,
      total: query.modelName ? mapped.length : total,
      limit,
      offset,
    };
  }

  async getCostsSummaryV2(query: Pick<AdminAiDateFilters, 'from' | 'to'> = {}) {
    const createdAt = buildDateRange(query);
    const usageWhere = createdAt ? { createdAt } : {};
    const ledgerWhere: Prisma.AICreditLedgerWhereInput = {
      eventType: 'DEBIT',
      ...(createdAt ? { createdAt } : {}),
    };

    const [usageAgg, ledgerAgg, usageCost, ledgerRows] = await Promise.all([
      this.prisma.aIUsageLog.aggregate({
        where: usageWhere,
        _count: { id: true },
        _sum: {
          costUsd: true,
          chargedCredits: true,
          inputTokens: true,
          outputTokens: true,
          creditValueUsd: true,
          platformMarginUsd: true,
        },
      }),
      this.prisma.aICreditLedger.aggregate({
        where: ledgerWhere,
        _count: { id: true },
        _sum: { credits: true, costUsd: true },
      }),
      this.prisma.aIUsageLog.aggregate({
        where: usageWhere,
        _sum: { costUsd: true },
      }),
      this.prisma.aICreditLedger.findMany({
        where: ledgerWhere,
        select: { metadata: true, credits: true, costUsd: true },
      }),
    ]);

    let ledgerProviderCost = 0;
    for (const row of ledgerRows) {
      const meta = parseLedgerMetadata(row.metadata);
      ledgerProviderCost +=
        meta.providerCostUsd ??
        (row.costUsd != null ? Number(row.costUsd) : 0);
    }

    const usageLogCost = Number(usageAgg._sum.costUsd ?? 0);
    const usageLogRequests = usageAgg._count.id;
    const ledgerDebits = ledgerAgg._count.id;
    const ledgerCredits = ledgerAgg._sum.credits ?? 0;

    return {
      usageLogRequests,
      usageLogCostUsd: usageLogCost,
      usageLogCredits: usageAgg._sum.chargedCredits ?? 0,
      usageLogTokens:
        (usageAgg._sum.inputTokens ?? 0) + (usageAgg._sum.outputTokens ?? 0),
      ledgerDebits,
      ledgerCreditsCharged: ledgerCredits,
      ledgerProviderCostUsd: Number(ledgerProviderCost.toFixed(6)),
      totalCreditValueUsd: Number(usageAgg._sum.creditValueUsd ?? 0),
      totalPlatformMarginUsd: Number(usageAgg._sum.platformMarginUsd ?? 0),
      combinedProviderCostUsd: Number(
        Math.max(usageLogCost, ledgerProviderCost).toFixed(6),
      ),
      avgCostPerRequest:
        usageLogRequests > 0 ? usageLogCost / usageLogRequests : 0,
      avgCreditsPerDebit: ledgerDebits > 0 ? ledgerCredits / ledgerDebits : 0,
    };
  }

  async listAiUsageLogs(query: AdminAiDateFilters = {}) {
    const limit = Math.min(query.limit ?? 100, 500);
    const offset = query.offset ?? 0;
    const createdAt = buildDateRange(query);

    const where: Prisma.AIUsageLogWhereInput = {
      tenantId: query.tenantId || undefined,
      userId: query.userId || undefined,
      taskType: query.taskType || undefined,
      modelName: query.modelName || undefined,
      modelProvider: query.modelProvider || undefined,
      createdAt,
    };

    const [items, total] = await Promise.all([
      this.prisma.aIUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          taskType: true,
          mode: true,
          modelName: true,
          modelProvider: true,
          modelTier: true,
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
          chargedCredits: true,
          creditValueUsd: true,
          platformMarginUsd: true,
          status: true,
          error: true,
          latencyMs: true,
          telemetry: true,
          createdAt: true,
          tenantId: true,
          userId: true,
          user: { select: { email: true, name: true } },
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.aIUsageLog.count({ where }),
    ]);

    return {
      items: items.map((l) => ({
        ...l,
        costUsd: l.costUsd != null ? Number(l.costUsd) : 0,
        creditValueUsd: l.creditValueUsd != null ? Number(l.creditValueUsd) : null,
        platformMarginUsd:
          l.platformMarginUsd != null ? Number(l.platformMarginUsd) : null,
        userName: l.user?.name ?? l.user?.email ?? null,
        tenantName: l.tenant?.name ?? null,
        entityName: l.tenant?.name ?? l.user?.name ?? l.user?.email ?? null,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Answers "is the AI actually working in this country?" from the per-run
   * telemetry every research and drafting run writes. Grouped by jurisdiction so
   * a regression confined to one country is visible next to healthy ones instead
   * of being averaged away.
   */
  async getRunQualityByCountry(
    query: Pick<AdminAiDateFilters, 'from' | 'to' | 'tenantId'> & { flow?: 'research' | 'drafting' } = {},
  ) {
    const createdAt = buildDateRange(query);
    const flow = query.flow === 'research' || query.flow === 'drafting' ? query.flow : undefined;
    const rows = await this.prisma.aIUsageLog.findMany({
      where: {
        telemetry: { not: Prisma.DbNull },
        tenantId: query.tenantId || undefined,
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: RUN_QUALITY_ROW_CAP,
      select: { telemetry: true, latencyMs: true },
    });

    type Bucket = {
      countryCode: string;
      runs: number;
      clarificationAborts: number;
      authoritiesRetrieved: number;
      authoritiesAfterPack: number;
      citationsStripped: number;
      runsWithZeroAuthorities: number;
      llmVerifierRuns: number;
      lawyerReviewRequired: number;
      modelFallbacks: number;
      deadConnectorRuns: number;
      totalDurationMs: number;
      verificationStatuses: Record<string, number>;
      similarCasesOutcomes: Record<string, number>;
    };

    const buckets = new Map<string, Bucket>();
    const count = (map: Record<string, number>, key?: string | null) => {
      if (!key) return;
      map[key] = (map[key] ?? 0) + 1;
    };

    for (const row of rows) {
      const t = parseRunTelemetry(row.telemetry);
      if (!t) continue;
      if (flow && (t.flow ?? 'research') !== flow) continue;

      const countryCode = t.countryCode ?? 'unknown';
      const bucket = buckets.get(countryCode) ?? {
        countryCode,
        runs: 0,
        clarificationAborts: 0,
        authoritiesRetrieved: 0,
        authoritiesAfterPack: 0,
        citationsStripped: 0,
        runsWithZeroAuthorities: 0,
        llmVerifierRuns: 0,
        lawyerReviewRequired: 0,
        modelFallbacks: 0,
        deadConnectorRuns: 0,
        totalDurationMs: 0,
        verificationStatuses: {},
        similarCasesOutcomes: {},
      };

      bucket.runs += 1;
      if (t.clarificationReason) bucket.clarificationAborts += 1;
      bucket.authoritiesRetrieved += t.authoritiesRetrieved ?? 0;
      bucket.authoritiesAfterPack += t.authoritiesAfterPack ?? 0;
      bucket.citationsStripped += t.citationsStripped ?? 0;
      if ((t.authoritiesRetrieved ?? 0) === 0) bucket.runsWithZeroAuthorities += 1;
      if (t.llmVerifierRan) bucket.llmVerifierRuns += 1;
      if (t.requiresLawyerReview) bucket.lawyerReviewRequired += 1;
      if (t.modelFellBack) bucket.modelFallbacks += 1;
      if ((t.connectorHealth ?? []).some((c) => c.status && c.status.toLowerCase() !== 'ok')) {
        bucket.deadConnectorRuns += 1;
      }
      bucket.totalDurationMs += t.durationMs ?? row.latencyMs ?? 0;
      count(bucket.verificationStatuses, t.verificationStatus);
      count(bucket.similarCasesOutcomes, t.similarCasesOutcome);

      buckets.set(countryCode, bucket);
    }

    const items = [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        avgAuthoritiesRetrieved: bucket.runs > 0 ? bucket.authoritiesRetrieved / bucket.runs : 0,
        avgAuthoritiesAfterPack: bucket.runs > 0 ? bucket.authoritiesAfterPack / bucket.runs : 0,
        avgDurationMs: bucket.runs > 0 ? Math.round(bucket.totalDurationMs / bucket.runs) : 0,
        /** Share of runs where nothing survived retrieval — the honest-gap rate. */
        zeroAuthorityRate: bucket.runs > 0 ? bucket.runsWithZeroAuthorities / bucket.runs : 0,
        modelFallbackRate: bucket.runs > 0 ? bucket.modelFallbacks / bucket.runs : 0,
      }))
      .sort((a, b) => b.runs - a.runs);

    return {
      items,
      flow: flow ?? 'all',
      rowsScanned: rows.length,
      /** True when older runs in the window were cut off; narrow the date range. */
      truncated: rows.length === RUN_QUALITY_ROW_CAP,
      rowCap: RUN_QUALITY_ROW_CAP,
    };
  }

  async getCostsByModel(query: Pick<AdminAiDateFilters, 'from' | 'to'> = {}) {
    const createdAt = buildDateRange(query);
    const where = createdAt ? { createdAt } : {};

    const usageRows = await this.prisma.aIUsageLog.groupBy({
      by: ['modelName', 'modelProvider'],
      where,
      _count: { id: true },
      _sum: {
        costUsd: true,
        chargedCredits: true,
        inputTokens: true,
        outputTokens: true,
      },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    const ledgerRows = await this.prisma.aICreditLedger.findMany({
      where: { eventType: 'DEBIT', ...(createdAt ? { createdAt } : {}) },
      select: { metadata: true, credits: true, costUsd: true },
    });

    const ledgerByModel = new Map<
      string,
      { requests: number; credits: number; costUsd: number; tokens: number }
    >();
    for (const row of ledgerRows) {
      const meta = parseLedgerMetadata(row.metadata);
      const model = meta.modelName ?? 'unknown';
      const entry = ledgerByModel.get(model) ?? {
        requests: 0,
        credits: 0,
        costUsd: 0,
        tokens: 0,
      };
      entry.requests += 1;
      entry.credits += row.credits;
      entry.costUsd +=
        meta.providerCostUsd ??
        (row.costUsd != null ? Number(row.costUsd) : 0);
      entry.tokens += (meta.inputTokens ?? 0) + (meta.outputTokens ?? 0);
      ledgerByModel.set(model, entry);
    }

    const usageModels = new Set(usageRows.map((r) => r.modelName!));

    const fromUsage = usageRows.map((r) => {
      const ledger = ledgerByModel.get(r.modelName!) ?? {
        requests: 0,
        credits: 0,
        costUsd: 0,
        tokens: 0,
      };
      const inputTokens = r._sum.inputTokens ?? 0;
      const outputTokens = r._sum.outputTokens ?? 0;
      const costUsd = Number(r._sum.costUsd ?? 0);
      const totalTokens = inputTokens + outputTokens;
      return {
        modelName: r.modelName!,
        modelProvider: r.modelProvider,
        usageLogRequests: r._count.id,
        ledgerDebits: ledger.requests,
        totalRequests: Math.max(r._count.id, ledger.requests),
        costUsd: Math.max(costUsd, ledger.costUsd),
        creditsCharged: Math.max(r._sum.chargedCredits ?? 0, ledger.credits),
        inputTokens,
        outputTokens,
        totalTokens: Math.max(totalTokens, ledger.tokens),
        avgCostPer1MTokens:
          totalTokens > 0 ? (costUsd / totalTokens) * 1_000_000 : 0,
      };
    });

    for (const [modelName, ledger] of ledgerByModel) {
      if (usageModels.has(modelName)) continue;
      fromUsage.push({
        modelName,
        modelProvider: 'unknown',
        usageLogRequests: 0,
        ledgerDebits: ledger.requests,
        totalRequests: ledger.requests,
        costUsd: ledger.costUsd,
        creditsCharged: ledger.credits,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: ledger.tokens,
        avgCostPer1MTokens:
          ledger.tokens > 0 ? (ledger.costUsd / ledger.tokens) * 1_000_000 : 0,
      });
    }

    return fromUsage.sort((a, b) => b.costUsd - a.costUsd);
  }

  async getCostsByEntityPaginated(query: AdminAiDateFilters = {}) {
    const limit = Math.min(query.limit ?? 100, 500);
    const offset = query.offset ?? 0;
    const createdAt = buildDateRange(query);

    const ledgerWhere: Prisma.AICreditLedgerWhereInput = {
      eventType: 'DEBIT',
      ...(createdAt ? { createdAt } : {}),
    };

    const [tenantLedger, consumerLedger, usageTenant, usageConsumer] =
      await Promise.all([
        this.prisma.aICreditLedger.groupBy({
          by: ['tenantId'],
          where: { ...ledgerWhere, tenantId: { not: null } },
          _sum: { credits: true, costUsd: true },
          _count: { id: true },
        }),
        this.prisma.aICreditLedger.groupBy({
          by: ['userId'],
          where: { ...ledgerWhere, tenantId: null, userId: { not: null } },
          _sum: { credits: true, costUsd: true },
          _count: { id: true },
        }),
        this.prisma.aIUsageLog.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: { not: null },
            ...(createdAt ? { createdAt } : {}),
          },
          _sum: { costUsd: true, chargedCredits: true },
          _count: { id: true },
        }),
        this.prisma.aIUsageLog.groupBy({
          by: ['userId'],
          where: {
            tenantId: null,
            userId: { not: null },
            ...(createdAt ? { createdAt } : {}),
          },
          _sum: { costUsd: true, chargedCredits: true },
          _count: { id: true },
        }),
      ]);

    type EntityAgg = {
      entityId: string;
      entityType: 'tenant' | 'consumer';
      totalCostUsd: number;
      totalCreditsCharged: number;
      totalRequests: number;
    };

    const entityMap = new Map<string, EntityAgg>();

    const merge = (
      id: string,
      type: 'tenant' | 'consumer',
      cost: number,
      credits: number,
      requests: number,
    ) => {
      const key = `${type}:${id}`;
      const existing = entityMap.get(key) ?? {
        entityId: id,
        entityType: type,
        totalCostUsd: 0,
        totalCreditsCharged: 0,
        totalRequests: 0,
      };
      existing.totalCostUsd = Math.max(existing.totalCostUsd, cost);
      existing.totalCreditsCharged = Math.max(
        existing.totalCreditsCharged,
        credits,
      );
      existing.totalRequests += requests;
      entityMap.set(key, existing);
    };

    for (const r of tenantLedger) {
      if (!r.tenantId) continue;
      merge(
        r.tenantId,
        'tenant',
        Number(r._sum.costUsd ?? 0),
        r._sum.credits ?? 0,
        r._count.id,
      );
    }
    for (const r of consumerLedger) {
      if (!r.userId) continue;
      merge(
        r.userId,
        'consumer',
        Number(r._sum.costUsd ?? 0),
        r._sum.credits ?? 0,
        r._count.id,
      );
    }
    for (const r of usageTenant) {
      if (!r.tenantId) continue;
      merge(
        r.tenantId,
        'tenant',
        Number(r._sum.costUsd ?? 0),
        r._sum.chargedCredits ?? 0,
        r._count.id,
      );
    }
    for (const r of usageConsumer) {
      if (!r.userId) continue;
      merge(
        r.userId,
        'consumer',
        Number(r._sum.costUsd ?? 0),
        r._sum.chargedCredits ?? 0,
        r._count.id,
      );
    }

    const sorted = [...entityMap.values()].sort(
      (a, b) => b.totalCreditsCharged - a.totalCreditsCharged,
    );
    const page = sorted.slice(offset, offset + limit);

    const tenantIds = page
      .filter((e) => e.entityType === 'tenant')
      .map((e) => e.entityId);
    const userIds = page
      .filter((e) => e.entityType === 'consumer')
      .map((e) => e.entityId);

    const [tenants, users] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      }),
    ]);
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]));

    return {
      items: page.map((e) => ({
        ...e,
        entityName:
          e.entityType === 'tenant'
            ? (tenantMap.get(e.entityId) ?? e.entityId)
            : (userMap.get(e.entityId) ?? e.entityId),
        topTaskType: null,
        breakdown: [],
      })),
      total: sorted.length,
      limit,
      offset,
    };
  }

  async getProfitability(query: AdminAiDateFilters & {
    groupBy?: 'taskType' | 'modelName' | 'tenantId';
  } = {}) {
    const createdAt = buildDateRange(query);
    const where: Prisma.AIUsageLogWhereInput = {
      tenantId: query.tenantId || undefined,
      userId: query.userId || undefined,
      taskType: query.taskType || undefined,
      modelName: query.modelName || undefined,
      ...(createdAt ? { createdAt } : {}),
    };
    const groupField = query.groupBy ?? 'taskType';

    const rows = await this.prisma.aIUsageLog.groupBy({
      by: [groupField],
      where,
      _count: { id: true },
      _sum: {
        chargedCredits: true,
        creditValueUsd: true,
        costUsd: true,
        platformMarginUsd: true,
      },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 200,
    });

    // Build ledger cost lookup by taskType so we can use max(usageLog, ledger)
    // for rows that may still have near-zero costUsd from the pre-fix era.
    const ledgerWhere: Prisma.AICreditLedgerWhereInput = {
      eventType: 'DEBIT',
      tenantId: query.tenantId || undefined,
      userId: query.userId || undefined,
      taskType: query.taskType || undefined,
      ...(createdAt ? { createdAt } : {}),
    };
    const ledgerRows = groupField === 'taskType'
      ? await this.prisma.aICreditLedger.findMany({
          where: ledgerWhere,
          select: { taskType: true, metadata: true, costUsd: true, credits: true },
        })
      : [];

    const ledgerCostByTask = new Map<string, number>();
    for (const row of ledgerRows) {
      const meta = parseLedgerMetadata(row.metadata);
      if (query.modelName && meta.modelName !== query.modelName) continue;
      const cost = meta.providerCostUsd ?? (row.costUsd != null ? Number(row.costUsd) : 0);
      const taskType = row.taskType ?? 'unknown';
      ledgerCostByTask.set(taskType, (ledgerCostByTask.get(taskType) ?? 0) + cost);
    }

    const tenantCountryMap = new Map<string, string>();
    if (groupField === 'tenantId') {
      const tenantIds = rows
        .map((r) => (r as { tenantId: string | null }).tenantId)
        .filter(Boolean) as string[];
      const tenants = await this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, primaryCountry: true, name: true },
      });
      for (const t of tenants) {
        tenantCountryMap.set(t.id, t.primaryCountry);
      }
    }

    return rows.map((r) => {
      const revenue = Number(r._sum?.creditValueUsd ?? 0);
      const usageLogCost = Number(r._sum?.costUsd ?? 0);
      const key =
        groupField === 'taskType'
          ? r.taskType
          : groupField === 'modelName'
            ? r.modelName
            : r.tenantId;
      // Use max(usageLog costUsd, ledger providerCostUsd) to handle zero-cost legacy rows.
      const ledgerCost = groupField === 'taskType' && key ? (ledgerCostByTask.get(key) ?? 0) : 0;
      const cost = Math.max(usageLogCost, ledgerCost);
      const margin = revenue - cost;
      return {
        groupBy: groupField,
        key: key ?? 'unknown',
        taskType: groupField === 'taskType' ? key ?? undefined : undefined,
        countryCode:
          groupField === 'tenantId' && key
            ? (tenantCountryMap.get(key) ?? null)
            : null,
        userSegment: null,
        totalCreditsCharged: r._sum?.chargedCredits ?? 0,
        totalCreditValueUsd: revenue,
        totalActualCostUsd: cost,
        platformMarginUsd: margin,
        grossMarginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
        requestCount: typeof r._count === 'object' ? (r._count.id ?? 0) : 0,
      };
    });
  }

  /**
   * Fix existing AIUsageLog rows where costUsd ≈ 0 (caused by the 1000× formula bug).
   * For each such row, look for a matching AICreditLedger debit and pull providerCostUsd
   * from its metadata.
   */
  async fixZeroCostUsageLogs(params: { from?: string; to?: string; limit?: number } = {}) {
    const createdAt = buildDateRange(params);
    const limit = Math.min(params.limit ?? 500, 2000);

    const zeroCostLogs = await this.prisma.aIUsageLog.findMany({
      where: {
        costUsd: { lt: 0.0001 },
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        tenantId: true,
        taskType: true,
        chargedCredits: true,
        createdAt: true,
      },
    });

    let updated = 0;
    let skipped = 0;

    for (const log of zeroCostLogs) {
      const ledger = await this.prisma.aICreditLedger.findFirst({
        where: {
          userId: log.userId ?? undefined,
          tenantId: log.tenantId ?? undefined,
          taskType: log.taskType,
          eventType: 'DEBIT',
          createdAt: {
            gte: new Date(log.createdAt.getTime() - 5000),
            lte: new Date(log.createdAt.getTime() + 5000),
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!ledger) {
        skipped += 1;
        continue;
      }

      const meta = parseLedgerMetadata(ledger.metadata);
      const providerCostUsd = meta.providerCostUsd ?? (ledger.costUsd != null ? Number(ledger.costUsd) : null);

      if (!providerCostUsd || providerCostUsd < 0.000001) {
        skipped += 1;
        continue;
      }

      const creditValueUsd = log.chargedCredits * 0.01;
      const platformMarginUsd = creditValueUsd - providerCostUsd;

      await this.prisma.aIUsageLog.update({
        where: { id: log.id },
        data: {
          costUsd: providerCostUsd,
          platformMarginUsd: platformMarginUsd > 0 ? platformMarginUsd : 0,
        },
      });
      updated += 1;
    }

    return { updated, skipped, processed: zeroCostLogs.length };
  }

  async backfillUsageFromLedger(params: { from?: string; to?: string; limit?: number } = {}) {
    const createdAt = buildDateRange(params);
    const limit = Math.min(params.limit ?? 500, 2000);

    const debits = await this.prisma.aICreditLedger.findMany({
      where: {
        eventType: 'DEBIT',
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    let created = 0;
    let skipped = 0;

    for (const debit of debits) {
      const meta = parseLedgerMetadata(debit.metadata);
      if (!meta.modelName && !meta.inputTokens) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.aIUsageLog.findFirst({
        where: {
          userId: debit.userId ?? undefined,
          tenantId: debit.tenantId ?? undefined,
          taskType: debit.taskType,
          createdAt: {
            gte: new Date(debit.createdAt.getTime() - 2000),
            lte: new Date(debit.createdAt.getTime() + 2000),
          },
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const costUsd = meta.providerCostUsd ?? (debit.costUsd != null ? Number(debit.costUsd) : 0);

      await this.prisma.aIUsageLog.create({
        data: {
          userId: debit.userId,
          tenantId: debit.tenantId,
          taskType: debit.taskType,
          mode: 'AUTO',
          modelProvider: resolveModelProvider(meta.modelName ?? 'unknown'),
          modelName: meta.modelName ?? 'unknown',
          inputTokens: meta.inputTokens ?? 0,
          outputTokens: meta.outputTokens ?? 0,
          costUsd,
          chargedCredits: debit.credits,
          status: 'SUCCESS',
        },
      });
      created += 1;
    }

    return { created, skipped, processed: debits.length };
  }

  /** Anthropic (Claude) spend grouped by task type — for Claude credits audit. */
  async getAnthropicUsageByTaskType(query: Pick<AdminAiDateFilters, 'from' | 'to' | 'tenantId'> = {}) {
    const createdAt = buildDateRange(query);
    const where: Prisma.AIUsageLogWhereInput = {
      status: 'SUCCESS',
      OR: [
        { modelProvider: 'anthropic' },
        { modelName: { startsWith: 'claude-' } },
      ],
      tenantId: query.tenantId || undefined,
      ...(createdAt ? { createdAt } : {}),
    };

    const rows = await this.prisma.aIUsageLog.groupBy({
      by: ['taskType', 'modelName', 'modelProvider'],
      where,
      _count: { id: true },
      _sum: {
        costUsd: true,
        chargedCredits: true,
        inputTokens: true,
        outputTokens: true,
      },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    const byTaskType = new Map<
      string,
      {
        taskType: string;
        requests: number;
        costUsd: number;
        chargedCredits: number;
        inputTokens: number;
        outputTokens: number;
        models: Array<{ modelName: string; modelProvider: string | null; requests: number; costUsd: number }>;
      }
    >();

    for (const row of rows) {
      const taskType = row.taskType ?? 'unknown';
      const entry = byTaskType.get(taskType) ?? {
        taskType,
        requests: 0,
        costUsd: 0,
        chargedCredits: 0,
        inputTokens: 0,
        outputTokens: 0,
        models: [],
      };
      const costUsd = Number(row._sum.costUsd ?? 0);
      entry.requests += row._count.id;
      entry.costUsd += costUsd;
      entry.chargedCredits += row._sum.chargedCredits ?? 0;
      entry.inputTokens += row._sum.inputTokens ?? 0;
      entry.outputTokens += row._sum.outputTokens ?? 0;
      entry.models.push({
        modelName: row.modelName ?? 'unknown',
        modelProvider: row.modelProvider,
        requests: row._count.id,
        costUsd,
      });
      byTaskType.set(taskType, entry);
    }

    const items = [...byTaskType.values()].sort((a, b) => b.costUsd - a.costUsd);
    const totals = items.reduce(
      (acc, item) => ({
        requests: acc.requests + item.requests,
        costUsd: acc.costUsd + item.costUsd,
        chargedCredits: acc.chargedCredits + item.chargedCredits,
        inputTokens: acc.inputTokens + item.inputTokens,
        outputTokens: acc.outputTokens + item.outputTokens,
      }),
      { requests: 0, costUsd: 0, chargedCredits: 0, inputTokens: 0, outputTokens: 0 },
    );

    return {
      provider: 'anthropic',
      totals: {
        ...totals,
        costUsd: Number(totals.costUsd.toFixed(6)),
      },
      byTaskType: items.map((item) => ({
        ...item,
        costUsd: Number(item.costUsd.toFixed(6)),
      })),
    };
  }

  /** Tenants whose persisted deep-analysis default is a Claude model. */
  async getTenantDeepAnalysisModelAudit() {
    const rows = await this.prisma.tenant.groupBy({
      by: ['deepAnalysisPremiumModelId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const byModel = rows.map((row) => ({
      deepAnalysisPremiumModelId: row.deepAnalysisPremiumModelId,
      tenantCount: row._count.id,
      isClaude: row.deepAnalysisPremiumModelId.startsWith('claude-'),
    }));

    const claudeTenants = byModel
      .filter((row) => row.isClaude)
      .reduce((sum, row) => sum + row.tenantCount, 0);

    return {
      schemaDefault: 'claude-opus-4-8',
      totalTenants: byModel.reduce((sum, row) => sum + row.tenantCount, 0),
      claudeTenantCount: claudeTenants,
      byModel,
    };
  }
}
