import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientStatement(tenantId: string, clientId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, clientId: clientId || undefined },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const now = Date.now();
    const buckets = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      over90: 0,
    };

    const lines = invoices
      .filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
      .map((inv) => {
        const amount = Number(inv.amount.toString());
        const due = inv.dueDate ? inv.dueDate.getTime() : now;
        const daysPast = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));

        if (daysPast <= 0) buckets.current += amount;
        else if (daysPast <= 30) buckets.days1_30 += amount;
        else if (daysPast <= 60) buckets.days31_60 += amount;
        else if (daysPast <= 90) buckets.days61_90 += amount;
        else buckets.over90 += amount;

        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount,
          currency: inv.currency,
          status: inv.status,
          dueDate: inv.dueDate?.toISOString() ?? null,
          daysPastDue: daysPast,
        };
      });

    const totalOutstanding = Object.values(buckets).reduce((a, b) => a + b, 0);

    return {
      clientId: clientId ?? null,
      generatedAt: new Date().toISOString(),
      aging: buckets,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      lines,
    };
  }

  async getClientStatementPdfText(tenantId: string, clientId?: string) {
    const statement = await this.getClientStatement(tenantId, clientId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const clientName = clientId
      ? (
          await this.prisma.client.findFirst({
            where: { id: clientId, tenantId },
            select: { name: true },
          })
        )?.name ?? clientId
      : 'All Clients';

    const lines = [
      'CLIENT STATEMENT',
      '================',
      `Firm: ${tenant?.name ?? tenantId}`,
      `Client: ${clientName}`,
      `Generated: ${statement.generatedAt}`,
      '',
      'AGING SUMMARY',
      '-------------',
      `Current:     ${statement.aging.current.toFixed(2)}`,
      `1-30 days:   ${statement.aging.days1_30.toFixed(2)}`,
      `31-60 days:  ${statement.aging.days31_60.toFixed(2)}`,
      `61-90 days:  ${statement.aging.days61_90.toFixed(2)}`,
      `Over 90:     ${statement.aging.over90.toFixed(2)}`,
      '',
      `Total Outstanding: ${statement.totalOutstanding.toFixed(2)}`,
      '',
      'OPEN INVOICES',
      '-------------',
    ];

    if (statement.lines.length === 0) {
      lines.push('No open invoices.');
    } else {
      for (const line of statement.lines) {
        lines.push(
          `${line.invoiceNumber} | ${line.amount.toFixed(2)} ${line.currency} | Due ${line.dueDate?.slice(0, 10) ?? 'N/A'} | ${line.daysPastDue} days past due | ${line.status}`,
        );
      }
    }

    return lines.join('\n');
  }
}
