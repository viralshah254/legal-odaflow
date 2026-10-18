import { Module, forwardRef } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { AiModule } from '@/ai/ai.module';
import {
  MatterArgumentsController,
  MatterFactsController,
  MatterIssuesController,
  MatterOpponentAnalysisController,
  MatterSimilarCasesController,
  MatterStrategyMemosController,
} from './matter-intelligence.controller';
import { MatterIntelligenceService } from './matter-intelligence.service';
import { MatterAnalysisService } from './matter-analysis.service';

@Module({
  imports: [AccessModule, MarketplaceModule, forwardRef(() => AiModule)],
  controllers: [
    MatterFactsController,
    MatterIssuesController,
    MatterArgumentsController,
    MatterStrategyMemosController,
    MatterSimilarCasesController,
    MatterOpponentAnalysisController,
  ],
  providers: [MatterIntelligenceService, MatterAnalysisService],
  exports: [MatterIntelligenceService, MatterAnalysisService],
})
export class MatterIntelligenceModule {}
