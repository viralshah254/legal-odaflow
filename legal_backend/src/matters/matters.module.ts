import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { AutomationsModule } from '@/automations/automations.module';
import { ConflictsModule } from '@/conflicts/conflicts.module';
import { DocumentAutomationModule } from '@/document-automation/document-automation.module';
import { MatterAutonomyModule } from '@/matter-autonomy/matter-autonomy.module';
import { TemplatesModule } from '@/templates/templates.module';
import { PlaybooksModule } from '@/playbooks/playbooks.module';
import { SearchModule } from '@/search/search.module';
import { UsersModule } from '@/users/users.module';
import { LegalFormsModule } from '@/legal-forms/legal-forms.module';
import { MattersController } from './matters.controller';
import { DraftingWorkspaceService } from './drafting-workspace.service';
import { MattersService } from './matters.service';

@Module({
  imports: [
    forwardRef(() => AiModule),
    forwardRef(() => AutomationsModule),
    PlaybooksModule,
    ConflictsModule,
    UsersModule,
    DocumentAutomationModule,
    MatterAutonomyModule,
    TemplatesModule,
    SearchModule,
    LegalFormsModule,
  ],
  controllers: [MattersController],
  providers: [MattersService, DraftingWorkspaceService],
  exports: [MattersService, DraftingWorkspaceService],
})
export class MattersModule {}
