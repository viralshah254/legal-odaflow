import { Module, forwardRef } from '@nestjs/common';
import { LegalFormsModule } from '@/legal-forms/legal-forms.module';
import { AiModule } from '@/ai/ai.module';
import { MatterIntelligencePlatformModule } from '@/ai/matter-intelligence/matter-intelligence.module';
import { LegalLocationModule } from '@/legal-location/legal-location.module';
import { DraftIntentController } from './draft-intent.controller';
import { DraftIntentService } from './draft-intent.service';
import { DraftIntentAnalyzeService } from './draft-intent-analyze.service';
import { MatterClarificationService } from './matter-clarification.service';
import { PlaybookResolverService } from './playbook-resolver.service';
import { ExplicitDocumentResolverService } from './explicit-document-resolver.service';

@Module({
  imports: [LegalFormsModule, MatterIntelligencePlatformModule, LegalLocationModule, forwardRef(() => AiModule)],
  controllers: [DraftIntentController],
  providers: [
    DraftIntentService,
    DraftIntentAnalyzeService,
    MatterClarificationService,
    PlaybookResolverService,
    ExplicitDocumentResolverService,
  ],
  exports: [
    DraftIntentService,
    DraftIntentAnalyzeService,
    PlaybookResolverService,
    ExplicitDocumentResolverService,
  ],
})
export class DraftIntentModule {}
