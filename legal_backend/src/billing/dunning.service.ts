import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/notifications/notifications.service';

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processOverdueInvoices() {
    const overdue = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        dueDate: { lt: new Date() },
      },
      take: 100,
    });

    for (const invoice of overdue) {
      if (invoice.status === 'SENT') {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'OVERDUE' },
        });
      }

      const tenantUsers = await this.prisma.tenantUser.findMany({
        where: { tenantId: invoice.tenantId, role: { in: ['PARTNER_ADMIN', 'FINANCE'] } },
        take: 5,
      });

      for (const tu of tenantUsers) {
        await this.notifications.create(invoice.tenantId, {
          userId: tu.userId,
          type: 'INVOICE_OVERDUE',
          title: `Invoice ${invoice.invoiceNumber} is overdue`,
          body: `Amount ${invoice.amount} ${invoice.currency} — follow up with client.`,
          metadata: { invoiceId: invoice.id },
        });
      }
    }

    this.logger.log(`Dunning processed ${overdue.length} overdue invoices`);
    return { processed: overdue.length };
  }
}
