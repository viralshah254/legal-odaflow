import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { FeatureHandoffService } from './feature-handoff.service'
import { FeatureHandoffController } from './feature-handoff.controller'

@Module({
  imports: [PrismaModule],
  controllers: [FeatureHandoffController],
  providers: [FeatureHandoffService],
  exports: [FeatureHandoffService],
})
export class FeatureHandoffModule {}
