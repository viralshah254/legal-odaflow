import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { getOpenAiApiMode } from '@/ai/openai-transport';
import { PrismaService } from '@/prisma/prisma.service';
import { parseLedgerMetadata } from '@/admin/admin-ai-observability.util';

@Injectable()
export class ProviderBillingReconciliationService {
  private readonly logger = new Logger(ProviderBillingReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }

  async computePlatformCostForDay(date: Date): Promise<number> {
    const start = this.startOfDay(date);
    const end = this.endOfDay(date);

    const [usageAgg, ledgerRows] = await Promise.all([
      this.prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: start, lte: end }, status: 'SUCCESS' },
        _sum: { costUsd: true },
      }),
      this.prisma.aICreditLedger.findMany({
        where: {
          eventType: 'DEBIT',
          createdAt: { gte: start, lte: end },
        },
        select: { metadata: true, costUsd: true },
      }),
    ]);

    let ledgerCost = 0;
    for (const row of ledgerRows) {
      const meta = parseLedgerMetadata(row.metadata);
      ledgerCost +=
        meta.providerCostUsd ??
        (row.costUsd != null ? Number(row.costUsd) : 0);
    }

    const usageCost = Number(usageAgg._sum.costUsd ?? 0);
    return Math.max(usageCost, ledgerCost);
  }

  async fetchOpenAiReportedCost(date: Date): Promise<number | null> {
    if (getOpenAiApiMode(this.configService) === 'azure') {
      this.logger.log(
        'Skipping OpenAI org costs reconciliation: OPENAI_API_MODE=azure (Azure Cost Management not wired)',
      );
      return null;
    }

    const adminKey = this.configService.get<string>('OPENAI_ADMIN_API_KEY');
    if (!adminKey) return null;

    const start = Math.floor(this.startOfDay(date).getTime() / 1000);
    const end = Math.floor(this.endOfDay(date).getTime() / 1000);

    try {
      const response = await fetch(
        `https://api.openai.com/v1/organization/costs?start_time=${start}&end_time=${end}&bucket_width=1d`,
        {
          headers: {
            Authorization: `Bearer ${adminKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!response.ok) {
        this.logger.warn(`OpenAI costs API returned ${response.status}`);
        return null;
      }
      const payload = (await response.json()) as {
        data?: Array<{ results?: Array<{ amount?: { value?: number } }> }>;
      };
      let total = 0;
      for (const bucket of payload.data ?? []) {
        for (const result of bucket.results ?? []) {
          total += result.amount?.value ?? 0;
        }
      }
      return total;
    } catch (err) {
      this.logger.warn(`OpenAI costs API failed: ${String(err)}`);
      return null;
    }
  }

  async reconcileDay(date: Date) {
    const periodDate = this.startOfDay(date);
    const computedUsd = await this.computePlatformCostForDay(date);
    const openAiReported = await this.fetchOpenAiReportedCost(date);

    const snapshots: Array<{
      provider: string;
      reportedUsd: number;
      computedUsd: number;
    }> = [];

    if (openAiReported != null) {
      snapshots.push({
        provider: 'openai',
        reportedUsd: openAiReported,
        computedUsd,
      });
    } else {
      snapshots.push({
        provider: 'platform',
        reportedUsd: computedUsd,
        computedUsd,
      });
    }

    const results = [];
    for (const snap of snapshots) {
      const varianceUsd = snap.reportedUsd - snap.computedUsd;
      const variancePercent =
        snap.computedUsd > 0
          ? Number(((varianceUsd / snap.computedUsd) * 100).toFixed(2))
          : null;

      const row = await this.prisma.providerBillingSnapshot.upsert({
        where: {
          provider_periodDate: {
            provider: snap.provider,
            periodDate,
          },
        },
        create: {
          provider: snap.provider,
          periodDate,
          reportedUsd: new Prisma.Decimal(snap.reportedUsd),
          computedUsd: new Prisma.Decimal(snap.computedUsd),
          varianceUsd: new Prisma.Decimal(varianceUsd),
          variancePercent:
            variancePercent != null
              ? new Prisma.Decimal(variancePercent)
              : null,
        },
        update: {
          reportedUsd: new Prisma.Decimal(snap.reportedUsd),
          computedUsd: new Prisma.Decimal(snap.computedUsd),
          varianceUsd: new Prisma.Decimal(varianceUsd),
          variancePercent:
            variancePercent != null
              ? new Prisma.Decimal(variancePercent)
              : null,
        },
      });
      results.push(row);
    }

    return results;
  }

  async listSnapshots(limit = 30) {
    const rows = await this.prisma.providerBillingSnapshot.findMany({
      orderBy: { periodDate: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      periodDate: r.periodDate,
      reportedUsd: Number(r.reportedUsd),
      computedUsd: Number(r.computedUsd),
      varianceUsd: Number(r.varianceUsd),
      variancePercent: r.variancePercent != null ? Number(r.variancePercent) : null,
      createdAt: r.createdAt,
    }));
  }
}
