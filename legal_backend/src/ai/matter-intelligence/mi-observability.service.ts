import { Injectable, Logger } from '@nestjs/common';
import type { MatterProfile } from './matter-intelligence.types';

export interface MiMetricsSnapshot {
  classifyLatencyMs: number;
  confidence: number;
  recommendationMode: string;
  practiceArea: string;
  clarificationRequired: boolean;
}

@Injectable()
export class MiObservabilityService {
  private readonly logger = new Logger(MiObservabilityService.name);

  recordClassify(
    consumer: string,
    profile: MatterProfile,
    latencyMs: number,
    recommendationMode: string,
    clarificationRequired: boolean,
  ): void {
    const snapshot: MiMetricsSnapshot = {
      classifyLatencyMs: latencyMs,
      confidence: profile.confidence,
      recommendationMode,
      practiceArea: profile.practiceArea,
      clarificationRequired,
    };
    this.logger.log(
      JSON.stringify({ event: 'mi_classify', consumer, ...snapshot }),
    );
  }

  recordRetrieval(
    consumer: string,
    topScore: number,
    recommendationMode: string,
    resultCount: number,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'mi_retrieval',
        consumer,
        topScore,
        recommendationMode,
        resultCount,
      }),
    );
  }
}
