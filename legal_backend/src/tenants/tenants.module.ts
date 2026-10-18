import { Module } from '@nestjs/common';
import { CreditsModule } from '@/credits/credits.module';
import { PaymentsModule } from '@/payments/payments.module';
import { PasswordModule } from '@/auth/password/password.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [CreditsModule, PaymentsModule, PasswordModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
