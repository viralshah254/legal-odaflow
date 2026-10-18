import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { VerificationModule } from '@/platform/verification/verification.module'
import { AiModule } from '@/ai/ai.module'
import { JobsModule } from '@/jobs/jobs.module'
import { ReVerificationService } from './re-verification.service'
import { FirmLearningService } from './firm-learning.service'
import { LegalUpdateIngestService } from './legal-update-ingest.service'

@Module({
  imports: [PrismaModule, VerificationModule, forwardRef(() => AiModule), JobsModule],
  providers: [ReVerificationService, FirmLearningService, LegalUpdateIngestService],
  exports: [ReVerificationService, FirmLearningService, LegalUpdateIngestService],
})
export class ContinuousModule {}
