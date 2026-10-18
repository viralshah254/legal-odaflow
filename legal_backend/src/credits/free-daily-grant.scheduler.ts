import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { resolveDailyFreeConsumerCredits } from '@/config/pricing.config';

/**
 * Adds daily free credits to every free (no active subscription) consumer
 * once per day at midnight UTC. Consumers with an active paid subscription are
 * explicitly excluded — they receive credits through their plan grant only.
 * Unused free credits carry over; each day adds DAILY_FREE_CONSUMER_CREDITS
 * on top of the existing balance.
 */
@Injectable()
export class FreeDailyGrantScheduler {
  private readonly logger = new Logger(FreeDailyGrantScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly creditLedger: AICreditLedgerService,
  ) {}

  @Cron('0 0 * * *', { name: 'free-consumer-daily-grant', timeZone: 'UTC' })
  async grantDailyFreeCredits() {
    const dailyCredits = resolveDailyFreeConsumerCredits(
      this.config.get<string>('DAILY_FREE_CONSUMER_CREDITS'),
    );

    const freeProfiles = await this.prisma.consumerProfile.findMany({
      where: { subscriptionStatus: 'FREE' },
      select: { userId: true },
    });

    if (freeProfiles.length === 0) {
      this.logger.log('Daily free credit grant: no free consumers found, skipping.');
      return;
    }

    const userIds = freeProfiles.map((p) => p.userId);

    const activeSubUserIds = await this.prisma.subscription
      .findMany({
        where: { userId: { in: userIds }, userType: 'CONSUMER', status: 'ACTIVE' },
        select: { userId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.userId)));

    const eligibleIds = userIds.filter((id) => !activeSubUserIds.has(id));

    if (eligibleIds.length === 0) {
      this.logger.log(
        'Daily free credit grant: all free profiles have active subscriptions, skipping.',
      );
      return;
    }

    let granted = 0;
    for (const userId of eligibleIds) {
      try {
        await this.creditLedger.credit({
          userId,
          taskType: 'daily_free_grant',
          credits: dailyCredits,
          metadata: { source: 'free_daily_grant_scheduler' },
        });
        granted++;
      } catch (err) {
        this.logger.warn(`Daily grant failed for user ${userId}: ${String(err)}`);
      }
    }

    const creditUsd = Number(this.config.get<string>('AI_CREDIT_USD_VALUE', '0.06'));
    this.logger.log(
      `Daily free credit grant: added ${dailyCredits} credits to ${granted}/${eligibleIds.length} ` +
        `free consumer(s) ($${(dailyCredits * creditUsd).toFixed(2)} each).`,
    );
  }
}
