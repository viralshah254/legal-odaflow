import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { buildLocalePromptInstruction } from '@/config/locales';
import { PrismaService } from '@/prisma/prisma.service';
import { sleep } from './llm-retry.util';
import { LlmCompletionService, LlmMessage } from './llm-completion.service';
import { COPILOT_TOOL_SCHEMAS } from './copilot-tools.registry';

/**
 * A single "step" in the ReAct loop:
 * thought -> action (tool call or answer)
 */
interface ReActStep {
  thought: string;
  action: 'tool' | 'answer';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  observation?: string;
  answer?: string;
}

export interface ReActResult {
  finalAnswer: string;
  steps: ReActStep[];
  toolsUsed: string[];
}

/** Available ReAct tools (each has a name, description, and executor) */
interface ReActTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

@Injectable()
export class ReActAgentService {
  private readonly logger = new Logger(ReActAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmCompletion: LlmCompletionService,
  ) {}

  /**
   * Run a multi-step ReAct agent loop for a given query.
   * The agent will iteratively think, select a tool, observe the result,
   * and repeat until it produces a final answer (max 5 steps).
   */
  async run(params: {
    query: string;
    matterId?: string;
    tenantId: string;
    modelName: string;
    maxSteps?: number;
    locale?: string;
  }): Promise<ReActResult> {
    const tools = this.buildTools(params.matterId, params.tenantId);
    return this.runLoop({ ...params, tools });
  }

  async runWithTools(params: {
    query: string;
    matterId?: string;
    tenantId: string;
    modelName: string;
    maxSteps?: number;
    locale?: string;
    tools: ReActTool[];
  }): Promise<ReActResult> {
    return this.runLoop(params);
  }

  private async runLoop(params: {
    query: string;
    matterId?: string;
    tenantId: string;
    modelName: string;
    maxSteps?: number;
    locale?: string;
    tools: ReActTool[];
  }): Promise<ReActResult> {
    const maxSteps = params.maxSteps ?? 5;
    const steps: ReActStep[] = [];
    const toolsUsed: string[] = [];
    const tools = params.tools;

    const systemPrompt = [
      `You are a legal AI assistant running a ReAct (Reason + Act) loop.
For each turn, you MUST respond with JSON in one of these two forms:

If you need to use a tool:
{"thought": "...", "action": "tool", "toolName": "tool_name", "toolArgs": {...}}

If you have enough information to answer:
{"thought": "...", "action": "answer", "answer": "your final answer here"}

Available tools:
${tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

Context: ${params.matterId ? `matter ID = ${params.matterId}` : 'no specific matter'}
Be concise. Produce the final answer as soon as you have enough information.`,
      buildLocalePromptInstruction(params.locale),
    ].filter(Boolean).join('\n');

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.query },
    ];

    for (let step = 0; step < maxSteps; step++) {
      try {
        const result = await this.llmCompletion.complete({
          modelName: params.modelName,
          messages,
          temperature: 0.1,
          maxTokens: 1200,
        });

        let parsed: ReActStep;
        try {
          const jsonMatch = result.content.match(/\{[\s\S]+\}/);
          parsed = JSON.parse(jsonMatch?.[0] ?? result.content) as ReActStep;
        } catch {
          parsed = { thought: result.content, action: 'answer', answer: result.content };
        }

        steps.push(parsed);

        if (parsed.action === 'answer' || !parsed.toolName) {
          return {
            finalAnswer: parsed.answer ?? result.content,
            steps,
            toolsUsed,
          };
        }

        const tool = tools.find((t) => t.name === parsed.toolName);
        let observation: string;

        if (!tool) {
          observation = `Tool "${parsed.toolName}" not found.`;
        } else {
          toolsUsed.push(parsed.toolName);
          try {
            observation = await tool.execute(parsed.toolArgs ?? {});
          } catch (e) {
            observation = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }

        parsed.observation = observation;

        messages.push({
          role: 'assistant',
          content: JSON.stringify({ thought: parsed.thought, action: 'tool', toolName: parsed.toolName, toolArgs: parsed.toolArgs }),
        });
        messages.push({
          role: 'user',
          content: `Observation: ${observation}\n\nContinue the ReAct loop.`,
        });

        // Spread TPM across steps to avoid burst rate limits on premium models.
        await sleep(400);
      } catch (e) {
        this.logger.error(`ReAct step ${step} failed: ${e}`);
        if (e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
          throw e;
        }
        if (e instanceof Error && /rate limit|429|AI_RATE_LIMIT/i.test(e.message)) {
          throw e;
        }
        break;
      }
    }

    return {
      finalAnswer: 'I was unable to produce a final answer within the step limit.',
      steps,
      toolsUsed,
    };
  }

  private buildTools(matterId: string | undefined, tenantId: string): ReActTool[] {
    return [
      {
        name: 'get_matter_facts',
        description: 'Retrieve key facts, parties, and context for the current matter',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          if (!matterId) return 'No matter specified.';
          const matter = await this.prisma.matter.findFirst({
            where: { id: matterId, tenantId },
            include: { client: true },
          });
          if (!matter) return 'Matter not found.';
          return JSON.stringify({
            title: matter.title,
            practiceArea: matter.practiceArea,
            stage: matter.stage,
            status: matter.status,
            factsSummary: matter.factsSummary,
            desiredOutcome: matter.desiredOutcome,
            opposingParty: matter.opposingParty,
            jurisdiction: matter.jurisdiction,
            clientName: matter.client?.name,
          });
        },
      },
      {
        name: 'get_matter_tasks',
        description: 'Get open tasks for the current matter',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          if (!matterId) return 'No matter specified.';
          const tasks = await this.prisma.task.findMany({
            where: { matterId, tenantId, status: { not: 'DONE' } },
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
            take: 10,
          });
          if (tasks.length === 0) return 'No open tasks.';
          return tasks.map((t) => `- [${t.priority}] ${t.title}${t.dueDate ? ` (due ${t.dueDate.toISOString().slice(0, 10)})` : ''}`).join('\n');
        },
      },
      {
        name: 'get_matter_documents',
        description: 'List documents attached to the current matter with short searchable excerpts',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          if (!matterId) return 'No matter specified.';
          const docs = await this.prisma.document.findMany({
            where: { matterId, tenantId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { fileName: true, mimeType: true, createdAt: true, aiDraftStatus: true, extractedText: true },
          });
          if (docs.length === 0) return 'No documents.';
          return docs.map((d) => `- ${d.fileName} (${d.mimeType})${d.aiDraftStatus ? ` [${d.aiDraftStatus}]` : ''}\n  ${d.extractedText?.slice(0, 1200) ?? 'No searchable text'}`).join('\n');
        },
      },
      {
        name: 'get_matter_analysis',
        description: 'Get the latest unified matter summary, risks, next actions, and evidence gaps',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          if (!matterId) return 'No matter specified.';
          const snapshot = await this.prisma.matterAnalysisSnapshot.findFirst({
            where: { matterId, tenantId },
            orderBy: { createdAt: 'desc' },
          });
          return snapshot
            ? JSON.stringify(snapshot)
            : 'No unified analysis exists yet. Ask the user to run full analysis from the matter overview.';
        },
      },
      {
        name: 'search_matter_documents',
        description: 'Search extracted text across documents in the current matter',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        execute: async (args) => {
          if (!matterId) return 'No matter specified.';
          const query = String(args.query ?? '').trim();
          if (!query) return 'A search query is required.';
          const documents = await this.prisma.document.findMany({
            where: {
              matterId,
              tenantId,
              status: 'ACTIVE',
              extractedText: { contains: query, mode: 'insensitive' },
            },
            select: { fileName: true, extractedText: true },
            take: 8,
          });
          if (!documents.length) return `No matter documents matched "${query}".`;
          return documents.map((document) => {
            const text = document.extractedText ?? '';
            const index = text.toLowerCase().indexOf(query.toLowerCase());
            const start = Math.max(0, index - 300);
            return `- ${document.fileName}: ${text.slice(start, start + 1200)}`;
          }).join('\n');
        },
      },
      {
        name: 'run_bulk_review',
        description: 'Check matter-wide AI review status and identify documents ready for a cited bulk review',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          if (!matterId) return 'No matter specified.';
          const [latest, documents] = await Promise.all([
            this.prisma.bulkDocumentReviewJob.findFirst({
              where: { matterId, tenantId },
              orderBy: { createdAt: 'desc' },
              select: { id: true, status: true, summaryMatrix: true, createdAt: true },
            }),
            this.prisma.document.findMany({
              where: { matterId, tenantId, status: 'ACTIVE', extractedText: { not: null } },
              select: { id: true, fileName: true },
              take: 50,
            }),
          ]);
          if (latest?.status === 'COMPLETED') {
            return `Latest bulk review completed at ${latest.createdAt.toISOString()}:\n${JSON.stringify(latest.summaryMatrix).slice(0, 8000)}`;
          }
          return `${documents.length} document(s) are ready for review. Open Documents → AI Review to select sources and start the approval-scoped bulk review.${latest ? ` Latest job status: ${latest.status}.` : ''}`;
        },
      },
      {
        name: 'get_planning_answers',
        description: 'Get questionnaire/intake answers saved for the current matter',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          if (!matterId) return 'No matter specified.';
          const matter = await this.prisma.matter.findFirst({
            where: { id: matterId, tenantId },
            select: { planningAnswers: true },
          });
          if (!matter?.planningAnswers) return 'No questionnaire answers saved.';
          return JSON.stringify(matter.planningAnswers, null, 2);
        },
      },
    ];
  }
}
