import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatterAccessService } from './matter-access.service';
import {
  GrantMatterAccessDto,
  UpdateMatterAccessDto,
} from './dto/matter-access.dto';

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

  async updateAccess(
    tenantId: string,
    matterId: string,
    userId: string,
    actorId: string,
    actorRole: string | undefined,
    dto: UpdateMatterAccessDto,
  ) {
    if (!this.matterAccess.hasFullAccess(actorRole)) {
      throw new ForbiddenException('Only admins can update matter access');
    }

    await this.ensureMatter(tenantId, matterId);
    const access = await this.prisma.matterAccess.findUnique({
      where: { matterId_userId: { matterId, userId } },
    });
    if (!access || access.tenantId !== tenantId) {
      throw new NotFoundException('Matter access record not found');
    }

    return this.prisma.matterAccess.update({
      where: { matterId_userId: { matterId, userId } },
      data: { accessLevel: dto.accessLevel, grantedBy: actorId },
    });
  }

  async listAccess(tenantId: string, matterId: string) {
    await this.ensureMatter(tenantId, matterId);

    const rows = await this.prisma.matterAccess.findMany({
      where: { tenantId, matterId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      matterId: row.matterId,
      userId: row.userId,
      userName: row.user.name ?? row.user.email.split('@')[0],
      accessLevel: row.accessLevel,
      sharedBy: row.grantedBy,
      sharedAt: row.createdAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getMyAccess(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatter(tenantId, matterId);

    if (this.matterAccess.hasFullAccess(role)) {
      return { accessLevel: 'WRITE', isOwner: true };
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: { matterId_userId: { matterId, userId } },
    });

    const writeLevels = new Set(['WRITE', 'FULL', 'FULL_CASE_SUPPORT', 'OWNER']);
    return {
      accessLevel: access?.accessLevel ?? null,
      isOwner: access ? writeLevels.has(access.accessLevel) : false,
    };
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
