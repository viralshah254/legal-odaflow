import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { FullLoopAutomationService } from '@/marketplace/full-loop-automation.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateMatterArgumentDto,
  CreateMatterFactDto,
  CreateMatterIssueDto,
  CreateMatterStrategyMemoDto,
  UpdateMatterArgumentDto,
  UpdateMatterFactDto,
  UpdateMatterIssueDto,
  UpdateMatterStrategyMemoDto,
} from './dto/matter-intelligence.dto';

@Injectable()
export class MatterIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly fullLoopAutomation: FullLoopAutomationService,
  ) {}

  // --- Facts ---

  async createFact(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateMatterFactDto,
  ) {
    const fact = await this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterFact.create({
        data: {
          tenantId,
          matterId,
          factText: dto.factText,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          confidence: dto.confidence ?? 0.5,
          isDisputed: dto.isDisputed ?? false,
          approvedByLawyer: dto.approvedByLawyer ?? false,
        },
      }),
    );

    void this.fullLoopAutomation.queueOutcomeRefreshOnFact(
      tenantId,
      matterId,
      userId,
      role,
    );

    return fact;
  }

  findAllFacts(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterFact.findMany({
        where: { tenantId, matterId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  findOneFact(
    tenantId: string,
    matterId: string,
    factId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const fact = await this.prisma.matterFact.findFirst({
        where: { id: factId, tenantId, matterId },
      });
      if (!fact) {
        throw new NotFoundException('Fact not found');
      }
      return fact;
    });
  }

  updateFact(
    tenantId: string,
    matterId: string,
    factId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateMatterFactDto,
  ) {
    return this.findOneFact(tenantId, matterId, factId, userId, role).then(() =>
      this.prisma.matterFact.update({
        where: { id: factId },
        data: dto,
      }),
    );
  }

  removeFact(
    tenantId: string,
    matterId: string,
    factId: string,
    userId: string,
    role?: string,
  ) {
    return this.findOneFact(tenantId, matterId, factId, userId, role).then(async () => {
      await this.prisma.matterFact.delete({ where: { id: factId } });
      return { success: true };
    });
  }

  // --- Issues ---

  createIssue(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateMatterIssueDto,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterIssue.create({
        data: {
          tenantId,
          matterId,
          title: dto.title,
          description: dto.description,
          status: dto.status ?? 'OPEN',
          priority: dto.priority ?? 'MEDIUM',
        },
      }),
    );
  }

  findAllIssues(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterIssue.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  findOneIssue(
    tenantId: string,
    matterId: string,
    issueId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const issue = await this.prisma.matterIssue.findFirst({
        where: { id: issueId, tenantId, matterId },
      });
      if (!issue) {
        throw new NotFoundException('Issue not found');
      }
      return issue;
    });
  }

  updateIssue(
    tenantId: string,
    matterId: string,
    issueId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateMatterIssueDto,
  ) {
    return this.findOneIssue(tenantId, matterId, issueId, userId, role).then(() =>
      this.prisma.matterIssue.update({
        where: { id: issueId },
        data: dto,
      }),
    );
  }

  removeIssue(
    tenantId: string,
    matterId: string,
    issueId: string,
    userId: string,
    role?: string,
  ) {
    return this.findOneIssue(tenantId, matterId, issueId, userId, role).then(async () => {
      await this.prisma.matterIssue.delete({ where: { id: issueId } });
      return { success: true };
    });
  }

  // --- Arguments ---

  createArgument(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateMatterArgumentDto,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterArgument.create({
        data: {
          tenantId,
          matterId,
          title: dto.title,
          side: dto.side ?? 'CLIENT',
          content: dto.content,
          strength: dto.strength,
        },
      }),
    );
  }

  findAllArguments(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterArgument.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  findOneArgument(
    tenantId: string,
    matterId: string,
    argumentId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const argument = await this.prisma.matterArgument.findFirst({
        where: { id: argumentId, tenantId, matterId },
      });
      if (!argument) {
        throw new NotFoundException('Argument not found');
      }
      return argument;
    });
  }

  updateArgument(
    tenantId: string,
    matterId: string,
    argumentId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateMatterArgumentDto,
  ) {
    return this.findOneArgument(tenantId, matterId, argumentId, userId, role).then(() =>
      this.prisma.matterArgument.update({
        where: { id: argumentId },
        data: dto,
      }),
    );
  }

  removeArgument(
    tenantId: string,
    matterId: string,
    argumentId: string,
    userId: string,
    role?: string,
  ) {
    return this.findOneArgument(tenantId, matterId, argumentId, userId, role).then(async () => {
      await this.prisma.matterArgument.delete({ where: { id: argumentId } });
      return { success: true };
    });
  }

  // --- Strategy memos ---

  createStrategyMemo(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateMatterStrategyMemoDto,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterStrategyMemo.create({
        data: {
          tenantId,
          matterId,
          title: dto.title,
          content: dto.content,
          status: dto.status ?? 'DRAFT',
          createdBy: userId,
        },
      }),
    );
  }

  findAllStrategyMemos(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, () =>
      this.prisma.matterStrategyMemo.findMany({
        where: { tenantId, matterId },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  findOneStrategyMemo(
    tenantId: string,
    matterId: string,
    memoId: string,
    userId: string,
    role?: string,
  ) {
    return this.withMatterAccess(tenantId, matterId, userId, role, async () => {
      const memo = await this.prisma.matterStrategyMemo.findFirst({
        where: { id: memoId, tenantId, matterId },
      });
      if (!memo) {
        throw new NotFoundException('Strategy memo not found');
      }
      return memo;
    });
  }

  updateStrategyMemo(
    tenantId: string,
    matterId: string,
    memoId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateMatterStrategyMemoDto,
  ) {
    return this.findOneStrategyMemo(tenantId, matterId, memoId, userId, role).then(() =>
      this.prisma.matterStrategyMemo.update({
        where: { id: memoId },
        data: dto,
      }),
    );
  }

  removeStrategyMemo(
    tenantId: string,
    matterId: string,
    memoId: string,
    userId: string,
    role?: string,
  ) {
    return this.findOneStrategyMemo(tenantId, matterId, memoId, userId, role).then(async () => {
      await this.prisma.matterStrategyMemo.delete({ where: { id: memoId } });
      return { success: true };
    });
  }

  private async withMatterAccess<T>(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (!this.matterAccess.hasFullAccess(role)) {
      try {
        await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
      } catch {
        throw new ForbiddenException('Matter access denied');
      }
    }

    return fn();
  }
}
