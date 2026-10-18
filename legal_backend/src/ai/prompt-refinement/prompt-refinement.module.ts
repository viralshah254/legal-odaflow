import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { PromptRefinementController } from './prompt-refinement.controller';
import { PromptRefinementService } from './prompt-refinement.service';

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [PromptRefinementController],
  providers: [PromptRefinementService],
  exports: [PromptRefinementService],
})
export class PromptRefinementModule {}
