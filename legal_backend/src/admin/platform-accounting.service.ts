import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type RevenueSource = string;
export type ExpenseCategory = string;

export interface UpsertRevenueEntryInput {
  source: RevenueSource;
  grossAmount: number;
  taxAmount?: number;
  feeAmount?: number;
  currency: string;
  countryCode?: string;
  planId?: string;
  tenantId?: string;
  userId?: string;
  paymentProvider: string;
  /** Must be unique per provider; used for idempotent upsert */
  providerRef: string;
  description?: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  vendor?: string;
  description: string;
  amount: number;
  currency: string;
  taxAmount?: number;
  expenseDate: Date;
  isRecurring?: boolean;
  receiptUrl?: string;
  snapshotRef?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountingSummary {
  grossRevenue: number;
  taxCollected: number;
  fees: number;
  netRevenue: number;
  totalExpenses: number;
  netMargin: number;
  currency: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PlatformAccountingService {
  private readonly logger = new Logger(PlatformAccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Revenue ──────────────────────────────────────────────────────────────

  async upsertRevenueEntry(input: UpsertRevenueEntryInput) {
    const net = input.grossAmount - (input.taxAmount ?? 0) - (input.feeAmount ?? 0);
    await this.prisma.platformRevenueEntry.upsert({
      where: { providerRef: input.providerRef },
      create: {
        source: input.source,
        grossAmount: new Prisma.Decimal(input.grossAmount),
        taxAmount: new Prisma.Decimal(input.taxAmount ?? 0),
        feeAmount: new Prisma.Decimal(input.feeAmount ?? 0),
        netAmount: new Prisma.Decimal(net),
        currency: input.currency.toUpperCase(),
        countryCode: input.countryCode,
        planId: input.planId,
        tenantId: input.tenantId,
        userId: input.userId,
        paymentProvider: input.paymentProvider,
        providerRef: input.providerRef,
        description: input.description,
        occurredAt: input.occurredAt,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
      update: {},
    });
    this.logger.debug(`Revenue upsert [${input.source}] ref=${input.providerRef}`);
  }

  async listRevenue(query: {
    from?: string;
    to?: string;
    source?: string;
    country?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(query.limit ?? 50, 200);
    const skip = ((query.page ?? 1) - 1) * take;
    const occurredAt = buildDateRange(query.from, query.to);

    const where: Prisma.PlatformRevenueEntryWhereInput = {
      ...(occurredAt ? { occurredAt } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.country ? { countryCode: query.country } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.platformRevenueEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.platformRevenueEntry.count({ where }),
    ]);

    return { items, total, page: query.page ?? 1, limit: take };
  }

  async getRevenueSummary(from?: string, to?: string) {
    const occurredAt = buildDateRange(from, to);
    const where: Prisma.PlatformRevenueEntryWhereInput = occurredAt ? { occurredAt } : {};

    const rows = await this.prisma.platformRevenueEntry.groupBy({
      by: ['source'],
      where,
      _sum: { grossAmount: true, taxAmount: true, feeAmount: true, netAmount: true },
      _count: { id: true },
    });

    return rows.map((r) => ({
      source: r.source,
      count: r._count.id,
      grossAmount: Number(r._sum.grossAmount ?? 0),
      taxAmount: Number(r._sum.taxAmount ?? 0),
      feeAmount: Number(r._sum.feeAmount ?? 0),
      netAmount: Number(r._sum.netAmount ?? 0),
    }));
  }

  // ── Expenses ─────────────────────────────────────────────────────────────

  async createExpense(createdById: string, input: CreateExpenseInput) {
    return this.prisma.platformExpense.create({
      data: {
        category: input.category,
        vendor: input.vendor,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency.toUpperCase(),
        taxAmount: new Prisma.Decimal(input.taxAmount ?? 0),
        expenseDate: input.expenseDate,
        isRecurring: input.isRecurring ?? false,
        receiptUrl: input.receiptUrl,
        snapshotRef: input.snapshotRef,
        createdById,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async updateExpense(id: string, input: Partial<CreateExpenseInput>) {
    const expense = await this.prisma.platformExpense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    return this.prisma.platformExpense.update({
      where: { id },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.vendor !== undefined && { vendor: input.vendor }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amount !== undefined && { amount: new Prisma.Decimal(input.amount) }),
        ...(input.currency !== undefined && { currency: input.currency.toUpperCase() }),
        ...(input.taxAmount !== undefined && { taxAmount: new Prisma.Decimal(input.taxAmount) }),
        ...(input.expenseDate !== undefined && { expenseDate: input.expenseDate }),
        ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
        ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
        ...(input.snapshotRef !== undefined && { snapshotRef: input.snapshotRef }),
        ...(input.metadata !== undefined && { metadata: input.metadata as Prisma.InputJsonValue }),
      },
    });
  }

  async deleteExpense(id: string) {
    const expense = await this.prisma.platformExpense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    await this.prisma.platformExpense.delete({ where: { id } });
    return { deleted: true, id };
  }

  async listExpenses(query: { from?: string; to?: string; category?: string }) {
    const expenseDate = buildDateRange(query.from, query.to);
    return this.prisma.platformExpense.findMany({
      where: {
        ...(expenseDate ? { expenseDate } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: { expenseDate: 'desc' },
      take: 200,
    });
  }

  async getExpenseSummary(from?: string, to?: string) {
    const expenseDate = buildDateRange(from, to);
    const where: Prisma.PlatformExpenseWhereInput = expenseDate ? { expenseDate } : {};

    const rows = await this.prisma.platformExpense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true, taxAmount: true },
      _count: { id: true },
    });

    return rows.map((r) => ({
      category: r.category,
      count: r._count.id,
      amount: Number(r._sum.amount ?? 0),
      taxAmount: Number(r._sum.taxAmount ?? 0),
    }));
  }

  // ── Taxes ─────────────────────────────────────────────────────────────────

  async getTaxSummary(query: { from?: string; to?: string; country?: string }) {
    const occurredAt = buildDateRange(query.from, query.to);
    const where: Prisma.PlatformRevenueEntryWhereInput = {
      ...(occurredAt ? { occurredAt } : {}),
      ...(query.country ? { countryCode: query.country } : {}),
    };

    const rows = await this.prisma.platformRevenueEntry.groupBy({
      by: ['countryCode'],
      where,
      _sum: { taxAmount: true, grossAmount: true },
      _count: { id: true },
    });

    return rows.map((r) => ({
      countryCode: r.countryCode,
      transactions: r._count.id,
      grossAmount: Number(r._sum.grossAmount ?? 0),
      taxCollected: Number(r._sum.taxAmount ?? 0),
    }));
  }

  // ── Accounting Summary ────────────────────────────────────────────────────

  async getAccountingSummary(from?: string, to?: string): Promise<AccountingSummary> {
    const occurredAt = buildDateRange(from, to);
    const expenseDate = buildDateRange(from, to);

    const [revRows, expRows] = await Promise.all([
      this.prisma.platformRevenueEntry.aggregate({
        where: occurredAt ? { occurredAt } : {},
        _sum: { grossAmount: true, taxAmount: true, feeAmount: true, netAmount: true },
      }),
      this.prisma.platformExpense.aggregate({
        where: expenseDate ? { expenseDate } : {},
        _sum: { amount: true },
      }),
    ]);

    const grossRevenue = Number(revRows._sum.grossAmount ?? 0);
    const taxCollected = Number(revRows._sum.taxAmount ?? 0);
    const fees = Number(revRows._sum.feeAmount ?? 0);
    const netRevenue = Number(revRows._sum.netAmount ?? 0);
    const totalExpenses = Number(expRows._sum.amount ?? 0);
    const netMargin = netRevenue - totalExpenses;

    return { grossRevenue, taxCollected, fees, netRevenue, totalExpenses, netMargin, currency: 'USD' };
  }

  // ── Backfill helper (called from script) ─────────────────────────────────

  async backfillPayments(dryRun = false) {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'PAID' },
      orderBy: { createdAt: 'asc' },
    });

    let created = 0;
    let skipped = 0;

    for (const p of payments) {
      const providerRef = `payment:${p.id}`;
      const existing = await this.prisma.platformRevenueEntry.findUnique({
        where: { providerRef },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const source = mapPurposeToSource(p.purpose ?? '');

      if (!dryRun) {
        const gross = Number(p.amount);
        await this.prisma.platformRevenueEntry.create({
          data: {
            source,
            grossAmount: new Prisma.Decimal(gross),
            taxAmount: new Prisma.Decimal(0),
            feeAmount: new Prisma.Decimal(0),
            netAmount: new Prisma.Decimal(gross),
            currency: p.currency,
            countryCode: p.countryCode,
            tenantId: p.tenantId,
            userId: p.userId,
            paymentProvider: p.paymentProvider ?? 'unknown',
            providerRef,
            description: `Backfilled from Payment ${p.id}`,
            occurredAt: p.createdAt,
            metadata: { backfilled: true, paymentId: p.id } as Prisma.InputJsonValue,
          },
        });
      }
      created++;
    }

    return {
      total: payments.length,
      created,
      skipped,
      dryRun,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}

function mapPurposeToSource(purpose: string): RevenueSource {
  if (purpose === 'subscription') return 'subscription';
  if (purpose === 'AI_CREDIT_TOPUP') return 'credit_topup';
  if (purpose === 'lawyer_review') return 'lawyer_review';
  if (purpose === 'marketplace') return 'marketplace';
  return 'other';
}
