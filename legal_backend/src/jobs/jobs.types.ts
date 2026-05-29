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
  countryCode: string;
  query?: string;
  jurisdiction?: string;
  limit?: number;
}

export interface NotificationDispatchPayload {
  agentJobId?: string;
  notificationId?: string;
  userId: string;
  tenantId?: string;
  jobType?: string;
  params?: Record<string, unknown>;
}
