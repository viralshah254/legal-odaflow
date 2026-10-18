import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';

export interface CreateCopilotPlanDto {
  title: string;
  sessionId?: string;
  matterId?: string;
  leadId?: string;
  steps: Array<{
    title: string;
    description?: string;
    kind?: string;
    agentKey?: string;
    toolName?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface UpdateCopilotPlanStepDto {
  id: string;
  title?: string;
  description?: string;
  kind?: string;
  status?: string;
  sortOrder?: number;
  agentKey?: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CopilotPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  async listPlans(tenantId: string, userId: string) {
    const plans = await this.prisma.copilotPlan.findMany({
      where: { tenantId, userId },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    await Promise.all(plans.map((plan) => this.refreshRunningSteps(plan.id)));
    return this.prisma.copilotPlan.findMany({
      where: { tenantId, userId },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  async getPlan(tenantId: string, planId: string) {
    await this.refreshRunningSteps(planId);
    const plan = await this.prisma.copilotPlan.findFirst({
      where: { id: planId, tenantId },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async createPlan(tenantId: string, userId: string, dto: CreateCopilotPlanDto) {
    return this.prisma.copilotPlan.create({
      data: {
        tenantId,
        userId,
        sessionId: dto.sessionId,
        matterId: dto.matterId,
        leadId: dto.leadId,
        title: dto.title,
        status: 'draft',
        steps: {
          create: dto.steps.map((step, index) => ({
            sortOrder: index,
            title: step.title,
            description: step.description,
            kind: step.kind ?? 'task',
            status: step.kind === 'question' ? 'needs_input' : 'pending',
            agentKey: step.agentKey,
            toolName: step.toolName,
            metadata: (step.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        },
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async updatePlanSteps(
    tenantId: string,
    planId: string,
    steps: UpdateCopilotPlanStepDto[],
  ) {
    await this.getPlan(tenantId, planId);
    await this.prisma.$transaction(
      steps.map((step) =>
        this.prisma.copilotPlanStep.update({
          where: { id: step.id },
          data: {
            title: step.title,
            description: step.description,
            kind: step.kind,
            status: step.status,
            sortOrder: step.sortOrder,
            agentKey: step.agentKey,
            toolName: step.toolName,
            metadata: (step.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        }),
      ),
    );
    return this.getPlan(tenantId, planId);
  }

  async executePlan(tenantId: string, userId: string, planId: string) {
    const plan = await this.getPlan(tenantId, planId);
    await this.prisma.copilotPlan.update({
      where: { id: planId },
      data: { status: 'active' },
    });

    const runnable = plan.steps.filter(
      (s) => s.status === 'pending' && (s.agentKey || s.toolName),
    );

    for (const step of runnable) {
      await this.prisma.copilotPlanStep.update({
        where: { id: step.id },
        data: { status: 'running' },
      });

      if (step.agentKey) {
        const enqueue = await this.jobsService.enqueueAgentJob({
          tenantId,
          userId,
          agentId: step.agentKey,
          jobType: step.toolName ?? 'plan_step',
          params: {
            planId: plan.id,
            stepId: step.id,
            title: step.title,
            description: step.description,
            matterId: plan.matterId,
          },
        });

        await this.prisma.copilotPlanStep.update({
          where: { id: step.id },
          data: {
            metadata: {
              ...(typeof step.metadata === 'object' && step.metadata !== null
                ? (step.metadata as Record<string, unknown>)
                : {}),
              agentJobId: enqueue.agentJobId,
            } as Prisma.InputJsonValue,
          },
        });
      } else {
        await this.prisma.copilotPlanStep.update({
          where: { id: step.id },
          data: { status: 'done' },
        });
      }
    }

    return this.getPlan(tenantId, planId);
  }

  /** Poll agent jobs linked to running plan steps and mark completed/failed. */
  async refreshRunningSteps(planId: string) {
    const runningSteps = await this.prisma.copilotPlanStep.findMany({
      where: { planId, status: 'running' },
    });

    for (const step of runningSteps) {
      const metadata =
        step.metadata && typeof step.metadata === 'object'
          ? (step.metadata as Record<string, unknown>)
          : {};
      const agentJobId = metadata.agentJobId as string | undefined;
      if (!agentJobId) continue;

      const job = await this.prisma.agentJob.findUnique({
        where: { id: agentJobId },
        select: { status: true },
      });
      if (!job) continue;

      if (job.status === 'COMPLETED') {
        await this.prisma.copilotPlanStep.update({
          where: { id: step.id },
          data: { status: 'done' },
        });
      } else if (job.status === 'FAILED') {
        await this.prisma.copilotPlanStep.update({
          where: { id: step.id },
          data: { status: 'pending' },
        });
      }
    }

    const remaining = await this.prisma.copilotPlanStep.count({
      where: { planId, status: { in: ['pending', 'running', 'needs_input'] } },
    });
    if (remaining === 0) {
      await this.prisma.copilotPlan.update({
        where: { id: planId },
        data: { status: 'completed' },
      });
    }
  }

  async markStepDoneFromJob(stepId: string, status: 'COMPLETED' | 'FAILED') {
    const step = await this.prisma.copilotPlanStep.findUnique({
      where: { id: stepId },
      select: { id: true, planId: true, status: true },
    });
    if (!step || step.status !== 'running') return;

    await this.prisma.copilotPlanStep.update({
      where: { id: stepId },
      data: { status: status === 'COMPLETED' ? 'done' : 'pending' },
    });
    await this.refreshRunningSteps(step.planId);
  }
}
