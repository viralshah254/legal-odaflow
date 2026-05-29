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
}
