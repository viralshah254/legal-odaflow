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
  /** Practice area slug (e.g. 'employment_labour', 'corporate_commercial'). */
  practiceArea?: string;
  minAmount?: number;
}

/**
 * Alias table used to match short-hand practice area names (used in recipe
 * conditions) against the canonical slugs stored on Matter.practiceArea.
 *
 * Derived from PLATFORM_DOMAINS aliases in platform-taxonomy.ts.
 */
export const PRACTICE_AREA_ALIASES: Record<string, string[]> = {
  litigation_disputes: ['litigation', 'civil_litigation', 'criminal', 'criminal_defense', 'criminal_procedure', 'bail', 'criminal_defence'],
  employment_labour: ['employment', 'labour', 'labor'],
  corporate_commercial: ['corporate', 'commercial', 'contract'],
  family_matrimonial: ['family', 'matrimonial'],
  real_estate_property: ['property', 'real_estate', 'conveyancing', 'housing'],
  intellectual_property: ['ip', 'intellectual_property'],
  immigration: [],
  tax: ['taxation', 'tax_revenue'],
  insolvency: ['insolvency_ibc', 'bankruptcy'],
};
