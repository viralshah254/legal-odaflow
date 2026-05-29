import { Module } from '@nestjs/common';
import { AutomationsModule } from '@/automations/automations.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { InvoiceOverdueScheduler } from './invoice-overdue.scheduler';
import { InvoicesController } from './invoices.controller';
import { InvoicesService, TrustService } from './invoices.service';
import { PreBillController } from './pre-bill.controller';
import { PreBillService } from './pre-bill.service';
import { RateTablesController } from './rate-tables.controller';
import { RateTablesService } from './rate-tables.service';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';
import { TrustController } from './trust.controller';
import { TrustReconciliationController } from './trust-reconciliation.controller';
import { TrustReconciliationService } from './trust-reconciliation.service';
import { DunningService } from './dunning.service';

@Module({
  imports: [AutomationsModule, NotificationsModule],
  controllers: [
    InvoicesController,
    TrustController,
    TrustReconciliationController,
    RateTablesController,
    PreBillController,
    StatementsController,
  ],
  providers: [
    InvoicesService,
    TrustService,
    InvoiceOverdueScheduler,
    RateTablesService,
    PreBillService,
    TrustReconciliationService,
    StatementsService,
    DunningService,
  ],
  exports: [
    InvoicesService,
    TrustService,
    RateTablesService,
    PreBillService,
    TrustReconciliationService,
    StatementsService,
  ],
})
export class BillingModule {}
