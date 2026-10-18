import { Global, Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [EncryptionService, CaptchaService],
  exports: [EncryptionService, CaptchaService],
})
export class SecurityModule {}
