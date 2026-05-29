import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoiceOverdueScheduler {
  private readonly logger = new Logger(InvoiceOverdueScheduler.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async markOverdueInvoices() {
    const count = await this.invoicesService.markOverdueAndDispatch();
    this.logger.log(`Invoice overdue cron completed: ${count} invoices updated`);
  }
}
