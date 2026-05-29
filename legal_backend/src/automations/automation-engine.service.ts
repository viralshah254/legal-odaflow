import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobsService } from '@/jobs/jobs.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AutomationAction,
  AutomationConditions,
  AutomationRunPayload,
  AutomationTrigger,
} from './automation.types';

@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async dispatch(
    tenantId: string,
    trigger: AutomationTrigger,
    context: Record<string, unknown>,
  ) {
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId, isEnabled: true, trigger },
    });

    const enqueued: string[] = [];

    for (const rule of rules) {
      if (!this.matchesConditions(rule.conditions, context)) {
        continue;
      }

      const run = await this.prisma.automationRun.create({
        data: {
          tenantId,
          ruleId: rule.id,
          status: 'QUEUED',
        },
      });

      await this.jobsService.enqueueAutomationRun({
        runId: run.id,
        tenantId,
        ruleId: rule.id,
        trigger,
        context,
      });

      enqueued.push(run.id);
    }

    return { trigger, enqueuedRuns: enqueued.length, runIds: enqueued };
  }

  async executeRun(payload: AutomationRunPayload) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: payload.ruleId, tenantId: payload.tenantId },
    });

    if (!rule) {
      return { status: 'skipped', reason: 'rule_not_found' };
    }

    await this.prisma.automationRun.update({
      where: { id: payload.runId },
      data: { status: 'RUNNING' },
    });

    const actions = this.parseActions(rule.actions);
    const results: Array<Record<string, unknown>> = [];

    try {
      for (const action of actions) {
        results.push(await this.executeAction(payload.tenantId, action, payload.context));
      }

      await this.prisma.automationRun.update({
        where: { id: payload.runId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: results as Prisma.InputJsonValue,
        },
      });

      return { status: 'completed', results };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Automation failed';
      this.logger.warn(`Automation run ${payload.runId} failed: ${message}`);

      await this.prisma.automationRun.update({
        where: { id: payload.runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: message,
        },
      });

      return { status: 'failed', error: message };
    }
  }

  private parseActions(raw: Prisma.JsonValue | null): AutomationAction[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(
      (item): item is AutomationAction =>
        typeof item === 'object' && item !== null && 'type' in item,
    );
  }

  private matchesConditions(
    raw: Prisma.JsonValue | null,
    context: Record<string, unknown>,
  ): boolean {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return true;
    }

    const conditions = raw as AutomationConditions;

    if (conditions.hasAssignee && !context.assigneeId) {
      return false;
    }

    if (conditions.jobType && context.jobType !== conditions.jobType) {
      return false;
    }

    if (conditions.matterType && context.matterType !== conditions.matterType) {
      return false;
    }

    if (
      conditions.minAmount !== undefined &&
      Number(context.amount ?? 0) < conditions.minAmount
    ) {
      return false;
    }

    return true;
  }

  private interpolate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = context[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private resolveField(
    context: Record<string, unknown>,
    field?: string,
    fallback?: string,
  ): string | undefined {
    if (field && context[field]) {
      return String(context[field]);
    }
    return fallback;
  }

  private async executeAction(
    tenantId: string,
    action: AutomationAction,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (action.type) {
      case 'send_notification': {
        let userId =
          action.userId ??
          this.resolveField(context, action.userIdField) ??
          this.resolveField(context, 'userId');

        if (!userId && action.notifyRole) {
          userId = await this.resolveUserIdByRole(tenantId, action.notifyRole);
        }

        if (!userId) {
          return { type: action.type, skipped: true, reason: 'missing_user' };
        }

        const notification = await this.notificationsService.createAndDispatch({
          tenantId,
          userId,
          title: this.interpolate(action.title, context),
          body: this.interpolate(action.body, context),
          type: 'AUTOMATION',
          metadata: { automation: true } as Prisma.InputJsonValue,
        });

        return { type: action.type, notificationId: notification.id };
      }

      case 'create_task': {
        const matterId = this.resolveField(context, action.matterIdField ?? 'matterId');
        const assigneeId = this.resolveField(
          context,
          action.assigneeIdField ?? 'assigneeId',
        );

        const task = await this.prisma.task.create({
          data: {
            tenantId,
            matterId,
            title: this.interpolate(action.title, context),
            priority: action.priority ?? 'MEDIUM',
            status: 'TODO',
            assigneeId,
          },
        });

        return { type: action.type, taskId: task.id };
      }

      case 'enqueue_agent_job': {
        const userId = this.resolveField(context, 'userId');
        const matterId = this.resolveField(context, action.matterIdField ?? 'matterId');

        if (!userId) {
          return { type: action.type, skipped: true, reason: 'missing_user' };
        }

        const toolName = action.toolName as
          | 'summarize_matter'
          | 'legal_research_memo'
          | 'draft_document'
          | 'suggest_next_steps';

        const result = await this.jobsService.enqueueCopilotAiJob({
          toolName,
          tenantId,
          userId,
          params: { matterId, message: `Automation triggered ${toolName}` },
          priority: action.priority ?? 'low',
        });

        return { type: action.type, agentJobId: result.agentJobId };
      }

      default:
        return { type: 'unknown', skipped: true };
    }
  }

  private async resolveUserIdByRole(
    tenantId: string,
    role: 'FIRM_ADMIN' | 'FINANCE' | 'PARTNER',
  ): Promise<string | undefined> {
    const roles =
      role === 'FIRM_ADMIN'
        ? ['FIRM_ADMIN', 'PARTNER']
        : role === 'PARTNER'
          ? ['PARTNER', 'FIRM_ADMIN']
          : ['FINANCE', 'FIRM_ADMIN', 'PARTNER'];

    const membership = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        role: { in: roles },
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });

    return membership?.userId;
  }
}
