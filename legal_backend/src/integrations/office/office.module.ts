import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { DocumentReviewModule } from '@/platform/document-review/document-review.module';
import { SeriesAModule } from '@/series-a/series-a.module';
import { OfficeController, CopilotOfficeController } from './office.controller';
import { OfficeService } from './office.service';
import { EmailContextService } from './email-context.service';
import { BillingNarrativeService } from './billing-narrative.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AiModule),
    forwardRef(() => DocumentReviewModule),
    forwardRef(() => SeriesAModule),
  ],
  controllers: [OfficeController, CopilotOfficeController],
  providers: [OfficeService, EmailContextService, BillingNarrativeService],
  exports: [OfficeService, EmailContextService, BillingNarrativeService],
})
export class OfficeModule {}
