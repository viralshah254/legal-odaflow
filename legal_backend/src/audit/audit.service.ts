import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface AuditLogInput {
  userId?: string;
  tenantId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface DomainAuditEventInput {
  userId?: string;
  tenantId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditLogQuery {
  tenantId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      },
    });
  }

  async logDomainEvent(input: DomainAuditEventInput) {
    return this.log({
      ...input,
      metadata: {
        ...(typeof input.metadata === 'object' && input.metadata !== null
          ? input.metadata
          : {}),
        source: 'domain_event',
      },
    });
  }

  async findLogs(query: AuditLogQuery) {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;

    const where: Prisma.AuditLogWhereInput = {
      tenantId: query.tenantId,
      userId: query.userId || undefined,
      action: query.action ? { contains: query.action, mode: 'insensitive' } : undefined,
      entityType: query.entityType || undefined,
      entityId: query.entityId || undefined,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findRecent(tenantId?: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
