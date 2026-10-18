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
    return this.getStatementText(tenantId, reconciliationId);
  }

  async getStatementText(tenantId: string, reconciliationId: string) {
    const row = await this.prisma.trustReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
      include: {
        tenant: { select: { name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Reconciliation not found');
    }

    const account = await this.prisma.trustAccount.findFirst({
      where: { id: row.accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Trust account not found');
    }

    const entries = await this.prisma.trustLedgerEntry.findMany({
      where: {
        accountId: row.accountId,
        createdAt: { gte: row.periodStart, lte: row.periodEnd },
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
    });

    const lines = [
      'TRUST ACCOUNT STATEMENT',
      '=======================',
      `Firm: ${row.tenant.name}`,
      `Account: ${account.name}`,
      `Period: ${row.periodStart.toISOString().slice(0, 10)} to ${row.periodEnd.toISOString().slice(0, 10)}`,
      `Status: ${row.status}`,
      '',
      'BALANCES',
      '--------',
      `Opening Balance: ${Number(row.openingBalance.toString()).toFixed(2)} ${account.currency}`,
      `Closing Balance: ${Number(row.closingBalance.toString()).toFixed(2)} ${account.currency}`,
      '',
      'TRANSACTIONS',
      '------------',
    ];

    if (entries.length === 0) {
      lines.push('No completed transactions in this period.');
    } else {
      for (const entry of entries) {
        const sign = entry.type === 'DEPOSIT' || entry.type === 'TRANSFER_IN' ? '+' : '-';
        lines.push(
          `${entry.createdAt.toISOString().slice(0, 10)} | ${entry.type} | ${sign}${Number(entry.amount.toString()).toFixed(2)} ${account.currency} | ${entry.description ?? ''}`,
        );
      }
    }

    if (row.notes) {
      lines.push('', 'NOTES', '-----', row.notes);
    }

    const text = lines.join('\n');

    return {
      reconciliationId: row.id,
      accountId: row.accountId,
      accountName: account.name,
      currency: account.currency,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      openingBalance: Number(row.openingBalance.toString()),
      closingBalance: Number(row.closingBalance.toString()),
      status: row.status,
      transactionCount: entries.length,
      text,
    };
  }
}
