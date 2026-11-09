import { Injectable } from '@nestjs/common';
import { EthicalWall } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SecurityMonitorService } from './security-monitor.service';

export interface CreateEthicalWallDto {
  name: string;
  description?: string;
  restrictedUserIds?: string[];
  protectedMatterIds?: string[];
  protectedClientIds?: string[];
}

@Injectable()
export class EthicalWallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityMonitor: SecurityMonitorService,
  ) {}

  async createWall(tenantId: string, createdBy: string, dto: CreateEthicalWallDto): Promise<EthicalWall> {
    return this.prisma.ethicalWall.create({
      data: {
        tenantId,
        createdBy,
        name: dto.name,
        description: dto.description,
        restrictedUserIds: dto.restrictedUserIds ?? [],
        protectedMatterIds: dto.protectedMatterIds ?? [],
        protectedClientIds: dto.protectedClientIds ?? [],
        status: 'active',
      },
    });
  }

  async checkAccess(
    tenantId: string,
    userId: string,
    matterId: string,
    clientId?: string,
  ): Promise<{ allowed: boolean; wallId?: string }> {
    const walls = await this.prisma.ethicalWall.findMany({
      where: { tenantId, status: 'active' },
    });

    for (const wall of walls) {
      const userRestricted = wall.restrictedUserIds.includes(userId);
      const matterProtected = wall.protectedMatterIds.includes(matterId) || Boolean(clientId && wall.protectedClientIds.includes(clientId));

      if (userRestricted && matterProtected) {
        await this.securityMonitor.recordEvent({
          tenantId,
          userId,
          eventType: 'ethical_wall_violation',
          severity: 'high',
          details: { wallId: wall.id, wallName: wall.name, matterId },
          blocked: true,
        });
        return { allowed: false, wallId: wall.id };
      }
    }

    return { allowed: true };
  }

  async addMatterToWall(wallId: string, matterId: string, tenantId: string): Promise<EthicalWall> {
    const wall = await this.prisma.ethicalWall.findFirst({
      where: { id: wallId, tenantId },
    });
    if (!wall) throw new Error(`Ethical wall ${wallId} not found`);

    const updated = [...new Set([...wall.protectedMatterIds, matterId])];
    return this.prisma.ethicalWall.update({
      where: { id: wallId },
      data: { protectedMatterIds: updated },
    });
  }

  async addUserToWall(wallId: string, userId: string, tenantId: string): Promise<EthicalWall> {
    const wall = await this.prisma.ethicalWall.findFirst({
      where: { id: wallId, tenantId },
    });
    if (!wall) throw new Error(`Ethical wall ${wallId} not found`);

    const updated = [...new Set([...wall.restrictedUserIds, userId])];
    return this.prisma.ethicalWall.update({
      where: { id: wallId },
      data: { restrictedUserIds: updated },
    });
  }

  async getWalls(tenantId: string): Promise<EthicalWall[]> {
    return this.prisma.ethicalWall.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
