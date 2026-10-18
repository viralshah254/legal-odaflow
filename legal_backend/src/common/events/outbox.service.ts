import { Injectable } from '@nestjs/common';
import { OutboxEvent, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainEventBus } from './domain-event-bus';
import { DomainEvent } from './domain-event.types';

type PublishableEvent = Omit<DomainEvent, 'id' | 'occurredAt'>;

/**
 * OutboxService – writes domain events to the OutboxEvent table and emits them
 * in-process via DomainEventBus for immediate in-memory consumption.
 *
 * For transactional correctness, call `publishInTx` with the transaction client
 * so the event is persisted atomically with the aggregate change.
 * The outbox-publisher.scheduler picks up any events that were missed due to
 * process crashes or failed in-process emits.
 */
@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  /**
   * Publish a single domain event.
   * The OutboxEvent is written using the provided Prisma client (can be a
   * transaction client or the default PrismaService).
   * The event is also emitted in-process immediately.
   */
  async publish(
    prismaClient: Pick<PrismaService, 'outboxEvent'>,
    event: PublishableEvent,
  ): Promise<OutboxEvent> {
    const id = randomUUID();
    const occurredAt = new Date().toISOString();

    const record = await prismaClient.outboxEvent.create({
      data: {
        id,
        eventType: event.type,
        tenantId: event.tenantId,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: {
          ...event.payload,
          _meta: { occurredAt },
        } as Prisma.InputJsonValue,
        published: false,
      },
    });

    // Emit immediately in-process. The scheduler will re-emit if this fails.
    this.emitSafely({ ...event, id, occurredAt });

    return record;
  }

  /**
   * Publish a single event within an existing Prisma transaction.
   * Pass `tx` (the transaction client) as the first argument.
   */
  async publishInTx(
    tx: Prisma.TransactionClient,
    event: PublishableEvent,
  ): Promise<OutboxEvent> {
    const id = randomUUID();
    const occurredAt = new Date().toISOString();

    const record = await tx.outboxEvent.create({
      data: {
        id,
        eventType: event.type,
        tenantId: event.tenantId,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: {
          ...event.payload,
          _meta: { occurredAt },
        } as Prisma.InputJsonValue,
        published: false,
      },
    });

    this.emitSafely({ ...event, id, occurredAt });

    return record;
  }

  /**
   * Batch-publish multiple events.
   * All events share the same Prisma client for atomicity when a tx client is supplied.
   */
  async publishMany(
    prismaClient: Pick<PrismaService, 'outboxEvent'>,
    events: PublishableEvent[],
  ): Promise<OutboxEvent[]> {
    const results: OutboxEvent[] = [];
    for (const event of events) {
      const record = await this.publish(prismaClient, event);
      results.push(record);
    }
    return results;
  }

  /**
   * Mark a batch of OutboxEvents as published.
   * Called by the outbox-publisher.scheduler after successful relay.
   */
  async markPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { published: true, publishedAt: new Date() },
    });
  }

  private emitSafely(event: DomainEvent): void {
    try {
      this.eventBus.emit(event);
    } catch {
      // Swallow in-process emit errors; the scheduler will ensure delivery.
    }
  }
}
