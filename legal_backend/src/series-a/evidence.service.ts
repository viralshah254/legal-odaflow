import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string, matterId: string) {
    return this.prisma.evidenceItem.findMany({
      where: { tenantId, matterId },
      include: { custodyLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    tenantId: string,
    matterId: string,
    data: { title: string; description?: string; documentId?: string },
    actorId: string,
  ) {
    const item = await this.prisma.evidenceItem.create({
      data: {
        tenantId,
        matterId,
        title: data.title,
        description: data.description,
        documentId: data.documentId,
        chainOfCustody: [{ action: 'CREATED', actorId, at: new Date().toISOString() }] as Prisma.InputJsonValue,
      },
    });

    await this.prisma.evidenceCustodyLog.create({
      data: { evidenceId: item.id, action: 'CREATED', actorId },
    });

    await this.audit.log({
      tenantId,
      userId: actorId,
      action: 'EVIDENCE_CREATED',
      entityType: 'EvidenceItem',
      entityId: item.id,
      metadata: { matterId },
    });

    return item;
  }

  async logAccess(tenantId: string, evidenceId: string, actorId: string, action: string) {
    const item = await this.prisma.evidenceItem.findFirst({
      where: { id: evidenceId, tenantId },
    });
    if (!item) throw new NotFoundException('Evidence not found');

    await this.prisma.evidenceCustodyLog.create({
      data: { evidenceId, action, actorId },
    });

    const chain = Array.isArray(item.chainOfCustody) ? (item.chainOfCustody as object[]) : [];
    return this.prisma.evidenceItem.update({
      where: { id: evidenceId },
      data: {
        chainOfCustody: [
          ...chain,
          { action, actorId, at: new Date().toISOString() },
        ] as Prisma.InputJsonValue,
      },
    });
  }

  exportCustodyReport(tenantId: string, evidenceId: string) {
    return this.prisma.evidenceItem.findFirst({
      where: { id: evidenceId, tenantId },
      include: { custodyLogs: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
