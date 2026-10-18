import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { LegalUpdatesService } from './legal-updates.service';
import { LegalUpdatesController } from './legal-updates.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LegalUpdatesController],
  providers: [LegalUpdatesService],
  exports: [LegalUpdatesService],
})
export class LegalUpdatesModule {}
