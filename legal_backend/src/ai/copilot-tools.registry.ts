import { CopilotToolName } from './copilot.types';
import { LlmCompletionService } from './llm-completion.service';

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
  find_draft: {
    name: 'find_draft',
    label: 'Find draft',
    description: 'Search forms catalog, templates, and AI drafting kinds',
    async: false,
    requiresApproval: false,
    priority: 'sync',
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
    tool: 'find_draft',
    patterns: [
      /\bfind_draft\b/i,
      /\bwhat (do you )?want to draft\b/i,
      /\b(find|search|look for)\s+(a\s+)?(form|template|contract|agreement|filing)\b/i,
      /\bdraft\s+(a |an )?(employment|contractor|construction|lease|nda|service|job)\b/i,
      /\b(uscis|irs|i-130|i-485|bail|petition|complaint)\b/i,
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
    if (
      context?.page === 'legal-forms' &&
      message.trim().length >= 8
    ) {
      return ['find_draft'];
    }
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
    case 'find_draft':
      return {
        query: (context?.draftQuery as string) ?? message,
        countryCode: (context?.countryCode as string) ?? undefined,
        jurisdiction: context?.jurisdiction as string | undefined,
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

/** OpenAI-compatible schema for each copilot tool for native tool calling */
export const COPILOT_TOOL_SCHEMAS = [
  {
    name: 'create_task',
    description: 'Create a task on the current matter. Use when the user wants to add or create a task.',
    parameters: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title (max 120 chars)' },
        priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'], description: 'Task priority' },
        matterId: { type: 'string', description: 'Matter ID to attach task to' },
      },
      required: ['title'],
    },
  },
  {
    name: 'summarize_matter',
    description: 'Generate a matter summary memo. Use when the user asks to summarize or get an overview of the matter.',
    parameters: {
      type: 'object' as const,
      properties: {
        matterId: { type: 'string', description: 'Matter ID to summarize' },
      },
      required: [],
    },
  },
  {
    name: 'legal_research_memo',
    description: 'Run legal research on a topic and produce a memo with citations. Use for legal research requests.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Research question or topic' },
        countryCode: { type: 'string', description: 'Country code for jurisdiction' },
        matterId: { type: 'string', description: 'Matter ID for context' },
      },
      required: ['query'],
    },
  },
  {
    name: 'draft_document',
    description: 'Draft a legal document (letter, motion, brief, contract). Use when asked to write or draft a document.',
    parameters: {
      type: 'object' as const,
      properties: {
        documentType: { type: 'string', description: 'Type of document (letter, motion, brief, contract, memo)' },
        instructions: { type: 'string', description: 'Specific instructions for the document' },
        matterId: { type: 'string', description: 'Matter ID for context' },
      },
      required: ['documentType'],
    },
  },
  {
    name: 'find_draft',
    description:
      'Search official forms, firm templates, and AI drafting kinds for what the user wants to draft. Use when asked to find a form, template, or contract type.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Natural language description of what to draft' },
        countryCode: { type: 'string', description: 'Country code (IN, US, GB, KE)' },
        jurisdiction: { type: 'string', description: 'State or jurisdiction code' },
      },
      required: ['query'],
    },
  },
  {
    name: 'suggest_next_steps',
    description: 'Suggest prioritized next steps for the matter. Use when asked what to do next.',
    parameters: {
      type: 'object' as const,
      properties: {
        matterId: { type: 'string', description: 'Matter ID' },
      },
      required: [],
    },
  },
];

/**
 * Resolve copilot tools via native LLM function/tool calling.
 * Falls back to regex-based resolution if tool calling fails.
 */
export async function resolveCopilotToolsWithLlm(
  message: string,
  modelName: string,
  llmCompletion: LlmCompletionService,
  context?: Record<string, unknown>,
): Promise<{ toolName: CopilotToolName | null; toolArgs: Record<string, unknown>; textContent: string }> {
  const explicit = context?.requestedTool ?? context?.tool;
  if (typeof explicit === 'string' && explicit in COPILOT_TOOLS) {
    const toolArgs = buildToolArgs(explicit as CopilotToolName, message, context);
    return { toolName: explicit as CopilotToolName, toolArgs, textContent: '' };
  }

  try {
    const matterId =
      (context?.selectedMatterId as string | undefined) ??
      (context?.matterId as string | undefined);

    const systemPrompt = `You are a legal copilot assistant. The user is working on a matter (id: ${matterId ?? 'unknown'}).
If the user's request clearly requires one of the available tools, call it. Otherwise respond in plain text.`;

    const result = await llmCompletion.completeWithTools({
      modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      tools: COPILOT_TOOL_SCHEMAS,
      temperature: 0.1,
    });

    if (result.toolName && result.toolName in COPILOT_TOOLS) {
      const toolName = result.toolName as CopilotToolName;
      const toolArgs = {
        ...buildToolArgs(toolName, message, context),
        ...result.toolArgs,
      };
      return { toolName, toolArgs, textContent: result.textContent };
    }

    return { toolName: null, toolArgs: {}, textContent: result.textContent };
  } catch {
    // Fall back to regex-based resolution
    const resolved = resolveCopilotTools(message, context);
    if (resolved.length > 0) {
      const toolName = resolved[0];
      return { toolName, toolArgs: buildToolArgs(toolName, message, context), textContent: '' };
    }
    return { toolName: null, toolArgs: {}, textContent: '' };
  }
}
