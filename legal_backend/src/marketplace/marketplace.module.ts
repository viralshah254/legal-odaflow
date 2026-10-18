import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AiModule } from '@/ai/ai.module';
import { AutomationsModule } from '@/automations/automations.module';
import { ConflictsModule } from '@/conflicts/conflicts.module';
import { MatterAutonomyModule } from '@/matter-autonomy/matter-autonomy.module';
import { CourtDeadlinesModule } from '@/court-deadlines/court-deadlines.module';
import { DocumentsModule } from '@/documents/documents.module';
import { JobsModule } from '@/jobs/jobs.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PaymentsModule } from '@/payments/payments.module';
import { PlaybooksModule } from '@/playbooks/playbooks.module';
import { StorageModule } from '@/storage/storage.module';
import { UsersModule } from '@/users/users.module';
import { MatterIntelligencePlatformModule } from '@/ai/matter-intelligence/matter-intelligence.module';
import { FullLoopAutomationService } from './full-loop-automation.service';
import { IntakeAnalysisService } from './intake-analysis.service';
import { LeadDocumentsService } from './lead-documents.service';
import { LeadSlaScheduler } from './lead-sla.scheduler';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    forwardRef(() => AiModule),
    forwardRef(() => AutomationsModule),
    ConflictsModule,
    MatterAutonomyModule,
    CourtDeadlinesModule,
    JobsModule,
    LegalSourcesModule,
    forwardRef(() => PaymentsModule),
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me_dev_secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
    PlaybooksModule,
    StorageModule,
    UsersModule,
    MatterIntelligencePlatformModule,
  ],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    IntakeAnalysisService,
    LeadDocumentsService,
    FullLoopAutomationService,
    LeadSlaScheduler,
  ],
  exports: [MarketplaceService, IntakeAnalysisService, FullLoopAutomationService],
})
export class MarketplaceModule {}
