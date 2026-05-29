import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { AiModule } from '@/ai/ai.module';
import { TasksModule } from '@/tasks/tasks.module';
import { MatterOutcomeController } from './matter-outcome.controller';
import { MatterOutcomeV2Controller } from './matter-outcome-v2.controller';
import { MatterOutcomeService } from './matter-outcome.service';

@Module({
  imports: [AccessModule, AiModule, TasksModule],
  controllers: [MatterOutcomeController, MatterOutcomeV2Controller],
  providers: [MatterOutcomeService],
  exports: [MatterOutcomeService],
})
export class MatterOutcomeModule {}
