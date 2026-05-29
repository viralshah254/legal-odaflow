import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import {
  CourtCaseController,
  CourtLookupController,
  MatterCourtController,
} from './court.controller';
import { CourtService } from './court.service';

@Module({
  imports: [AccessModule, LegalSourcesModule],
  controllers: [MatterCourtController, CourtCaseController, CourtLookupController],
  providers: [CourtService],
  exports: [CourtService],
})
export class CourtModule {}
