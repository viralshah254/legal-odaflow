import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'] as const;

export type DemoRequestStatus = (typeof STATUSES)[number];

@Injectable()
export class DemoRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDemoRequestDto) {
    const email = dto.email.trim().toLowerCase();
    const recent = await this.prisma.demoRequest.findFirst({
      where: {
        email,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestException(
        'We already received a demo request from this email in the last 24 hours. Our team will reach out shortly.',
      );
    }

    return this.prisma.demoRequest.create({
      data: {
        contactName: dto.contactName.trim(),
        email,
        companyName: dto.companyName.trim(),
        phone: dto.phone?.trim() || null,
        jobTitle: dto.jobTitle?.trim() || null,
        firmSize: dto.firmSize || null,
        countryCode: (dto.countryCode || 'IN').trim().toUpperCase(),
        message: dto.message?.trim() || null,
        source: dto.source?.trim() || 'demo_page',
      },
    });
  }

  async list(params: {
    status?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);
    const where: Prisma.DemoRequestWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { contactName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.demoRequest.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getStats() {
    const [total, byStatus] = await Promise.all([
      this.prisma.demoRequest.count(),
      this.prisma.demoRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last7Days = await this.prisma.demoRequest.count({
      where: { createdAt: { gte: weekAgo } },
    });

    return {
      total,
      last7Days,
      new: statusCounts.NEW ?? 0,
      contacted: statusCounts.CONTACTED ?? 0,
      qualified: statusCounts.QUALIFIED ?? 0,
      closed: statusCounts.CLOSED ?? 0,
    };
  }

  async updateStatus(id: string, status: string, adminNotes?: string) {
    if (!STATUSES.includes(status as DemoRequestStatus)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    try {
      return await this.prisma.demoRequest.update({
        where: { id },
        data: {
          status,
          ...(adminNotes !== undefined ? { adminNotes: adminNotes.trim() || null } : {}),
        },
      });
    } catch {
      throw new NotFoundException('Demo request not found');
    }
  }
}
