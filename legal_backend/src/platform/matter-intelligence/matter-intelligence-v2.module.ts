import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MatterFactService } from './matter-fact.service';
import { ContradictionDetectionService } from './contradiction-detection.service';
import { TimelineService } from './timeline.service';
import { IssueTrackerService } from './issue-tracker.service';
import { LegalMemoryService } from './legal-memory.service';
import { MatterIntelligenceV2Controller } from './matter-intelligence-v2.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => AiModule)],
  controllers: [MatterIntelligenceV2Controller],
  providers: [
    MatterFactService,
    ContradictionDetectionService,
    TimelineService,
    IssueTrackerService,
    LegalMemoryService,
  ],
  exports: [
    MatterFactService,
    ContradictionDetectionService,
    TimelineService,
    IssueTrackerService,
    LegalMemoryService,
  ],
})
export class MatterIntelligenceV2Module {}
