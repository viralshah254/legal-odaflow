import { Injectable } from '@nestjs/common';
import { Prisma, SecurityEvent } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/observability/logger.service';

export interface RecordEventDto {
  tenantId?: string;
  userId?: string;
  eventType: string;
  severity?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  blocked?: boolean;
}

export interface GetEventsFilters {
  eventType?: string;
  severity?: string;
  reviewed?: boolean;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class SecurityMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async recordEvent(dto: RecordEventDto): Promise<SecurityEvent> {
    try {
      const event = await this.prisma.securityEvent.create({
        data: {
          tenantId: dto.tenantId,
          userId: dto.userId,
          eventType: dto.eventType,
          severity: dto.severity ?? 'medium',
          details: dto.details ? (dto.details as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          blocked: dto.blocked ?? false,
        },
      });

      this.logger.warn('security_event_recorded', {
        tenantId: dto.tenantId,
        userId: dto.userId,
        metadata: { eventType: dto.eventType, severity: dto.severity, blocked: dto.blocked },
      });

      return event;
    } catch (err) {
      this.logger.error('security_event_record_failed', err instanceof Error ? err : undefined);
      return {
        id: 'error',
        tenantId: dto.tenantId ?? null,
        userId: dto.userId ?? null,
        eventType: dto.eventType,
        severity: dto.severity ?? 'medium',
        details: null,
        ipAddress: null,
        userAgent: null,
        blocked: false,
        reviewed: false,
        reviewedBy: null,
        reviewNote: null,
        createdAt: new Date(),
      } as SecurityEvent;
    }
  }

  async getEvents(tenantId: string, filters?: GetEventsFilters): Promise<SecurityEvent[]> {
    return this.prisma.securityEvent.findMany({
      where: {
        tenantId,
        ...(filters?.eventType ? { eventType: filters.eventType } : {}),
        ...(filters?.severity ? { severity: filters.severity } : {}),
        ...(filters?.reviewed !== undefined ? { reviewed: filters.reviewed } : {}),
        ...(filters?.startDate || filters?.endDate
          ? {
              createdAt: {
                ...(filters.startDate ? { gte: filters.startDate } : {}),
                ...(filters.endDate ? { lte: filters.endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewEvent(
    eventId: string,
    tenantId: string,
    reviewedBy: string,
    reviewNote: string,
  ): Promise<SecurityEvent> {
    return this.prisma.securityEvent.update({
      where: { id: eventId },
      data: { reviewed: true, reviewedBy, reviewNote },
    });
  }

  async detectUnusualActivity(userId: string, tenantId: string): Promise<boolean> {
    const now = new Date();

    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const failedLogins = await this.prisma.securityEvent.count({
      where: {
        userId,
        tenantId,
        eventType: 'login_failure',
        createdAt: { gte: fifteenMinAgo },
      },
    });

    if (failedLogins > 5) {
      await this.recordEvent({
        tenantId,
        userId,
        eventType: 'brute_force',
        severity: 'critical',
        details: { failedLogins, windowMinutes: 15 },
        blocked: false,
      });
      return true;
    }

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const exports = await this.prisma.securityEvent.count({
      where: {
        userId,
        tenantId,
        eventType: 'unusual_export',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (exports > 20) {
      await this.recordEvent({
        tenantId,
        userId,
        eventType: 'data_exfil_attempt',
        severity: 'critical',
        details: { exportCount: exports, windowMinutes: 60 },
        blocked: false,
      });
      return true;
    }

    return false;
  }
}
