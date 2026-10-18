import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AiModule } from '@/ai/ai.module';
import { JobsModule } from '@/jobs/jobs.module';
import { DocumentParserService } from './document-parser.service';
import { ObligationExtractorService } from './obligation-extractor.service';
import { ReviewFindingsService } from './review-findings.service';
import { PlaybookComparisonService } from './playbook-comparison.service';
import { ContractIntelligenceService } from './contract-intelligence.service';
import { DocumentReviewOrchestrationService } from './document-review-orchestration.service';
import { ContractManagementService } from './contract-management.service';
import { DocumentReviewController } from './document-review.controller';
import { ObligationMonitorService } from './obligation-monitor.service';
import { RedlineExportService } from './redline-export.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AiModule), JobsModule],
  controllers: [DocumentReviewController],
  providers: [
    DocumentParserService,
    ObligationExtractorService,
    ReviewFindingsService,
    PlaybookComparisonService,
    ContractIntelligenceService,
    DocumentReviewOrchestrationService,
    ContractManagementService,
    ObligationMonitorService,
    RedlineExportService,
  ],
  exports: [
    DocumentReviewOrchestrationService,
    ContractManagementService,
    ContractIntelligenceService,
    PlaybookComparisonService,
    ObligationMonitorService,
    RedlineExportService,
  ],
})
export class DocumentReviewModule {}
