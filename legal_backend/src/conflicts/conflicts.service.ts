import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateConflictCheckDto } from './dto/conflicts.dto';

@Injectable()
export class ConflictsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, status?: string) {
    return this.prisma.conflictCheck.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(tenantId: string, userId: string, dto: CreateConflictCheckDto) {
    const parties = dto.parties ?? [];
    const matches = await this.findPotentialMatches(tenantId, parties, dto.clientId);

    const status = matches.length > 0 ? 'REVIEW_REQUIRED' : 'CLEAR';
    const result = {
      matches,
      checkedAt: new Date().toISOString(),
      summary:
        matches.length > 0
          ? `${matches.length} potential conflict(s) found`
          : 'No conflicts detected',
    };

    return this.prisma.conflictCheck.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        matterId: dto.matterId,
        leadId: dto.leadId,
        status,
        parties: parties as unknown as Prisma.InputJsonValue,
        result: result as Prisma.InputJsonValue,
        checkedBy: userId,
      },
    });
  }

  async getById(tenantId: string, id: string) {
    const row = await this.prisma.conflictCheck.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Conflict check not found');
    return row;
  }

  private async findPotentialMatches(
    tenantId: string,
    parties: Array<{ name?: string; email?: string }>,
    excludeClientId?: string,
  ) {
    const matches: Array<{ type: string; id: string; name: string; reason: string }> = [];
    const names = parties.map((p) => p.name?.trim().toLowerCase()).filter(Boolean) as string[];
    const emails = parties.map((p) => p.email?.trim().toLowerCase()).filter(Boolean) as string[];

    if (names.length === 0 && emails.length === 0) return matches;

    const clients = await this.prisma.client.findMany({
      where: {
        tenantId,
        ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
        OR: [
          ...(names.length
            ? names.map((name) => ({ name: { contains: name, mode: 'insensitive' as const } }))
            : []),
          ...(emails.length ? emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })) : []),
        ],
      },
      take: 20,
    });

    for (const client of clients) {
      matches.push({
        type: 'client',
        id: client.id,
        name: client.name,
        reason: 'Name or email matches an existing client',
      });
    }

    const opposing = await this.prisma.matterParty.findMany({
      where: {
        tenantId,
        OR: names.map((name) => ({ name: { contains: name, mode: 'insensitive' as const } })),
      },
      take: 20,
    });

    for (const party of opposing) {
      matches.push({
        type: 'matter_party',
        id: party.id,
        name: party.name,
        reason: `Appears as ${party.role} on another matter`,
      });
    }

    return matches;
  }
}
