import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { PrismaService } from '@/prisma/prisma.service';

const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class CreditReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AICreditLedgerService,
    private readonly configService: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_CREDIT_RESERVATIONS', 'false') === 'true';
  }

  async reserve(params: {
    userId?: string;
    tenantId?: string;
    taskType: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const credits = getCreditCost(params.taskType);
    await this.ledger.assertSufficientBalance({
      userId: params.userId,
      tenantId: params.tenantId,
      taskType: params.taskType,
    });

    const ttlMs = Number(
      this.configService.get<string>('CREDIT_RESERVATION_TTL_MS', String(DEFAULT_RESERVATION_TTL_MS)),
    );

    return this.prisma.creditReservation.create({
      data: {
        userId: params.userId,
        tenantId: params.tenantId,
        taskType: params.taskType,
        credits,
        status: 'HELD',
        expiresAt: new Date(Date.now() + ttlMs),
        metadata: params.metadata,
      },
    });
  }

  async release(reservationId: string) {
    const reservation = await this.findHeldReservation(reservationId);

    const debit = await this.ledger.assertAndDebit({
      userId: reservation.userId ?? undefined,
      tenantId: reservation.tenantId ?? undefined,
      taskType: reservation.taskType,
      metadata: reservation.metadata ?? undefined,
    });

    await this.prisma.creditReservation.update({
      where: { id: reservationId },
      data: { status: 'CONSUMED' },
    });

    return { reservation, debit };
  }

  async refund(reservationId: string) {
    const reservation = await this.findHeldReservation(reservationId);

    await this.prisma.creditReservation.update({
      where: { id: reservationId },
      data: { status: 'REFUNDED' },
    });

    return reservation;
  }

  private async findHeldReservation(reservationId: string) {
    const reservation = await this.prisma.creditReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Credit reservation not found');
    }

    if (reservation.status !== 'HELD') {
      throw new ForbiddenException(`Reservation is ${reservation.status}, expected HELD`);
    }

    if (reservation.expiresAt.getTime() < Date.now()) {
      await this.prisma.creditReservation.update({
        where: { id: reservationId },
        data: { status: 'EXPIRED' },
      });
      throw new ForbiddenException('Credit reservation expired');
    }

    return reservation;
  }
}
