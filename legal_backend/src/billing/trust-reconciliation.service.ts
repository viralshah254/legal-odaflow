import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TrustReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, accountId?: string) {
    return this.prisma.trustReconciliation.findMany({
      where: { tenantId, accountId: accountId || undefined },
      orderBy: { periodEnd: 'desc' },
      take: 50,
    });
  }

  async create(
    tenantId: string,
    accountId: string,
    periodStart: Date,
    periodEnd: Date,
    userId?: string,
  ) {
    const account = await this.prisma.trustAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Trust account not found');
    }

    const entries = await this.prisma.trustLedgerEntry.findMany({
      where: {
        accountId,
        createdAt: { gte: periodStart, lte: periodEnd },
        status: 'COMPLETED',
      },
    });

    const netChange = entries.reduce((sum, e) => {
      const amt = Number(e.amount.toString());
      return sum + (e.type === 'DEPOSIT' ? amt : -amt);
    }, 0);

    const openingBalance = Number(account.balance.toString()) - netChange;
    const closingBalance = Number(account.balance.toString());

    return this.prisma.trustReconciliation.create({
      data: {
        tenantId,
        accountId,
        periodStart,
        periodEnd,
        openingBalance: new Prisma.Decimal(openingBalance),
        closingBalance: new Prisma.Decimal(closingBalance),
        status: 'OPEN',
        reconciledBy: userId,
      },
    });
  }

  async close(tenantId: string, reconciliationId: string, userId: string, notes?: string) {
    const row = await this.prisma.trustReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Reconciliation not found');
    }

    return this.prisma.trustReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'CLOSED',
        reconciledBy: userId,
        reconciledAt: new Date(),
        notes,
      },
    });
  }

  buildStatementPdfData(tenantId: string, reconciliationId: string) {
    return this.prisma.trustReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
      include: {
        tenant: { select: { name: true } },
      },
    });
  }
}
