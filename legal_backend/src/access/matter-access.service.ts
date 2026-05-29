import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const FULL_ACCESS_ROLES = new Set(['FIRM_ADMIN', 'PARTNER']);

@Injectable()
export class MatterAccessService {
  constructor(private readonly prisma: PrismaService) {}

  hasFullAccess(role?: string): boolean {
    return role ? FULL_ACCESS_ROLES.has(role) : false;
  }

  async getAccessibleMatterIds(
    tenantId: string,
    userId: string,
    role?: string,
  ): Promise<string[] | null> {
    if (this.hasFullAccess(role)) {
      return null;
    }

    const rows = await this.prisma.matterAccess.findMany({
      where: { tenantId, userId },
      select: { matterId: true },
    });

    return rows.map((row) => row.matterId);
  }

  async getAccessibleClientIds(
    tenantId: string,
    userId: string,
    role?: string,
  ): Promise<string[] | null> {
    if (this.hasFullAccess(role)) {
      return null;
    }

    const matterIds = await this.getAccessibleMatterIds(tenantId, userId, role);
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
    if (this.hasFullAccess(role)) {
      return;
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: {
        matterId_userId: { matterId, userId },
      },
    });

    if (!access || access.tenantId !== tenantId) {
      throw new Error('Matter access denied');
    }
  }
}
