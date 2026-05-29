import { Module } from '@nestjs/common';
import { CreditsModule } from '@/credits/credits.module';
import { PaymentsModule } from '@/payments/payments.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [CreditsModule, PaymentsModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
