import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AiModule } from '@/ai/ai.module';
import { WorkflowModule } from '@/platform/workflow/workflow.module';
import { FeatureFlagsModule } from '@/platform/feature-flags/feature-flags.module';
import { ResearchPlanService } from './research-plan.service';
import { AuthorityRankingService } from './authority-ranking.service';
import { ContextAssemblerService } from './context-assembler.service';
import { CitationBindingService } from './citation-binding.service';
import { ResearchWorkflowService } from './research-workflow.service';
import { ResearchController } from './research.controller';
import { ResearchWorkspaceController } from './research-workspace.controller';
import { ResearchWorkspaceService } from './research-workspace.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AiModule),
    WorkflowModule,
    FeatureFlagsModule,
  ],
  controllers: [ResearchController, ResearchWorkspaceController],
  providers: [
    ResearchPlanService,
    AuthorityRankingService,
    ContextAssemblerService,
    CitationBindingService,
    ResearchWorkflowService,
    ResearchWorkspaceService,
  ],
  exports: [ResearchWorkflowService, ResearchWorkspaceService, AuthorityRankingService],
})
export class ResearchModule {}
