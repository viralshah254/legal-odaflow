import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from './matter-access.service';
import { GrantMatterAccessDto } from './dto/matter-access.dto';

@Injectable()
export class MatterAccessManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
  ) {}

  async grantAccess(
    tenantId: string,
    matterId: string,
    actorId: string,
    actorRole: string | undefined,
    dto: GrantMatterAccessDto,
  ) {
    if (!this.matterAccess.hasFullAccess(actorRole)) {
      throw new ForbiddenException('Only admins can grant matter access');
    }

    await this.ensureMatter(tenantId, matterId);

    const user = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId: dto.userId },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new NotFoundException('User is not an active tenant member');
    }

    return this.prisma.matterAccess.upsert({
      where: {
        matterId_userId: { matterId, userId: dto.userId },
      },
      create: {
        tenantId,
        matterId,
        userId: dto.userId,
        accessLevel: dto.accessLevel ?? 'READ_ONLY',
        grantedBy: dto.grantedBy ?? actorId,
      },
      update: {
        accessLevel: dto.accessLevel ?? 'READ_ONLY',
        grantedBy: dto.grantedBy ?? actorId,
      },
    });
  }

  async revokeAccess(
    tenantId: string,
    matterId: string,
    userId: string,
    actorId: string,
    actorRole: string | undefined,
  ) {
    if (!this.matterAccess.hasFullAccess(actorRole)) {
      throw new ForbiddenException('Only admins can revoke matter access');
    }

    await this.ensureMatter(tenantId, matterId);

    const access = await this.prisma.matterAccess.findUnique({
      where: { matterId_userId: { matterId, userId } },
    });

    if (!access || access.tenantId !== tenantId) {
      throw new NotFoundException('Matter access record not found');
    }

    await this.prisma.matterAccess.delete({
      where: { matterId_userId: { matterId, userId } },
    });

    return { success: true, revokedBy: actorId };
  }

  async listAccess(tenantId: string, matterId: string) {
    await this.ensureMatter(tenantId, matterId);

    return this.prisma.matterAccess.findMany({
      where: { tenantId, matterId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
  }
}
