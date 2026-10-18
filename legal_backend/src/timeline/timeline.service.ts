import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TimelineEvent } from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateTimelineEventDto,
  UpdateTimelineEventDto,
} from './dto/timeline.dto';

@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
  ) {}

  async create(
    tenantId: string,
    matterId: string,
    userId: string,
    role: string | undefined,
    dto: CreateTimelineEventDto,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const event = await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        matterId,
        eventType: dto.eventType,
        title: dto.title,
        description: dto.description,
        metadata: {
          ...(dto.metadata as Record<string, unknown> | undefined),
          userId,
        } as Prisma.InputJsonValue,
        occurredAt: dto.occurredAt ?? new Date(),
      },
    });

    return this.formatEvent(event, userId);
  }

  async findAll(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
    eventType?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const events = await this.prisma.timelineEvent.findMany({
      where: {
        tenantId,
        matterId,
        eventType: eventType || undefined,
      },
      orderBy: { occurredAt: 'desc' },
    });

    return events.map((event) => this.formatEvent(event));
  }

  async findOne(
    tenantId: string,
    matterId: string,
    eventId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterReadable(tenantId, matterId, userId, role);

    const event = await this.prisma.timelineEvent.findFirst({
      where: { id: eventId, tenantId, matterId },
    });

    if (!event) {
      throw new NotFoundException('Timeline event not found');
    }

    return this.formatEvent(event);
  }

  async update(
    tenantId: string,
    matterId: string,
    eventId: string,
    userId: string,
    role: string | undefined,
    dto: UpdateTimelineEventDto,
  ) {
    await this.findOne(tenantId, matterId, eventId, userId, role);

    return this.formatEvent(
      await this.prisma.timelineEvent.update({
        where: { id: eventId },
        data: {
          eventType: dto.eventType,
          title: dto.title,
          description: dto.description,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          occurredAt: dto.occurredAt,
        },
      }),
    );
  }

  async remove(
    tenantId: string,
    matterId: string,
    eventId: string,
    userId: string,
    role?: string,
  ) {
    await this.findOne(tenantId, matterId, eventId, userId, role);
    await this.prisma.timelineEvent.delete({ where: { id: eventId } });
    return { success: true };
  }

  private async ensureMatterReadable(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    if (this.matterAccess.hasFullAccess(role)) {
      return;
    }

    const access = await this.prisma.matterAccess.findUnique({
      where: { matterId_userId: { matterId, userId } },
    });

    if (!access) {
      throw new ForbiddenException('Matter access denied');
    }
  }

  formatEvent(event: TimelineEvent, fallbackUserId?: string) {
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const userId =
      typeof metadata.userId === 'string'
        ? metadata.userId
        : fallbackUserId ?? '';
    const userName =
      typeof metadata.userName === 'string' ? metadata.userName : 'System';

    return {
      id: event.id,
      matterId: event.matterId,
      type: event.eventType,
      title: event.title,
      description: event.description,
      userId,
      userName,
      createdAt: event.occurredAt.toISOString(),
      metadata: event.metadata,
    };
  }
}
