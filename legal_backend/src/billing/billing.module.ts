import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
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
import { LedesService } from './ledes.service';
import { TrustComplianceController } from './trust-compliance.controller';
import { TrustComplianceService } from './trust-compliance.service';

@Module({
  imports: [
    AutomationsModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me_dev_secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [
    InvoicesController,
    TrustController,
    TrustReconciliationController,
    TrustComplianceController,
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
    TrustComplianceService,
    StatementsService,
    DunningService,
    LedesService,
  ],
  exports: [
    InvoicesService,
    TrustService,
    RateTablesService,
    PreBillService,
    TrustReconciliationService,
    TrustComplianceService,
    StatementsService,
    LedesService,
  ],
})
export class BillingModule {}
