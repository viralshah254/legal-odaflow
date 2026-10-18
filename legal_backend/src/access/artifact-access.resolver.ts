import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from './matter-access.service';
import { EthicalWallService } from '@/platform/security/ethical-wall.service';

export interface AccessActor {
  tenantId: string;
  userId: string;
  tenantRole?: string;
}

@Injectable()
export class ArtifactAccessResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly ethicalWall: EthicalWallService,
  ) {}

  async assertMatterReadable(actor: AccessActor, matterId: string): Promise<void> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId: actor.tenantId },
      select: { id: true, clientId: true, status: true },
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    if (matter.status === 'archived') {
      throw new ForbiddenException('Matter is archived');
    }
    await this.matterAccess.ensureMatterAccess(
      actor.tenantId,
      actor.userId,
      matterId,
      actor.tenantRole,
    );
    const wall = await this.ethicalWall.checkAccess(actor.tenantId, actor.userId, matterId);
    if (!wall.allowed) {
      throw new ForbiddenException('Ethical wall restriction');
    }
    if (matter.clientId) {
      await this.assertClientWall(actor, matter.clientId);
    }
  }

  async assertClientReadable(actor: AccessActor, clientId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    const accessible = await this.matterAccess.getAccessibleClientIds(
      actor.tenantId,
      actor.userId,
      actor.tenantRole,
    );
    if (accessible !== null && !accessible.includes(clientId)) {
      throw new ForbiddenException('Client access denied');
    }
    await this.assertClientWall(actor, clientId);
  }

  async assertClientMatterLink(
    actor: AccessActor,
    clientId: string,
    matterId: string,
  ): Promise<{ clientName: string }> {
    await this.assertClientReadable(actor, clientId);
    await this.assertMatterReadable(actor, matterId);
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId: actor.tenantId },
      select: { clientId: true },
    });
    if (!matter?.clientId || matter.clientId !== clientId) {
      throw new ForbiddenException('Matter does not belong to the selected client');
    }
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: actor.tenantId },
      select: { name: true },
    });
    return { clientName: client?.name ?? '' };
  }

  async assertDraftJobAccessible(
    actor: AccessActor,
    jobId: string,
  ): Promise<{ job: { id: string; tenantId: string; userId: string; matterId: string | null } }> {
    const job = await this.prisma.draftJob.findFirst({
      where: { id: jobId, tenantId: actor.tenantId },
      select: { id: true, tenantId: true, userId: true, matterId: true },
    });
    if (!job) {
      throw new NotFoundException('Draft job not found');
    }
    if (job.userId !== actor.userId) {
      throw new ForbiddenException('Draft job access denied');
    }
    if (job.matterId) {
      await this.assertMatterReadable(actor, job.matterId);
    }
    return { job };
  }

  private async assertClientWall(actor: AccessActor, clientId: string): Promise<void> {
    const walls = await this.prisma.ethicalWall.findMany({
      where: { tenantId: actor.tenantId, status: 'active' },
    });
    for (const wall of walls) {
      const userRestricted = wall.restrictedUserIds.includes(actor.userId);
      const clientProtected = wall.protectedClientIds.includes(clientId);
      if (userRestricted && clientProtected) {
        throw new ForbiddenException('Ethical wall restriction');
      }
    }
  }
}
