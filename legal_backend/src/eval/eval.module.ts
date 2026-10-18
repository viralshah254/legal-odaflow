import { Module } from '@nestjs/common';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { LegalComplianceModule } from '@/legal-compliance/legal-compliance.module';
import { LegalSearchModule } from '@/legal-search/legal-search.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { EvalController } from './eval.controller';
import { EvalService } from './eval.service';
import { EvalSuiteRunner } from './eval-suite.runner';
import { UmbrellaLegalEvalHarness } from './umbrella-legal-eval.harness';
import { AccuracyReportService } from './accuracy-report.service';

@Module({
  imports: [CountryComplianceModule, LegalComplianceModule, LegalSearchModule, LegalSourcesModule],
  controllers: [EvalController],
  providers: [
    EvalService,
    EvalSuiteRunner,
    UmbrellaLegalEvalHarness,
    AccuracyReportService,
    AiComplianceGuardService,
    SubstanceVerificationService,
  ],
  exports: [EvalService, EvalSuiteRunner, AccuracyReportService],
})
export class EvalModule {}
