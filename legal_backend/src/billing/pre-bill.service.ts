import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PreBillService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    tenantId: string,
    userId: string,
    body: { matterId?: string; notes?: string },
  ) {
    const review = await this.getPreBillReview(tenantId, body.matterId);
    return this.prisma.preBillSession.create({
      data: {
        tenantId,
        matterId: body.matterId,
        notes: body.notes,
        createdBy: userId,
        status: 'DRAFT',
        adjustments: {
          create: review.lines.map((line) => ({
            timeEntryId: line.id,
            adjustedMinutes: line.minutes,
          })),
        },
      },
      include: { adjustments: true },
    });
  }

  async updateSession(
    tenantId: string,
    sessionId: string,
    body: {
      writeDownPercent?: number;
      notes?: string;
      adjustments?: Array<{
        timeEntryId: string;
        adjustedMinutes?: number;
        writeDownPercent?: number;
        notes?: string;
      }>;
    },
  ) {
    const session = await this.prisma.preBillSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Pre-bill session not found');

    if (body.adjustments?.length) {
      for (const adj of body.adjustments) {
        const existing = await this.prisma.preBillLineAdjustment.findFirst({
          where: { sessionId, timeEntryId: adj.timeEntryId },
        });
        if (existing) {
          await this.prisma.preBillLineAdjustment.update({
            where: { id: existing.id },
            data: {
              adjustedMinutes: adj.adjustedMinutes,
              writeDownPercent: adj.writeDownPercent
                ? new Prisma.Decimal(adj.writeDownPercent)
                : undefined,
              notes: adj.notes,
            },
          });
        } else {
          await this.prisma.preBillLineAdjustment.create({
            data: {
              sessionId,
              timeEntryId: adj.timeEntryId,
              adjustedMinutes: adj.adjustedMinutes,
              writeDownPercent: adj.writeDownPercent
                ? new Prisma.Decimal(adj.writeDownPercent)
                : undefined,
              notes: adj.notes,
            },
          });
        }
      }
    }

    return this.prisma.preBillSession.update({
      where: { id: sessionId },
      data: {
        writeDownPercent: body.writeDownPercent
          ? new Prisma.Decimal(body.writeDownPercent)
          : undefined,
        notes: body.notes,
      },
      include: { adjustments: true },
    });
  }

  async getPreBillReview(tenantId: string, matterId?: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      },
      include: { matter: { select: { id: true, title: true, clientId: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const lines = entries.map((entry) => {
      const rate = entry.rate ? Number(entry.rate.toString()) : 0;
      const hours = entry.minutes / 60;
      const amount = rate * hours;
      return {
        id: entry.id,
        matterId: entry.matterId,
        matterTitle: entry.matter?.title ?? 'Unassigned',
        userId: entry.userId,
        date: entry.date.toISOString(),
        minutes: entry.minutes,
        hours: Math.round(hours * 100) / 100,
        narrative: entry.narrative,
        billable: entry.billable,
        rate,
        amount: Math.round(amount * 100) / 100,
        status: entry.status,
      };
    });

    const billableLines = lines.filter((line) => line.billable);
    const totalHours = billableLines.reduce((sum, line) => sum + line.hours, 0);
    const totalAmount = billableLines.reduce((sum, line) => sum + line.amount, 0);
    const pendingApproval = lines.filter((line) => line.status !== 'APPROVED').length;

    return {
      matterId: matterId ?? null,
      summary: {
        entryCount: lines.length,
        billableHours: Math.round(totalHours * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        pendingApproval,
      },
      lines,
    };
  }

  generateLedesCsv(tenantId: string, matterId?: string): string {
    const header = [
      'INVOICE_DATE',
      'INVOICE_NUMBER',
      'CLIENT_ID',
      'LAW_FIRM_MATTER_ID',
      'LINE_ITEM_NUMBER',
      'LINE_ITEM_DATE',
      'TIMEKEEPER_ID',
      'LINE_ITEM_TYPE',
      'LINE_ITEM_UNITS',
      'LINE_ITEM_RATE',
      'LINE_ITEM_AMOUNT',
      'LINE_ITEM_DESCRIPTION',
    ].join(',');

    return `${header}\n`;
  }

  async buildLedesExport(tenantId: string, matterId?: string) {
    const review = await this.getPreBillReview(tenantId, matterId);
    const invoiceDate = new Date().toISOString().slice(0, 10);
    const invoiceNumber = `PREBILL-${Date.now()}`;

    const rows = review.lines
      .filter((line) => line.billable)
      .map((line, index) =>
        [
          invoiceDate,
          invoiceNumber,
          '',
          line.matterId ?? '',
          String(index + 1),
          line.date.slice(0, 10),
          line.userId,
          'F',
          line.hours.toFixed(2),
          line.rate.toFixed(2),
          line.amount.toFixed(2),
          `"${(line.narrative ?? '').replace(/"/g, '""')}"`,
        ].join(','),
      );

    const csv = `${this.generateLedesCsv(tenantId, matterId)}${rows.join('\n')}`;

    return {
      format: 'LEDES1998B',
      invoiceNumber,
      rowCount: rows.length,
      csv,
    };
  }
}
