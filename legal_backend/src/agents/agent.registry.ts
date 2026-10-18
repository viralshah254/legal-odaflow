import { CopilotToolName } from '@/ai/copilot.types';

export type InternalAgentId =
  | 'research-agent'
  | 'matter-analyst'
  | 'drafting-agent'
  | 'diligence-agent'
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
    copilotTools: ['find_draft', 'draft_document'],
    requiresApproval: true,
  },
  'diligence-agent': {
    id: 'diligence-agent',
    name: 'Diligence Agent',
    description:
      'Runs bulk document review, extracts risks, and builds diligence summary matrices.',
    queue: 'ai.high_priority',
    capabilities: ['bulk_diligence', 'clause_risk_extraction', 'document_summarize'],
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
  // ── PRACTICE-AREA RECIPES ──────────────────────────────────────────────────
  // conditions.practiceArea matches matter.practiceArea (canonical slugs from
  // platform-taxonomy.ts). Alias matching is handled by AutomationEngineService.
  {
    recipeKey: 'employment_new_matter_tasks',
    name: 'Employment: initial checklist tasks',
    description: 'Create standard initial tasks when an employment law matter is opened.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'employment_labour' },
    actions: [
      { type: 'create_task', title: 'Obtain client employment contract', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Confirm limitation period for claims', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Assess statutory employment rights and entitlements', priority: 'MEDIUM', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'corporate_incorporation_tasks',
    name: 'Corporate: incorporation checklist',
    description: 'Create standard tasks for company incorporation matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'corporate_commercial' },
    actions: [
      { type: 'create_task', title: 'Draft Memorandum & Articles of Association', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'File company incorporation application', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Prepare shareholders agreement', priority: 'MEDIUM', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'criminal_defense_tasks',
    name: 'Criminal: initial defense tasks',
    description: 'Create standard tasks for criminal defense matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'litigation_disputes' },
    actions: [
      { type: 'create_task', title: 'Obtain FIR / charge sheet / police disclosure', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Advise client on bail/remand conditions', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Confirm hearing / mention date', priority: 'HIGH', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'family_divorce_tasks',
    name: 'Family: divorce/separation initial tasks',
    description: 'Create standard tasks for family law / divorce matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'family_matrimonial' },
    actions: [
      { type: 'create_task', title: 'Obtain marriage certificate', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Prepare financial disclosure statement', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Advise on mediation / pre-litigation requirements', priority: 'MEDIUM', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'litigation_claim_tasks',
    name: 'Litigation: new claim initial tasks',
    description: 'Create standard tasks for civil litigation matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'litigation_disputes' },
    actions: [
      { type: 'create_task', title: 'Send legal notice / Letter Before Claim', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Calculate and confirm limitation period', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Gather evidence and witness statements', priority: 'MEDIUM', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'ip_trademark_tasks',
    name: 'IP: trade mark registration tasks',
    description: 'Create standard tasks for intellectual property matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'intellectual_property' },
    actions: [
      { type: 'create_task', title: 'Conduct availability / clearance search', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Classify goods and services (Nice Classification)', priority: 'MEDIUM', matterIdField: 'matterId' },
      { type: 'create_task', title: 'File trade mark application', priority: 'HIGH', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'property_conveyancing_tasks',
    name: 'Real Estate: conveyancing tasks',
    description: 'Create standard tasks for property conveyancing matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'real_estate_property' },
    actions: [
      { type: 'create_task', title: 'Conduct property / title searches', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Review title deeds and land registry entries', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Draft / review transfer deed', priority: 'HIGH', matterIdField: 'matterId' },
    ],
  },
  {
    recipeKey: 'immigration_visa_tasks',
    name: 'Immigration: visa application tasks',
    description: 'Create standard tasks for immigration and visa matters.',
    trigger: 'matter.created',
    conditions: { practiceArea: 'immigration' },
    actions: [
      { type: 'create_task', title: 'Verify passport validity and travel history', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Gather supporting documents', priority: 'HIGH', matterIdField: 'matterId' },
      { type: 'create_task', title: 'Prepare visa application form and cover letter', priority: 'HIGH', matterIdField: 'matterId' },
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
