import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

export interface BudgetPhase {
  phase: string;
  estimatedHours: number;
  estimatedFees: number;
  actualHours?: number;
  actualFees?: number;
}

export interface CreateMatterBudgetDto {
  currency: string;
  phases: BudgetPhase[];
  totalEstimatedFees: number;
  alertThreshold?: number; // percentage, e.g. 80
}

export interface UpdateMatterBudgetDto {
  phases?: BudgetPhase[];
  totalEstimatedFees?: number;
  alertThreshold?: number;
}

@Injectable()
export class MatterBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async getOrNull(tenantId: string, matterId: string) {
    return this.prisma.matterBudget.findUnique({
      where: { matterId },
    });
  }

  async upsert(
    tenantId: string,
    matterId: string,
    dto: CreateMatterBudgetDto,
  ) {
    // Verify matter belongs to tenant
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    return this.prisma.matterBudget.upsert({
      where: { matterId },
      create: {
        tenantId,
        matterId,
        currency: dto.currency,
        phases: dto.phases as unknown as Prisma.InputJsonValue,
        totalEstimatedFees: new Prisma.Decimal(dto.totalEstimatedFees),
        alertThreshold: dto.alertThreshold ?? 80,
      },
      update: {
        phases: dto.phases as unknown as Prisma.InputJsonValue,
        totalEstimatedFees: new Prisma.Decimal(dto.totalEstimatedFees),
        alertThreshold: dto.alertThreshold ?? 80,
        alertTriggered: false,
      },
    });
  }

  async update(tenantId: string, matterId: string, dto: UpdateMatterBudgetDto) {
    const existing = await this.prisma.matterBudget.findUnique({
      where: { matterId },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Budget not found');
    }

    return this.prisma.matterBudget.update({
      where: { matterId },
      data: {
        ...(dto.phases !== undefined && {
          phases: dto.phases as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.totalEstimatedFees !== undefined && {
          totalEstimatedFees: new Prisma.Decimal(dto.totalEstimatedFees),
        }),
        ...(dto.alertThreshold !== undefined && {
          alertThreshold: dto.alertThreshold,
        }),
      },
    });
  }

  /** Recalculate actual fees from time entries and check alert threshold */
  async syncActuals(tenantId: string, matterId: string): Promise<void> {
    const budget = await this.prisma.matterBudget.findUnique({
      where: { matterId },
    });
    if (!budget) return;

    // Sum all billable time entry amounts for this matter
    const entries = await this.prisma.timeEntry.findMany({
      where: { matterId, tenantId, billable: true },
    });

    const totalActual = entries.reduce((sum, e) => {
      const rate = e.rate ? Number(e.rate) : 0;
      const hours = e.minutes / 60;
      return sum + rate * hours;
    }, 0);

    const totalEstimated = Number(budget.totalEstimatedFees);
    const pctUsed = totalEstimated > 0 ? (totalActual / totalEstimated) * 100 : 0;
    const threshold = budget.alertThreshold ?? 80;
    const shouldAlert = pctUsed >= threshold && !budget.alertTriggered;

    await this.prisma.matterBudget.update({
      where: { matterId },
      data: {
        totalActualFees: new Prisma.Decimal(totalActual),
        alertTriggered: shouldAlert ? true : budget.alertTriggered,
      },
    });

    if (shouldAlert) {
      try {
        await this.alerts.create(tenantId, {
          title: 'Matter Budget Alert',
          message: `Matter budget is ${pctUsed.toFixed(0)}% utilised (threshold: ${threshold}%)`,
          matterId,
          severity: 'HIGH',
        });
      } catch {
        // Non-fatal — alert creation failing shouldn't break the sync
      }
    }
  }

  async getBudgetSummary(tenantId: string, matterId: string) {
    const budget = await this.prisma.matterBudget.findUnique({
      where: { matterId },
    });

    if (!budget || budget.tenantId !== tenantId) return null;

    const estimated = Number(budget.totalEstimatedFees);
    const actual = Number(budget.totalActualFees);
    const remaining = estimated - actual;
    const pctUsed = estimated > 0 ? (actual / estimated) * 100 : 0;

    return {
      ...budget,
      totalEstimatedFees: estimated,
      totalActualFees: actual,
      remainingFees: remaining,
      percentageUsed: Math.round(pctUsed * 10) / 10,
      isOverBudget: actual > estimated,
      isAlertTriggered: budget.alertTriggered,
    };
  }
}
