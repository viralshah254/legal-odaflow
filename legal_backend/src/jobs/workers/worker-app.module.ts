import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '@/security/security.module';
import { AiModule } from '@/ai/ai.module';
import { AutomationsModule } from '@/automations/automations.module';
import { CacheModule } from '@/cache/cache.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { OcrModule } from '@/ocr/ocr.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MatterOutcomeModule } from '@/matter-outcome/matter-outcome.module';
import { DocumentAutomationModule } from '@/document-automation/document-automation.module';
import { MatterIntelligencePlatformModule } from '@/ai/matter-intelligence/matter-intelligence.module';
import { DraftingWorkspaceService } from '@/matters/drafting-workspace.service';
import { MeetingsModule } from '@/meetings/meetings.module';
import { TemplatesModule } from '@/templates/templates.module';
import { JobsModule } from '../jobs.module';
import { LegalLocationModule } from '@/legal-location/legal-location.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    SecurityModule,
    CacheModule,
    RealtimeModule,
    EmbeddingsModule,
    LegalSourcesModule,
    JobsModule,
    LegalLocationModule,
    AiModule,
    OcrModule,
    NotificationsModule,
    AutomationsModule,
    MatterOutcomeModule,
    DocumentAutomationModule,
    TemplatesModule,
    MeetingsModule,
    MatterIntelligencePlatformModule,
  ],
  providers: [DraftingWorkspaceService],
  exports: [DraftingWorkspaceService],
})
export class WorkerAppModule {}
