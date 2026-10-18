import { Module } from '@nestjs/common';
import { AiSafetyController } from './ai-safety.controller';
import { AiSafetyService } from './ai-safety.service';
import { PlatformSecurityModule } from '../security/platform-security.module';

@Module({
  imports: [PlatformSecurityModule],
  controllers: [AiSafetyController],
  providers: [AiSafetyService],
  exports: [AiSafetyService],
})
export class AiSafetyModule {}
