import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TimeService } from '@/time/time.service';

@Injectable()
export class SuggestedTimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeService: TimeService,
  ) {}

  listPending(tenantId: string, userId: string) {
    return this.prisma.suggestedTimeEntry.findMany({
      where: { tenantId, userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async suggest(
    tenantId: string,
    userId: string,
    data: {
      matterId?: string;
      source: string;
      minutes: number;
      narrative?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.prisma.suggestedTimeEntry.create({
      data: {
        tenantId,
        userId,
        matterId: data.matterId,
        source: data.source,
        minutes: data.minutes,
        narrative: data.narrative,
        metadata: data.metadata as object | undefined,
      },
    });
  }

  async accept(tenantId: string, userId: string, suggestionId: string) {
    const row = await this.prisma.suggestedTimeEntry.findFirst({
      where: { id: suggestionId, tenantId, userId, status: 'PENDING' },
    });
    if (!row) throw new NotFoundException('Suggestion not found');

    const entry = await this.timeService.create(tenantId, userId, {
      matterId: row.matterId ?? undefined,
      date: new Date().toISOString(),
      minutes: row.minutes,
      narrative: row.narrative ?? `Accepted from ${row.source}`,
      billable: true,
      status: 'DRAFT',
    });

    await this.prisma.suggestedTimeEntry.update({
      where: { id: suggestionId },
      data: { status: 'ACCEPTED' },
    });

    return { suggestion: row, entry };
  }

  async dismiss(tenantId: string, userId: string, suggestionId: string) {
    const row = await this.prisma.suggestedTimeEntry.findFirst({
      where: { id: suggestionId, tenantId, userId },
    });
    if (!row) throw new NotFoundException('Suggestion not found');
    return this.prisma.suggestedTimeEntry.update({
      where: { id: suggestionId },
      data: { status: 'DISMISSED' },
    });
  }
}
