import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertsService } from '@/alerts/alerts.service';
import { CreateMonitorDto, UpdateMonitorDto, UpdateMonitorHitDto } from './dto/monitor.dto';

@Injectable()
export class MonitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async createMonitor(tenantId: string, dto: CreateMonitorDto) {
    return this.prisma.monitor.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        jurisdiction: dto.jurisdiction,
        topics: dto.topics,
        sources: dto.sources ?? this.defaultSources(dto.jurisdiction),
        frequency: dto.frequency ?? 'DAILY',
      },
      include: { _count: { select: { hits: true } } },
    });
  }

  async listMonitors(tenantId: string) {
    const monitors = await this.prisma.monitor.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { hits: true } },
        hits: {
          where: { status: 'NEW' },
          select: { id: true },
        },
      },
    });
    return monitors.map((m) => ({
      ...m,
      newHitCount: m.hits.length,
      totalHitCount: m._count.hits,
    }));
  }

  async getMonitor(tenantId: string, monitorId: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, tenantId },
      include: { _count: { select: { hits: true } } },
    });
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }

  async updateMonitor(tenantId: string, monitorId: string, dto: UpdateMonitorDto) {
    await this.getMonitor(tenantId, monitorId);
    return this.prisma.monitor.update({
      where: { id: monitorId },
      data: dto,
      include: { _count: { select: { hits: true } } },
    });
  }

  async deleteMonitor(tenantId: string, monitorId: string) {
    await this.getMonitor(tenantId, monitorId);
    await this.prisma.monitor.delete({ where: { id: monitorId } });
    return { deleted: true };
  }

  async listHits(tenantId: string, monitorId: string, status?: string) {
    await this.getMonitor(tenantId, monitorId);
    return this.prisma.monitorHit.findMany({
      where: {
        monitorId,
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateHit(tenantId: string, monitorId: string, hitId: string, dto: UpdateMonitorHitDto) {
    const hit = await this.prisma.monitorHit.findFirst({
      where: { id: hitId, monitorId, tenantId },
    });
    if (!hit) throw new NotFoundException('Monitor hit not found');
    return this.prisma.monitorHit.update({
      where: { id: hitId },
      data: { status: dto.status },
    });
  }

  async createHit(
    monitorId: string,
    tenantId: string,
    data: {
      title: string;
      sourceUrl?: string;
      sourceName?: string;
      aiSummary?: string;
      severity?: string;
      relevanceScore?: number;
      publishedAt?: Date;
    },
  ) {
    const hit = await this.prisma.monitorHit.create({
      data: {
        monitorId,
        tenantId,
        title: data.title,
        sourceUrl: data.sourceUrl,
        sourceName: data.sourceName,
        aiSummary: data.aiSummary,
        severity: data.severity ?? 'INFO',
        relevanceScore: data.relevanceScore ?? 0.5,
        publishedAt: data.publishedAt,
        status: 'NEW',
      },
    });

    if (data.severity === 'CRITICAL' || data.severity === 'WARNING') {
      await this.alerts.create(tenantId, {
        title: `Monitor alert: ${data.title}`,
        message: data.aiSummary?.slice(0, 500),
        severity: data.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      });
    }

    return hit;
  }

  async listAllHits(tenantId: string, status?: string, limit = 50) {
    return this.prisma.monitorHit.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        monitor: { select: { name: true, jurisdiction: true } },
      },
    });
  }

  async getHitsSummary(tenantId: string) {
    const [critical, warning, info] = await Promise.all([
      this.prisma.monitorHit.count({ where: { tenantId, status: 'NEW', severity: 'CRITICAL' } }),
      this.prisma.monitorHit.count({ where: { tenantId, status: 'NEW', severity: 'WARNING' } }),
      this.prisma.monitorHit.count({ where: { tenantId, status: 'NEW', severity: 'INFO' } }),
    ]);
    return {
      criticalCount: critical,
      warningCount: warning,
      infoCount: info,
      totalUnread: critical + warning + info,
    };
  }

  async getActiveMonitorsForScan(frequency: string) {
    return this.prisma.monitor.findMany({
      where: { isActive: true, frequency },
    });
  }

  async markLastRunAt(monitorId: string) {
    return this.prisma.monitor.update({
      where: { id: monitorId },
      data: { lastRunAt: new Date() },
    });
  }

  private defaultSources(jurisdiction: string): string[] {
    const j = jurisdiction.toUpperCase();
    if (j === 'IN') return ['india_kanoon', 'india_code', 'tavily'];
    if (j === 'KE') return ['kenya_law', 'tavily'];
    if (j === 'GB') return ['legislation_gov_uk', 'tavily'];
    return ['courtlistener', 'tavily'];
  }
}
