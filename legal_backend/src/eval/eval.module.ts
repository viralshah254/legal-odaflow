import { Module } from '@nestjs/common';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { LegalComplianceModule } from '@/legal-compliance/legal-compliance.module';
import { EvalController } from './eval.controller';
import { EvalService } from './eval.service';
import { EvalSuiteRunner } from './eval-suite.runner';

@Module({
  imports: [CountryComplianceModule, LegalComplianceModule],
  controllers: [EvalController],
  providers: [EvalService, EvalSuiteRunner, AiComplianceGuardService],
  exports: [EvalService, EvalSuiteRunner],
})
export class EvalModule {}
