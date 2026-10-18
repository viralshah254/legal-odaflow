import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { DocumentsModule } from '@/documents/documents.module';
import { UsersModule } from '@/users/users.module';
import { DocumentAutomationController } from './document-automation.controller';
import { DocumentAutomationService } from './document-automation.service';
import { DocumentDraftService } from './document-draft.service';
import { ExportBrandingService } from '@/export/export-branding.service';

@Module({
  imports: [forwardRef(() => AiModule), UsersModule, DocumentsModule],
  controllers: [DocumentAutomationController],
  providers: [DocumentAutomationService, DocumentDraftService, ExportBrandingService],
  exports: [DocumentAutomationService, DocumentDraftService],
})
export class DocumentAutomationModule {}
