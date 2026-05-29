import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRateTableDto, UpdateRateTableDto } from './dto/rate-table.dto';

@Injectable()
export class RateTablesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.rateTable.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, rateTableId: string) {
    const row = await this.prisma.rateTable.findFirst({
      where: { id: rateTableId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Rate table not found');
    }
    return row;
  }

  async create(tenantId: string, dto: CreateRateTableDto) {
    if (dto.isDefault) {
      await this.clearDefault(tenantId);
    }

    return this.prisma.rateTable.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        currency: dto.currency ?? 'USD',
        rates: dto.rates as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(tenantId: string, rateTableId: string, dto: UpdateRateTableDto) {
    await this.findOne(tenantId, rateTableId);

    if (dto.isDefault) {
      await this.clearDefault(tenantId);
    }

    return this.prisma.rateTable.update({
      where: { id: rateTableId },
      data: {
        name: dto.name?.trim(),
        currency: dto.currency,
        rates: dto.rates as Prisma.InputJsonValue | undefined,
        isDefault: dto.isDefault,
      },
    });
  }

  async resolveRateForRole(
    tenantId: string,
    role: string,
  ): Promise<{ rate: number; currency: string } | null> {
    const table = await this.prisma.rateTable.findFirst({
      where: { tenantId, isDefault: true },
    });
    if (!table) {
      return null;
    }

    const rates = table.rates as Record<string, number> | null;
    if (!rates || typeof rates !== 'object') {
      return null;
    }

    const rate = rates[role] ?? rates.default ?? rates.DEFAULT;
    if (typeof rate !== 'number') {
      return null;
    }

    return { rate, currency: table.currency };
  }

  private async clearDefault(tenantId: string) {
    await this.prisma.rateTable.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
