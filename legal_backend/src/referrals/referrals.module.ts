import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralFraudService } from './referral-fraud.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralFraudService],
  exports: [ReferralsService, ReferralFraudService],
})
export class ReferralsModule {}
