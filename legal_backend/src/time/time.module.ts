import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '@/billing/billing.module';
import { TimeController } from './time.controller';
import { TimeService } from './time.service';

@Module({
  imports: [forwardRef(() => BillingModule)],
  controllers: [TimeController],
  providers: [TimeService],
  exports: [TimeService],
})
export class TimeModule {}
