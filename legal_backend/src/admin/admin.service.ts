import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    return this.getStats();
  }

  async getStats() {
    const [
      userCount,
      tenantCount,
      matterCount,
      consumerCaseCount,
      invoiceCount,
      paymentCount,
      aiUsageCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.matter.count(),
      this.prisma.consumerCase.count(),
      this.prisma.invoice.count(),
      this.prisma.payment.count(),
      this.prisma.aIUsageLog.count(),
    ]);

    const recentAuditLogs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      totals: {
        users: userCount,
        tenants: tenantCount,
        matters: matterCount,
        consumerCases: consumerCaseCount,
        invoices: invoiceCount,
        payments: paymentCount,
        aiUsageLogs: aiUsageCount,
      },
      recentAuditLogs,
      generatedAt: new Date().toISOString(),
    };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        countryCode: true,
        isActive: true,
        createdAt: true,
        tenantUsers: {
          select: {
            role: true,
            status: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        primaryCountry: true,
        defaultCurrency: true,
        billingPlan: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            tenantUsers: true,
            matters: true,
            clients: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listAiCosts(limit = 100) {
    return this.prisma.aIUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        taskType: true,
        mode: true,
        modelName: true,
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
        status: true,
        createdAt: true,
        tenantId: true,
        userId: true,
      },
    });
  }

  async listAiLogs(limit = 50) {
    return this.listAiCosts(limit);
  }

  async listAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { email: true, name: true } },
      },
    });
  }

  async listTrainingDatasets() {
    const datasets = await this.prisma.trainingDataset.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return datasets.map((d) => ({
      id: d.id,
      name: d.name,
      datasetType: d.datasetType,
      countryCode: d.countryCode,
      status: d.status,
      itemCount: d._count.items,
      createdAt: d.createdAt,
    }));
  }

  async listLegalSources() {
    return this.prisma.legalSource.findMany({
      orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
    });
  }

  async getUnitEconomicsSummary() {
    const snapshots = await this.prisma.unitEconomicsSnapshot.findMany({
      orderBy: { periodStart: 'desc' },
      take: 20,
    });
    const totalCost = await this.prisma.aIUsageLog.aggregate({
      _sum: { costUsd: true },
      _count: true,
    });
    return {
      snapshots,
      aiUsageTotal: totalCost._count,
      aiCostTotalUsd: Number(totalCost._sum.costUsd ?? 0),
      targetNetMargin: 0.4,
    };
  }
}
