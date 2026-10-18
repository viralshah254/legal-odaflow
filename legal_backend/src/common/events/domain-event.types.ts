export const DomainEventType = {
  MATTER_CREATED: 'matter.created',
  MATTER_FACTS_UPDATED: 'matter.facts.updated',
  DOCUMENT_UPLOADED: 'document.uploaded',
  RESEARCH_COMPLETED: 'research.completed',
  DRAFT_COMPLETED: 'draft.completed',
  VERIFICATION_FAILED: 'verification.failed',
  DEADLINE_DETECTED: 'deadline.detected',
  CONTRADICTION_FOUND: 'contradiction.found',
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  LEGAL_UPDATE_DETECTED: 'legal_update.detected',
} as const;

export type DomainEventType = (typeof DomainEventType)[keyof typeof DomainEventType];

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: string;
  payload: TPayload;
}
