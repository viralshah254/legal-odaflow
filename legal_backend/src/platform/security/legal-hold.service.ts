import { Injectable } from '@nestjs/common';
import { LegalHold } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';

export interface CreateLegalHoldDto {
  name: string;
  description?: string;
  scope: string;
  matterId?: string;
  userIds?: string[];
  documentTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetHoldsFilters {
  status?: string;
  matterId?: string;
}

@Injectable()
export class LegalHoldService {
  constructor(private readonly prisma: PrismaService) {}

  async createHold(tenantId: string, createdBy: string, dto: CreateLegalHoldDto): Promise<LegalHold> {
    return this.prisma.legalHold.create({
      data: {
        tenantId,
        createdBy,
        name: dto.name,
        description: dto.description,
        scope: dto.scope,
        matterId: dto.matterId,
        userIds: dto.userIds ?? [],
        documentTypes: dto.documentTypes ?? [],
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
        status: 'active',
      },
    });
  }

  async checkHold(
    tenantId: string,
    matterId?: string,
    userId?: string,
  ): Promise<{ onHold: boolean; holdId?: string; reason?: string }> {
    const conditions: object[] = [];

    if (matterId) {
      conditions.push({ matterId });
    }
    if (userId) {
      conditions.push({ userIds: { has: userId } });
    }

    if (conditions.length === 0) {
      return { onHold: false };
    }

    const hold = await this.prisma.legalHold.findFirst({
      where: {
        tenantId,
        status: 'active',
        OR: conditions,
      },
    });

    if (!hold) return { onHold: false };

    return {
      onHold: true,
      holdId: hold.id,
      reason: `Legal hold "${hold.name}" (${hold.scope}) is active`,
    };
  }

  async releaseHold(
    holdId: string,
    tenantId: string,
    releasedBy: string,
    reason: string,
  ): Promise<LegalHold> {
    return this.prisma.legalHold.update({
      where: { id: holdId },
      data: {
        status: 'released',
        releasedBy,
        releasedAt: new Date(),
        releasedReason: reason,
      },
    });
  }

  async getHolds(tenantId: string, filters?: GetHoldsFilters): Promise<LegalHold[]> {
    return this.prisma.legalHold.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.matterId ? { matterId: filters.matterId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async enforceHold(
    tenantId: string,
    matterId: string,
    action: 'delete' | 'export' | 'modify',
  ): Promise<void> {
    if (action !== 'delete') return;

    const result = await this.checkHold(tenantId, matterId);
    if (result.onHold) {
      throw new DomainError(
        DomainErrorCode.FORBIDDEN,
        'This matter is under legal hold and cannot be deleted',
        403,
        { holdId: result.holdId, matterId },
      );
    }
  }
}
