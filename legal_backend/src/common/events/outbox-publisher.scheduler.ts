import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainEventBus } from './domain-event-bus';
import { DomainEvent, DomainEventType } from './domain-event.types';

const BATCH_SIZE = 50;

/**
 * OutboxPublisherScheduler
 *
 * Runs every 5 seconds to relay any unpublished OutboxEvent rows that were
 * persisted but not yet emitted in-process (e.g., due to a crash or failed emit).
 * This provides at-least-once delivery semantics for domain events.
 */
function isMissingOutboxTableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2021';
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('OutboxEvent') && message.includes('does not exist');
}

@Injectable()
export class OutboxPublisherScheduler {
  private readonly logger = new Logger(OutboxPublisherScheduler.name);
  private running = false;
  private outboxUnavailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  @Cron('*/5 * * * * *')
  async publishPendingEvents(): Promise<void> {
    if (this.outboxUnavailable) return;

    // Prevent overlapping runs if the batch takes longer than 5 s
    if (this.running) return;
    this.running = true;

    try {
      const unpublished = await this.prisma.outboxEvent.findMany({
        where: { published: false },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (unpublished.length === 0) return;

      const published: string[] = [];

      for (const record of unpublished) {
        try {
          const payload = record.payload as Record<string, unknown>;
          const meta = (payload._meta ?? {}) as Record<string, unknown>;

          const event: DomainEvent = {
            id: record.id,
            type: record.eventType as DomainEventType,
            tenantId: record.tenantId,
            aggregateId: record.aggregateId,
            aggregateType: record.aggregateType,
            occurredAt: typeof meta.occurredAt === 'string' ? meta.occurredAt : record.createdAt.toISOString(),
            payload,
          };

          this.eventBus.emit(event);
          published.push(record.id);
        } catch (err) {
          this.logger.warn(
            `Failed to re-emit outbox event ${record.id} (${record.eventType}): ${(err as Error).message}`,
          );
          // Increment retry count; don't mark as published so it is retried
          await this.prisma.outboxEvent.update({
            where: { id: record.id },
            data: { retryCount: { increment: 1 } },
          }).catch(() => undefined);
        }
      }

      if (published.length > 0) {
        await this.prisma.outboxEvent.updateMany({
          where: { id: { in: published } },
          data: { published: true, publishedAt: new Date() },
        });

        this.logger.debug(`OutboxPublisher: emitted ${published.length} event(s)`);
      }
    } catch (err) {
      if (isMissingOutboxTableError(err)) {
        this.outboxUnavailable = true;
        this.logger.warn(
          'OutboxEvent table is missing — outbox relay disabled until the database schema is migrated (run: npx prisma db push or prisma migrate deploy).',
        );
        return;
      }

      this.logger.error(`OutboxPublisher batch failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
