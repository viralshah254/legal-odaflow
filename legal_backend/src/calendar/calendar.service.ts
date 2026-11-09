import { isISO8601 } from 'class-validator';
import { ArtifactAccessResolver, type AccessActor } from '@/access/artifact-access.resolver';
import { MatterAccessService } from '@/access/matter-access.service';
import concurrencyLimit from '@/common/utils/concurrency-limit';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    private readonly access: ArtifactAccessResolver,
    private readonly matterAccess: MatterAccessService,
  ) {}

  async create(tenantId: string, dto: CreateCalendarEventDto, actor?: AccessActor) {
    this.validateRange(dto.startAt, dto.endAt);
    if (actor) {
      if (actor.tenantId !== tenantId) throw new ForbiddenException('Calendar access denied');
      if (dto.matterId) await this.assertWritableMatter(actor, dto.matterId);
      if (dto.clientId) await this.access.assertClientReadable(actor, dto.clientId);
    }
    const matter = dto.matterId ? await this.ensureMatter(tenantId, dto.matterId) : null;
    if (matter && dto.clientId && dto.clientId !== matter.clientId) throw new BadRequestException('Calendar client must match the matter');

    const event = await this.prisma.calendarEvent.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        clientId: matter?.clientId ?? dto.clientId,
        userId: actor?.userId,
        reminderMinutes: dto.reminderMinutes === undefined ? 30 : dto.reminderMinutes,
        reminderAt: this.reminderTime(dto.startAt, dto.reminderMinutes === undefined ? 30 : dto.reminderMinutes),
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'MEETING',
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

  async findAll(tenantId: string, matterId?: string, from?: string, to?: string, actor?: AccessActor) {
    if (!actor || actor.tenantId !== tenantId) throw new ForbiddenException('Calendar access denied');
    if (from) this.validateDate(from);
    if (to) this.validateDate(to);
    if (from && to) this.validateRange(from, to);
    if (matterId) await this.access.assertMatterReadable(actor, matterId);
    const ids = await this.matterAccess.getAccessibleMatterIds(tenantId, actor.userId, actor.tenantRole);
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        OR: [{ userId: actor.userId }, { matterId: ids === null ? { not: null } : { in: ids } }],
        // Include events spanning the requested window, not only events fully
        // contained within it. Timed/all-day semantics are separate later work.
        endAt: from ? { gte: new Date(from) } : undefined,
        startAt: to ? { lte: new Date(to) } : undefined,
      },
      include: { matter: true },
      orderBy: { startAt: 'asc' },
    });
    const limit = concurrencyLimit(4);
    const checks = new Map<string, Promise<boolean>>();
    for (const event of events) {
      if (event.matterId && !checks.has(event.matterId)) {
        const id = event.matterId;
        checks.set(id, limit(async () => {
          try { await this.access.assertMatterReadable(actor, id); return true; }
          catch { return false; }
        }));
      }
    }
    const allowed = await Promise.all(events.map(async (event) => event.matterId
      ? await checks.get(event.matterId) : event.userId === actor.userId));
    return events.filter((_, index) => allowed[index]);
  }

  async findOne(tenantId: string, eventId: string, actor?: AccessActor) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId },
      include: { matter: true },
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    if (!actor || actor.tenantId !== tenantId) throw new ForbiddenException('Calendar access denied');
    if (event.matterId) await this.access.assertMatterReadable(actor, event.matterId);
    else if (event.userId !== actor.userId) throw new NotFoundException('Calendar event not found');
    return event;
  }

  async update(tenantId: string, eventId: string, dto: UpdateCalendarEventDto, actor?: AccessActor) {
    const existing = await this.findOne(tenantId, eventId, actor);
    if (existing.matterId) await this.assertWritableMatter(actor!, existing.matterId);
    if (dto.matterId) await this.assertWritableMatter(actor!, dto.matterId);
    if (dto.clientId) await this.access.assertClientReadable(actor!, dto.clientId);
    const targetMatterId = dto.matterId !== undefined ? dto.matterId : existing.matterId;
    const matter = targetMatterId ? await this.ensureMatter(tenantId, targetMatterId) : null;
    if (matter && dto.clientId && dto.clientId !== matter.clientId) throw new BadRequestException('Calendar client must match the matter');
    this.validateRange(dto.startAt ?? existing.startAt.toISOString(), dto.endAt ?? existing.endAt.toISOString());

    const event = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        matterId: dto.matterId,
        clientId: matter?.clientId ?? dto.clientId,
        ...(dto.startAt !== undefined || dto.reminderMinutes !== undefined ? {
          reminderMinutes: dto.reminderMinutes === undefined ? existing.reminderMinutes : dto.reminderMinutes,
          reminderAt: this.reminderTime(dto.startAt ?? existing.startAt.toISOString(), dto.reminderMinutes === undefined ? existing.reminderMinutes : dto.reminderMinutes),
        } : {}),
        title: dto.title,
        description: dto.description,
        type: dto.type,
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

  async remove(tenantId: string, eventId: string, actor?: AccessActor) {
    const existing = await this.findOne(tenantId, eventId, actor);
    if (existing.matterId) await this.assertWritableMatter(actor!, existing.matterId);
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
    return matter;
  }

  private async assertWritableMatter(actor: AccessActor, matterId: string) {
    await this.access.assertMatterReadable(actor, matterId);
    if (this.matterAccess.hasFullAccess(actor.tenantRole)) return;
    const grant = await this.prisma.matterAccess.findUnique({ where: { matterId_userId: { matterId, userId: actor.userId } } });
    if (!grant || grant.tenantId !== actor.tenantId || !['WRITE', 'FULL', 'FULL_CASE_SUPPORT', 'OWNER'].includes(grant.accessLevel)) {
      throw new ForbiddenException('Matter calendar write access required');
    }
  }

  private reminderTime(startAt: string, minutes: number | null | undefined): Date | null {
    if (minutes == null) return null;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) throw new BadRequestException('Invalid reminder interval');
    return new Date(new Date(startAt).getTime() - minutes * 60_000);
  }

  private validateDate(value: string) {
    if (!isISO8601(value, { strict: true, strictSeparator: true }) || !Number.isFinite(new Date(value).getTime())) throw new BadRequestException('Invalid calendar date');
  }

  private validateRange(start: string, end: string) {
    if (![start, end].every(value => /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) throw new BadRequestException('Calendar timestamps require an explicit timezone');
    this.validateDate(start);
    this.validateDate(end);
    if (new Date(end).getTime() < new Date(start).getTime()) throw new BadRequestException('Calendar end precedes start');
  }
}
