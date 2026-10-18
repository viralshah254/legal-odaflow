import { Module } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { DocumentAutomationModule } from '@/document-automation/document-automation.module';
import { ESignModule } from '@/esign/esign.module';
import { OcrModule } from '@/ocr/ocr.module';
import { PortalModule } from '@/portal/portal.module';
import { TemplatesModule } from '@/templates/templates.module';
import { UsersModule } from '@/users/users.module';
import { DocumentIngestService } from './document-ingest.service';
import { DraftingSessionController } from './drafting-session.controller';
import { DraftingSessionService } from './drafting-session.service';

@Module({
  imports: [
    AiModule,
    DocumentAutomationModule,
    TemplatesModule,
    UsersModule,
    OcrModule,
    ESignModule,
    PortalModule,
  ],
  controllers: [DraftingSessionController],
  providers: [DraftingSessionService, DocumentIngestService],
  exports: [DraftingSessionService, DocumentIngestService],
})
export class DraftingSessionModule {}
