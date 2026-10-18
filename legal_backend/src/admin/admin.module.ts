import { Module } from '@nestjs/common';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { AiModule } from '@/ai/ai.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { MatterIntelligencePlatformModule } from '@/ai/matter-intelligence/matter-intelligence.module';
import { CostMonitoringModule } from '@/cost-monitoring/cost-monitoring.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAiObservabilityService } from './admin-ai-observability.service';
import { AdminUserActivityService } from './admin-user-activity.service';
import { LawyerProspectsService } from './lawyer-prospects.service';
import { GooglePlacesProspectService } from './google-places-prospect.service';
import { DemoRequestsService } from './demo-requests.service';
import { UnmatchedSectionsService } from './unmatched-sections.service';
import { SuperAdminGuard } from './super-admin.guard';
import { ResearchCorrectionService } from '@/ai/legal-research/research-correction.service';
import { EnterpriseController } from './enterprise.controller';
import { MarketingController } from './marketing.controller';
import { MiMetadataController } from './mi-metadata.controller';
import { MiMetadataService } from './mi-metadata.service';
import { WhatsappOutreachService } from './whatsapp-outreach.service';
import { PlatformAccountingService } from './platform-accounting.service';
import { AdminTodosService } from './admin-todos.service';
import { WhatsappWebhookController } from '@/webhooks/whatsapp-webhook.controller';

@Module({
  imports: [LegalSourcesModule, NotificationsModule, AiModule, EmbeddingsModule, MatterIntelligencePlatformModule, CostMonitoringModule],
  controllers: [AdminController, EnterpriseController, MarketingController, MiMetadataController, WhatsappWebhookController],
  providers: [
    AdminService,
    AdminAiObservabilityService,
    AdminUserActivityService,
    LawyerProspectsService,
    GooglePlacesProspectService,
    DemoRequestsService,
    UnmatchedSectionsService,
    SuperAdminGuard,
    ResearchCorrectionService,
    MiMetadataService,
    WhatsappOutreachService,
    PlatformAccountingService,
    AdminTodosService,
  ],
})
export class AdminModule {}
