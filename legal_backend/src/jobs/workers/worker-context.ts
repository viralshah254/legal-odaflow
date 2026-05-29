import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { CourtListenerConnector } from '@/legal-sources/connectors/courtlistener.connector';
import { MatterOutcomeService } from '@/matter-outcome/matter-outcome.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { AzureOcrService } from '@/ocr/azure-ocr.service';
import { WorkerAppModule } from './worker-app.module';

let appContext: INestApplicationContext | null = null;

export interface WorkerServices {
  aiGateway: AiGatewayService;
  automationEngine: AutomationEngineService;
  azureOcr: AzureOcrService;
  embeddingService: EmbeddingService;
  courtListener: CourtListenerConnector;
  matterOutcome: MatterOutcomeService;
  realtime: RealtimePublisherService;
}

export async function getWorkerServices(): Promise<WorkerServices> {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(WorkerAppModule, {
      logger: ['error', 'warn', 'log'],
    });
  }

  return {
    aiGateway: appContext.get(AiGatewayService),
    automationEngine: appContext.get(AutomationEngineService),
    azureOcr: appContext.get(AzureOcrService),
    embeddingService: appContext.get(EmbeddingService),
    courtListener: appContext.get(CourtListenerConnector),
    matterOutcome: appContext.get(MatterOutcomeService),
    realtime: appContext.get(RealtimePublisherService),
  };
}

export async function closeWorkerServices(): Promise<void> {
  if (appContext) {
    await appContext.close();
    appContext = null;
  }
}
