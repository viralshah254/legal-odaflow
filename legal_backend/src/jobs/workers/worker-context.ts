import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { CourtListenerConnector } from '@/legal-sources/connectors/courtlistener.connector';
import { LegalSourceService } from '@/legal-sources/legal-source.service';
import { StatuteIngestService } from '@/legal-sources/statute-ingest.service';
import { KenyaIngestOpsService } from '@/legal-sources/kenya-ingest-ops.service';
import { MatterOutcomeService } from '@/matter-outcome/matter-outcome.service';
import { DraftingWorkspaceService } from '@/matters/drafting-workspace.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { AzureOcrService } from '@/ocr/azure-ocr.service';
import { OpenSearchAdapterService } from '@/legal-sources/search/opensearch-adapter.service';
import { MeetingsService } from '@/meetings/meetings.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { TokenCreditChargeService } from '@/ai-credits/token-credit-charge.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { EvidenceExtractorService } from '@/ai/matter-intelligence/evidence-extractor.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import { LegalLocationService } from '@/legal-location/legal-location.service';
import { WorkerAppModule } from './worker-app.module';
import { DraftJobService } from '@/ai/unified-drafting/draft-job.service';

let appContext: INestApplicationContext | null = null;
let appContextPromise: Promise<INestApplicationContext> | null = null;

export interface WorkerServices {
  aiGateway: AiGatewayService;
  llmCompletion: LlmCompletionService;
  automationEngine: AutomationEngineService;
  azureOcr: AzureOcrService;
  embeddingService: EmbeddingService;
  courtListener: CourtListenerConnector;
  legalSourceService: LegalSourceService;
  statuteIngest: StatuteIngestService;
  kenyaIngestOps: KenyaIngestOpsService;
  matterOutcome: MatterOutcomeService;
  draftingWorkspace: DraftingWorkspaceService;
  realtime: RealtimePublisherService;
  meetings: MeetingsService;
  creditLedger: AICreditLedgerService;
  tokenCreditCharge: TokenCreditChargeService;
  usageRecorder: AiUsageRecorderService;
  openSearch: OpenSearchAdapterService;
  evidenceExtractor: EvidenceExtractorService;
  matterMemory: MatterMemoryService;
  legalLocation: LegalLocationService;
  draftJobService: DraftJobService;
}

export async function getWorkerServices(): Promise<WorkerServices> {
  if (!appContext) {
    appContextPromise ??= NestFactory.createApplicationContext(WorkerAppModule, {
      logger: ['error', 'warn', 'log'],
    }).then((created) => {
      appContext = created;
      return created;
    });
    try {
      appContext = await appContextPromise;
    } finally {
      appContextPromise = null;
    }
  }

  return {
    aiGateway: appContext.get(AiGatewayService),
    llmCompletion: appContext.get(LlmCompletionService),
    automationEngine: appContext.get(AutomationEngineService),
    azureOcr: appContext.get(AzureOcrService),
    embeddingService: appContext.get(EmbeddingService),
    courtListener: appContext.get(CourtListenerConnector),
    legalSourceService: appContext.get(LegalSourceService),
    statuteIngest: appContext.get(StatuteIngestService),
    kenyaIngestOps: appContext.get(KenyaIngestOpsService),
    matterOutcome: appContext.get(MatterOutcomeService),
    draftingWorkspace: appContext.get(DraftingWorkspaceService),
    realtime: appContext.get(RealtimePublisherService),
    meetings: appContext.get(MeetingsService),
    creditLedger: appContext.get(AICreditLedgerService),
    tokenCreditCharge: appContext.get(TokenCreditChargeService),
    usageRecorder: appContext.get(AiUsageRecorderService),
    openSearch: appContext.get(OpenSearchAdapterService),
    evidenceExtractor: appContext.get(EvidenceExtractorService),
    matterMemory: appContext.get(MatterMemoryService),
    legalLocation: appContext.get(LegalLocationService),
    draftJobService: appContext.get(DraftJobService),
  };
}

export async function closeWorkerServices(): Promise<void> {
  if (appContextPromise) {
    await appContextPromise;
  }
  if (appContext) {
    await appContext.close();
    appContext = null;
  }
}
