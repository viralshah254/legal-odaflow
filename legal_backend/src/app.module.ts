import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from '@/access/access.module';
import { AnonymizationModule } from '@/anonymization/anonymization.module';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { LegalComplianceModule } from '@/legal-compliance/legal-compliance.module';
import { TrainingConsentModule } from '@/training-consent/training-consent.module';
import { TrainingDatasetsModule } from '@/training-datasets/training-datasets.module';
import { AnalyticsModule } from '@/analytics/analytics.module';
import { AdminModule } from '@/admin/admin.module';
import { AgentsModule } from '@/agents/agents.module';
import { AiModule } from '@/ai/ai.module';
import { AlertsModule } from '@/alerts/alerts.module';
import { AssistanceModule } from '@/assistance/assistance.module';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { AutomationsModule } from '@/automations/automations.module';
import { BillingModule } from '@/billing/billing.module';
import { CacheModule } from '@/cache/cache.module';
import { CalendarModule } from '@/calendar/calendar.module';
import { ClientsModule } from '@/clients/clients.module';
import { AppConfigModule } from '@/config/config.module';
import { ConsumersModule } from '@/consumers/consumers.module';
import { DocumentsModule } from '@/documents/documents.module';
import { FinanceModule } from '@/finance/finance.module';
import { GovernanceModule } from '@/governance/governance.module';
import { GdprModule } from '@/gdpr/gdpr.module';
import { EvalModule } from '@/eval/eval.module';
import { GeoModule } from '@/geo/geo.module';
import { HealthModule } from '@/health/health.module';
import { JobsModule } from '@/jobs/jobs.module';
import { KycModule } from '@/kyc/kyc.module';
import { ConsumerReportsModule } from '@/consumer-reports/consumer-reports.module';
import { CostMonitoringModule } from '@/cost-monitoring/cost-monitoring.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { MatterBrainModule } from '@/matter-brain/matter-brain.module';
import { MatterIntelligenceModule } from '@/matter-intelligence/matter-intelligence.module';
import { MatterPartiesModule } from '@/matter-parties/matter-parties.module';
import { MatterOutcomeModule } from '@/matter-outcome/matter-outcome.module';
import { CourtModule } from '@/court/court.module';
import { MigrationModule } from '@/migration/migration.module';
import { StorageModule } from '@/storage/storage.module';
import { PublicApiModule } from '@/public-api/public-api.module';
import { IntegrationsModule } from '@/integrations/integrations.module';
import { PlaybooksModule } from '@/playbooks/playbooks.module';
import { SubscriptionsModule } from '@/subscriptions/subscriptions.module';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { CreditsModule } from '@/credits/credits.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { MattersModule } from '@/matters/matters.module';
import { MeetingsModule } from '@/meetings/meetings.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PaymentsModule } from '@/payments/payments.module';
import { PortalModule } from '@/portal/portal.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { TasksModule } from '@/tasks/tasks.module';
import { TemplatesModule } from '@/templates/templates.module';
import { TenantsModule } from '@/tenants/tenants.module';
import { TimelineModule } from '@/timeline/timeline.module';
import { TimeModule } from '@/time/time.module';
import { UsersModule } from '@/users/users.module';
import { SearchModule } from '@/search/search.module';
import { ConflictsModule } from '@/conflicts/conflicts.module';
import { DocumentAutomationModule } from '@/document-automation/document-automation.module';
import { FirmMemoryModule } from '@/firm-memory/firm-memory.module';
import { SeriesAModule } from '@/series-a/series-a.module';
import { AuditLogInterceptor } from '@/common/interceptors/audit-log.interceptor';
import { RealtimeModule } from '@/realtime/realtime.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: Number(configService.get<string>('RATE_LIMIT_TTL_SECONDS', '60')) * 1000,
          limit: Number(configService.get<string>('RATE_LIMIT_MAX_REQUESTS', '120')),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    AccessModule,
    CountryComplianceModule,
    LegalComplianceModule,
    TrainingConsentModule,
    AnonymizationModule,
    TrainingDatasetsModule,
    CacheModule,
    RealtimeModule,
    AuditModule,
    JobsModule,
    AuthModule,
    GeoModule,
    HealthModule,
    AppConfigModule,
    AiCreditsModule,
    CreditsModule,
    LegalSourcesModule,
    EmbeddingsModule,
    CostMonitoringModule,
    MatterBrainModule,
    MatterIntelligenceModule,
    MatterPartiesModule,
    MatterOutcomeModule,
    PlaybooksModule,
    CourtModule,
    MigrationModule,
    PublicApiModule,
    IntegrationsModule,
    ConsumerReportsModule,
    SubscriptionsModule,
    TenantsModule,
    ConsumersModule,
    AiModule,
    DocumentsModule,
    MattersModule,
    ClientsModule,
    TasksModule,
    TimeModule,
    CalendarModule,
    BillingModule,
    PaymentsModule,
    PortalModule,
    MarketplaceModule,
    AdminModule,
    AgentsModule,
    NotificationsModule,
    MeetingsModule,
    KycModule,
    AlertsModule,
    TemplatesModule,
    FinanceModule,
    AutomationsModule,
    TimelineModule,
    AssistanceModule,
    GovernanceModule,
    GdprModule,
    EvalModule,
    UsersModule,
    AnalyticsModule,
    SearchModule,
    ConflictsModule,
    DocumentAutomationModule,
    FirmMemoryModule,
    SeriesAModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
