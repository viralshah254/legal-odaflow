import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { VerificationModule } from '@/platform/verification/verification.module';
import { AiModule } from '@/ai/ai.module';
import { WorkflowModule } from '@/platform/workflow/workflow.module';
import { DraftSectionStateMachineService } from './draft-section-state-machine.service';
import { ProceduralGateService } from './procedural-gate.service';
import { DraftPlannerService } from './draft-planner.service';
import { AdversarialReviewService } from './adversarial-review.service';
import { TargetedRepairService } from './targeted-repair.service';
import { DraftOrchestrationService } from './draft-orchestration.service';
import { DraftController } from './draft.controller';

@Module({
  imports: [PrismaModule, VerificationModule, forwardRef(() => AiModule), WorkflowModule],
  controllers: [DraftController],
  providers: [
    ProceduralGateService,
    DraftPlannerService,
    AdversarialReviewService,
    TargetedRepairService,
    DraftOrchestrationService,
    DraftSectionStateMachineService,
  ],
  exports: [DraftOrchestrationService, ProceduralGateService, DraftSectionStateMachineService, VerificationModule],
})
export class DraftingModule {}
