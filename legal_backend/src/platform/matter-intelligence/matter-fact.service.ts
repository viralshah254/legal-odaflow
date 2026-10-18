import { Injectable } from '@nestjs/common';
import { MatterFactV2, MatterFactVersion, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';

export interface AssertFactDto {
  text: string;
  factType: string;
  confidence?: number;
  parties?: string[];
  documentIds?: string[];
  evidenceIds?: string[];
  dateOccurred?: Date;
  metadata?: Record<string, unknown>;
}

export interface FactFilter {
  status?: string;
  factType?: string;
}

@Injectable()
export class MatterFactService {
  constructor(private readonly prisma: PrismaService) {}

  async assertFact(
    matterId: string,
    tenantId: string,
    dto: AssertFactDto,
    createdBy: string,
  ): Promise<MatterFactV2> {
    return this.prisma.matterFactV2.create({
      data: {
        matterId,
        tenantId,
        text: dto.text,
        factType: dto.factType,
        confidence: dto.confidence ?? 0.7,
        parties: dto.parties ?? [],
        documentIds: dto.documentIds ?? [],
        evidenceIds: dto.evidenceIds ?? [],
        dateOccurred: dto.dateOccurred,
        createdBy,
        metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async updateFactStatus(
    factId: string,
    matterId: string,
    tenantId: string,
    status: string,
    reason: string | undefined,
    changedBy: string,
  ): Promise<MatterFactV2> {
    const fact = await this.findFactOrThrow(factId, matterId, tenantId);

    await this.prisma.matterFactVersion.create({
      data: {
        factId,
        version: fact.version,
        status: fact.status,
        text: fact.text,
        confidence: fact.confidence,
        changedBy,
        changeReason: reason,
        metadata: (fact.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    return this.prisma.matterFactV2.update({
      where: { id: factId },
      data: {
        status,
        version: fact.version + 1,
        lastModifiedBy: changedBy,
      },
    });
  }

  async disputeFact(
    factId: string,
    matterId: string,
    tenantId: string,
    contestedBy: string,
    reason: string,
  ): Promise<MatterFactV2> {
    await this.findFactOrThrow(factId, matterId, tenantId);

    return this.prisma.matterFactV2.update({
      where: { id: factId },
      data: {
        isContested: true,
        contestedBy,
        contestedReason: reason,
        status: 'DISPUTED',
      },
    });
  }

  async getFacts(
    matterId: string,
    tenantId: string,
    filter?: FactFilter,
  ): Promise<MatterFactV2[]> {
    return this.prisma.matterFactV2.findMany({
      where: {
        matterId,
        tenantId,
        ...(filter?.status && { status: filter.status }),
        ...(filter?.factType && { factType: filter.factType }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllVersions(
    factId: string,
    matterId: string,
    tenantId: string,
  ): Promise<MatterFactVersion[]> {
    await this.findFactOrThrow(factId, matterId, tenantId);

    return this.prisma.matterFactVersion.findMany({
      where: { factId },
      orderBy: { version: 'desc' },
    });
  }

  async withdrawFact(
    factId: string,
    matterId: string,
    tenantId: string,
    reason: string,
    changedBy: string,
  ): Promise<MatterFactV2> {
    return this.updateFactStatus(factId, matterId, tenantId, 'WITHDRAWN', reason, changedBy);
  }

  private async findFactOrThrow(
    factId: string,
    matterId: string,
    tenantId: string,
  ): Promise<MatterFactV2> {
    const fact = await this.prisma.matterFactV2.findFirst({
      where: { id: factId, matterId, tenantId },
    });
    if (!fact) {
      throw new DomainError(DomainErrorCode.NOT_FOUND, `Fact ${factId} not found`, 404);
    }
    return fact;
  }
}
