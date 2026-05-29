import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateClaimDto,
  CreateExpenseDto,
  CreateFixedCostDto,
  UpdateClaimDto,
  UpdateExpenseDto,
  UpdateFixedCostDto,
} from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findInvoices(tenantId: string, status?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: status || undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { name: true } },
      },
    });
    return invoices.map((inv) => ({
      ...inv,
      paymentLink: `/pay/${inv.id}`,
    }));
  }

  async findOutstandingInvoices(tenantId: string) {
    return this.findInvoicesByStatuses(tenantId, ['DRAFT', 'SENT']);
  }

  async findOverdueInvoices(tenantId: string) {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { not: 'PAID' },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
    });
    return invoices.map((inv) => ({ ...inv, paymentLink: `/pay/${inv.id}` }));
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return {
      ...invoice,
      paymentLink: `/pay/${invoice.id}`,
    };
  }

  async recordInvoicePayment(
    tenantId: string,
    invoiceId: string,
    dto: { amount: number; paymentMethod?: string },
  ) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        amount: new Prisma.Decimal(dto.amount),
        currency: invoice.currency,
        countryCode: 'IN',
        paymentProvider: 'manual',
        providerPaymentId: null,
        status: 'PAID',
        purpose: `INVOICE_PAYMENT:${invoiceId}`,
        metadata: {
          invoiceId,
          paymentMethod: dto.paymentMethod ?? 'manual',
          reconciled: false,
          paidAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID' },
    });

    const metadata = this.toMetadataObject(payment.metadata);
    return {
      id: payment.id,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(payment.amount),
      paidAt: metadata.paidAt ?? payment.createdAt.toISOString(),
      paymentMethod: metadata.paymentMethod ?? 'manual',
      reconciled: metadata.reconciled === 'true',
      clientId: invoice.clientId ?? undefined,
    };
  }

  async findPayments(tenantId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const invoiceIds = payments
      .map((payment) => this.toMetadataObject(payment.metadata).invoiceId)
      .filter((invoiceId): invoiceId is string => Boolean(invoiceId));
    const invoices = invoiceIds.length
      ? await this.prisma.invoice.findMany({
          where: { id: { in: Array.from(new Set(invoiceIds)) }, tenantId },
          select: {
            id: true,
            invoiceNumber: true,
            clientId: true,
          },
        })
      : [];
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    return payments.map((payment) => {
      const metadata = this.toMetadataObject(payment.metadata);
      const invoiceId = metadata.invoiceId;
      const invoice = invoiceId ? invoiceMap.get(invoiceId) : undefined;
      return {
        id: payment.id,
        invoiceId: invoiceId ?? '',
        invoiceNumber: invoice?.invoiceNumber,
        amount: Number(payment.amount),
        paidAt: metadata.paidAt ?? payment.createdAt.toISOString(),
        clientId: invoice?.clientId ?? undefined,
        paymentMethod: metadata.paymentMethod ?? undefined,
        reconciled: metadata.reconciled === 'true',
      };
    });
  }

  async setPaymentReconciled(tenantId: string, paymentId: string, reconciled: boolean) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const metadata = this.toMetadataObject(payment.metadata);
    metadata.reconciled = reconciled ? 'true' : 'false';

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
    const invoiceId = metadata.invoiceId ?? '';

    return {
      id: updated.id,
      invoiceId,
      amount: Number(updated.amount),
      paidAt: metadata.paidAt ?? updated.createdAt.toISOString(),
      paymentMethod: metadata.paymentMethod ?? undefined,
      reconciled,
    };
  }

  async createExpense(tenantId: string, dto: CreateExpenseDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    return this.prisma.expense.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        status: dto.status ?? 'DRAFT',
        expenseDate: dto.expenseDate,
      },
      include: { matter: true },
    });
  }

  async findExpenses(tenantId: string, matterId?: string, status?: string) {
    return this.prisma.expense.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        status: status || undefined,
      },
      include: { matter: true },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async updateExpense(
    tenantId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ) {
    await this.ensureExpense(tenantId, expenseId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: dto,
      include: { matter: true },
    });
  }

  async createClaim(tenantId: string, dto: CreateClaimDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    return this.prisma.claim.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        submitterId: dto.submitterId,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        status: dto.status ?? 'SUBMITTED',
      },
      include: { matter: true },
    });
  }

  async findClaims(tenantId: string, matterId?: string, status?: string) {
    return this.prisma.claim.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        status: status || undefined,
      },
      include: { matter: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClaim(tenantId: string, claimId: string, dto: UpdateClaimDto) {
    await this.ensureClaim(tenantId, claimId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    return this.prisma.claim.update({
      where: { id: claimId },
      data: dto,
      include: { matter: true },
    });
  }

  async createFixedCost(tenantId: string, dto: CreateFixedCostDto) {
    return this.prisma.fixedCost.create({
      data: {
        tenantId,
        name: dto.name,
        amount: dto.amount,
        currency: dto.currency,
        frequency: dto.frequency ?? 'MONTHLY',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findFixedCosts(tenantId: string, isActive?: string) {
    return this.prisma.fixedCost.findMany({
      where: {
        tenantId,
        isActive:
          isActive === undefined ? undefined : isActive === 'true',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateFixedCost(
    tenantId: string,
    fixedCostId: string,
    dto: UpdateFixedCostDto,
  ) {
    await this.ensureFixedCost(tenantId, fixedCostId);

    return this.prisma.fixedCost.update({
      where: { id: fixedCostId },
      data: dto,
    });
  }

  async getProfitAndLoss(tenantId: string, from?: string, to?: string) {
    const dateFilter: Prisma.ExpenseWhereInput = {};
    if (from || to) {
      dateFilter.expenseDate = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      };
    }

    const [expenses, claims, fixedCosts, invoices] = await Promise.all([
      this.prisma.expense.findMany({
        where: { tenantId, ...dateFilter },
      }),
      this.prisma.claim.findMany({
        where: {
          tenantId,
          status: { in: ['APPROVED', 'PAID'] },
          createdAt: from || to
            ? {
                gte: from ? new Date(from) : undefined,
                lte: to ? new Date(to) : undefined,
              }
            : undefined,
        },
      }),
      this.prisma.fixedCost.findMany({
        where: { tenantId, isActive: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['SENT', 'PAID'] },
          createdAt: from || to
            ? {
                gte: from ? new Date(from) : undefined,
                lte: to ? new Date(to) : undefined,
              }
            : undefined,
        },
      }),
    ]);

    const sum = (items: { amount: Prisma.Decimal }[]) =>
      items.reduce((total, item) => total + Number(item.amount), 0);

    const totalExpenses = sum(expenses);
    const totalClaims = sum(claims);
    const totalFixedCosts = sum(fixedCosts);
    const totalRevenue = sum(invoices);
    const totalCosts = totalExpenses + totalClaims + totalFixedCosts;

    return {
      period: { from: from ?? null, to: to ?? null },
      revenue: totalRevenue,
      expenses: totalExpenses,
      claims: totalClaims,
      fixedCosts: totalFixedCosts,
      totalCosts,
      netProfit: totalRevenue - totalCosts,
      currency: invoices[0]?.currency ?? expenses[0]?.currency ?? 'USD',
      counts: {
        expenses: expenses.length,
        claims: claims.length,
        fixedCosts: fixedCosts.length,
        invoices: invoices.length,
      },
    };
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
  }

  async getClientStatements(
    tenantId: string,
    clientId?: string,
    from?: string,
    to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const clientIds = [
      ...new Set(invoices.map((i) => i.clientId).filter((id): id is string => !!id)),
    ];
    const clients =
      clientIds.length > 0
        ? await this.prisma.client.findMany({
            where: { tenantId, id: { in: clientIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    const byClient = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        clientEmail: string | null;
        invoices: typeof invoices;
        totalInvoiced: number;
        totalPaid: number;
        balanceDue: number;
      }
    >();

    for (const inv of invoices) {
      const cid = inv.clientId ?? 'unknown';
      const client = clientMap.get(cid);
      const existing = byClient.get(cid) ?? {
        clientId: cid,
        clientName: client?.name ?? 'Unknown',
        clientEmail: client?.email ?? null,
        invoices: [] as typeof invoices,
        totalInvoiced: 0,
        totalPaid: 0,
        balanceDue: 0,
      };
      existing.invoices.push(inv);
      const amount = Number(inv.amount);
      existing.totalInvoiced += amount;
      if (inv.status === 'PAID') {
        existing.totalPaid += amount;
      } else if (inv.status !== 'VOID') {
        existing.balanceDue += amount;
      }
      byClient.set(cid, existing);
    }

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      clients: Array.from(byClient.values()),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
      })),
      summary: {
        clientCount: byClient.size,
        invoiceCount: invoices.length,
        totalBalanceDue: Array.from(byClient.values()).reduce(
          (sum, c) => sum + c.balanceDue,
          0,
        ),
      },
    };
  }

  private async ensureExpense(tenantId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
  }

  private async ensureClaim(tenantId: string, claimId: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, tenantId },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }
  }

  private async ensureFixedCost(tenantId: string, fixedCostId: string) {
    const fixedCost = await this.prisma.fixedCost.findFirst({
      where: { id: fixedCostId, tenantId },
    });

    if (!fixedCost) {
      throw new NotFoundException('Fixed cost not found');
    }
  }

  private async findInvoicesByStatuses(tenantId: string, statuses: string[]) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: statuses },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((inv) => ({ ...inv, paymentLink: `/pay/${inv.id}` }));
  }

  private toMetadataObject(metadata: Prisma.JsonValue | null): Record<string, string> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    return Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      } else if (typeof value === 'boolean') {
        acc[key] = value ? 'true' : 'false';
      } else if (value != null) {
        acc[key] = String(value);
      }
      return acc;
    }, {});
  }
}
