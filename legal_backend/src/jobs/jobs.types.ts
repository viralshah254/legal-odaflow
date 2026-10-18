import { CopilotToolName } from '@/ai/copilot.types';

export interface AiAgentJobPayload {
  agentJobId: string;
  jobType: string;
  tenantId: string;
  userId: string;
  userRole?: string;
  sessionId?: string;
  toolName?: CopilotToolName;
  params: Record<string, unknown>;
}

export interface AnonymizationJobPayload {
  anonymizationJobId: string;
  sourceType: string;
  sourceId: string;
}

export interface LegalIngestJobPayload {
  agentJobId?: string;
  countryCode: string;
  jobType?: string;
  actId?: string;
  query?: string;
  jurisdiction?: string;
  limit?: number;
  years?: number[];
  maxPerYear?: number;
  queries?: string[];
  forceReindex?: boolean;
  practiceAreas?: string[];
  /** Kenya manifest batch cursor (0-based index into manifest.acts). */
  manifestCursor?: number;
  /** Acts per KE_MANIFEST_BATCH_INGEST job (default 5). */
  batchSize?: number;
  /** Kenya Law request pacing for crawl jobs. */
  delayMs?: number;
  /** Include subsidiary legislation when rebuilding KE manifest. */
  includeSubsidiary?: boolean;
  /** Kenya source policy key for pause/resume-aware jobs. */
  sourceKey?: string;
  /** Extended corpus collection for KE_EXTENDED_COLLECTION_DISPATCH. */
  kenyaCollection?: 'BILLS' | 'COUNTY_LAW' | 'TREATIES' | 'EAC_LAW' | 'REGULATOR';
  /** Judgments feed limit for KE_CASE_LAW_SYNC. */
  feedLimit?: number;
  /** Auto-enqueue the next manifest batch when cursor remains. */
  chainNextBatch?: boolean;
}

export interface NotificationDispatchPayload {
  agentJobId?: string;
  notificationId?: string;
  userId: string;
  tenantId?: string;
  jobType?: string;
  params?: Record<string, unknown>;
}
