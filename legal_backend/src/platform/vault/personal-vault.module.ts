import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PlatformSecurityModule } from '@/platform/security/platform-security.module';
import { PersonalVaultController } from './personal-vault.controller';
import { PersonalVaultService } from './personal-vault.service';

@Module({
  imports: [PrismaModule, PlatformSecurityModule],
  controllers: [PersonalVaultController],
  providers: [PersonalVaultService],
  exports: [PersonalVaultService],
})
export class PersonalVaultModule {}
