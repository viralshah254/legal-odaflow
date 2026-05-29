export type AutomationTrigger =
  | 'task.created'
  | 'matter.created'
  | 'document.uploaded'
  | 'agent.completed'
  | 'invoice.overdue';

export type AutomationAction =
  | {
      type: 'send_notification';
      title: string;
      body: string;
      userIdField?: string;
      userId?: string;
      notifyRole?: 'FIRM_ADMIN' | 'FINANCE' | 'PARTNER';
    }
  | {
      type: 'create_task';
      title: string;
      priority?: string;
      assigneeIdField?: string;
      matterIdField?: string;
    }
  | {
      type: 'enqueue_agent_job';
      toolName: string;
      priority?: 'high' | 'low';
      matterIdField?: string;
    };

export interface AutomationRunPayload {
  runId: string;
  tenantId: string;
  ruleId: string;
  trigger: string;
  context: Record<string, unknown>;
}

export interface AutomationConditions {
  hasAssignee?: boolean;
  jobType?: string;
  matterType?: string;
  minAmount?: number;
}
