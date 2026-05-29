import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class EthicalWallsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.ethicalWallGroup.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(tenantId: string, data: { name: string; matterIds: string[]; userIds: string[] }) {
    return this.prisma.ethicalWallGroup.create({
      data: {
        tenantId,
        name: data.name,
        matterIds: data.matterIds as unknown as Prisma.InputJsonValue,
        userIds: data.userIds as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async assertMatterAccess(tenantId: string, userId: string, matterId: string) {
    const walls = await this.prisma.ethicalWallGroup.findMany({
      where: { tenantId, isActive: true },
    });

    for (const wall of walls) {
      const matterIds = (wall.matterIds as string[]) ?? [];
      const userIds = (wall.userIds as string[]) ?? [];

      if (!matterIds.includes(matterId)) continue;

      if (userIds.includes(userId)) {
        throw new ForbiddenException(
          `Ethical wall "${wall.name}" restricts access to this matter`,
        );
      }
    }
  }

  async remove(tenantId: string, id: string) {
    const row = await this.prisma.ethicalWallGroup.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Ethical wall not found');
    return this.prisma.ethicalWallGroup.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
