import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UnitEconomicsService } from './unit-economics.service';

@Injectable()
export class UnitEconomicsScheduler {
  private readonly logger = new Logger(UnitEconomicsScheduler.name);

  constructor(private readonly unitEconomicsService: UnitEconomicsService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async snapshotWeeklyEconomics() {
    const result = await this.unitEconomicsService.snapshotWeekly();
    this.logger.log(
      `Unit economics weekly snapshot completed: ${result.count} plan rows for ${result.periodStart.toISOString()} – ${result.periodEnd.toISOString()}`,
    );
  }
}
