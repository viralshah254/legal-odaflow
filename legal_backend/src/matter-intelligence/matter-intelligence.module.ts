import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import {
  MatterArgumentsController,
  MatterFactsController,
  MatterIssuesController,
  MatterStrategyMemosController,
} from './matter-intelligence.controller';
import { MatterIntelligenceService } from './matter-intelligence.service';

@Module({
  imports: [AccessModule, MarketplaceModule],
  controllers: [
    MatterFactsController,
    MatterIssuesController,
    MatterArgumentsController,
    MatterStrategyMemosController,
  ],
  providers: [MatterIntelligenceService],
  exports: [MatterIntelligenceService],
})
export class MatterIntelligenceModule {}
