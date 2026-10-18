import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AudienceContextService } from './audience-context.service'
import { ConsumerLawyerHandoffService } from './consumer-lawyer-handoff.service'
import { AudienceController } from './audience.controller'
import { ConsumerLawyerHandoffController } from './consumer-lawyer-handoff.controller'

@Module({
  imports: [PrismaModule],
  controllers: [AudienceController, ConsumerLawyerHandoffController],
  providers: [AudienceContextService, ConsumerLawyerHandoffService],
  exports: [AudienceContextService, ConsumerLawyerHandoffService],
})
export class AudienceModule {}
