import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiModelResolverService } from '@/ai-credits/ai-model-resolver.service';
import { getTenantPlanCreditAllowance } from '@/config/billing-plans';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TasksService } from '@/tasks/tasks.service';
import { JobsService } from '@/jobs/jobs.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { AI_MODES, AI_TASK_TYPES } from './constants';
import { AiPolicyService } from './ai-policy.service';
import { AiUsageService } from './ai-usage.service';
import { AiComplianceGuardService } from './ai-compliance-guard.service';
import { estimateCostUsd, estimateTokens } from '@/common/utils/prompt-hash.util';
import {
  buildToolArgs,
  COPILOT_TOOLS,
  resolveCopilotTools,
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

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiUsage: AiUsageService,
    private readonly aiPolicy: AiPolicyService,
    private readonly aiCreditLedger: AICreditLedgerService,
    private readonly aiModelResolver: AiModelResolverService,
    private readonly creditWallet: CreditWalletService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly tasksService: TasksService,
    private readonly jobsService: JobsService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async listSessions(tenantId: string, userId: string) {
    return this.prisma.copilotSession.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createSession(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    context?: Record<string, unknown>,
  ) {
    return this.prisma.copilotSession.create({
      data: {
        tenantId,
        userId,
        userRole,
        context: context as Prisma.InputJsonValue | undefined,
      },
    });
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

  async chat(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    message: string,
    sessionId?: string,
    context?: Record<string, unknown>,
    modelMode?: 'AUTO' | 'PREMIUM',
    premiumModelId?: string,
  ): Promise<CopilotChatResponse> {
    let session = sessionId
      ? await this.prisma.copilotSession.findFirst({
          where: { id: sessionId, tenantId, userId },
        })
      : null;

    if (!session) {
      session = await this.createSession(tenantId, userId, userRole, context);
    } else if (context) {
      session = await this.prisma.copilotSession.update({
        where: { id: session.id },
        data: { context: context as Prisma.InputJsonValue },
      });
    }

    await this.prisma.copilotMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    const resolvedTools = resolveCopilotTools(message, context);
    const toolCalls: CopilotToolCallRecord[] = [];
    const actionProposals: CopilotActionProposal[] = [];
    const asyncJobs: Array<{ toolName: CopilotToolName; jobId: string }> = [];

    for (const toolName of resolvedTools) {
      const definition = COPILOT_TOOLS[toolName];
      const args = buildToolArgs(toolName, message, context);
      const toolCallId = randomUUID();

      if (!definition.async) {
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
    const inputTokens = estimateTokens(message);
    const estimatedOutputTokens = 800;
    const estimatedChatCost = estimateCostUsd(inputTokens, estimatedOutputTokens);

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
      : getTenantPlanCreditAllowance(tenantRecord?.billingPlan);
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
    if (!hasAsyncAiTools) {
      const debitResult = await this.aiCreditLedger.assertAndDebit({
        userId,
        tenantId,
        taskType: AI_TASK_TYPES.LAWYER_MATTER_QA,
        credits: modelContext.route.estimatedCredits,
        metadata: {
          sessionId: session.id,
          mode: 'copilot_chat',
          modelMode: modelContext.modelMode,
          premiumFallback: modelContext.premiumFallback,
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

    const toolSummary =
      resolvedTools.length > 0
        ? `\n\n_Tools invoked: ${resolvedTools.join(', ')}._`
        : '';
    let assistantContent =
      (await this.generateAssistantReply(
        message,
        context,
        modelContext.route.modelName,
      )) + toolSummary;

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

    const outputTokens = estimateTokens(assistantContent);

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

    await this.aiUsage.logUsage({
      userId,
      tenantId,
      taskType: AI_TASK_TYPES.LAWYER_MATTER_QA,
      mode: modelContext.modelMode,
      modelProvider: this.configService.get<string>('AI_PROVIDER', 'openai'),
      modelName: modelContext.route.modelName,
      modelTier: modelContext.route.tier,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(inputTokens, outputTokens),
      chargedCredits: creditsCharged,
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
      premiumFallback: modelContext.premiumFallback,
      creditsCharged,
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

  async listAudit(tenantId: string, userId: string, limit = 50) {
    return this.prisma.copilotAuditLog.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async executeSyncTool(
    tenantId: string,
    userId: string,
    toolName: CopilotToolName,
    args: Record<string, unknown>,
  ): Promise<{ result?: unknown; error?: string }> {
    if (toolName !== 'create_task') {
      return { error: `Unsupported sync tool: ${toolName}` };
    }

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

  private buildActionProposal(
    toolName: CopilotToolName,
    args: Record<string, unknown>,
    outcome: { result?: unknown; error?: string },
    requiresApproval: boolean,
    jobId?: string,
  ): CopilotActionProposal {
    const definition = COPILOT_TOOLS[toolName];
    const matterId = args.matterId as string | undefined;
    const executed = toolName === 'create_task' && !outcome.error;
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

  private async generateAssistantReply(
    message: string,
    context?: Record<string, unknown>,
    modelName?: string,
  ): Promise<string> {
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    const contextLine = context
      ? `\nContext: ${JSON.stringify(context)}`
      : '';

    if (openAiKey) {
      const resolvedModel =
        modelName ?? this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a matter-aware legal copilot for licensed attorneys. Be concise and actionable.',
            },
            { role: 'user', content: `${message}${contextLine}` },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return (
          payload.choices?.[0]?.message?.content ??
          'I could not generate a response right now.'
        );
      }
    }

    return [
      'Here is a quick copilot response based on your request:',
      '',
      `> ${message}`,
      '',
      '- Review the selected matter timeline and outstanding tasks.',
      '- Confirm jurisdiction-specific deadlines before acting.',
      '- Document your research trail in the matter file.',
      context?.selectedMatterId
        ? `\nMatter context: \`${String(context.selectedMatterId)}\``
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
