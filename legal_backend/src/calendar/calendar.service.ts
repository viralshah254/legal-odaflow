import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async create(tenantId: string, dto: CreateCalendarEventDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
      },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.CALENDAR_EVENT_UPDATED, {
      entityId: event.id,
      action: 'created',
    });
    this.realtime.publishDashboardRefresh(tenantId, event.id);

    return event;
  }

  async findAll(tenantId: string, matterId?: string, from?: string, to?: string) {
    return this.prisma.calendarEvent.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        startAt: from ? { gte: new Date(from) } : undefined,
        endAt: to ? { lte: new Date(to) } : undefined,
      },
      include: { matter: true },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(tenantId: string, eventId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId },
      include: { matter: true },
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    return event;
  }

  async update(tenantId: string, eventId: string, dto: UpdateCalendarEventDto) {
    await this.findOne(tenantId, eventId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const event = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        matterId: dto.matterId,
        title: dto.title,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.CALENDAR_EVENT_UPDATED, {
      entityId: eventId,
      action: 'updated',
    });
    this.realtime.publishDashboardRefresh(tenantId, eventId);

    return event;
  }

  async remove(tenantId: string, eventId: string) {
    await this.findOne(tenantId, eventId);
    await this.prisma.calendarEvent.delete({ where: { id: eventId } });
    return { success: true };
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
