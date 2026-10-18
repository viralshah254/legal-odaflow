import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { JobsService } from '@/jobs/jobs.service'
import type { AgentWorkflow, AgentWorkflowRun } from '@prisma/client'

export interface CreateWorkflowDto {
  name: string
  description?: string
  workflowDsl: Record<string, unknown>
  triggerType?: 'manual' | 'schedule' | 'event' | 'webhook'
  schedule?: string
  matterId?: string
}

@Injectable()
export class AgenticWorkflowService {
  private readonly logger = new Logger(AgenticWorkflowService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  async createWorkflow(tenantId: string, userId: string, dto: CreateWorkflowDto): Promise<AgentWorkflow> {
    return this.prisma.agentWorkflow.create({
      data: {
        tenantId,
        userId,
        name: dto.name,
        description: dto.description ?? null,
        workflowDsl: dto.workflowDsl as any,
        triggerType: dto.triggerType ?? 'manual',
        schedule: dto.schedule ?? null,
        matterId: dto.matterId ?? null,
        status: 'draft',
      },
    })
  }

  async activateWorkflow(id: string, tenantId: string): Promise<AgentWorkflow> {
    const workflow = await this.getWorkflow(id, tenantId)

    const dsl = workflow.workflowDsl as Record<string, unknown>
    if (!dsl || typeof dsl !== 'object') {
      throw new BadRequestException('Workflow DSL is missing or invalid')
    }

    const steps = dsl['steps'] ?? dsl['actions']
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new BadRequestException('Workflow DSL must contain a non-empty "steps" or "actions" array')
    }

    // Validate each step has an action
    for (const step of steps as Array<Record<string, unknown>>) {
      if (!step['action'] && !step['type']) {
        throw new BadRequestException('Each workflow step must have an "action" or "type" field')
      }
    }

    return this.prisma.agentWorkflow.update({
      where: { id },
      data: { status: 'active' },
    })
  }

  async runWorkflow(id: string, tenantId: string, triggeredBy: string): Promise<AgentWorkflowRun> {
    const workflow = await this.getWorkflow(id, tenantId)

    if (workflow.status !== 'active') {
      throw new BadRequestException(`Workflow is "${workflow.status}" — activate it before running`)
    }

    const run = await this.prisma.agentWorkflowRun.create({
      data: {
        workflowId: id,
        tenantId,
        status: 'queued',
        startedAt: new Date(),
      },
    })

    await this.prisma.agentWorkflow.update({
      where: { id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        lastRunStatus: 'queued',
      },
    })

    // Enqueue to BullMQ for real async execution
    await this.jobsService.enqueueAgenticWorkflowRun({
      runId: run.id,
      workflowId: id,
      tenantId,
      triggeredBy,
      workflowDsl: workflow.workflowDsl as Record<string, unknown>,
    })

    this.logger.log(`Agentic workflow run ${run.id} enqueued for workflow ${id}`)
    return run
  }

  async pauseWorkflow(id: string, tenantId: string): Promise<AgentWorkflow> {
    await this.getWorkflow(id, tenantId)
    return this.prisma.agentWorkflow.update({
      where: { id },
      data: { status: 'paused' },
    })
  }

  async getRuns(workflowId: string, tenantId: string): Promise<AgentWorkflowRun[]> {
    await this.getWorkflow(workflowId, tenantId)
    return this.prisma.agentWorkflowRun.findMany({
      where: { workflowId, tenantId },
      orderBy: { startedAt: 'desc' },
    })
  }

  async getWorkflow(id: string, tenantId: string): Promise<AgentWorkflow> {
    const wf = await this.prisma.agentWorkflow.findFirst({ where: { id, tenantId } })
    if (!wf) throw new NotFoundException('Agent workflow not found')
    return wf
  }

  async listWorkflows(tenantId: string): Promise<AgentWorkflow[]> {
    return this.prisma.agentWorkflow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    })
  }
}
