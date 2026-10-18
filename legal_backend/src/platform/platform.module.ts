import { Module } from '@nestjs/common';
import { ModelRegistryModule } from './model-registry/model-registry.module';
import { CostModule } from './cost/cost.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { AuditEventModule } from './audit/audit-event.module';
import { ResearchModule } from './research/research.module';
import { KnowledgeGraphModule } from './knowledge-graph/knowledge-graph.module';
import { LegalUpdatesModule } from './legal-updates/legal-updates.module';
import { MatterIntelligenceV2Module } from './matter-intelligence/matter-intelligence-v2.module';
import { DocumentReviewModule } from './document-review/document-review.module';
import { FeatureHandoffModule } from './handoff/feature-handoff.module';
import { PlatformSecurityModule } from './security/platform-security.module';
import { StrategyModule } from './strategy/strategy.module';
import { AgenticModule } from './agentic/agentic.module';
import { ContinuousModule } from './continuous/continuous.module';
import { AudienceModule } from './audience/audience.module';
import { IntegrationPlatformModule } from './integrations/integration-platform.module';
import { DeadlineEngineModule } from './deadlines/deadline-engine.module';
import { FormBuilderModule } from './forms/form-builder.module';
import { PersonalVaultModule } from './vault/personal-vault.module';
import { AiSafetyModule } from './ai-safety/ai-safety.module';
import { WebhookModule } from './webhooks/webhook.module';

const platformModules = [
  ModelRegistryModule,
  CostModule,
  FeatureFlagsModule,
  AuditEventModule,
  ResearchModule,
  KnowledgeGraphModule,
  LegalUpdatesModule,
  MatterIntelligenceV2Module,
  DocumentReviewModule,
  FeatureHandoffModule,
  PlatformSecurityModule,
  StrategyModule,
  AgenticModule,
  ContinuousModule,
  AudienceModule,
  IntegrationPlatformModule,
  DeadlineEngineModule,
  FormBuilderModule,
  PersonalVaultModule,
  AiSafetyModule,
  WebhookModule,
];

@Module({
  imports: platformModules,
  exports: platformModules,
})
export class PlatformModule {}
