import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EthicalWallService } from '@/platform/security/ethical-wall.service';

const FULL_ACCESS_ROLES = new Set(['FIRM_ADMIN', 'PARTNER', 'PARTNER_ADMIN']);

@Injectable()
export class MatterAccessService {
  constructor(private readonly prisma: PrismaService, private readonly ethicalWalls: EthicalWallService) {}

  hasFullAccess(role?: string): boolean {
    return role ? FULL_ACCESS_ROLES.has(role) : false;
  }

  async getAccessibleMatterIds(
    tenantId: string,
    userId: string,
    role?: string,
  ): Promise<string[] | null> {
    const walls = await this.prisma.ethicalWall.findMany({
      where: { tenantId, status: 'active', restrictedUserIds: { has: userId } },
      select: { protectedMatterIds: true, protectedClientIds: true },
    });
    const blocked = new Set(walls.flatMap((wall) => wall.protectedMatterIds));
    const clients = [...new Set(walls.flatMap((wall) => wall.protectedClientIds))];
    if (clients.length) {
      const protectedMatters = await this.prisma.matter.findMany({ where: { tenantId, clientId: { in: clients } }, select: { id: true } });
      protectedMatters.forEach((matter) => blocked.add(matter.id));
    }
    if (this.hasFullAccess(role)) {
      if (!blocked.size) return null;
      const allowed = await this.prisma.matter.findMany({ where: { tenantId, id: { notIn: [...blocked] } }, select: { id: true } });
      return allowed.map((matter) => matter.id);
    }

    const rows = await this.prisma.matterAccess.findMany({
      where: { tenantId, userId },
      select: { matterId: true },
    });

    return rows.map((row) => row.matterId).filter((id) => !blocked.has(id));
  }

  async getAccessibleClientIds(
    tenantId: string,
    userId: string,
    role?: string,
  ): Promise<string[] | null> {
    const matterIds = await this.getAccessibleMatterIds(tenantId, userId, role);
    if (matterIds === null) return null;
    if (!matterIds || matterIds.length === 0) {
      return [];
    }

    const matters = await this.prisma.matter.findMany({
      where: { tenantId, id: { in: matterIds }, clientId: { not: null } },
      select: { clientId: true },
    });

    return [
      ...new Set(
        matters
          .map((matter) => matter.clientId)
          .filter((clientId): clientId is string => clientId !== null),
      ),
    ];
  }

  async ensureMatterAccess(
    tenantId: string,
    userId: string,
    matterId: string,
    role?: string,
  ): Promise<void> {
    const matter = await this.prisma.matter.findFirst({ where: { id: matterId, tenantId }, select: { id: true, clientId: true } });
    if (!matter) throw new ForbiddenException('Matter access denied');
    const wall = await this.ethicalWalls.checkAccess(tenantId, userId, matterId, matter.clientId ?? undefined);
    if (!wall.allowed) throw new ForbiddenException('Matter access denied by ethical wall');
    if (this.hasFullAccess(role)) {
      return;
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: {
        matterId_userId: { matterId, userId },
      },
    });

    if (!access || access.tenantId !== tenantId) {
      throw new ForbiddenException('Matter access denied');
    }
  }

  async ensureMatterWriteAccess(tenantId: string, userId: string, matterId: string, role?: string): Promise<void> {
    await this.ensureMatterAccess(tenantId, userId, matterId, role);
    if (this.hasFullAccess(role)) return;
    const grant = await this.prisma.matterAccess.findUnique({ where: { matterId_userId: { matterId, userId } } });
    if (!grant || grant.tenantId !== tenantId || !['WRITE', 'FULL', 'FULL_CASE_SUPPORT', 'OWNER'].includes(grant.accessLevel)) {
      throw new ForbiddenException('Matter write access required');
    }
  }
}
