import { Module, forwardRef } from '@nestjs/common';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { CreditsModule } from '@/credits/credits.module';
import { LegalComplianceModule } from '@/legal-compliance/legal-compliance.module';
import { FirmMemoryModule } from '@/firm-memory/firm-memory.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { LegalSearchPlanService } from '@/legal-search/legal-search-plan.service';
import { TasksModule } from '@/tasks/tasks.module';
import { AiCommandCenterService } from './ai-command-center.service';
import { AiComplianceGuardService } from './ai-compliance-guard.service';
import { AiController } from './ai.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiPolicyService } from './ai-policy.service';
import { AiUsageService } from './ai-usage.service';
import { CitationVerificationService } from './citations/citation-verification.service';
import { AiCostService } from './costs/ai-cost.service';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { ModelRouterService } from './model-router/model-router.service';
import { AiPromptTemplateService } from './prompts/ai-prompt-template.service';

@Module({
  imports: [
    AiCreditsModule,
    forwardRef(() => CreditsModule),
    CountryComplianceModule,
    LegalComplianceModule,
    LegalSourcesModule,
    FirmMemoryModule,
    TasksModule,
  ],
  controllers: [AiController, CopilotController],
  providers: [
    AiGatewayService,
    AiPolicyService,
    AiUsageService,
    AiComplianceGuardService,
    AiCommandCenterService,
    CopilotService,
    ModelRouterService,
    AiCostService,
    CitationVerificationService,
    LegalSearchPlanService,
    AiPromptTemplateService,
  ],
  exports: [
    AiGatewayService,
    AiPolicyService,
    AiUsageService,
    AiComplianceGuardService,
    AiCommandCenterService,
    CopilotService,
    ModelRouterService,
    AiCostService,
  ],
})
export class AiModule {}
