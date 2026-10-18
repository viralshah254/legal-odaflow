import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { RateTablesService } from '@/billing/rate-tables.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

const TIME_APPROVER_ROLES = new Set([
  'FIRM_ADMIN',
  'PARTNER',
  'PARTNER_ADMIN',
  'JUNIOR_PARTNER',
  'FINANCE',
]);

type ActiveTimerSession = {
  id: string;
  tenantId: string;
  userId: string;
  matterId: string;
  startedAt: string;
  pausedAt: string | null;
  accumulatedMinutes: number;
};

@Injectable()
export class TimeService {
  private readonly activeTimers = new Map<string, ActiveTimerSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisherService,
    private readonly rateTables: RateTablesService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateTimeEntryDto) {
    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    let rate = dto.rate;
    if (rate === undefined) {
      const resolved = await this.rateTables.resolveRateForUserId(tenantId, userId);
      if (resolved) rate = resolved.rate;
    }

    await this.checkRetainerOnBillableEntry(
      tenantId,
      dto.matterId,
      dto.billable ?? true,
      dto.minutes,
      rate,
    );

    const entry = await this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId,
        matterId: dto.matterId,
        date: new Date(dto.date),
        minutes: dto.minutes,
        narrative: dto.narrative,
        billable: dto.billable ?? true,
        rate: rate !== undefined ? new Prisma.Decimal(rate) : undefined,
        status: dto.status ?? 'DRAFT',
      },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TIME_ENTRY_UPDATED, {
      entityId: entry.id,
      action: 'created',
      userId,
    });

    return entry;
  }

  findApprovalQueue(tenantId: string) {
    return this.prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: { in: ['SUBMITTED', 'DRAFT'] },
      },
      include: { matter: { select: { id: true, title: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async findAll(tenantId: string, matterId?: string, userId?: string) {
    return this.prisma.timeEntry.findMany({
      where: {
        tenantId,
        matterId: matterId || undefined,
        userId: userId || undefined,
      },
      include: { matter: true },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, entryId: string) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, tenantId },
      include: { matter: true },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }

    return entry;
  }

  async update(tenantId: string, entryId: string, dto: UpdateTimeEntryDto) {
    await this.findOne(tenantId, entryId);

    if (dto.matterId) {
      await this.ensureMatter(tenantId, dto.matterId);
    }

    const entry = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        matterId: dto.matterId,
        date: dto.date ? new Date(dto.date) : undefined,
        minutes: dto.minutes,
        narrative: dto.narrative,
        billable: dto.billable,
        rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : undefined,
        status: dto.status,
      },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TIME_ENTRY_UPDATED, {
      entityId: entryId,
      action: 'updated',
    });

    return entry;
  }

  async remove(tenantId: string, entryId: string) {
    await this.findOne(tenantId, entryId);
    await this.prisma.timeEntry.delete({ where: { id: entryId } });
    return { success: true };
  }

  async approve(tenantId: string, entryId: string, approverRole?: string) {
    const entry = await this.findOne(tenantId, entryId);

    if (entry.status === 'APPROVED') {
      return entry;
    }

    if (entry.status === 'INVOICED') {
      throw new BadRequestException('Invoiced time entries cannot be approved');
    }

    const allowedRoles = TIME_APPROVER_ROLES;
    if (approverRole && !allowedRoles.has(approverRole)) {
      throw new ForbiddenException('Insufficient permissions to approve time entries');
    }

    const approved = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: { status: 'APPROVED' },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TIME_ENTRY_UPDATED, {
      entityId: entryId,
      action: 'approved',
    });

    return approved;
  }

  async submit(tenantId: string, entryId: string, userId: string) {
    const entry = await this.findOne(tenantId, entryId);

    if (entry.userId !== userId) {
      throw new ForbiddenException('Only the timekeeper can submit this entry');
    }

    if (entry.status === 'SUBMITTED' || entry.status === 'APPROVED') {
      return entry;
    }

    if (entry.status === 'INVOICED') {
      throw new BadRequestException('Invoiced time entries cannot be submitted');
    }

    const submitted = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: { status: 'SUBMITTED' },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TIME_ENTRY_UPDATED, {
      entityId: entryId,
      action: 'submitted',
    });

    return submitted;
  }

  async reject(tenantId: string, entryId: string, approverRole?: string) {
    const entry = await this.findOne(tenantId, entryId);

    if (entry.status === 'REJECTED') {
      return entry;
    }

    if (entry.status === 'INVOICED') {
      throw new BadRequestException('Invoiced time entries cannot be rejected');
    }

    const allowedRoles = TIME_APPROVER_ROLES;
    if (approverRole && !allowedRoles.has(approverRole)) {
      throw new ForbiddenException('Insufficient permissions to reject time entries');
    }

    const rejected = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: { status: 'REJECTED' },
      include: { matter: true },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.TIME_ENTRY_UPDATED, {
      entityId: entryId,
      action: 'rejected',
    });

    return rejected;
  }

  getActiveTimer(tenantId: string, userId: string) {
    return this.activeTimers.get(this.timerKey(tenantId, userId)) ?? null;
  }

  async startTimer(tenantId: string, userId: string, matterId: string) {
    if (!matterId) {
      throw new BadRequestException('matterId is required to start a timer');
    }

    await this.ensureMatter(tenantId, matterId);
    const key = this.timerKey(tenantId, userId);
    const existing = this.activeTimers.get(key);
    if (existing) {
      throw new BadRequestException('An active timer already exists for this user');
    }

    const timer: ActiveTimerSession = {
      id: `timer_${Date.now()}_${userId}`,
      tenantId,
      userId,
      matterId,
      startedAt: new Date().toISOString(),
      pausedAt: null,
      accumulatedMinutes: 0,
    };
    this.activeTimers.set(key, timer);
    return timer;
  }

  async stopTimer(tenantId: string, userId: string) {
    const key = this.timerKey(tenantId, userId);
    const timer = this.activeTimers.get(key);
    if (!timer) {
      throw new NotFoundException('No active timer found');
    }

    const elapsedMs = Math.max(0, Date.now() - new Date(timer.startedAt).getTime());
    const elapsedMinutes = Math.max(
      1,
      Math.round(elapsedMs / (1000 * 60)) + timer.accumulatedMinutes,
    );

    let rate: number | undefined;
    const resolved = await this.rateTables.resolveRateForUserId(tenantId, userId);
    if (resolved) rate = resolved.rate;

    await this.checkRetainerOnBillableEntry(
      tenantId,
      timer.matterId,
      true,
      elapsedMinutes,
      rate,
    );

    const entry = await this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId,
        matterId: timer.matterId,
        date: new Date(),
        minutes: elapsedMinutes,
        narrative: 'Timer entry',
        billable: true,
        rate: rate !== undefined ? new Prisma.Decimal(rate) : undefined,
        status: 'DRAFT',
      },
      include: { matter: true },
    });

    this.activeTimers.delete(key);

    return {
      entry,
      timer: null,
    };
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

  private async checkRetainerOnBillableEntry(
    tenantId: string,
    matterId: string | undefined,
    billable: boolean,
    minutes: number,
    rate?: number,
  ) {
    if (!billable || !matterId) {
      return;
    }

    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { retainerBalance: true },
    });

    if (matter?.retainerBalance == null) {
      return;
    }

    const balance = Number(matter.retainerBalance.toString());
    if (balance <= 0) {
      throw new BadRequestException(
        'Matter retainer is depleted; cannot add billable time',
      );
    }

    if (rate !== undefined) {
      const entryAmount = (minutes / 60) * rate;
      if (entryAmount > balance) {
        throw new BadRequestException(
          `Billable time amount (${entryAmount.toFixed(2)}) exceeds retainer balance (${balance.toFixed(2)})`,
        );
      }
    }
  }

  private timerKey(tenantId: string, userId: string) {
    return `${tenantId}:${userId}`;
  }
}
