import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import {
  CreateAlertActionDto,
  CreateAlertDto,
  UpdateAlertDto,
} from './dto/alert.dto';

type AlertWithActions = Prisma.AlertGetPayload<{
  include: { actions: { orderBy: { createdAt: 'desc' } } };
}>;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async create(tenantId: string, dto: CreateAlertDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        title: dto.title,
        message: dto.message,
        severity: dto.severity ?? 'INFO',
        status: dto.status ?? 'ACTIVE',
      },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
    });
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.ALERT_CREATED, {
      entityId: alert.id,
      action: 'created',
    });
    this.realtime.publishDashboardRefresh(tenantId, alert.id);
    return this.toWebAlert(alert);
  }

  async findAll(tenantId: string, status?: string, matterId?: string) {
    const alerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        status: status || undefined,
        matterId: matterId || undefined,
      },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map((alert) => this.toWebAlert(alert));
  }

  async findUrgent(tenantId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { tenantId },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return alerts
      .filter((alert) => {
        const severity = this.normalizeSeverity(alert.severity);
        return !this.isAcknowledgedStatus(alert.status) && severity !== 'Normal';
      })
      .map((alert) => this.toWebAlert(alert));
  }

  async findOne(tenantId: string, alertId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, tenantId },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return this.toWebAlert(alert);
  }

  async update(tenantId: string, alertId: string, dto: UpdateAlertDto) {
    await this.ensureAlert(tenantId, alertId);
    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: dto,
      include: { actions: { orderBy: { createdAt: 'desc' } } },
    });
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.ALERT_UPDATED, {
      entityId: alertId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, alertId);
    return this.toWebAlert(alert);
  }

  async remove(tenantId: string, alertId: string) {
    await this.findOne(tenantId, alertId);
    await this.prisma.alert.delete({ where: { id: alertId } });
    return { success: true };
  }

  async addAction(
    tenantId: string,
    alertId: string,
    dto: CreateAlertActionDto,
  ) {
    await this.ensureAlert(tenantId, alertId);

    return this.prisma.alertAction.create({
      data: {
        tenantId,
        alertId,
        action: dto.action,
        performedBy: dto.performedBy,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async complete(tenantId: string, alertId: string) {
    return this.updateStatusWithAction(
      tenantId,
      alertId,
      'COMPLETED',
      'ALERT_COMPLETED',
    );
  }

  async skip(tenantId: string, alertId: string) {
    return this.updateStatusWithAction(tenantId, alertId, 'SKIPPED', 'ALERT_SKIPPED');
  }

  async acknowledge(tenantId: string, alertId: string) {
    return this.updateStatusWithAction(
      tenantId,
      alertId,
      'ACKNOWLEDGED',
      'ALERT_ACKNOWLEDGED',
    );
  }

  private async updateStatusWithAction(
    tenantId: string,
    alertId: string,
    status: string,
    action: string,
  ) {
    const currentAlert = await this.ensureAlert(tenantId, alertId);
    const alert = await this.prisma.$transaction(async (tx) => {
      await tx.alert.update({
        where: { id: alertId },
        data: { status },
        include: { actions: { orderBy: { createdAt: 'desc' } } },
      });

      await tx.alertAction.create({
        data: {
          tenantId,
          alertId,
          action,
          metadata: {
            previousStatus: currentAlert.status,
            nextStatus: status,
          },
        },
      });

      return tx.alert.findUniqueOrThrow({
        where: { id: alertId },
        include: { actions: { orderBy: { createdAt: 'desc' } } },
      });
    });

    return this.toWebAlert(alert);
  }

  private async ensureAlert(tenantId: string, alertId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return alert;
  }

  private toWebAlert(alert: AlertWithActions) {
    return {
      ...alert,
      description: alert.message ?? undefined,
      acknowledged: this.isAcknowledgedStatus(alert.status),
      severity: this.normalizeSeverity(alert.severity),
      type: 'OTHER',
    };
  }

  private normalizeSeverity(severity?: string): 'Critical' | 'High' | 'Normal' {
    const normalized = (severity ?? '').trim().toUpperCase();
    if (normalized === 'CRITICAL') return 'Critical';
    if (normalized === 'HIGH') return 'High';
    return 'Normal';
  }

  private isAcknowledgedStatus(status?: string) {
    const normalized = (status ?? '').trim().toUpperCase();
    return (
      normalized === 'ACKNOWLEDGED' ||
      normalized === 'COMPLETED' ||
      normalized === 'SKIPPED'
    );
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }
  }
}
