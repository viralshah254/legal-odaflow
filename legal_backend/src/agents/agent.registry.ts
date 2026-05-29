import { CopilotToolName } from '@/ai/copilot.types';

export type InternalAgentId =
  | 'research-agent'
  | 'matter-analyst'
  | 'drafting-agent'
  | 'ocr-agent'
  | 'notification-agent'
  | 'automation-agent'
  | 'document-explainer'
  | 'opponent-analyzer'
  | 'evidence-gap'
  | 'deadline'
  | 'billing-recovery'
  | 'outcome-analyzer';

export interface InternalAgentDefinition {
  id: InternalAgentId;
  name: string;
  description: string;
  queue: string;
  capabilities: string[];
  copilotTools?: CopilotToolName[];
  requiresApproval?: boolean;
}

export const INTERNAL_AGENTS: Record<InternalAgentId, InternalAgentDefinition> = {
  'research-agent': {
    id: 'research-agent',
    name: 'Legal Research Agent',
    description:
      'Authority-backed legal research memos with citations and matter context.',
    queue: 'ai.high_priority',
    capabilities: ['legal_research_memo', 'citation_extraction'],
    copilotTools: ['legal_research_memo'],
  },
  'matter-analyst': {
    id: 'matter-analyst',
    name: 'Matter Analyst',
    description:
      'Summarizes matters, surfaces open work, and proposes prioritized next steps.',
    queue: 'ai.low_priority',
    capabilities: ['summarize_matter', 'suggest_next_steps'],
    copilotTools: ['summarize_matter', 'suggest_next_steps'],
  },
  'drafting-agent': {
    id: 'drafting-agent',
    name: 'Drafting Agent',
    description:
      'Drafts memos, letters, and filings from matter context; notifies when ready.',
    queue: 'ai.low_priority',
    capabilities: ['draft_document', 'matter_context'],
    copilotTools: ['draft_document'],
    requiresApproval: true,
  },
  'ocr-agent': {
    id: 'ocr-agent',
    name: 'Document OCR Agent',
    description: 'Extracts text from uploaded documents for search and AI workflows.',
    queue: 'ocr-processing',
    capabilities: ['ocr_extract', 'document_indexing'],
  },
  'notification-agent': {
    id: 'notification-agent',
    name: 'Notification Agent',
    description: 'Delivers in-app and push notifications across firm and consumer apps.',
    queue: 'notifications.dispatch',
    capabilities: ['fcm_push', 'in_app_inbox'],
  },
  'automation-agent': {
    id: 'automation-agent',
    name: 'Automation Agent',
    description:
      'Runs if/then firm workflows: triggers, conditions, and chained actions.',
    queue: 'automations.execute',
    capabilities: [
      'trigger_matching',
      'create_task',
      'send_notification',
      'enqueue_agent_job',
    ],
  },
  'document-explainer': {
    id: 'document-explainer',
    name: 'Document Explainer',
    description: 'Explains uploaded documents in plain language with risk flags.',
    queue: 'ai.low_priority',
    capabilities: ['document_explain', 'clause_highlight'],
  },
  'opponent-analyzer': {
    id: 'opponent-analyzer',
    name: 'Opponent Analyzer',
    description: 'Analyzes opposing filings and suggests counterarguments.',
    queue: 'ai.high_priority',
    capabilities: ['opponent_filing_analysis', 'counterargument_map'],
    requiresApproval: true,
  },
  'evidence-gap': {
    id: 'evidence-gap',
    name: 'Evidence Gap Agent',
    description: 'Identifies missing evidence and discovery priorities for matters.',
    queue: 'ai.low_priority',
    capabilities: ['evidence_gap_analysis', 'discovery_checklist'],
  },
  deadline: {
    id: 'deadline',
    name: 'Deadline Agent',
    description: 'Tracks procedural deadlines and escalates at-risk dates.',
    queue: 'notifications.dispatch',
    capabilities: ['deadline_extraction', 'deadline_alerts'],
  },
  'billing-recovery': {
    id: 'billing-recovery',
    name: 'Billing Recovery Agent',
    description: 'Surfaces unbilled time, draft invoices, and collection opportunities.',
    queue: 'ai.low_priority',
    capabilities: ['unbilled_time_detection', 'invoice_draft_suggestions'],
    requiresApproval: true,
  },
  'outcome-analyzer': {
    id: 'outcome-analyzer',
    name: 'Case Outcome Analyzer',
    description:
      'Generates probabilistic outcome analysis from matter facts, issues, arguments, and strategy memos.',
    queue: 'ai.high_priority',
    capabilities: ['case_outcome_analysis', 'scenario_modeling', 'portal_summary_draft'],
    requiresApproval: true,
  },
};

export const BUILT_IN_AUTOMATION_RECIPES = [
  {
    recipeKey: 'task_notify_assignee',
    name: 'New task → notify assignee',
    description: 'When someone is assigned a task, they get an in-app notification.',
    trigger: 'task.created',
    conditions: { hasAssignee: true },
    actions: [
      {
        type: 'send_notification',
        title: 'New task assigned',
        body: 'You were assigned "{{taskTitle}}".',
        userIdField: 'assigneeId',
      },
    ],
  },
  {
    recipeKey: 'matter_kickoff_checklist',
    name: 'Matter opened → kickoff checklist',
    description: 'When a new matter is opened, create conflict-check and engagement-letter tasks.',
    trigger: 'matter.created',
    conditions: {},
    actions: [
      {
        type: 'create_task',
        title: 'Run conflict check',
        priority: 'HIGH',
        matterIdField: 'matterId',
      },
      {
        type: 'create_task',
        title: 'Send engagement letter',
        priority: 'MEDIUM',
        matterIdField: 'matterId',
      },
    ],
  },
  {
    recipeKey: 'draft_ready_notify',
    name: 'Draft ready → notify lawyer',
    description: 'When Copilot finishes a document draft, notify the lawyer who requested it.',
    trigger: 'agent.completed',
    conditions: { jobType: 'DRAFT_DOCUMENT' },
    actions: [
      {
        type: 'send_notification',
        title: 'Copilot draft ready',
        body: 'Your draft is ready for review.',
        userIdField: 'userId',
      },
    ],
  },
  {
    recipeKey: 'document_uploaded_confirm',
    name: 'Document uploaded → confirm upload',
    description: 'When a document is uploaded to a matter, confirm success to the uploader.',
    trigger: 'document.uploaded',
    conditions: {},
    actions: [
      {
        type: 'send_notification',
        title: 'Document uploaded',
        body: '"{{fileName}}" was uploaded successfully.',
        userIdField: 'userId',
      },
    ],
  },
  {
    recipeKey: 'invoice_overdue_alert',
    name: 'Invoice overdue → alert firm admin',
    description: 'When an invoice passes its due date, alert a firm admin to follow up.',
    trigger: 'invoice.overdue',
    conditions: { minAmount: 1 },
    actions: [
      {
        type: 'send_notification',
        title: 'Invoice overdue',
        body: 'Invoice {{invoiceNumber}} ({{amount}} {{currency}}) is overdue.',
        notifyRole: 'FIRM_ADMIN',
      },
    ],
  },
] as const;

export type BuiltInRecipeKey = (typeof BUILT_IN_AUTOMATION_RECIPES)[number]['recipeKey'];

export function getBuiltInRecipe(recipeKey: string) {
  return BUILT_IN_AUTOMATION_RECIPES.find((recipe) => recipe.recipeKey === recipeKey);
}

export function recipeConditionsWithKey(
  recipeKey: string,
  conditions: Record<string, unknown> = {},
): Record<string, unknown> {
  return { _recipeKey: recipeKey, ...conditions };
}

export function extractRecipeKey(
  conditions: unknown,
): string | undefined {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) {
    return undefined;
  }
  const key = (conditions as Record<string, unknown>)._recipeKey;
  return typeof key === 'string' ? key : undefined;
}

export function listInternalAgents(): InternalAgentDefinition[] {
  return Object.values(INTERNAL_AGENTS);
}

export function resolveAgentForTool(
  toolName: CopilotToolName,
): InternalAgentDefinition | undefined {
  return listInternalAgents().find((agent) =>
    agent.copilotTools?.includes(toolName),
  );
}

export function resolveAgentForQueue(queue: string): InternalAgentDefinition | undefined {
  return listInternalAgents().find((agent) => agent.queue === queue);
}
