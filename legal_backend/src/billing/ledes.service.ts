import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * LEDES 98B (Legal Electronic Data Exchange Standard) export service.
 * Spec: https://www.ledes.org/standards/ledes-98b/
 *
 * UTBMS Phase codes: L100–L600 (litigation), B100–B600 (bankruptcy),
 * M100–M800 (non-litigation/advisory), P100–P500 (project/corporate),
 * C100–C400 (counselling)
 */

const LEDES_HEADER = [
  'LEDES98B',
  'INVOICE_DATE',
  'INVOICE_NUMBER',
  'CLIENT_ID',
  'LAW_FIRM_MATTER_ID',
  'INVOICE_TOTAL',
  'BILLING_START_DATE',
  'BILLING_END_DATE',
  'INVOICE_DESCRIPTION',
  'LINE_ITEM_NUMBER',
  'EXP/FEE/INV_ADJ_TYPE',
  'LINE_ITEM_NUMBER_OF_UNITS',
  'LINE_ITEM_ADJUSTMENT_AMOUNT',
  'LINE_ITEM_TOTAL',
  'LINE_ITEM_DATE',
  'LINE_ITEM_TASK_CODE',
  'LINE_ITEM_EXPENSE_CODE',
  'LINE_ITEM_ACTIVITY_CODE',
  'TIMEKEEPER_ID',
  'TIMEKEEPER_NAME',
  'LINE_ITEM_DESCRIPTION',
  'LAW_FIRM_ID',
  'LINE_ITEM_UNIT_COST',
  'TIMEKEEPER_CLASSIFICATION',
  'CLIENT_MATTER_ID',
].join('|');

@Injectable()
export class LedesService {
  constructor(private readonly prisma: PrismaService) {}

  async exportInvoice98B(tenantId: string, invoiceId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    // Get time entries for this invoice by matching matter/client
    // In a full LEDES implementation, invoiceId would be linked to time entries
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { tenantId, status: 'APPROVED' },
      include: {
        matter: {
          select: { id: true, title: true, caseNumber: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const invoiceDate = this.formatLedesDate(invoice.createdAt);
    const billingStart =
      timeEntries.length > 0
        ? this.formatLedesDate(timeEntries[0].date)
        : invoiceDate;
    const billingEnd =
      timeEntries.length > 0
        ? this.formatLedesDate(timeEntries[timeEntries.length - 1].date)
        : invoiceDate;

    const lines: string[] = [LEDES_HEADER];

    timeEntries.forEach((entry, idx) => {
      const hours = (entry.minutes / 60).toFixed(2);
      const rate = entry.rate ? Number(entry.rate) : 0;
      const lineTotal = (Number(hours) * rate).toFixed(2);

      const line = [
        '', // LEDES98B (repeated on each line per spec)
        invoiceDate,
        invoice.invoiceNumber,
        invoice.clientId ?? '',
        entry.matter?.id ?? '',
        idx === 0 ? Number(invoice.amount).toFixed(2) : '', // Total only on first line
        billingStart,
        billingEnd,
        invoice.invoiceNumber,
        (idx + 1).toString(),
        'F', // F=Fee, E=Expense, IF=Invoice Fee Adjustment
        hours,
        '0.00', // Adjustment
        lineTotal,
        this.formatLedesDate(entry.date),
        entry.utbmsTaskCode ?? 'L190', // Default: Other Case Assessment
        '', // Expense code (blank for time entries)
        entry.utbmsActivityCode ?? 'A101', // Default: Plan and prepare
        entry.userId,
        '', // Timekeeper name — would need join
        (entry.narrative ?? 'Legal Services').replace(/\|/g, '/').slice(0, 255),
        tenantId.slice(0, 20), // Law firm ID
        rate.toFixed(2),
        this.resolveTimekeeperClass(entry.utbmsPhaseCode),
        entry.matter?.caseNumber ?? '',
      ].join('|');

      lines.push(line);
    });

    return lines.join('\n');
  }

  private formatLedesDate(date: Date): string {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  private resolveTimekeeperClass(phaseCode?: string | null): string {
    if (!phaseCode) return 'AT'; // Attorney
    if (phaseCode.startsWith('L')) return 'AT';
    if (phaseCode.startsWith('B')) return 'AT';
    if (phaseCode.startsWith('C')) return 'CL'; // Clerk
    if (phaseCode.startsWith('P')) return 'PL'; // Paralegal
    return 'AT';
  }
}
