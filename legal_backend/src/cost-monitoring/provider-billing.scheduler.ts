import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProviderBillingReconciliationService } from './provider-billing-reconciliation.service';

@Injectable()
export class ProviderBillingScheduler {
  private readonly logger = new Logger(ProviderBillingScheduler.name);

  constructor(
    private readonly reconciliation: ProviderBillingReconciliationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async reconcilePreviousDay() {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const results = await this.reconciliation.reconcileDay(yesterday);
    this.logger.log(
      `Provider billing reconciliation completed for ${yesterday.toISOString().slice(0, 10)}: ${results.length} snapshot(s)`,
    );
  }
}
