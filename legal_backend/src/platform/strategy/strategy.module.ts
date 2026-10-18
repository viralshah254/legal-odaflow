import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AiModule } from '@/ai/ai.module'
import { StrategyService } from './strategy.service'
import { StrategyController } from './strategy.controller'
import { HearingPrepService } from './hearing-prep.service'
import { DiscoveryService } from './discovery.service'
import { NegotiationService } from './negotiation.service'
import { FilingService } from './filing.service'

@Module({
  imports: [PrismaModule, forwardRef(() => AiModule)],
  controllers: [StrategyController],
  providers: [StrategyService, HearingPrepService, DiscoveryService, NegotiationService, FilingService],
  exports: [StrategyService, HearingPrepService, DiscoveryService, NegotiationService, FilingService],
})
export class StrategyModule {}
