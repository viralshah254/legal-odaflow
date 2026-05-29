import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BUILT_IN_AUTOMATION_RECIPES,
  INTERNAL_AGENTS,
  InternalAgentId,
  listInternalAgents,
  resolveAgentForQueue,
} from './agent.registry';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAgents() {
    const dbAgents = await this.prisma.aIAgent.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
    });

    if (dbAgents.length > 0) {
      return dbAgents.map((agent) => ({
        id: agent.key,
        name: agent.name,
        description: agent.description ?? '',
        queue: INTERNAL_AGENTS[agent.key as InternalAgentId]?.queue ?? 'ai.low_priority',
        capabilities: (agent.allowedTools as string[]) ?? [],
        requiresApproval: agent.requiresApproval,
      }));
    }

    return listInternalAgents();
  }

  listRecipes() {
    return BUILT_IN_AUTOMATION_RECIPES;
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.agentJob.findFirst({
      where: {
        id: jobId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!job) {
      throw new NotFoundException('Agent job not found');
    }

    const agent = resolveAgentForQueue(job.queue);

    return {
      ...job,
      agent: agent
        ? { id: agent.id, name: agent.name, description: agent.description }
        : null,
    };
  }

  async listJobsForUser(userId: string, tenantId?: string, limit = 25) {
    return this.prisma.agentJob.findMany({
      where: {
        userId,
        tenantId: tenantId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }
}
