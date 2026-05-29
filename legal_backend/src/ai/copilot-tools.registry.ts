import { CopilotToolName } from './copilot.types';

export interface CopilotToolDefinition {
  name: CopilotToolName;
  label: string;
  description: string;
  async: boolean;
  requiresApproval: boolean;
  priority: 'high' | 'low' | 'sync';
}

export const COPILOT_TOOLS: Record<CopilotToolName, CopilotToolDefinition> = {
  create_task: {
    name: 'create_task',
    label: 'Create task',
    description: 'Create a matter task immediately',
    async: false,
    requiresApproval: true,
    priority: 'sync',
  },
  summarize_matter: {
    name: 'summarize_matter',
    label: 'Summarize matter',
    description: 'Generate a matter summary memo',
    async: true,
    requiresApproval: false,
    priority: 'low',
  },
  legal_research_memo: {
    name: 'legal_research_memo',
    label: 'Legal research memo',
    description: 'Run legal research with citations',
    async: true,
    requiresApproval: false,
    priority: 'high',
  },
  draft_document: {
    name: 'draft_document',
    label: 'Draft document',
    description: 'Draft a document from matter context',
    async: true,
    requiresApproval: true,
    priority: 'low',
  },
  suggest_next_steps: {
    name: 'suggest_next_steps',
    label: 'Suggest next steps',
    description: 'Propose prioritized next actions for the matter',
    async: true,
    requiresApproval: false,
    priority: 'low',
  },
};

const TOOL_PATTERNS: Array<{ tool: CopilotToolName; patterns: RegExp[] }> = [
  {
    tool: 'create_task',
    patterns: [
      /\bcreate\s+(a\s+)?task\b/i,
      /\badd\s+(a\s+)?task\b/i,
      /\bnew\s+task\b/i,
      /\bcreate_task\b/i,
    ],
  },
  {
    tool: 'summarize_matter',
    patterns: [
      /\bsummarize\s+(the\s+)?matter\b/i,
      /\bmatter\s+summary\b/i,
      /\bsummarize_matter\b/i,
    ],
  },
  {
    tool: 'legal_research_memo',
    patterns: [
      /\blegal\s+research\b/i,
      /\bresearch\s+memo\b/i,
      /\blegal_research_memo\b/i,
    ],
  },
  {
    tool: 'draft_document',
    patterns: [
      /\bdraft\s+(a\s+)?document\b/i,
      /\bwrite\s+(a\s+)?(letter|motion|brief)\b/i,
      /\bdraft_document\b/i,
    ],
  },
  {
    tool: 'suggest_next_steps',
    patterns: [
      /\bnext\s+steps?\b/i,
      /\bwhat\s+should\s+(we|i)\s+do\b/i,
      /\bsuggest_next_steps\b/i,
    ],
  },
];

export function resolveCopilotTools(
  message: string,
  context?: Record<string, unknown>,
): CopilotToolName[] {
  const explicit = context?.requestedTool ?? context?.tool;
  if (typeof explicit === 'string' && explicit in COPILOT_TOOLS) {
    return [explicit as CopilotToolName];
  }

  const tools = new Set<CopilotToolName>();
  for (const entry of TOOL_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(message))) {
      tools.add(entry.tool);
    }
  }

  if (tools.size === 0) {
    return [];
  }

  return [...tools];
}

export function buildToolArgs(
  tool: CopilotToolName,
  message: string,
  context?: Record<string, unknown>,
): Record<string, unknown> {
  const matterId =
    (context?.selectedMatterId as string | undefined) ??
    (context?.matterId as string | undefined);

  switch (tool) {
    case 'create_task':
      return {
        matterId,
        title: extractQuotedTitle(message) ?? truncateTaskTitle(message),
        priority: 'MEDIUM',
      };
    case 'summarize_matter':
      return { matterId, message };
    case 'legal_research_memo':
      return {
        matterId,
        query: message,
        countryCode: (context?.countryCode as string) ?? 'US',
        jurisdiction: context?.jurisdiction,
      };
    case 'draft_document':
      return {
        matterId,
        documentType: (context?.documentType as string) ?? 'memo',
        instructions: message,
      };
    case 'suggest_next_steps':
      return { matterId, message };
    default:
      return { matterId, message };
  }
}

function extractQuotedTitle(message: string): string | undefined {
  const match = message.match(/["']([^"']{3,120})["']/);
  return match?.[1]?.trim();
}

function truncateTaskTitle(message: string): string {
  const cleaned = message.replace(/\b(create|add|new)\s+task\b/gi, '').trim();
  const title = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
  return title || 'Follow up from copilot';
}
