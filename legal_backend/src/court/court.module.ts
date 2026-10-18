import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { CalendarModule } from '@/calendar/calendar.module';
import { JobsModule } from '@/jobs/jobs.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import {
  CourtCaseController,
  CourtLookupController,
  MatterCourtController,
} from './court.controller';
import { CourtService } from './court.service';

@Module({
  imports: [AccessModule, CalendarModule, JobsModule, LegalSourcesModule],
  controllers: [MatterCourtController, CourtCaseController, CourtLookupController],
  providers: [CourtService],
  exports: [CourtService],
})
export class CourtModule {}
