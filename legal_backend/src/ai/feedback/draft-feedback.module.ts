import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { DataClassificationService } from '@/platform/security/data-classification.service';
import { DraftTrainingRedactionService } from './draft-training-redaction.service';
import { DraftFeedbackService } from './draft-feedback.service';
import { DraftFeedbackController } from './draft-feedback.controller';
import { DraftTrainingPipelineService } from './draft-training-pipeline.service';
import { PromptInjectionService } from './prompt-injection.service';
import { DraftFinetuneExportService } from './draft-finetune-export.service';
import { DraftTrainingAdminController } from './draft-training-admin.controller';
import { DraftVerificationOutcomeService } from './draft-verification-outcome.service';
import { DraftCorrectionService } from './draft-correction.service';
import { AzureFineTuneService } from './azure-finetune.service';
import { DraftEvalAutomationService } from './draft-eval-automation.service';
import { QualityFeedbackService } from './quality-feedback.service';
import { AuthorityTrustModule } from './authority-trust.module';
import { FineTunedModelResolverService } from './fine-tuned-model-resolver.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { TrainingConsentGateService } from './training-consent-gate.service';

@Module({
  imports: [PrismaModule, AuthorityTrustModule],
  controllers: [DraftFeedbackController, DraftTrainingAdminController],
  providers: [
    DataClassificationService,
    DraftTrainingRedactionService,
    DraftFeedbackService,
    QualityFeedbackService,
    DraftTrainingPipelineService,
    PromptInjectionService,
    DraftFinetuneExportService,
    DraftVerificationOutcomeService,
    DraftCorrectionService,
    AzureFineTuneService,
    DraftEvalAutomationService,
    FineTunedModelResolverService,
    LlmCompletionService,
    TrainingConsentGateService,
  ],
  exports: [
    DraftFeedbackService,
    QualityFeedbackService,
    PromptInjectionService,
    DraftTrainingRedactionService,
    DraftFinetuneExportService,
    DraftTrainingPipelineService,
    DraftVerificationOutcomeService,
    DraftCorrectionService,
    AzureFineTuneService,
    DraftEvalAutomationService,
    FineTunedModelResolverService,
    TrainingConsentGateService,
    AuthorityTrustModule,
  ],
})
export class DraftFeedbackModule {}
