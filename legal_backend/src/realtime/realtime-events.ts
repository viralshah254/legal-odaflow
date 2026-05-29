export const REALTIME_EVENTS = {
  COPILOT_MESSAGE_CREATED: 'copilot.message.created',
  COPILOT_JOB_COMPLETED: 'copilot.job.completed',
  AGENT_JOB_UPDATED: 'agent.job.updated',
  DOCUMENT_OCR_UPDATED: 'document.ocr.updated',
  NOTIFICATION_CREATED: 'notification.created',
  CREDIT_BALANCE_UPDATED: 'credit.balance.updated',
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  MATTER_CREATED: 'matter.created',
  MATTER_UPDATED: 'matter.updated',
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CALENDAR_EVENT_UPDATED: 'calendar.event.updated',
  ALERT_CREATED: 'alert.created',
  ALERT_UPDATED: 'alert.updated',
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  DASHBOARD_METRICS_UPDATED: 'dashboard.metrics.updated',
  TIME_ENTRY_UPDATED: 'timeEntry.updated',
  INVOICE_UPDATED: 'invoice.updated',
  TRUST_UPDATED: 'trust.updated',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimeEventPayload {
  tenantId: string;
  entityId?: string;
  action?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
}

export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
