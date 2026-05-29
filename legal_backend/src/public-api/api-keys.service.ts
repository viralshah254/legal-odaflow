import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.publicApiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, name: string, scopes: string[]) {
    const rawKey = `odf_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const row = await this.prisma.publicApiKey.create({
      data: {
        tenantId,
        name,
        keyHash,
        scopes: scopes as unknown as Prisma.InputJsonValue,
      },
    });

    return { apiKey: rawKey, id: row.id, name: row.name, scopes };
  }

  async validate(rawKey: string) {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const row = await this.prisma.publicApiKey.findFirst({
      where: { keyHash },
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;

    await this.prisma.publicApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return row;
  }
}
