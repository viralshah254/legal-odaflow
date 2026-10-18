import { Module } from '@nestjs/common';
import { PasswordBreachService } from './password-breach.service';
import { PasswordPolicyService } from './password-policy.service';

@Module({
  providers: [PasswordBreachService, PasswordPolicyService],
  exports: [PasswordPolicyService],
})
export class PasswordModule {}
