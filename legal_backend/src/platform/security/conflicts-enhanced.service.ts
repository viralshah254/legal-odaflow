import { Injectable } from '@nestjs/common';
import { ConflictCheck, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/observability/logger.service';

export interface ConflictRecord {
  type: string;
  id: string;
  name: string;
  reason: string;
  matterId?: string;
}

export interface CheckConflictsDto {
  partyName: string;
  partyRole: string;
  matterId?: string;
  userId?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictRecord[];
}

@Injectable()
export class ConflictsEnhancedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async checkConflicts(tenantId: string, dto: CheckConflictsDto): Promise<ConflictCheckResult> {
    const conflicts: ConflictRecord[] = [];
    const nameLower = dto.partyName.trim().toLowerCase();

    const clients = await this.prisma.client.findMany({
      where: {
        tenantId,
        name: { contains: nameLower, mode: 'insensitive' },
      },
      take: 20,
    });

    for (const client of clients) {
      conflicts.push({
        type: 'client',
        id: client.id,
        name: client.name,
        reason: `"${dto.partyName}" matches existing client "${client.name}"`,
      });
    }

    const opposingPartyMatters = await this.prisma.matter.findMany({
      where: {
        tenantId,
        status: { not: 'CLOSED' },
        opposingParty: { contains: nameLower, mode: 'insensitive' },
      },
      select: { id: true, title: true, opposingParty: true, status: true },
      take: 20,
    });

    for (const matter of opposingPartyMatters) {
      if (dto.matterId && matter.id === dto.matterId) continue;
      conflicts.push({
        type: 'opposing_party',
        id: matter.id,
        name: matter.opposingParty ?? dto.partyName,
        reason: `"${dto.partyName}" matches opposing party on matter "${matter.title}" (${matter.status})`,
        matterId: matter.id,
      });
    }

    const matterParties = await this.prisma.matterParty.findMany({
      where: {
        tenantId,
        name: { contains: nameLower, mode: 'insensitive' },
      },
      include: { matter: { select: { id: true, title: true, status: true } } },
      take: 20,
    });

    for (const party of matterParties) {
      conflicts.push({
        type: 'matter_party',
        id: party.id,
        name: party.name,
        reason: `"${dto.partyName}" appears as ${party.role} on matter "${party.matter?.title ?? party.matterId}" (${party.matter?.status ?? 'OPEN'})`,
        matterId: party.matterId,
      });
    }

    const seen = new Set<string>();
    const deduped = conflicts.filter((c) => {
      const key = `${c.type}:${c.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { hasConflict: deduped.length > 0, conflicts: deduped };
  }

  async recordConflictCheck(
    tenantId: string,
    dto: CheckConflictsDto,
    result: ConflictCheckResult,
  ): Promise<void> {
    try {
      await this.prisma.conflictCheck.create({
        data: {
          tenantId,
          matterId: dto.matterId,
          status: result.hasConflict ? 'REVIEW_REQUIRED' : 'CLEAR',
          parties: [{ name: dto.partyName, role: dto.partyRole }] as Prisma.InputJsonValue,
          result: {
            hasConflict: result.hasConflict,
            conflictCount: result.conflicts.length,
            conflicts: result.conflicts,
            checkedAt: new Date().toISOString(),
            summary: result.hasConflict
              ? `${result.conflicts.length} conflict(s) found for "${dto.partyName}"`
              : `No conflicts found for "${dto.partyName}"`,
          } as unknown as Prisma.InputJsonValue,
          checkedBy: dto.userId,
        },
      });
    } catch (err) {
      this.logger.error('conflict_check_audit_failed', err instanceof Error ? err : undefined, {
        tenantId,
      });
    }
  }

  async waiveConflict(
    conflictId: string,
    tenantId: string,
    waivedBy: string,
    consentedParties: string[],
    notes: string,
  ): Promise<ConflictCheck> {
    const check = await this.prisma.conflictCheck.findFirst({
      where: { id: conflictId, tenantId },
    });
    if (!check) throw new Error(`Conflict check ${conflictId} not found`);

    const existingResult = (check.result as Record<string, unknown> | null) ?? {};

    return this.prisma.conflictCheck.update({
      where: { id: conflictId },
      data: {
        status: 'WAIVED',
        result: {
          ...existingResult,
          waiver: {
            waivedBy,
            waivedAt: new Date().toISOString(),
            consentedParties,
            notes,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }
}
