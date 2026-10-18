import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AgentsService } from '@/agents/agents.service';
import { INTERNAL_AGENTS, InternalAgentId } from '@/agents/agent.registry';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AiModelResolverService } from '@/ai-credits/ai-model-resolver.service';
import { resolveModelProvider } from '@/ai/model-costs.config';
import { getUnpaidTenantCreditAllowance } from '@/config/billing-plans';
import {
  resolveJurisdiction,
  buildJurisdictionPromptBlock,
} from '@/config/jurisdiction-engine';
import { buildLocalePromptInstruction } from '@/config/locales';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TasksService } from '@/tasks/tasks.service';
import { JobsService } from '@/jobs/jobs.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { AI_MODES, AI_TASK_TYPES } from './constants';
import { AiPolicyService } from './ai-policy.service';
import { routeIntent } from './intent-router';
import { AiUsageService } from './ai-usage.service';
import { AiCostService } from './costs/ai-cost.service';
import { AiComplianceGuardService } from './ai-compliance-guard.service';
import { LlmCompletionService } from './llm-completion.service';
import { estimateCostUsd, estimateTokens } from '@/common/utils/prompt-hash.util';
import { DraftIntentService } from './draft-intent/draft-intent.service';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import {
  buildToolArgs,
  COPILOT_TOOLS,
  resolveCopilotTools,
  resolveCopilotToolsWithLlm,
} from './copilot-tools.registry';
import {
  CopilotActionProposal,
  CopilotChatResponse,
  CopilotToolCallRecord,
  CopilotToolName,
} from './copilot.types';

/** Async copilot tools that debit their own task credits when the job runs */
const ASYNC_AI_DEBIT_TOOLS = new Set<CopilotToolName>([
  'summarize_matter',
  'legal_research_memo',
  'draft_document',
]);

type WorkspaceTaskRow = {
  id: string;
  title: string;
  dueDate: string | null;
  matterId: string | null;
  matterTitle?: string | null;
};

function formatRelativeDue(dueDateIso: string | null | undefined): string {
  if (!dueDateIso) return '';
  const due = new Date(dueDateIso);
  if (Number.isNaN(due.getTime())) return '';
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `was due ${Math.abs(diffDays)} day(s) ago`;
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  return `due in ${diffDays} days`;
}

function formatTaskLine(task: WorkspaceTaskRow): string {
  const matterPart = task.matterTitle ? ` — ${task.matterTitle}` : '';
  const duePart = task.dueDate ? ` (${formatRelativeDue(task.dueDate)})` : '';
  return `• "${task.title}"${matterPart}${duePart}`;
}

function buildContextBrief(context: Record<string, unknown>): string {
  const workspace = context.tenantWorkspace as Record<string, unknown> | undefined;
  if (!workspace) return '';

  const lines: string[] = [];
  const firmName = String(workspace.firmName ?? 'Firm');
  const country = workspace.country ? String(workspace.country) : '';
  const plan = workspace.billingPlan ? String(workspace.billingPlan) : '';
  const locationLabel = [country, plan].filter(Boolean).join(' · ');

  lines.push('=== FIRM WORKSPACE ===');
  lines.push(
    locationLabel ? `Firm: ${firmName} (${locationLabel})` : `Firm: ${firmName}`,
  );
  lines.push(
    `Today: ${new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })}`,
  );
  lines.push('');
  lines.push('DASHBOARD:');

  const overdueTasks = (workspace.overdueTasks as WorkspaceTaskRow[] | undefined) ?? [];
  const upcomingTasks = (workspace.upcomingTasks as WorkspaceTaskRow[] | undefined) ?? [];
  const openTasksCount = Number(workspace.openTasksCount ?? 0);
  const overdueCount = Number(workspace.overdueTasksCount ?? overdueTasks.length);

  lines.push(
    `• Active matters: ${workspace.openMattersCount ?? 0} | Clients: ${workspace.clientsCount ?? 0}`,
  );
  lines.push(
    `• Your open tasks: ${openTasksCount} total${overdueCount > 0 ? ` — ${overdueCount} overdue` : ''}`,
  );
  if (workspace.pendingAiReview) {
    lines.push(`• AI drafts awaiting your review: ${workspace.pendingAiReview}`);
  }
  if (workspace.openLeadsCount) {
    lines.push(`• Open leads: ${workspace.openLeadsCount}`);
  }
  if (workspace.pendingTimeApprovals) {
    lines.push(`• Time entries pending approval: ${workspace.pendingTimeApprovals}`);
  }

  if (overdueTasks.length > 0) {
    lines.push('');
    lines.push('OVERDUE TASKS (action needed):');
    for (const task of overdueTasks) {
      lines.push(formatTaskLine(task));
    }
  }

  if (upcomingTasks.length > 0) {
    lines.push('');
    lines.push('YOUR TASKS DUE IN NEXT 7 DAYS:');
    for (const task of upcomingTasks) {
      lines.push(formatTaskLine(task));
    }
  }

  const recentMatters =
    (workspace.recentMatters as Array<{ title: string; status: string }> | undefined) ?? [];
  if (recentMatters.length > 0) {
    lines.push('');
    lines.push('RECENT OPEN MATTERS:');
    lines.push(
      recentMatters
        .map((matter) => `• ${matter.title} (${matter.status})`)
        .join('\n'),
    );
  }

  if (context.matterTitle) {
    lines.push('');
    lines.push('SELECTED MATTER:');
    lines.push(`• Title: ${context.matterTitle}`);
    if (context.matterStatus) lines.push(`• Status: ${context.matterStatus}`);
    if (context.practiceArea) lines.push(`• Practice area: ${context.practiceArea}`);
    if (context.clientName) lines.push(`• Client: ${context.clientName}`);
    if (context.factsSummary) lines.push(`• Facts: ${String(context.factsSummary).slice(0, 4000)}`);
    if (context.matterProfile) {
      lines.push(`• Intelligence profile: ${JSON.stringify(context.matterProfile).slice(0, 3500)}`);
    }
    if (context.matterAnalysis) {
      const analysis = context.matterAnalysis as Record<string, unknown>;
      lines.push(`• Current analysis: ${String(analysis.summary ?? '').slice(0, 3000)}`);
      for (const key of ['risks', 'nextActions', 'evidenceGaps'] as const) {
        if (Array.isArray(analysis[key]) && analysis[key].length > 0) {
          lines.push(`• ${key}: ${analysis[key].slice(0, 8).join('; ')}`);
        }
      }
    }
    if (Array.isArray(context.matterDocuments) && context.matterDocuments.length > 0) {
      lines.push('• Matter document context:');
      for (const document of context.matterDocuments.slice(0, 8) as Array<Record<string, unknown>>) {
        lines.push(`  - ${document.fileName}: ${String(document.text ?? 'No searchable text').slice(0, 1800)}`);
      }
    }
  } else if (context.clientName) {
    lines.push('');
    lines.push('SELECTED CLIENT:');
    lines.push(`• Name: ${context.clientName}`);
  } else if (context.taskTitle) {
    lines.push('');
    lines.push('SELECTED TASK:');
    lines.push(`• Title: ${context.taskTitle}`);
    if (context.taskStatus) lines.push(`• Status: ${context.taskStatus}`);
    if (context.matterTitle) lines.push(`• Matter: ${context.matterTitle}`);
  }

  if (context.pagePath) {
    lines.push('');
    lines.push(`Current page: ${context.pagePath}`);
  }

  return `\n\nTenant-scoped context (only this firm's data):\n${lines.join('\n')}`;
}

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiUsage: AiUsageService,
    private readonly aiCostService: AiCostService,
    private readonly aiPolicy: AiPolicyService,
    private readonly aiCreditLedger: AICreditLedgerService,
    private readonly aiModelResolver: AiModelResolverService,
    private readonly aiCreditEnforcement: AiCreditEnforcementService,
    private readonly creditWallet: CreditWalletService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly tasksService: TasksService,
    private readonly jobsService: JobsService,
    private readonly agentsService: AgentsService,
    private readonly realtime: RealtimePublisherService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly draftIntent: DraftIntentService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly matterMemory: MatterMemoryService,
  ) {}

  async listSessions(tenantId: string, userId: string) {
    const sessions = await this.prisma.copilotSession.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    if (sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((s) => s.id);
    const messages = await this.prisma.copilotMessage.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        sessionId: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    const grouped = new Map<string, typeof messages>();
    for (const message of messages) {
      const bucket = grouped.get(message.sessionId) ?? [];
      bucket.push(message);
      grouped.set(message.sessionId, bucket);
    }

    return sessions.map((session) => {
      const thread = grouped.get(session.id) ?? [];
      const firstUser = thread.find((m) => m.role === 'user');
      const lastAssistant = [...thread].reverse().find((m) => m.role === 'assistant');
      const previewMessages = [firstUser, lastAssistant].filter(
        (m, index, arr): m is NonNullable<typeof m> =>
          !!m && arr.findIndex((item) => item?.id === m.id) === index,
      );

      return {
        ...session,
        messages: previewMessages,
      };
    });
  }

  async createSession(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    context?: Record<string, unknown>,
    deliverableType?: string,
  ) {
    return this.prisma.copilotSession.create({
      data: {
        tenantId,
        userId,
        userRole,
        context: context as Prisma.InputJsonValue | undefined,
        deliverableType,
      },
    });
  }

  async generateDeliverable(
    tenantId: string,
    userId: string,
    sessionId: string,
    deliverableType?: string,
    documentText?: string,
  ) {
    const session = await this.prisma.copilotSession.findFirst({
      where: { id: sessionId, tenantId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
    });

    if (!session) {
      throw new NotFoundException('Copilot session not found');
    }

    const type = deliverableType ?? session.deliverableType ?? 'key_issues_list';
    const conversation = session.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n')
      .slice(0, 12000);

    const prompts: Record<string, string> = {
      key_issues_list:
        'Produce a structured Key Issues List with numbered issues, risk level, and recommended action for each.',
      clause_summary:
        'Produce a clause-by-clause summary table with risk flags and negotiation notes.',
      research_memo:
        'Produce a legal research memo with executive summary, analysis, and recommended next steps.',
      redline_report:
        'Produce a redline report listing each suggested change with original text, proposed text, and rationale.',
    };

    const systemPrompt = `You are a senior legal analyst. ${prompts[type] ?? prompts.key_issues_list}
Format in clear markdown suitable for a deliverable panel.`;

    const userPrompt = [
      documentText ? `Document:\n"""\n${documentText.slice(0, 40000)}\n"""` : '',
      conversation ? `Conversation context:\n${conversation}` : '',
      'Generate the deliverable now.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await this.llmCompletion.complete({
      modelName: this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 4000,
      temperature: 0.2,
    });

    const deliverable = {
      type,
      content: result.content.trim(),
      generatedAt: new Date().toISOString(),
    };

    await this.prisma.copilotSession.update({
      where: { id: sessionId },
      data: {
        deliverableType: type,
        deliverableJson: deliverable as Prisma.InputJsonValue,
      },
    });

    return deliverable;
  }

  async getSessionMessages(tenantId: string, userId: string, sessionId: string) {
    const session = await this.prisma.copilotSession.findFirst({
      where: { id: sessionId, tenantId, userId },
    });

    if (!session) {
      throw new NotFoundException('Copilot session not found');
    }

    return this.prisma.copilotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteSession(tenantId: string, userId: string, sessionId: string) {
    const session = await this.prisma.copilotSession.findFirst({
      where: { id: sessionId, tenantId, userId },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException('Copilot session not found');
    }

    await this.prisma.copilotSession.delete({ where: { id: sessionId } });
    return { deleted: true, id: sessionId };
  }

  async chat(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    message: string,
    sessionId?: string,
    context?: Record<string, unknown>,
    modelMode?: 'AUTO' | 'PREMIUM',
    premiumModelId?: string,
    locale?: string,
    knowledgeSources?: string[],
  ): Promise<CopilotChatResponse> {
    const enrichedContext = await this.enrichCopilotContext(
      tenantId,
      userId,
      knowledgeSources
        ? { ...context, knowledgeSources }
        : context,
    );

    let session = sessionId
      ? await this.prisma.copilotSession.findFirst({
          where: { id: sessionId, tenantId, userId },
        })
      : null;

    if (!session) {
      session = await this.createSession(
        tenantId,
        userId,
        userRole,
        enrichedContext,
      );
    } else if (enrichedContext) {
      session = await this.prisma.copilotSession.update({
        where: { id: session.id },
        data: { context: enrichedContext as Prisma.InputJsonValue },
      });
    }

    await this.prisma.copilotMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    const agentJobResult = await this.maybeEnqueueAgentJob(
      tenantId,
      userId,
      session.id,
      message,
      enrichedContext,
    );

    // Use native LLM tool calling to detect intent; fall back to regex if LLM fails
    const fastModel = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
    const llmToolResult = await resolveCopilotToolsWithLlm(
      message,
      fastModel,
      this.llmCompletion,
      enrichedContext ?? undefined,
    );
    const resolvedTools: CopilotToolName[] = llmToolResult.toolName ? [llmToolResult.toolName] : resolveCopilotTools(message, enrichedContext);

    const toolCalls: CopilotToolCallRecord[] = agentJobResult?.toolCall
      ? [agentJobResult.toolCall]
      : [];
    const actionProposals: CopilotActionProposal[] = agentJobResult?.actionProposal
      ? [agentJobResult.actionProposal]
      : [];
    const asyncJobs: Array<{ toolName: CopilotToolName; jobId: string }> =
      agentJobResult?.asyncJob ? [agentJobResult.asyncJob] : [];

    for (const toolName of resolvedTools) {
      const definition = COPILOT_TOOLS[toolName];
      const args = llmToolResult.toolName === toolName
        ? { ...buildToolArgs(toolName, message, enrichedContext), ...llmToolResult.toolArgs }
        : buildToolArgs(toolName, message, enrichedContext);
      const toolCallId = randomUUID();

      if (!definition.async) {
        if (definition.requiresApproval) {
          actionProposals.push(
            this.buildActionProposal(
              toolName,
              args,
              {},
              definition.requiresApproval,
            ),
          );
          continue;
        }

        const outcome = await this.executeSyncTool(
          tenantId,
          userId,
          toolName,
          args,
        );
        toolCalls.push({
          id: toolCallId,
          toolName,
          args,
          status: outcome.error ? 'error' : 'success',
          result: outcome.result,
          error: outcome.error,
        });
        actionProposals.push(
          this.buildActionProposal(toolName, args, outcome, definition.requiresApproval),
        );
        await this.auditTool(tenantId, userId, userRole, session.id, toolName, args, outcome);
        continue;
      }

      const estimatedAsyncCost = estimateCostUsd(estimateTokens(message), 1200);
      const asyncBudgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
        tenantId,
        userId,
        estimatedAsyncCost,
      );
      if (!asyncBudgetCheck.allowed) {
        throw new ForbiddenException(asyncBudgetCheck.reason ?? 'AI budget check failed');
      }

      if (definition.requiresApproval) {
        actionProposals.push(
          this.buildActionProposal(toolName, args, {}, definition.requiresApproval),
        );
        continue;
      }

      const enqueue = await this.jobsService.enqueueCopilotAiJob({
        toolName,
        tenantId,
        userId,
        userRole,
        sessionId: session.id,
        params: args,
        billingPlan: (
          await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { billingPlan: true },
          })
        )?.billingPlan,
      });

      toolCalls.push({
        id: toolCallId,
        toolName,
        args,
        status: enqueue.status === 'QUEUED' ? 'pending' : 'error',
        jobId: enqueue.agentJobId,
        error: enqueue.status === 'FAILED' ? enqueue.message : undefined,
      });

      if (enqueue.status === 'QUEUED') {
        asyncJobs.push({ toolName, jobId: enqueue.agentJobId });
      }

      actionProposals.push(
        this.buildActionProposal(
          toolName,
          args,
          { result: { jobId: enqueue.agentJobId, status: enqueue.status } },
          definition.requiresApproval,
          enqueue.agentJobId,
        ),
      );

      await this.auditTool(tenantId, userId, userRole, session.id, toolName, args, {
        result: { jobId: enqueue.agentJobId, queue: enqueue.queue },
      });
    }

    const startedAt = Date.now();
    const estimatedInputTokens = estimateTokens(message);
    const estimatedOutputTokens = 800;
    const estimatedChatCost = estimateCostUsd(estimatedInputTokens, estimatedOutputTokens);

    const chatBudgetCheck = await this.aiPolicy.checkBudgetBeforeTask(
      tenantId,
      userId,
      estimatedChatCost,
    );
    if (!chatBudgetCheck.allowed) {
      throw new ForbiddenException(chatBudgetCheck.reason ?? 'AI budget check failed');
    }

    const hasAsyncAiTools = resolvedTools.some((tool) => ASYNC_AI_DEBIT_TOOLS.has(tool));

    const tenantRecord = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true, createdAt: true },
    });
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, userType: 'LAW_FIRM', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
    const planCreditsMonthly = subscription
      ? await this.resolvePlanCredits(subscription.planId, subscription.countryCode)
      : getUnpaidTenantCreditAllowance();
    const cycleStart = subscription?.currentPeriodStart ?? tenantRecord?.createdAt ?? new Date();

    const modelContext = await this.aiModelResolver.resolveForTask({
      userId,
      tenantId,
      taskType: AI_TASK_TYPES.LAWYER_MATTER_QA,
      planCreditsMonthly,
      cycleStart,
      overrideMode: modelMode,
      overridePremiumModelId: premiumModelId,
    });

    let creditsCharged = 0;
    const historyRows = await this.prisma.copilotMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 24,
    });
    const conversationHistory = historyRows
      .slice(0, -1)
      .map((row) => ({ role: row.role, content: row.content }));

    if (!hasAsyncAiTools) {
      await this.aiCreditEnforcement.assertCanUseAi({
        userId,
        tenantId,
        modelMode: modelContext.modelMode,
        modelName: modelContext.route.modelName,
        planCreditsMonthly,
        cycleStart,
        inputTokens: estimateTokens(message + JSON.stringify(enrichedContext ?? {})),
        outputTokens: estimatedOutputTokens,
      });
    }

    const toolSummary =
      resolvedTools.length > 0
        ? `\n\n_Tools invoked: ${resolvedTools.join(', ')}._`
        : '';
    const reply = await this.generateAssistantReply(
      message,
      enrichedContext,
      modelContext.route.modelName,
      conversationHistory,
      locale,
    );
    let assistantContent = reply.content + toolSummary;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { primaryCountry: true },
    });
    const countryPolicy = await this.complianceGuard.getPolicyForCountry(
      tenant?.primaryCountry ?? 'US',
    );
    const sanitized = this.complianceGuard.sanitizeOutput(
      assistantContent,
      countryPolicy,
      'lawyer',
    );
    assistantContent = sanitized.outputMarkdown;

    const outputTokens = reply.outputTokens || estimateTokens(assistantContent);
    const inputTokens = reply.inputTokens || estimateTokens(message);

    if (!hasAsyncAiTools) {
      const debitResult = await this.aiCreditEnforcement.debitForTokenUsage({
        userId,
        tenantId,
        taskType: AI_TASK_TYPES.LAWYER_MATTER_QA,
        modelName: modelContext.route.modelName,
        inputTokens,
        outputTokens,
        metadata: {
          sessionId: session.id,
          mode: 'copilot_chat',
          modelMode: modelContext.modelMode,
          premiumFallback: false,
        },
      });
      creditsCharged = debitResult.creditsDebited;

      const tenantForTopUp = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { primaryCountry: true },
      });
      await this.creditWallet.checkAutoTopUp({
        userId,
        tenantId,
        balance: debitResult.balanceAfter,
        countryCode: tenantForTopUp?.primaryCountry ?? 'US',
      });
    }

    const assistantMessage = await this.prisma.copilotMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent,
        citations: [],
        toolCalls: toolCalls.length
          ? (toolCalls as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await this.prisma.copilotSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    this.realtime.publishToUser(userId, REALTIME_EVENTS.COPILOT_MESSAGE_CREATED, {
      tenantId,
      entityId: assistantMessage.id,
      action: 'created',
      data: {
        sessionId: session.id,
        role: assistantMessage.role,
      },
    });

    await this.prisma.copilotAuditLog.create({
      data: {
        tenantId,
        userId,
        userRole,
        sessionId: session.id,
        action: 'executed',
        toolName: 'chat',
        payload: { message, tools: resolvedTools },
        result: {
          messageId: assistantMessage.id,
          actionProposalCount: actionProposals.length,
        },
      },
    });

    const costUsd = await this.aiCostService.computeActualCostUsd({
      provider: resolveModelProvider(modelContext.route.modelName),
      modelName: modelContext.route.modelName,
      inputTokens,
      outputTokens,
    });
    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      creditsCharged,
      tenant?.primaryCountry ?? 'US',
    );
    const { platformMarginUsd } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: costUsd,
    });

    await this.aiUsage.logUsage({
      userId,
      tenantId,
      taskType: AI_TASK_TYPES.LAWYER_MATTER_QA,
      mode: modelContext.modelMode,
      modelProvider: resolveModelProvider(modelContext.route.modelName),
      modelName: modelContext.route.modelName,
      modelTier: modelContext.route.tier,
      inputTokens,
      outputTokens,
      costUsd,
      chargedCredits: creditsCharged,
      creditValueUsd,
      platformMarginUsd,
      latencyMs: Date.now() - startedAt,
      status: 'SUCCESS',
    });

    return {
      sessionId: session.id,
      message: {
        id: assistantMessage.id,
        sessionId: assistantMessage.sessionId,
        role: assistantMessage.role,
        content: assistantMessage.content,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        citations: assistantMessage.citations ?? undefined,
        createdAt: assistantMessage.createdAt,
      },
      actionProposals,
      asyncJobs: asyncJobs.length ? asyncJobs : undefined,
      modelMode: modelContext.modelMode,
      modelName: modelContext.route.modelName,
      premiumFallback: false,
      creditsCharged,
    };
  }

  private shouldRunAgent(message: string): boolean {
    const lower = message.toLowerCase();
    return message.includes('@agent') || lower.includes('run agent');
  }

  private parseAgentId(message: string, context?: Record<string, unknown>): InternalAgentId {
    const explicit = context?.agentId as string | undefined;
    if (explicit && explicit in INTERNAL_AGENTS) {
      return explicit as InternalAgentId;
    }

    const atMatch = message.match(/@agent\s+\{?([\w-]+)\}?/i);
    if (atMatch?.[1] && atMatch[1] in INTERNAL_AGENTS) {
      return atMatch[1] as InternalAgentId;
    }

    const runMatch = message.match(/run agent\s+\{?([\w-]+)\}?/i);
    if (runMatch?.[1] && runMatch[1] in INTERNAL_AGENTS) {
      return runMatch[1] as InternalAgentId;
    }

    return 'matter-analyst';
  }

  private resolveToolForAgent(agentId: InternalAgentId): CopilotToolName {
    const agent = INTERNAL_AGENTS[agentId];
    return agent.copilotTools?.[0] ?? 'summarize_matter';
  }

  private async maybeEnqueueAgentJob(
    tenantId: string,
    userId: string,
    sessionId: string,
    message: string,
    context?: Record<string, unknown>,
  ): Promise<{
    toolCall: CopilotToolCallRecord;
    actionProposal: CopilotActionProposal;
    asyncJob: { toolName: CopilotToolName; jobId: string };
  } | null> {
    if (!this.shouldRunAgent(message)) {
      return null;
    }

    const matterId = context?.selectedMatterId as string | undefined;
    const agentId = this.parseAgentId(message, context);
    const toolName = this.resolveToolForAgent(agentId);

    const enqueue = await this.agentsService.enqueueAgentJob({
      agentId,
      jobType: 'copilot_agent',
      tenantId,
      userId,
      sessionId,
      params: {
        message,
        matterId,
        context,
        toolName,
      },
    });

    const toolCallId = randomUUID();
    const toolCall: CopilotToolCallRecord = {
      id: toolCallId,
      toolName,
      args: { matterId, message, agentId },
      status: enqueue.status === 'QUEUED' ? 'pending' : 'error',
      jobId: enqueue.agentJobId,
      error: enqueue.status === 'FAILED' ? enqueue.message : undefined,
    };

    const actionProposal = this.buildActionProposal(
      toolName,
      { matterId, message, agentId },
      { result: { jobId: enqueue.agentJobId, status: enqueue.status } },
      true,
      enqueue.agentJobId,
    );

    await this.auditTool(tenantId, userId, undefined, sessionId, toolName, {
      matterId,
      message,
      agentId,
    }, {
      result: { jobId: enqueue.agentJobId, queue: enqueue.queue },
    });

    if (enqueue.status !== 'QUEUED') {
      return { toolCall, actionProposal, asyncJob: { toolName, jobId: enqueue.agentJobId } };
    }

    return {
      toolCall,
      actionProposal,
      asyncJob: { toolName, jobId: enqueue.agentJobId },
    };
  }

  private async resolvePlanCredits(planId: string, countryCode: string): Promise<number> {
    const dbPlan = await this.prisma.countryPricing.findUnique({
      where: {
        countryCode_userType_planId: {
          countryCode: countryCode.toUpperCase(),
          userType: 'LAW_FIRM',
          planId,
        },
      },
    });
    return dbPlan?.aiCredits ?? 50;
  }

  async listAudit(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    limit = 50,
  ) {
    const tenantScoped = userRole === 'PARTNER_ADMIN';
    const rows = await this.prisma.copilotAuditLog.findMany({
      where: tenantScoped ? { tenantId } : { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map(({ createdAt, ...rest }) => ({
      ...rest,
      timestamp: createdAt.toISOString(),
    }));
  }

  async approveAction(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    proposalId: string,
    input: {
      sessionId: string;
      toolName: CopilotToolName;
      payload: Record<string, unknown>;
      jobId?: string;
    },
  ): Promise<CopilotActionProposal> {
    const { sessionId, toolName, payload, jobId } = input;
    const definition = COPILOT_TOOLS[toolName];
    if (!definition) {
      throw new BadRequestException(`Unknown tool: ${toolName}`);
    }

    const session = await this.prisma.copilotSession.findFirst({
      where: { id: sessionId, tenantId, userId },
    });
    if (!session) {
      throw new NotFoundException('Copilot session not found');
    }

    if (!definition.async) {
      const args = { ...payload };
      delete args.result;
      delete args.error;
      const outcome = await this.executeSyncTool(tenantId, userId, toolName, args);
      await this.prisma.copilotAuditLog.create({
        data: {
          tenantId,
          userId,
          userRole,
          sessionId,
          action: outcome.error ? 'failed' : 'approved',
          toolName,
          payload: args as Prisma.InputJsonValue,
          result: (outcome.result ?? { error: outcome.error, proposalId }) as Prisma.InputJsonValue,
          error: outcome.error,
        },
      });
      return this.buildActionProposal(toolName, args, outcome, definition.requiresApproval);
    }

    if (jobId) {
      await this.prisma.copilotAuditLog.create({
        data: {
          tenantId,
          userId,
          userRole,
          sessionId,
          action: 'approved',
          toolName,
          payload: payload as Prisma.InputJsonValue,
          result: { jobId, status: 'approved', proposalId } as Prisma.InputJsonValue,
        },
      });
      return this.buildActionProposal(
        toolName,
        payload,
        { result: { jobId, status: 'approved' } },
        definition.requiresApproval,
        jobId,
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true },
    });
    const enqueue = await this.jobsService.enqueueCopilotAiJob({
      toolName,
      tenantId,
      userId,
      userRole,
      sessionId,
      params: payload,
      billingPlan: tenant?.billingPlan,
    });

    await this.prisma.copilotAuditLog.create({
      data: {
        tenantId,
        userId,
        userRole,
        sessionId,
        action: enqueue.status === 'QUEUED' ? 'approved' : 'failed',
        toolName,
        payload: payload as Prisma.InputJsonValue,
        result: { jobId: enqueue.agentJobId, status: enqueue.status, proposalId } as Prisma.InputJsonValue,
        error: enqueue.status === 'FAILED' ? enqueue.message : undefined,
      },
    });

    return this.buildActionProposal(
      toolName,
      payload,
      { result: { jobId: enqueue.agentJobId, status: enqueue.status } },
      definition.requiresApproval,
      enqueue.agentJobId,
    );
  }

  async rejectAction(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    proposalId: string,
    input: {
      sessionId: string;
      toolName: CopilotToolName;
      payload: Record<string, unknown>;
    },
  ): Promise<CopilotActionProposal> {
    const { sessionId, toolName, payload } = input;
    const definition = COPILOT_TOOLS[toolName];

    await this.prisma.copilotAuditLog.create({
      data: {
        tenantId,
        userId,
        userRole,
        sessionId,
        action: 'rejected',
        toolName,
        payload: payload as Prisma.InputJsonValue,
        result: { status: 'rejected', proposalId } as Prisma.InputJsonValue,
      },
    });

    return {
      id: proposalId,
      label: definition?.label ?? toolName,
      description: definition?.description ?? '',
      toolName,
      payload,
      affectedRecords: [],
      requiresApproval: definition?.requiresApproval ?? true,
      status: 'rejected',
    };
  }

  private async executeSyncTool(
    tenantId: string,
    userId: string,
    toolName: CopilotToolName,
    args: Record<string, unknown>,
  ): Promise<{ result?: unknown; error?: string }> {
    if (toolName === 'create_task') {
      const title = String(args.title ?? 'Copilot task');
      const matterId = args.matterId as string | undefined;

      try {
        const task = await this.tasksService.create(tenantId, {
          matterId,
          title,
          priority: (args.priority as string | undefined) ?? 'MEDIUM',
          status: 'TODO',
        });

        return {
          result: {
            taskId: task.id,
            title: task.title,
            matterId: task.matterId,
          },
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Task creation failed',
        };
      }
    }

    if (toolName === 'find_draft') {
      try {
        let query = String(args.query ?? '');
        const matterId = args.matterId as string | undefined;
        if (matterId && !query.trim()) {
          const matter = await this.prisma.matter.findFirst({
            where: { id: matterId, tenantId },
            select: { factsSummary: true },
          });
          query = matter?.factsSummary?.trim() ?? '';
        }

        const result = await this.draftIntent.resolve({
          query,
          tenantId,
          userId,
          countryCode: args.countryCode as string | undefined,
          jurisdiction: args.jurisdiction as string | undefined,
        });
        return { result };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Draft search failed',
        };
      }
    }

    return { error: `Unsupported sync tool: ${toolName}` };
  }

  private buildActionProposal(
    toolName: CopilotToolName,
    args: Record<string, unknown>,
    outcome: { result?: unknown; error?: string },
    requiresApproval: boolean,
    jobId?: string,
  ): CopilotActionProposal {
    const definition = COPILOT_TOOLS[toolName];
    const matterId = args.matterId as string | undefined;
    const executed =
      (toolName === 'create_task' || toolName === 'find_draft') && !outcome.error;
    const affectedRecords = matterId
      ? [{ type: 'matter', id: matterId, label: 'Matter' }]
      : [];

    if (outcome.result && typeof outcome.result === 'object' && 'taskId' in (outcome.result as object)) {
      const task = outcome.result as { taskId: string; title: string };
      affectedRecords.push({
        type: 'task',
        id: task.taskId,
        label: task.title,
      });
    }

    return {
      id: randomUUID(),
      label: definition.label,
      description: definition.description,
      toolName,
      payload: { ...args, result: outcome.result, error: outcome.error },
      affectedRecords,
      requiresApproval,
      status: outcome.error
        ? 'failed'
        : executed
          ? 'executed'
          : jobId
            ? 'proposed'
            : 'proposed',
      jobId,
    };
  }

  private async auditTool(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    sessionId: string,
    toolName: CopilotToolName,
    payload: Record<string, unknown>,
    outcome: { result?: unknown; error?: string },
  ) {
    await this.prisma.copilotAuditLog.create({
      data: {
        tenantId,
        userId,
        userRole,
        sessionId,
        action: outcome.error ? 'failed' : 'executed',
        toolName,
        payload: payload as Prisma.InputJsonValue,
        result: (outcome.result ?? { error: outcome.error }) as Prisma.InputJsonValue,
        error: outcome.error,
      },
    });
  }

  private async enrichCopilotContext(
    tenantId: string,
    userId: string,
    context?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const matterId =
      (context?.selectedMatterId as string | undefined) ??
      (context?.matterId as string | undefined);
    const clientId =
      (context?.selectedClientId as string | undefined) ??
      (context?.clientId as string | undefined);
    const taskId =
      (context?.selectedTaskId as string | undefined) ??
      (context?.taskId as string | undefined);
    const invoiceId =
      (context?.selectedInvoiceId as string | undefined) ??
      (context?.invoiceId as string | undefined);

    const enriched: Record<string, unknown> = {
      ...(context ?? {}),
      tenantId,
      selectedMatterId: matterId,
      selectedClientId: clientId,
      selectedTaskId: taskId,
      selectedInvoiceId: invoiceId,
      matterId,
      clientId,
      taskId,
      invoiceId,
    };

    if (matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { id: matterId, tenantId },
        include: {
          client: { select: { id: true, name: true } },
          documents: {
            where: { status: 'ACTIVE' },
            select: { fileName: true, extractedText: true },
            orderBy: { createdAt: 'desc' },
            take: 8,
          },
          analysisSnapshots: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!matter) {
        throw new BadRequestException(
          'Selected matter is not in this firm workspace',
        );
      }
      enriched.matterTitle = matter.title;
      enriched.matterStatus = matter.status;
      enriched.practiceArea = matter.practiceArea;
      enriched.factsSummary = matter.factsSummary;
      enriched.matterDocuments = matter.documents.map((document) => ({
        fileName: document.fileName,
        text: document.extractedText?.slice(0, 3000) ?? null,
      }));
      const latestAnalysis = matter.analysisSnapshots[0];
      if (latestAnalysis) {
        enriched.matterAnalysis = {
          summary: latestAnalysis.summary,
          risks: latestAnalysis.risks,
          nextActions: latestAnalysis.nextActions,
          evidenceGaps: latestAnalysis.evidenceGaps,
          contradictions: latestAnalysis.contradictions,
          createdAt: latestAnalysis.createdAt,
        };
      }
      if (matter.clientId) {
        enriched.selectedClientId = matter.clientId;
        enriched.clientId = matter.clientId;
        enriched.clientName = matter.client?.name;
      }

      let matterProfile = matter.matterProfile as MatterProfile | null;
      if (!matterProfile && matter.factsSummary?.trim()) {
        const miResult = await this.matterPipeline.run({
          facts: matter.factsSummary,
          countryCode: matter.countryCode,
          jurisdiction: matter.jurisdiction ?? undefined,
          skipRetrieval: true,
        });
        matterProfile = miResult.profile;
        void this.matterMemory
          .persist(
            'matter',
            matter.id,
            {
              profile: miResult.profile,
              graph: miResult.graph,
              taskGraph: miResult.taskGraph,
            },
            matter.factsSummary,
          )
          .catch(() => undefined);
        enriched.matterGraph = miResult.graph ?? matter.matterGraph;
        enriched.matterTaskGraph = miResult.taskGraph ?? matter.matterTaskGraph;
      } else {
        enriched.matterGraph = matter.matterGraph;
        enriched.matterTaskGraph = matter.matterTaskGraph;
      }
      if (matterProfile) {
        enriched.matterProfile = matterProfile;
      }
    }

    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, tenantId },
      });
      if (!client) {
        throw new BadRequestException(
          'Selected client is not in this firm workspace',
        );
      }
      enriched.clientName = client.name;
    }

    if (taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, tenantId },
        include: { matter: { select: { id: true, title: true } } },
      });
      if (!task) {
        throw new BadRequestException(
          'Selected task is not in this firm workspace',
        );
      }
      enriched.taskTitle = task.title;
      enriched.taskStatus = task.status;
      if (task.matterId) {
        enriched.selectedMatterId = task.matterId;
        enriched.matterId = task.matterId;
        enriched.matterTitle = task.matter?.title;
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, primaryCountry: true, billingPlan: true },
    });

    const now = new Date();
    const weekOut = new Date(now);
    weekOut.setDate(weekOut.getDate() + 7);

    const [
      recentMatters,
      openMattersCount,
      openTasks,
      overdueTasks,
      upcomingTasks,
      clientsCount,
      pendingApprovals,
      pendingAiReview,
      openLeadsCount,
    ] = await Promise.all([
      this.prisma.matter.findMany({
        where: {
          tenantId,
          status: { notIn: ['CLOSED', 'ARCHIVED'] },
        },
        select: { id: true, title: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.matter.count({
        where: {
          tenantId,
          status: { notIn: ['CLOSED', 'ARCHIVED'] },
        },
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          OR: [{ assigneeId: userId }, { assigneeId: null }],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          matterId: true,
          matter: { select: { title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 8,
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          dueDate: { lt: now },
          status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
          OR: [{ assigneeId: userId }, { assigneeId: null }],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          matterId: true,
          matter: { select: { title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          dueDate: { gte: now, lte: weekOut },
          status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
          OR: [{ assigneeId: userId }, { assigneeId: null }],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          matterId: true,
          matter: { select: { title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.client.count({ where: { tenantId } }),
      this.prisma.timeEntry.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'DRAFT'] } },
      }),
      this.prisma.aIOutput.count({
        where: {
          tenantId,
          requiresLawyerReview: true,
        },
      }),
      this.prisma.lawyerLead.count({
        where: {
          tenantId,
          status: { in: ['NEW', 'OPEN'] },
        },
      }),
    ]);

    const mapTaskRow = (task: {
      id: string;
      title: string;
      dueDate: Date | null;
      matterId: string | null;
      matter?: { title: string } | null;
    }): WorkspaceTaskRow => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate?.toISOString() ?? null,
      matterId: task.matterId,
      matterTitle: task.matter?.title ?? null,
    });

    enriched.tenantWorkspace = {
      firmName: tenant?.name,
      country: tenant?.primaryCountry,
      billingPlan: tenant?.billingPlan,
      clientsCount,
      openMattersCount,
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      pendingTimeApprovals: pendingApprovals,
      pendingAiReview,
      openLeadsCount,
      recentMatters: recentMatters.map((matter) => ({
        id: matter.id,
        title: matter.title,
        status: matter.status,
      })),
      myOpenTasks: openTasks.map(mapTaskRow),
      overdueTasks: overdueTasks.map(mapTaskRow),
      upcomingTasks: upcomingTasks.map(mapTaskRow),
      pagePath: context?.pagePath,
    };

    return enriched;
  }

  private async generateAssistantReply(
    message: string,
    context?: Record<string, unknown>,
    modelName?: string,
    history: Array<{ role: string; content: string }> = [],
    locale?: string,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const workspace = context?.tenantWorkspace as Record<string, unknown> | undefined;
    const firmName = workspace?.firmName ?? 'the firm';
    const workspaceCountry =
      typeof workspace?.country === 'string' ? (workspace.country as string) : undefined;
    const contextBlock = context ? buildContextBrief(context) : '';

    // Intent routing — detect AI patterns so the prompt can be scoped appropriately.
    const detectedPatterns = await routeIntent(message).catch(() => [] as string[]);
    const patternBlock = detectedPatterns.length > 0
      ? `Active AI patterns: ${detectedPatterns.join(', ')}. Focus your response accordingly.`
      : '';

    // Inject jurisdiction guidance so copilot answers are jurisdiction-accurate.
    const jurisdictionProfile = resolveJurisdiction(workspaceCountry);
    const jurisdictionBlock = buildJurisdictionPromptBlock(jurisdictionProfile);

    const localeInstruction = buildLocalePromptInstruction(locale);

    // Inject knowledge-source restriction when the user selected specific sources.
    const knowledgeSources = context?.knowledgeSources as string[] | undefined;
    const knowledgeSourcesBlock = knowledgeSources && knowledgeSources.length > 0
      ? `Restrict retrieval and citations to these knowledge sources only: ${knowledgeSources.join(', ')}.`
      : '';

    const systemPrompt = [
      `You are a legal copilot for licensed attorneys at ${firmName}.`,
      'You only have access to the active firm workspace described in context — never invent clients, matters, or facts outside it.',
      'Be concise and actionable. When you state legal rules, use the correct citation format for the jurisdiction and never fabricate cases, statutes, or URLs.',
      localeInstruction,
      patternBlock,
      knowledgeSourcesBlock,
      '',
      jurisdictionBlock,
      contextBlock,
    ].filter(Boolean).join('\n');

    const resolvedModel =
      modelName ?? this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');

    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...history
        .filter((row) => row.role === 'user' || row.role === 'assistant')
        .map((row) => ({
          role: row.role as 'user' | 'assistant',
          content: row.content,
        })),
      { role: 'user' as const, content: message },
    ];

    const completion = await this.llmCompletion.complete({
      modelName: resolvedModel,
      messages: llmMessages,
      temperature: 0.2,
    });

    return {
      content: completion.content,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    };
  }
}
